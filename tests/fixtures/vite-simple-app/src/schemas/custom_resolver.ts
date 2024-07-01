//  resolved module = default
export default {
	// custom resolveSchema will call this function
	schema: () => {
		return {
			type: "string",
		};
	},

	skipped_by_resolver: {},

	transformed_resolved: "transform_2_json_schema",
};

export const ignored = "my ignored export";
