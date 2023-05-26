import Ajv from "ajv";
import secureMetaSchema from "ajv/lib/refs/json-schema-secure.json";
import { logger } from "./ajv";
import { blue, bold, red } from "kleur/colors";

// to prevent ReDos attack we will validate all schemas using this meta-schema
// any insecure schemas will have allErrors disabled
// so custom error message will not work
// https://ajv.js.org/security.html#security-risks-of-trusted-schemas
const ajv = new Ajv({ strictTypes: false, allErrors: true });
export const isSchemaSecure = ajv.compile(secureMetaSchema);

export function warnAboutInsecure(file: string, export_name: string) {
    const source = `${bold(file)}:${blue(export_name)}`;
    const context = Ajv.prototype.errorsText.call(null, isSchemaSecure.errors);

    logger.log("");
    logger.warn(`${source} ${red("is not secure")}.`);
    logger.log(bold("context:"), context);
    logger.log(red("NOTE:"), "allErrors option will be disabled for this schema");
    logger.log(
        `See ${bold("https://ajv.js.org/security.html#redos-attack")} for more context.`
    );
}
