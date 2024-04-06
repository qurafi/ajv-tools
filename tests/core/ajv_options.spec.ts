import Ajv, { type Options } from "ajv";
import { writeFileSync } from "node:fs";
import { expect, it, suite } from "vitest";
import { createAjvFileStore, enforcedAjvOptions } from "../../src/core/ajv";
import { resolve } from "node:path";
import standaloneCode from "ajv/dist/standalone";

suite("ajv options per schema", async () => {
    const ajv = new Ajv({
        ...enforcedAjvOptions,
        allErrors: false,
        inlineRefs: false,
        code: { ...enforcedAjvOptions.code, lines: true },
    });

    const store = createAjvFileStore({
        ajvInstances: { default: ajv },
    });

    const promises = Object.entries(modules).map(([file, module]) => {
        return store.loadFileSchemas(file, module);
    });
    await Promise.all(promises);

    it("should respect individual schema options: allErrors", () => {
        const single_errors = ajv.getSchema("file://s/errors/single_error.json");
        const multiple_errors = ajv.getSchema("file://s/errors/multiple_errors.json");
        const default_error = ajv.getSchema("file://s/errors/default.json");
        expect(single_errors).toBeTypeOf("function");
        const invalid_data = {
            a: null,
            b: null,
        };
        single_errors!(invalid_data);
        multiple_errors!(invalid_data);
        default_error!(invalid_data);
        expect(single_errors?.errors).toHaveLength(1);
        expect(default_error?.errors).toHaveLength(1);
        expect(multiple_errors?.errors).toHaveLength(2);
    });

    it("should respect individual schema options: coerceTypes", async () => {
        const schemas_entries = ["a", "b", "c", "d"].map((v) => {
            return [v, ajv.getSchema(`file://s/coerceTypes/${v}.json`)];
        });
        const schemas = Object.fromEntries(schemas_entries);

        const data_a = { a: 1 };
        schemas.a(data_a);
        expect(data_a.a).toBeTypeOf("string");

        const data_b = { a: 1 };
        schemas.b(data_b);
        expect(schemas.b.errors?.[0]?.keyword).toBe("type");
        expect(data_b.a).toBeTypeOf("number");

        const data_c = { a: 1 };
        schemas.c(data_c);
        expect(data_c.a).toBeTypeOf("string");

        const data_d = { a: 1 };
        schemas.d(data_d);
        expect(schemas.d.errors?.[0]?.keyword).toBe("type");
        expect(data_d.a).toBeTypeOf("number");
    });

    //TODO
    it.todo("errors should not conflicts when reference other schema", async () => {
        const ref2a = ajv.getSchema("file://s/ref2a/default.json");

        const code = standaloneCode(ajv, ref2a);
        const tmp_path = resolve(__dirname, `./ref2a.tmp.js`);

        writeFileSync(tmp_path, code!);

        const module = await import(tmp_path);
        const validate = module.validate;

        validate!({
            a: {
                foo: "string",
                bar: 1,
            },
            b: 1,
            c: true,
        });
    });
});

const modules = {
    "s/errors": {
        single_error: {
            type: "object",
            properties: {
                a: { type: "number" },
                b: { type: "string" },
            },
        },
        multiple_errors: {
            $$meta: {
                options: {
                    allErrors: true,
                },
            },
            $id: "all_errors",
            type: "object",
            properties: {
                a: { type: "number" },
                b: { type: "string" },
            },
        },
        // allErrors=false by default
        default: {
            type: "object",
            properties: {
                a: { type: "number" },
                b: { type: "string" },
            },
        },
    },
    "s/coerceTypes": {
        a: {
            $$meta: {
                options: {
                    coerceTypes: true,
                } as Options,
            },
            type: "object",
            properties: {
                a: { type: "string" },
            },
        },
        b: {
            $$meta: {
                options: {
                    coerceTypes: false,
                } as Options,
            },
            type: "object",
            properties: {
                a: { type: "string" },
            },
        },
        c: {
            $$meta: {
                options: {
                    coerceTypes: true,
                } as Options,
            },
            type: "object",
            properties: {
                a: { type: "string" },
            },
        },
        d: {
            type: "object",
            properties: {
                a: { type: "string" },
            },
        },
    },
    "s/a": {
        a: {
            $$meta: {
                options: {
                    allErrors: true,
                },
            },
            $id: "a",
            type: "object",
            properties: {
                foo: { type: "number" },
                bar: { type: "string" },
            },
        },
    },
    "s/ref2a": {
        default: {
            $$meta: {
                options: {
                    allErrors: false,
                } as Options,
            },
            type: "object",
            $id: "c",
            properties: {
                b: { type: "boolean" },
                a: { $ref: "a" },
                c: { type: "number" },
            },
        },
    },
};
