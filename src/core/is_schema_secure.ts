import Ajv from "ajv";
import { red } from "kleur/colors";
import { createRequire } from "node:module";
import { logger } from "../utils/index.js";
import { schema_opts } from "./ajv_options.js";

const secureMetaSchema = createRequire(__dirname)("ajv/lib/refs/json-schema-secure.json");

// to prevent ReDos attack we will validate all schemas using this meta-schema
// any insecure schemas will have allErrors disabled
// so custom error message will not work
// https://ajv.js.org/security.html#security-risks-of-trusted-schemas
const ajv = new Ajv({ strictTypes: false, allErrors: true });
export const isSchemaSecure = ajv.compile(secureMetaSchema);

let secure_warn_context: Record<string, any> = {};

export function warnAboutInsecure(file: string, export_name: string) {
    secure_warn_context[file] = {
        ...secure_warn_context[file],
        [export_name]: ajv.errorsText(isSchemaSecure.errors),
    };

    Promise.resolve().then(() => {
        if (!Object.keys(secure_warn_context).length) {
            return;
        }

        logger.log(
            red("\nSECURITY:"),
            `Some of the exported schemas are not secure:`,
            secure_warn_context
        );

        logger.warn("allErrors option will be disabled for this schema");

        secure_warn_context = {};
    });
}

export function checkForSchemaSecuriry(schema: any, file: string, export_name: string) {
    if (!isSchemaSecure(schema)) {
        warnAboutInsecure(file, export_name);

        const opts = schema_opts.get(schema) || {};
        opts.allErrors = false;
        schema_opts.set(schema, opts);

        JSON.stringify(schema, (key, v) => {
            if (key == "errorMessage") {
                throw new Error(
                    `${file}: custom error messages are not supported when the schema is not secure because allErrors option has to be disabled on insecure schemas`
                );
            }
            return v;
        });
    }
}
