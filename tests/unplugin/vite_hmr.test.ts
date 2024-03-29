import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { editFile, poll, resolveFixturePath, setupVite } from "./helpers";
import path from "path";
import fse from "fs-extra";

describe("vite hot reloading schemas", async () => {
    //TODO a seperate fixtures path for hmr
    const fixtures_tmp = resolveFixturePath("tmp-vite-simple-app-hmr");
    const fixtures_src = resolveFixturePath("vite-simple-app");

    const { server, src } = await setupVite({
        fixture: fixtures_tmp,
        viteOptions: {
            root: fixtures_tmp,
        },
    });

    beforeEach(async () => {
        await fse.remove(fixtures_tmp);
        await fse.copy(fixtures_src, fixtures_tmp);
    });

    afterAll(async () => {
        await fse.remove(fixtures_tmp);
    });

    it(
        "update module graph when a schema file is updated",
        async () => {
            async function test_importer(changed = false) {
                const default_export = "schemas/default_export";
                const m = (await server.ssrLoadModule("./src/importer-all")).default;
                expect(m).toHaveProperty(default_export);
                const schemas = await m[default_export]?.();
                expect(schemas).toBeDefined();
                const named = changed ? "named_changed" : "named";
                expect(Object.keys(schemas)).toEqual(["default", named]);
                const validate = schemas[named];
                expect(validate(1)).toBe(true);
                expect(validate("invalid")).toBe(false);
                expect(validate()).toBe(false);
            }

            await test_importer();

            await editFile(
                path.resolve(src, "./schemas/default_export.ts"),
                (content) => {
                    return content.replace("named", "named_changed");
                }
            );

            await poll(30, 5000, async () => {
                const m = await server.ssrLoadModule("./src/importer");
                const changed = m.schemas.named_changed;
                return changed !== undefined;
            });

            await test_importer(true);
        },
        { timeout: 5200, retry: 2 }
    );

    it.todo("should reload current schema modules when schema global id changes");
});
