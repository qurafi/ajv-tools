export const User = {
    type: "object",
    properties: {
        foo: { type: "number" },
    },
};

export const RefUser = {
    // same file reference
    $ref: "#User",
};
