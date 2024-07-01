import path from "node:path";
import Ajv from "ajv";
import addFormat from "ajv-formats";
import standaloneCode from "ajv/dist/standalone";
import { type Plugin, createServer } from "vite";
import { expect, suite, test } from "vitest";
import { transformCJS } from "../src/utils/code/cjs_to_esm";

const example_schema = {
	$id: "id",
	$async: true, // will result in importing "ajv/dist/runtime/validation_error.js"
	type: "object",
	properties: {
		nested: {
			type: "number",
			minimum: 2,
		},
		email: {
			type: "string",
			format: "email",
			minLength: 1,
		},
		test: { type: "string", format: "uuid" },
		foo: { type: "string", format: "date-time" },
		time: { type: "string", format: "time" },
		binary: { type: "string", format: "binary" },
		url: { type: "string", format: "url" },
		double: { type: "string", format: "double" },
	},
};

const valid_import_id = "valid_import";
const invalid_import_id = "invalid_import";

function createAjvInstance() {
	const ajv = new Ajv({
		code: {
			source: true,
			esm: true,
			lines: true,
		},
		schemas: [example_schema],
	});
	addFormat(ajv);
	return ajv;
}

async function createAjvViteInstance() {
	const ajv = createAjvInstance();

	const testPlugin: Plugin = {
		name: "test",
		async load(id) {
			if (id === valid_import_id || id === invalid_import_id) {
				const code = standaloneCode(ajv, ajv.getSchema("id"));

				if (id === valid_import_id) {
					const transformed = transformCJS(code, true);
					return transformed;
				}

				return code;
			}
		},
	};

	const vite = await createServer({
		configFile: false,
		logLevel: "silent",
		root: path.resolve(__dirname, ".."),
		plugins: [testPlugin],
	});
	return { ajv, vite };
}

suite("transform ajv compiled code from commonjs to esm", async () => {
	test("transform match snapshot, interop = true", async () => {
		const ajv = createAjvInstance();

		const schema = ajv.getSchema("id");
		const code = transformCJS(standaloneCode(ajv, schema), true);
		expect(code).toMatchSnapshot(code);
	});

	test.todo("transform match snapshot, interop = false");

	test("transformed code should work correctly with vite esm imports", async () => {
		const { vite } = await createAjvViteInstance();

		const m = await vite.ssrLoadModule(valid_import_id);

		expect(
			m.default,
			"default export should be the validation function",
		).toBeTypeOf("function");

		expect(m.validate, "validate export should be a function").toBeTypeOf(
			"function",
		);
		await expect(m.validate({ email: "w" })).rejects.toThrow(
			/validation failed/,
		);
	});

	test("untransformed code should throw error", async () => {
		const { vite } = await createAjvViteInstance();
		const m = vite.ssrLoadModule(invalid_import_id);
		await expect(m).rejects.toThrow(/require is not defined/);
	});
});
