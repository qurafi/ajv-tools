import { afterAll, describe, expect, it } from "vitest";
import { setupVite } from "./helpers";
import puppeteer from "puppeteer";

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
        fixture: "vite-simple-app",
        pluginOptions: {
            ajvOptions: {
                all: {
                    schemas: [global_schemas],
                },
            },
        },
    });

    await server.listen(5174);

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
        console.log(module);
    });

    it.todo("should import routes schemas", async () => {
        const module = await server.ssrLoadModule("$schemas?t=routes");
        console.log(module);
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
        const module = await server.ssrLoadModule("$schemas/schemas/default_export");
        validateDefaultExport(module);
    });

    async function testServerJSONSchema(mod: any) {
        const original = {
            ...(await import("../fixtures/vite-simple-app/src/schemas/default_export")),
        };
        // we didn't mutate the schema when resolving it in the builder and the source schema is technically the resolved one
        expect(mod.default).toEqual(original);
    }

    it("should import raw schema when adding ?raw with defaults query by file", async () => {
        const module = await server.ssrLoadModule("$schemas/schemas/default_export?raw");
        testServerJSONSchema(module);
    });

    it("should import raw schema when adding ?raw&server query by file", async () => {
        const module = await server.ssrLoadModule(
            "$schemas/schemas/default_export?raw&server"
        );

        testServerJSONSchema(module);
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

    async function testClientBuilds(invalid: boolean) {
        const browser = await puppeteer.launch({
            headless: "new",
        });

        const page = await browser.newPage();

        await page.goto(url + (invalid ? "index_invalid.html" : ""));

        const json = await page.$eval("body", (body) => body.textContent);

        console.log(await page.content());
        expect(json).toBeDefined();
        expect((json?.trim().length ?? 0) > 2).toBe(!invalid);
        if (!invalid) {
            const schema = JSON.parse(json!);
            console.log(schema);
            expect(schema).toEqual({
                default: { type: "string" },
                named: { type: "number" },
            });
        }
    }

    it("importing raw json schema shuold not have $$meta props", async () => {
        await testClientBuilds(false);
    });

    it("importing raw json schema with instance=server should throw error in client side", async () => {
        await testClientBuilds(true);
    });

    it("should import all schemas files", async () => {
        const module = await server.ssrLoadModule("$schemas?t=all");
        const default_export = await module.default?.["schemas/default_export"]?.();

        validateDefaultExport(default_export);
    });

    // invalid
    it("throw error when not specifying ?t= ", async () => {
        expect(server.ssrLoadModule("$schemas?t")).rejects.toThrow();
    });

    it("?code query for raw compiled schema", async () => {
        const module = await server.ssrLoadModule("$schemas/schemas/user?code");
        expect(module.default).toBeTypeOf("string");
    });

    it("raw code query should propagate when using ?t=all", async () => {
        const module = await server.ssrLoadModule("$schemas?t=all&code");
        const code = await module.default["schemas/user"]();
        expect(code).toBeTypeOf("string");
    });

    afterAll(async () => {
        await server.close();
    });
});
