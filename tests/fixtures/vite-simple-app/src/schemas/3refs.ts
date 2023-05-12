export const a = {
    $$meta: {
        options: {
            allErrors: false,
        },
    },
    $id: "3refs",
    type: "object",
    properties: {
        a: { $ref: "a" },
        b: { $ref: "b" },
        c: {
            type: "object",
            properties: {
                foo: { type: "number" },
                bar: { type: "string" },
            },
        },
    },
    required: ["a", "b", "c"],
    additionalProperties: false,
};
