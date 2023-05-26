export default {
    type: "object",
    required: ["foo", "bar"],
    allOf: [
        {
            properties: {
                foo: { type: "integer", minimum: 2 },
                bar: { type: "string", minLength: 2 },
            },
            additionalProperties: false,
        },
    ],
    errorMessage: {
        properties: {
            foo: "data.foo should be integer >= 2",
            bar: "data.bar should be string with length >= 2",
        },
    },
};
