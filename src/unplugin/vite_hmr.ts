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

            // sometimes vite does not update the whole graph of $schemas?t=all so we need to make sure
            const tall = `\0$schemas?t=`;

            for (const mod of idToModuleMap.keys()) {
                if (mod.startsWith(file_prefix) || mod.startsWith(tall)) {
                    const module = server.moduleGraph.getModuleById(mod);
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
