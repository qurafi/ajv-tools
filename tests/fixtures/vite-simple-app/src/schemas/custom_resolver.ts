export default {
    // custom resolveSchema will call this function
    schema: () => {
        return {
            type: "string",
        };
    },
};

export const ignored = "my ignored export";
