import type { Options as AjvOptions } from "ajv";
import rfdc from "rfdc";
import { transformCJS } from "../utils/code/cjs_to_esm.js";
import {
	type MaybePromise,
	createDebug,
	isObject,
	logger,
	removeSchemaFileExt,
} from "../utils/index.js";
import { type AjvCompileOptions, schema_opts } from "./ajv_options.js";
import {
	type Ajv,
	addAjvErrors,
	addAjvFormats,
	addAjvKeywords,
	generateAjvStandaloneCode,
} from "./deps.js";
import { checkForSchemaSecurity } from "./is_schema_secure.js";

const clone = rfdc();

const debug = createDebug("files");

export type ResolveModule = (
	module: Record<string, unknown>,
	file: string,
) => MaybePromise<Record<string, any> | false | undefined>;

/**
 * Called after {@linkcode TransformSchema}
 *
 * Takes the schema after transformation and outputs JSON Schema
 *
 */
export type ResolveSchema = (
	schema: any,
	source: string,
	name: string,
) => MaybePromise<Record<string, any> | false | undefined>;

export type TransformCode = (
	code: string,
	instance: string,
) => MaybePromise<string | undefined>;

export interface AjvFilesStoreOptions {
	ajvInstances: Record<string, Ajv>;
	resolveModule?: ResolveModule;
	resolveSchema?: ResolveSchema;
	transformCode?: TransformCode;
}

export interface SchemaMeta {
	options: AjvCompileOptions;
	[key: string]: any;
}

export function createAjvFileStore(opts: AjvFilesStoreOptions) {
	const {
		ajvInstances: instances,
		resolveSchema = (schema) => schema,
		resolveModule = (mod) => mod,
		transformCode = (code) => code,
	} = opts;

	const id_key = "$id";

	const meta_prop = "$$meta";

	const files = new Map<string, Map<string, any>>();

	const instance_entries = Object.entries(instances);

	const default_instance = instance_entries[0]?.[1];
	if (!default_instance) {
		throw new Error("expecting at least one ajv instance");
	}

	function getFileSchemas(file: string) {
		return files.get(removeSchemaFileExt(file));
	}

	async function transformSchemaCode(
		code: string,
		instance: string,
		interop = false,
	) {
		const init_code = transformCJS(code, interop);
		return (await transformCode(init_code, instance)) ?? init_code;
	}

	// multiple instances so we can have different options for the server and the client
	// all schemas are stored in each instance
	function forEachInstance(cb: (value: [string, Ajv]) => void) {
		return instance_entries.forEach(cb);
	}

	function addSchema(schema: any, ref: string) {
		return forEachInstance(([, ajv]) => ajv.addSchema(schema, ref));
	}

	function removeSchema(ref: string) {
		return forEachInstance(([, ajv]) => ajv.removeSchema(ref));
	}

	function removeFileSchemas(file: string) {
		const file_schemas = getFileSchemas(file);

		if (!file_schemas) {
			return;
		}

		for (const [ref, schema] of file_schemas.entries()) {
			if (schema[id_key] !== undefined) {
				removeSchema(schema[id_key]);
			}

			removeSchema(resolveSchemaRef(file, ref));
		}

		files.delete(removeSchemaFileExt(file));
	}

	async function loadFileSchemas(
		file: string,
		module: Record<string, unknown>,
	) {
		const schemas = await resolveModule(module, file);
		if (schemas === false) {
			return; // skip
		}

		if (schemas && !isObject(schemas)) {
			throw new TypeError(`resolveModule of ${file} returned non object value`);
		}

		debug("loadFileSchemas", schemas);
		// biome-ignore lint/style/noNonNullAssertion: <explanation>
		const schemas_entries = Object.entries(schemas!);

		if (schemas_entries.length === 0) {
			logger.warn(`${file}: does not export any schema`);
		}

		removeFileSchemas(file);

		const file_schemas = new Map<string, any>();

		files.set(removeSchemaFileExt(file), file_schemas);

		for (const [export_name, raw_schema] of schemas_entries) {
			const schema = await resolveSchema(clone(raw_schema), file, export_name);

			if (!schema) {
				continue;
			}

			if (!isObject(schema)) {
				throw new TypeError(
					`Schema ${export_name} must be object, got ${typeof schema}`,
				);
			}

			const ref = resolveSchemaRef(file, export_name);

			const schema_clone = { ...schema };

			// see ajv_options.ts for context
			const meta = schema_clone[meta_prop];
			if (meta?.options) {
				schema_opts.set(schema_clone, meta.options);
			}

			// we don't want this in Ajv instance
			delete schema_clone[meta_prop];

			// store original
			schema[meta_prop] ??= {};
			schema[meta_prop].raw_schema = raw_schema;

			checkForSchemaSecurity(schema_clone, file, export_name);

			addSchema(schema_clone, ref);
			file_schemas.set(export_name, schema);
		}

		return [...file_schemas.entries()];
	}

	/** Generate validation code for all schemas in a file */
	function getSchemaFileCode(instance: string, file: string, interop = false) {
		const ajv = ensureInstance(instance);

		const file_schemas = getFileSchemas(file);
		if (!file_schemas) {
			return;
		}

		let export_schema_code = "";
		const seen = new Set<string>();

		const refs = Array.from(file_schemas, ([ref]) => {
			const ajv_key = resolveSchemaRef(file, ref);
			const fn = ajv.getSchema(ajv_key);
			const schemaInScope = fn?.source?.scopeValues.schema;
			if (schemaInScope) {
				for (const scope of schemaInScope) {
					if (scope.value?.ref === fn.schema) {
						seen.add(scope.str);
						export_schema_code += `\n${fn.name}.schema = ${scope.str};`;
					}
				}
			}
			return [ref, ajv_key];
		});

		const code = generateAjvStandaloneCode(ajv, Object.fromEntries(refs))
			.replace("export const default =", "export default")
			.replace('"use strict";', "");

		return transformSchemaCode(code + export_schema_code, instance, interop);
	}

	/** Generate a schema validation code */
	async function getSchemaCode(ref: string, instance: string, interop = false) {
		const ajv = ensureInstance(instance);
		const schema = ajv.getSchema(ref);
		if (!schema) {
			throw new Error(`schema with key or $id: ${ref} is not found`);
		}

		const code = generateAjvStandaloneCode(ajv, schema);
		return transformSchemaCode(code, instance, interop);
	}

	function getFileJsonSchemas(
		file: string,
		/** server=true, return a json schema with $$meta property for extra information
		 *
		 * server=false, return the json schema as stored in ajv(without $$meta prop)
		 */
		server = false,
	) {
		const file_schemas = getFileSchemas(file);
		if (!file_schemas) {
			return;
		}

		const schemas = [...file_schemas.entries()].map(([ref, schema]) => {
			if (server) {
				return [ref, schema];
			}
			const full_ref = resolveSchemaRef(file, ref);
			const ajv_schema = default_instance.getSchema(full_ref)?.schema;
			return [ref, ajv_schema];
		});

		return Object.fromEntries(schemas) as Record<string, any>;
	}

	function ensureInstance(instance: string) {
		const ajv = instances[instance];
		if (!ajv) {
			throw Error(`Could not find ajv instance "${instance}"`);
		}
		return ajv;
	}

	function getSchemasWithId() {
		return Object.values(default_instance.schemas).filter((schema) => {
			return !schema?.meta && (schema?.schema as any)?.$id;
		});
	}

	return {
		instances,
		files,
		getFileJsonSchemas,
		getSchemaFileCode,
		getSchemaCode,
		getFileSchemas,
		removeFileSchemas,
		loadFileSchemas,
		getSchemasWithId,
	};
}

