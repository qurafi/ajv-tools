import { unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import Ajv from "ajv";
import { expect, it, suite } from "vitest";
import { createAjvFileStore, enforcedAjvOptions } from "../../src/core/ajv";
import { expectToMatchArray } from "../helpers";

suite("createAjvFileStore", () => {
	const modules = {
		"s/a.schema.js": {
			default: {},
			a: {
				$id: "a",
				type: "object",
				properties: {
					foo: { type: "string" },
				},
				required: ["foo"],
			},
			to_be_removed: {
				$id: "to_be_removed",
			},
		},
		"s/b.schema.js": {
			default: {},
			b: {}, // no id
		},
		"s/c.schema.js": {
			default: {
				$id: "c",
				type: "object",
				properties: {
					a: { $ref: "a" },
				},
				required: ["a"],
			},
		},
	};

	const ajv = new Ajv(enforcedAjvOptions);
	const resolved_symbol = Symbol("resolved");
	const resolved_files: string[] = [];

	const store = createAjvFileStore({
		ajvInstances: { default: ajv },
		resolveModule(module, file) {
			resolved_files.push(file);
			return module;
		},
		resolveSchema(schema) {
			schema[resolved_symbol] = true;
			return schema;
		},
	});

	Object.entries(modules).map(([file, module]) => {
		return store.loadFileSchemas(file, module);
	});

	it("should load all schemas", () => {
		expect(Object.entries(ajv.schemas).slice(1)).toMatchSnapshot();
	});

	it.todo("should remove old schemas when loading the same file");

	it.todo("should throw when adding multiple ids from different files");

	it("should use resolveModule", () => {
		expect(resolved_files).toStrictEqual(Object.keys(modules));
	});

	it.todo("should load all schemas", () => {
		const schemas = store.getFileSchemas("s/a.schema.js");
	});

	it("should validate correctly", () => {
		const schema_a = ajv.getSchema("a");
		expect(schema_a).toBeDefined();

		if (!schema_a) return;

		const valid_0 = schema_a({ foo: "correct" });

		expect(valid_0).toBe(true);
		expect(schema_a?.errors).toBe(null);

		const valid_1 = schema_a({});
		expect(valid_1).toBe(false);
		expect(schema_a?.errors).toMatchSnapshot();
	});

	it("should validate cross-file reference", () => {
		const schema_a = ajv.getSchema("c");
		expect(schema_a).toBeDefined();

		if (!schema_a) return;

		const valid_0 = schema_a({ a: { foo: "correct" } });
		expect(valid_0).toBe(true);
		expect(schema_a?.errors).toBe(null);

		const valid_1 = schema_a({ a: { foo: 1 } });
		expect(valid_1).toBe(false);
		expect(schema_a?.errors).toMatchSnapshot();

		const valid_2 = schema_a({ a: {} });
		expect(valid_2).toBe(false);
		expect(schema_a?.errors).toMatchSnapshot();
	});

	it("should resolve schema with resolveSchema", () => {
		const schema_a = ajv.getSchema("a");
		expect(schema_a).toBeDefined();

		// biome-ignore lint/style/noNonNullAssertion: <explanation>
		const { schema } = schema_a!;

		expect(typeof schema === "object" && resolved_symbol in schema).toBe(true);
	});

	it("getSchemaFileCode should return the code and validate correctly", async () => {
		const code = await store.getSchemaFileCode("default", "s/a.schema");
		expect(code).toBeDefined();

		const tmp_path = path.resolve(__dirname, `./schema.tmp.${Date.now()}.js`);

		if (code) writeFileSync(tmp_path, code);

		const module = await import(tmp_path);

		console.log({ module });

		const valid_0 = module.a({ foo: "correct" });

		expect(valid_0).toBe(true);
		expect(module.a?.errors).toBe(null);

		const valid_1 = module.a({});
		expect(valid_1).toBe(false);
		expect(module.a?.errors).toMatchSnapshot();

		expectToMatchArray(
			Object.keys(module),
			Object.keys(modules["s/a.schema.js"]),
		);

		unlinkSync(tmp_path);
	});

	it.todo("should be fine with cross-file reference with any order");
	it.todo("same file schema reference tests without id using file:// ref");
	it.todo("cross-file schema reference tests without id using file:// ref");
});
