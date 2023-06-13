import { describe, expect, it } from "vitest";

import { setupVite } from "./helpers";
import { ValidateFunction } from "ajv";

describe("handling schema options", async () => {
    const { server } = await setupVite({ fixture: "vite-simple-app" });

    async function testErrors(single: boolean, mod?: string) {
        const schema = mod ?? single ? "single_error" : "multiple_errors";
        const m = await server.ssrLoadModule(`$schemas/schemas/${schema}`);
        console.log({ schema, m });
        const validate = m.default;

        // invalid data
        const data = {
            a: {
                foo: "1",
                bar: 1,
            },
            b: 1,
            c: true,
        };
        validate!(data);

        console.log(data, validate.errors);
        expect(validate.errors?.length >= (single ? 1 : 2)).toBe(true);
    }

    it("test allErrors=false option", async () => {
        await testErrors(true);
    });

    it("test allErrors=true option", async () => {
        await testErrors(false);
    });

    it("test allErrors with default option", async () => {
        await testErrors(true, "default_errors");
    });

    // type coercions
    function testCoercion(validate: ValidateFunction, coerce: boolean) {
        const data = {
            a: "12",
            b: 12,
        };

        const valid = validate(data);
        expect(valid).toBe(coerce);

        expect((validate.errors?.length ?? 0) >= (coerce ? 0 : 1)).toBe(true);

        expect(data.a).toBeTypeOf(coerce ? "number" : "string");
        expect(data.b).toBeTypeOf(coerce ? "string" : "number");
    }

    it("test coerceTypes: multiple options in the same file", async () => {
        const m = await server.ssrLoadModule(`$schemas/schemas/coerceTypes_0`);
        testCoercion(m.coerce, true);
        testCoercion(m.a_no_coerce, false);
        testCoercion(m.defaults, true);
        //TODO client build with no coercing?
    });

    it.todo("test coerceTypes default", async () => {
        const m = await server.ssrLoadModule(`$schemas/schemas/coerceTypes_1`);
        testCoercion(m.defaults, true);
    });

    //TODO
    it.todo("test removeAdditional");

    //TODO
    it.todo("test useDefaults");
});
