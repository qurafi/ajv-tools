export const test = {
	type: "object",
	properties: {
		a: { type: "string", format: "email" },
		b: { type: "string" },
	},

	required: ["a", "b"],
};
