import Ajv from "ajv";
import generateAjvStandaloneCode from "ajv/dist/standalone/index.js";
import { red, yellow } from "kleur/colors";
import { createDebug, removeSchemaFileExt } from "../utils/index.js";
import type { Options as AjvOptions } from "ajv";
import rfdc from "rfdc";
import addFormats from "ajv-formats";
import { AjvCompileOptions, schema_opts } from "./ajv_options.js";
import { transformCJS } from "../utils/code/cjs_to_esm.js";

const clone = rfdc();

const debug = createDebug("files");

export interface AjvFilesStoreOptions {
    ajvInstances: Record<string, Ajv>;
    resolveModule?(module: Record<string, unknown>, file: string): Record<string, any>;
    resolveSchema?(schema: any, source: string): any;
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
    } = opts;

    const id_key = "$id";

    const meta_prop = "$$meta";

    const files = new Map<string, Map<string, any>>();

    const instance_entries = Object.entries(instances);

    const default_instance = instance_entries[0]?.[1];
    if (!default_instance) {
        throw new Error("expecting at least on ajv instance");
    }

    function getFileSchemas(file: string) {
        return files.get(removeSchemaFileExt(file));
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
            if (schema[id_key] != undefined) {
                removeSchema(schema[id_key]);
            }

            removeSchema(resolveSchemaRef(file, ref));
        }

        files.delete(removeSchemaFileExt(file));
    }

    async function loadFileSchemas(file: string, module: Record<string, unknown>) {
        const schemas = await resolveModule(module, file);
        const schemas_entries = Object.entries(schemas);

        if (schemas_entries.length === 0) {
            console.log(yellow(`Warning: ${file}: does not export any schema`));
        }

        removeFileSchemas(file);

        const file_schemas = new Map<string, any>();

        files.set(removeSchemaFileExt(file), file_schemas);

        for (const [export_name, raw_schema] of schemas_entries) {
            const schema = await resolveSchema(clone(raw_schema), file);

            if (schema == undefined) {
                continue;
            }

            if (typeof schema != "object") {
                // idk why ajv allows boolean as schemas?
                throw new TypeError("Schema must be object");
            }

            const ref = resolveSchemaRef(file, export_name);

            const schema_clone = { ...schema };

            // see ajv_options.ts for context
            const meta = schema_clone[meta_prop];
            if (meta?.options) {
                schema_opts.set(schema_clone, meta.options);
            }

            delete schema_clone[meta_prop];

            addSchema(schema_clone, ref);
            file_schemas.set(export_name, schema);
        }

        return [...file_schemas.entries()];
    }

    /** Generate validation code for all schemas in a file */
    function getSchemaFileCode(instance: string, file: string) {
        const ajv = ensureInstance(instance);

        const file_schemas = getFileSchemas(file);
        if (!file_schemas) {
            return;
        }

        const refs = Array.from(file_schemas, ([ref]) => {
            return [ref, resolveSchemaRef(file, ref)];
        });

        const code = generateAjvStandaloneCode(ajv, Object.fromEntries(refs))
            .replace("export const default =", "export default")
            .replace('"use strict";', "");

        return transformCJS(code);
    }

    /** Generate a schema validation code */
    function getSchemaCode(ref: string, instance: string) {
        const ajv = ensureInstance(instance);
        const schema = ajv.getSchema(ref);
        if (!schema) {
            throw new Error(`schema with key or $id: ${ref} is not found`);
        }

        const code = generateAjvStandaloneCode(ajv, schema);
        return transformCJS(code);
    }

    /** Generate code represent all defined schema in a file */
    function getFileJsonSchemas(
        file: string,
        /** server=true, return a json schema with extra information($$meta)
         *
         * server=false, return the json schema as stored in ajv and without $$meta prop
         * to avoid leaking schema information to client
         */
        server = false
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

        return Object.fromEntries(schemas);
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
        addFormats(instance, [
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
            /** not actual format but a hint for the UI */
            "password",
        ]);
    }
}

export function resolveSchemaRef(file: string, ref: string) {
    return `file://${removeSchemaFileExt(file)}#${ref}`;
}

export const enforcedAjvOptions: AjvOptions = {
    code: {
        esm: true,
        source: true,
        optimize: 2,
        lines: true, // REMOVEME for dev mode only
    },

    logger: {
        // currently error is not used because strict=true
        error: (...args: any[]) => console.error(red("ajv error: "), ...args),
        warn: (...args: any[]) => console.log(yellow("ajv warning: "), ...args),
        log: console.log,
    },
};

/** server options optmized for speed */
export const ajvOptionsServer: AjvOptions = {
    allErrors: false,
    removeAdditional: true,
    useDefaults: true,
    coerceTypes: true,
};

/** optmized for size */
export const ajvOptionsClient: AjvOptions = {
    inlineRefs: false,
    allErrors: true,
    useDefaults: false,
    coerceTypes: false,
    loopRequired: 4,
    loopEnum: 4,
};
