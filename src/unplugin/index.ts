import { createUnplugin } from "unplugin";

const IMPORT_PREFIX = "$schemas";

interface PluginOptions {
    //
}

export default createUnplugin((opts: PluginOptions) => {
    return {
        name: "unplugin-ajv",
        resolveId(id, importer, options) {
            console.log(id, importer, options);
            return id;
        },
    };
});
