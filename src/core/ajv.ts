import Ajv from "ajv";
import generateAjvStandaloneCode from "ajv/dist/standalone/index.js";
import { red, yellow } from "kleur/colors";
import { createDebug, removeSchemaFileExt } from "../utils/index.js";
import type { Options as AjvOptions } from "ajv";
import rfdc from "rfdc";

const clone = rfdc();

const debug = createDebug("files");

export interface AjvFilesStoreOptions {
    ajvInstances: Record<string, Ajv>;
    resolveModule(module: Record<string, unknown>, file: string): Record<string, any>;
    resolveSchema(schema: any, source: string): any;
}

export interface SchemaOption {
    [key: string]: any;
}

export function createAjvFileStore(opts: AjvFilesStoreOptions) {
    const { ajvInstances: instances, resolveSchema, resolveModule } = opts;

    const id_key = "$id";

    const options_prop = "$$options";

    const files = new Map<string, Map<string, any>>();

    function getFileSchemas(file: string) {
        return files.get(removeSchemaFileExt(file));
    }

    // function getSchemaOptions();

    function forEachInstance(cb: (value: [string, Ajv]) => void) {
        return Object.entries(instances).forEach(cb);
    }

    function addSchema(schema: any, ref: string) {
        // options.set(ref, schema[options_prop]);
        // delete schema[options_prop];
        return forEachInstance(([, ajv]) => ajv.addSchema(schema, ref));
    }

    function removeSchema(ref: string) {
        // options.delete(ref);
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

        const file_schemas = new Map();

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

            // // we don't need deep clone. just to allow schema to have options because ajv throw errors on unknown keywords
            const schema_clone = { ...schema };
            delete schema_clone[options_prop];
            addSchema(schema_clone, ref);
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