export function initInstances(instances: Record<string, Ajv>) {
	for (const instance of Object.values(instances)) {
		addAjvFormats(instance, [
			"date-time",
			"time",
			"date",
			"email",
			"hostname",
			"ipv4",
			"ipv6",
			"uri",
			"uri-reference",
			"uuid",
			"uri-template",
			"json-pointer",
			"relative-json-pointer",
			"regex",
			"iso-date-time",
			"iso-time",
			"password", // not actual format but a hint for the UI
		]);

		addAjvKeywords(instance);

		addAjvErrors(instance);

		const not_supported = [
			"instanceof",
			"uniqueItemProperties",
			"dynamicDefaults",
		];

		for (const keyword of not_supported) {
			instance.removeKeyword(keyword);
		}
	}
}

export function resolveSchemaRef(file: string, ref: string) {
	return `file://${removeSchemaFileExt(file)}/${ref}.json`;
}

export const enforcedAjvOptions: AjvOptions = {
	code: {
		esm: true,
		source: true,
		optimize: 2,
		lines: true,
	},

	$data: true,

	logger: logger,
};

/** server options optimized for speed */
export const ajvOptionsServer: AjvOptions = {
	allErrors: true,
	removeAdditional: true,
	useDefaults: true,
	coerceTypes: true,
};

/** optimized for output size */
export const ajvOptionsClient: AjvOptions = {
	allErrors: true,
	removeAdditional: true,
	useDefaults: true,
	coerceTypes: true,
	inlineRefs: false,
	loopRequired: 4,
	loopEnum: 4,
};
