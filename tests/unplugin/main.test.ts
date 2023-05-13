import { describe, expect, it } from "vitest";
import { setupVite } from "./helpers";

describe("importing schemas", async () => {
    const { server } = await setupVite({ fixture: "vite-simple-app" });

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

    it("should import raw schema when adding ?raw query by file", async () => {
        const module = await server.ssrLoadModule("$schemas/schemas/default_export?raw");
        const schemas = module.default;
        expect(schemas).toEqual({
            default: { type: "string" },
            named: { type: "number" },
        });
    });

    it("should import raw schema when adding ?raw&instance=server query by file", async () => {
        const module = await server.ssrLoadModule(
            "$schemas/schemas/default_export?raw&instance=server"
        );
        const original = {
            ...(await import("../fixtures/vite-simple-app/src/schemas/default_export")),
        };
        // we didn't mutate the schema when resolving it in the builder and the source schema is technically the resolved one
        expect(module.default).toEqual(original);
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
});
