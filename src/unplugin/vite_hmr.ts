import type { ViteDevServer } from "vite";
import type { Plugin, SchemaBuilder } from "../core/index.js";
import { removeSchemaFileExt } from "../utils/index.js";

export default function viteHmrBuilderPlugin(server: ViteDevServer): Plugin {
	let schema_builder: SchemaBuilder;
	return {
		init(context) {
			schema_builder = context.builder;
		},
		onFile: async ({ relativePath, file: absolutePath, initial }) => {
			if (initial) {
				return;
			}
			const file = removeSchemaFileExt(relativePath);

			const modules = server.moduleGraph.getModulesByFile(absolutePath);
			for (const mod of modules ?? []) {
				server.reloadModule(mod);
			}

			const { idToModuleMap } = server.moduleGraph;
			const importers = idToModuleMap.get(absolutePath)?.importers;

			for (const mod of importers ?? []) {
				if (mod.file && schema_builder.isSchemaFile(mod.file)) {
					server.watcher.emit("change", mod.file);
				}
			}

			// so we could support ?queries params
			const file_prefix = `\0$schemas/${file}`;

			// sometimes vite does not update the whole graph of $schemas?t=all so we need to make sure
			const tall = "\0$schemas?t=";

			for (const mod of idToModuleMap.keys()) {
				if (mod.startsWith(file_prefix) || mod.startsWith(tall)) {
					const module = server.moduleGraph.getModuleById(mod);
					if (module) {
						server.reloadModule(module);
					}
				}
			}

			//TODO reload by id
		},
	};
}
