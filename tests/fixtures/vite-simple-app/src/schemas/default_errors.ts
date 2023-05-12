export default {
    type: "object",
    properties: {
        foo: { type: "number" },
        bar: { type: "string" },
    },
    required: ["foo", "bar"],
    additionalProperties: false,
};
