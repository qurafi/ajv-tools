import fs from "node:fs";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { editFile, poll, resolveFixturePath, setupVite } from "./helpers";

describe("vite hot reloading schemas", async () => {
	//TODO a separate fixtures path for hmr
	const fixtures_tmp = resolveFixturePath("tmp-vite-simple-app-hmr");
	const fixtures_src = resolveFixturePath("vite-simple-app");

	fs.rmSync(fixtures_tmp, { recursive: true, force: true });
	fs.cpSync(fixtures_src, fixtures_tmp, { recursive: true });

	const { server, src } = await setupVite({
		fixture: fixtures_tmp,
		viteOptions: {
			root: fixtures_tmp,
		},
	});

	afterAll(async () => {
		fs.rmSync(fixtures_tmp, { recursive: true, force: true });
		await server.close();
	});

	//TODO: broken test in Vite 5
	it.todo(
		"update module graph when a schema file is updated",
		{ timeout: 5200 },
		async () => {
			async function test_importer(changed = false) {
				const default_export = "schemas/default_export";
				const mod = await server.ssrLoadModule("./src/importer-all");
				const m = mod.default;
				const schemas = await m[default_export]?.();
				const named = changed ? "named_changed" : "named";
				const validate = schemas[named];

				expect(m).toHaveProperty(default_export);
				expect(schemas).toBeDefined();
				expect(Object.keys(schemas)).toEqual(["default", named]);
				expect(validate(1)).toBe(true);
				expect(validate("invalid")).toBe(false);
				expect(validate()).toBe(false);
			}

			await test_importer();

			await editFile(
				path.resolve(src, "./schemas/default_export.ts"),
				(content) => {
					return content.replace("named", "named_changed");
				},
			);

			await poll(30, 5000, async () => {
				const m = await server.ssrLoadModule("./src/importer");
				const changed = m.schemas.named_changed;
				return changed !== undefined;
			});

			await test_importer(true);
		},
	);

	it.todo(
		"should reload current schema modules when schema with global id changes",
	);
});
