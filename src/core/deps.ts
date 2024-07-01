import AjvMod from "ajv";
import AjvErrors from "ajv-errors";
import AjvFormats from "ajv-formats";
import AjvKeywords from "ajv-keywords";
import standalone from "ajv/dist/standalone/index.js";

export const generateAjvStandaloneCode = standalone.default;
export const addAjvFormats = AjvFormats.default;
export const addAjvKeywords = AjvKeywords.default;
export const addAjvErrors = AjvErrors.default;

export const Ajv = AjvMod.default;
export type Ajv = AjvMod.default;
