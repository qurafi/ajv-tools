import Ajv from "ajv";
import { describe, expect, it } from "vitest";
import { createAjvFileStore, enforcedAjvOptions } from "../../src/core/ajv.js";

describe("compile errors", () => {
	it("errorMessage with insecure schema", async () => {
		const builder = createAjvFileStore({
			ajvInstances: {
				default: new Ajv(enforcedAjvOptions),
			},
		});

		const schema = {
			type: "object",
			properties: {
				a: { type: "string", format: "email" },
				b: { type: "string" },
			},

			required: ["a", "b"],
		};

		const promise = builder.loadFileSchemas("test", {
			test: schema,
		});

		const promise_error = builder.loadFileSchemas("test_err", {
			test: {
				...schema,
				errorMessage: {
					required: {
						a: "a is required",
					},
				},
			},
		});

		await expect(promise_error).rejects.toThrow();
		await expect(promise).resolves.toBeDefined();
	});
});
