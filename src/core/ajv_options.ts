import {
    default as Ajv,
    type Options as AjvOptions,
    type InstanceOptions as AjvInstanceOptions,
} from "ajv";
import { createRequire } from "module";
import { SchemaEnv } from "ajv/dist/compile";
import { type compileSchema } from "ajv/dist/compile/index.js";

export type AjvCompileOptions = Pick<
    AjvOptions,
    | "allErrors"
    | "coerceTypes"
    | "inlineRefs"
    | "loopEnum"
    | "loopRequired"
    | "useDefaults"
    | "removeAdditional"
    | "ownProperties"
    | "messages"
>;

const compile_index = createRequire(import.meta.url)("ajv/dist/compile/index.js");

const compile_schema = compile_index.compileSchema;
const instance_opts = new WeakMap<Ajv, AjvInstanceOptions>();
export const schema_opts = new WeakMap();

// THIS is temporarily solution for now to support different options on each schema for ajv
// this is still don't get called with $ref schemas
// the references schema will inherit the parent schema options for now.
const patchedCompileSchema: typeof compileSchema = function (this: Ajv, sch: SchemaEnv) {
    const opts = typeof sch.schema == "object" && schema_opts.get(sch.schema);
    if (opts) {
        if (!instance_opts.has(this)) {
            instance_opts.set(this, this.opts);
        }

        this.opts = { ...this.opts, ...opts, inlineRefs: false };

        try {
            return compile_schema.call(this, sch);
        } finally {
            //@ts-expect-error we already defined it before
            this.opts = instance_opts.get(this);
        }
    }

    return compile_schema.call(this, sch);
};

// overrides original compileSchema from ajv
compile_index.compileSchema = patchedCompileSchema;

export function addWithOptions(ajv: Ajv, schema: any, opts: AjvCompileOptions) {
    if (opts) {
        schema_opts.set(schema, opts);
    }
    return ajv.addSchema(schema);
}
