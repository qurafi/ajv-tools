export default {
    $id: "formats",
    type: "object",
    properties: {
        email: { type: "string", format: "email" },
    },
    required: ["email"],
};
