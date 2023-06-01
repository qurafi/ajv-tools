import { ViteDevServer } from "vite";
import { Plugin, SchemaBuilder } from "../core";
import { removeSchemaFileExt } from "../utils";

export default function builderHmrVitePlugin(server: ViteDevServer): Plugin {
    let schema_builder: SchemaBuilder;
    return {
        init(context) {
            schema_builder = context.builder;
        },
        onFile: async ({ relativePath, file: absolutePath, initial }) => {
            if (initial) {
                return;
            }

            const modules_to_reload: Promise<void>[] = [];
            const file = removeSchemaFileExt(relativePath);
            const { idToModuleMap } = server.moduleGraph;
            const importers = idToModuleMap.get(absolutePath)?.importers;

            importers?.forEach((mod) => {
                if (mod.file && schema_builder.isSchemaFile(mod.file)) {
                    server.watcher.emit("change", mod.file);
                }
            });

            // so we could support ?queries params
            const file_prefix = `\0$schemas/${file}`;

            for (const id of idToModuleMap.keys()) {
                if (id.startsWith(file_prefix)) {
                    console.log(id);
                    const module = server.moduleGraph.getModuleById(id);
                    if (module) {
                        modules_to_reload.push(server.reloadModule(module));
                    }
                }
            }

            await Promise.all(modules_to_reload);

            //TODO reload by id
        },
    };
}
