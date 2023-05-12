export const defaults = {
    type: "object",
    properties: {
        a: { type: "number" },
        b: { type: "string" },
    },
};
export const coerce = {
    $$meta: {
        options: {
            coerceTypes: true,
        },
    },
    ...defaults,
};

export const a_no_coerce = {
    $$meta: {
        options: {
            coerceTypes: false,
        },
    },
    ...defaults,
};
