import Ajv from "ajv";
import generateAjvStandaloneCode from "ajv/dist/standalone/index.js";
import { red, yellow } from "kleur/colors";
import { createDebug, removeSchemaFileExt } from "../utils/index.js";
import type { Options as AjvOptions } from "ajv";

const debug = createDebug("files");

export interface AjvFilesStoreOptions {
    ajvInstances: Record<string, Ajv>;
    resolveModule(module: Record<string, unknown>, file: string): Record<string, any>;
    resolveSchema(schema: any): any;
}

export function createAjvFileStore(opts: AjvFilesStoreOptions) {
    const { ajvInstances: instances, resolveSchema, resolveModule } = opts;

    const id_key = "$id";

    const files: Partial<Record<string, Map<string, any>>> = {};

    function getFileSchemas(file: string) {
        return files[removeSchemaFileExt(file)];
    }

    function forEachInstance(cb: (value: [string, Ajv]) => void) {
        return Object.entries(instances).forEach(cb);
    }

    function addSchema(schema: any, ref?: string) {
        return forEachInstance(([, ajv]) => ajv.addSchema(schema, ref));
    }

    function removeSchema(schema: any) {
        return forEachInstance(([, ajv]) => ajv.removeSchema(schema));
    }

    function removeFileSchemas(file: string) {
        const file_schemas = getFileSchemas(file);

        if (!file_schemas) {
            return;
        }

        debug("removeFileSchemas", { file, file_schemas });

        for (const [ref, schema] of file_schemas.entries()) {
            if (schema[id_key] != undefined) {
                removeSchema(schema[id_key]);
            }

            removeSchema(resolveSchemaRef(file, ref));
        }

        file_schemas.clear();
    }

    async function loadFileSchemas(file: string, module: Record<string, unknown>) {
        debug("loading file schemas: %o", { file, module });

        const schemas = await resolveModule(module, file);
        const schemas_entries = Object.entries(schemas);
        debug({ schemas, schemas_entries });

        debug({ schemas_entries });

        if (schemas_entries.length === 0) {
            console.log(yellow(`Warning: ${file}: does not export any schema`));
        }

        removeFileSchemas(file);

        const file_schemas = (files[removeSchemaFileExt(file)] ??= new Map());

        for (const [export_name, raw_schema] of schemas_entries) {
            const schema = await resolveSchema(raw_schema);
            debug("resolved schema", schema);

            if (schema == undefined) {
                continue;
            }

            if (typeof schema != "object") {
                // idk why ajv allows boolean as schemas?
                throw new TypeError("Schema must be object");
            }

            const ref = resolveSchemaRef(file, export_name);

            debug("adding a schema:", { schema, ref });

            addSchema(schema, ref);
            file_schemas.set(export_name, schema);
        }
    }

    function getSchemaFileCode(instance: keyof typeof instances, file: string) {
        const ajv = instances[instance];
        if (!ajv) {
            throw Error(`Could not find ajv instance "${instance}"`);
        }

        const file_schemas = getFileSchemas(file);
        if (!file_schemas) {
            return;
        }

        const refs = Array.from(file_schemas, ([ref]) => {
            return [ref, resolveSchemaRef(file, ref)];
        });

        let code = generateAjvStandaloneCode(ajv, Object.fromEntries(refs));
        code = code.replace("export const default =", "export default");
        code = code.replace('"use strict";', "");

        return code;
    }

    return {
        instances,
        files,
        getSchemaFileCode,
        getFileSchemas,
        removeFileSchemas,
        loadFileSchemas,
        getSchemasWithId() {
            return Object.values(instances.server.schemas).filter((schema) => {
                return !schema?.meta && (schema?.schema as any)?.$id;
            });
        },
    };
}

export function resolveSchemaRef(file: string, ref: string) {
    return `file://${removeSchemaFileExt(file)}#${ref}`;
}

export const overridenAjvOptions: AjvOptions = {
    allErrors: false,
    code: {
        esm: true,
        source: true,
        optimize: 2,
    },
    logger: {
        error: (...args: any[]) => console.error(red("ajv error: "), ...args),
        warn: (...args: any[]) => console.warn(yellow("ajv warning: "), ...args),
        log: console.log,
    },
};

export const ajvOptionsServer: AjvOptions = {
    removeAdditional: true,
    useDefaults: true,
    coerceTypes: true,
};
