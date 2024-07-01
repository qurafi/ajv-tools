export default {
	$$meta: {
		options: {
			allErrors: false,
		},
	},
	type: "object",
	$id: "c",
	properties: {
		b: { type: "boolean" },
		a: { $ref: "a" },
		c: { type: "number" },
	},
	required: ["a", "b", "c"],
};
