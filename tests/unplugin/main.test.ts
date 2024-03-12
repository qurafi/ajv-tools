import { afterAll, describe, expect, it } from "vitest";
import { setupVite } from "./helpers";
import puppeteer from "puppeteer";
import { type ErrorObject } from "ajv";

describe("importing schemas", async () => {
    const global_schemas = [
        {
            $id: "http://api.example.com/Message",
            type: "object",
            properties: {
                content: { type: "string" },
                created_at: { type: "number" },
                user: { $ref: "http://api.example.com/User" },
            },
        },
        {
            $id: "http://api.example.com/User",
            type: "object",
            properties: {
                id: { type: "number" },
                created_at: { type: "number" },
                full_name: { type: "string" },
                username: { type: "string" },
            },
        },
    ];

    const { server } = await setupVite({
        listenPort: 5174,
        fixture: "vite-simple-app",
        pluginOptions: {
            // exclude: [],
            ajvOptions: {
                all: {
                    schemas: [global_schemas],
                },
            },
        },
    });

    const url = server.resolvedUrls?.local?.[0] as string;

    it("should import a single schema by id", async () => {
        const module = await server.ssrLoadModule("$schemas:global_id");
        expect(module.validate).toStrictEqual(module.default);
        expect(module.validate).toBeTypeOf("function");
        expect(module.validate("test")).toBe(true);
        expect(module.validate({})).toBe(false);
        expect(module.validate()).toBe(false);
    });

    it("should throw error on non existing schemas", async () => {
        const module = server.ssrLoadModule("$schemas:non_existing");
        await expect(module).rejects.toThrow();
    });

    it("should validate formats correctly", async () => {
        const module = await server.ssrLoadModule("$schemas:formats");
        expect(module.validate({})).toBe(false);
        expect(module.validate()).toBe(false);
        expect(module.validate({ email: "something@" })).toBe(false);
        expect(module.validate({ email: "example@email.com" })).toBe(true);
    });

    it.todo("should import all schemas with id", async () => {
        const module = await server.ssrLoadModule("$schemas?t=ids");
    });

    function validateDefaultExport(default_export: any) {
        const validate = default_export?.default;
        expect(Object.keys(default_export)).toEqual(["default", "named"]);
        expect(validate).toBeTypeOf("function");
        expect(validate("test")).toBe(true);
        expect(validate({})).toBe(false);
        expect(validate()).toBe(false);
    }

    it("should import by specific path", async () => {
        const module = await server.ssrLoadModule("$schemas/schemas/export_schema");
        const source = await server.ssrLoadModule("src/schemas/export_schema");
        for (const [name, fn] of Object.entries(module)) {
            const original = source[name];
            expect(fn.schema).toEqual(original);
        }
    });

    it("each validation function should have schema property", async () => {
        const module = await server.ssrLoadModule("$schemas/schemas/default_export");
        validateDefaultExport(module);
    });

    // ?raw query

    async function testServerJSONSchema(mod: any) {
        const original = {
            ...(await import("../fixtures/vite-simple-app/src/schemas/default_export")),
        } as any;

        const expected_schemas: Record<string, any> = {};
        for (const [name] of Object.entries(mod.default)) {
            const schema = original[name];
            expected_schemas[name] = {
                ...schema,
                $$meta: { ...schema.$$meta, raw_schema: schema },
            };
        }

        // we didn't mutate the schema when resolving it in the builder and the source schema is technically the resolved one
        expect(mod.default).toEqual(expected_schemas);
    }

    it("should import raw schema when adding ?raw with defaults query by file", async () => {
        const module = await server.ssrLoadModule("$schemas/schemas/default_export?raw");
        await testServerJSONSchema(module);
    });

    it("should import raw schema when adding ?raw&server query by file", async () => {
        const module = await server.ssrLoadModule(
            "$schemas/schemas/default_export?raw&server"
        );

        await testServerJSONSchema(module);
    });

    it("should import raw schema when adding ?raw&client query by file", async () => {
        const module = await server.ssrLoadModule(
            "$schemas/schemas/default_export?raw&client"
        );
        const schemas = module.default;
        expect(schemas).toEqual({
            default: { type: "string" },
            named: { type: "number" },
        });
    });

    //TODO move it to a separate test
    async function testClientBuilds(invalid: boolean) {
        const browser = await puppeteer.launch({
            headless: true,
        });

        const page = await browser.newPage();

        await page.goto(url + (invalid ? "index_invalid.html" : ""));

        const json = await page.$eval("body", (body) => body.textContent);
        expect(json).toBeDefined();
        expect((json?.trim().length ?? 0) > 2).toBe(!invalid);
        if (!invalid) {
            const schema = JSON.parse(json!);
            expect(schema).toEqual({
                default: { type: "string" },
                named: { type: "number" },
            });
        }
    }

    it("importing raw json schema should not have $$meta props", async () => {
        await testClientBuilds(false);
    });

    it("importing raw json schema with instance=server should throw error in client side", async () => {
        await testClientBuilds(true);
    });

    // ?t=all

    it("should import all schemas files", async () => {
        const module = await server.ssrLoadModule("$schemas?t=all");
        const default_export = await module.default?.["schemas/default_export"]?.();

        validateDefaultExport(default_export);
    });

    // invalid
    it("throw error when not specifying ?t= ", async () => {
        expect(server.ssrLoadModule("$schemas?t")).rejects.toThrow();
    });

    // ?code for raw code

    it("?code query for raw compiled schema", async () => {
        const module = await server.ssrLoadModule("$schemas/schemas/user?code");
        expect(module.default).toBeTypeOf("string");
    });

    it("raw code query should propagate when using ?t=all", async () => {
        const module = await server.ssrLoadModule("$schemas?t=all&code");
        const code = await module.default["schemas/user"]();
        expect(code).toBeTypeOf("string");
    });

    // external schemas

    it("should allow referencing external schemas added by schemas options", async () => {
        const m = "$schemas/schemas/ref_external";

        await expect(server.ssrLoadModule(m)).resolves.toBeDefined();
        await expect(server.ssrLoadModule(m + "?client")).resolves.toBeDefined();
    });

    it("should disable allErrors when the schema is not secure", async () => {
        const m = await server.ssrLoadModule("$schemas/schemas/insecure");
        // const code = await server.ssrLoadModule("$schemas/schemas/insecure?code");
        m.test({});
        expect(m.test.errors?.length).toBe(1);
    });

    it("should accept custom error messages", async () => {
        const m = await server.ssrLoadModule("$schemas/schemas/custom_error");
        const valid = m.default({ foo: 1, bar: "a" });
        const expected_errors = {
            foo: "data.foo should be integer >= 2",
            bar: "data.bar should be string with length >= 2",
        };

        const errors = m.default.errors as Array<ErrorObject>;
        expect(valid).toBe(false);
        expect(errors).toHaveLength(2);

        const expected = errors.filter((err) => {
            const prop = err.instancePath.slice(1);
            return (expected_errors as any)[prop] == err.message;
        });
        expect(expected).toHaveLength(2);
    });

    it("should work with typebox", async () => {
        await server.ssrLoadModule("$schemas/schemas/typebox");
    });

    it("test cjs interop  with 'ajv/dist/...length' import", async () => {
        await server.ssrLoadModule("$schemas/schemas/length");
    });

    it("custom resolver", async () => {
        const mod = await server.ssrLoadModule("$schemas/schemas/custom_resolver");
        expect(mod.default).toBe(undefined);
        expect(mod.schema).toBeDefined();
    });

    afterAll(async () => {
        await server.close();
    });
});
