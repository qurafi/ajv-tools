import { describe, expect, it } from "vitest";
import { editFile, poll, setupVite } from "./helpers";
import { HmrContext } from "vite";
import path from "path";

describe("vite hot reloading schemas", async () => {
    const { server, src } = await setupVite({});

    it.only("update module graph when a schema file is updated", async () => {
        async function test_importer(changed = false) {
            const default_export = "schemas/default_export";
            const m = (await server.ssrLoadModule("./src/importer-all")).default;
            expect(m).toHaveProperty(default_export);
            const schemas = await m[default_export];
            expect(schemas).toBeDefined();
            const named = changed ? "named_changed" : "named";
            expect(Object.keys(schemas)).toEqual(["default", named]);
            const validate = schemas[named];
            expect(validate(1)).toBe(true);
            expect(validate("invalid")).toBe(false);
            expect(validate()).toBe(false);
        }

        await test_importer();

        await editFile(path.resolve(src, "./schemas/default_export.ts"), (content) => {
            return content.replace("named", "named_changed");
        });

        await poll(30, 5000, async () => {
            const m = await server.ssrLoadModule("./src/importer");
            const changed = m.schemas.named_changed;
            if (changed) {
                return true;
            }
        });

        await test_importer(true);
    });

    it.todo("should reload current schema modules when schema global id changes");
});
