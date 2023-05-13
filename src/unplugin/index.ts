import { createUnplugin } from "unplugin";
import { ViteDevServer } from "vite";
import {
    createSchemaBuilder,
    SchemaBuilder,
    SchemaBuilderOptions,
} from "../core/index.js";
import { generateDynamicImportsCode } from "../utils/code/generate_import_code.js";
import { createDebug, parseQueries, removeSchemaFileExt } from "../utils/index.js";
import { resolveSchemaRef } from "../core/ajv.js";

const IMPORT_PREFIX = "$schemas";

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface PluginOptions extends SchemaBuilderOptions {
    //TODO
}

const debug = createDebug("unplugin");

const debug_load = debug.extend("load");

export default createUnplugin((config: PluginOptions) => {
    config.baseDir ??= "src";

    debug("init", { config });

    let vite_server: ViteDevServer;

    let schema_builder: SchemaBuilder;
    let build_promise: Promise<any>;

    const resolved_prefix = "\0" + IMPORT_PREFIX;

    async function initSchemaBuilder() {
        schema_builder = await createSchemaBuilder({
            ...config,
            useDirectImport: true,
            moduleLoader(context) {
                const { files, defaultModuleLoader } = context;
                if (vite_server) {
                    return Object.fromEntries(
                        files.map((file) => {
                            return [file, vite_server.ssrLoadModule(file)];
                        })
                    );
                }
                return defaultModuleLoader(context);
            },
            onFile: async ({ relativePath }) => {
                if (!vite_server) {
                    return;
                }

                const file = removeSchemaFileExt(relativePath);

                // const module = vite_server.moduleGraph.getModuleById(
                //     `\0$schemas/${file}`
                // );

                // so we could support ?queries params
                const file_prefix = `\0$schemas/${file}`;

                const modules_to_reload: Promise<void>[] = [];

                for (const id of vite_server.moduleGraph.idToModuleMap.keys()) {
                    if (id.startsWith(file_prefix)) {
                        console.log(id);
                        const module = vite_server.moduleGraph.getModuleById(id);
                        if (module) {
                            modules_to_reload.push(vite_server.reloadModule(module));
                        }
                    }
                }

                if (module) {
                    await Promise.all(modules_to_reload);
                }

                //TODO reload by id
            },
        });

        build_promise = schema_builder.build();
        await build_promise;
    }

    function resolveId(id: string) {
        if (id.startsWith(IMPORT_PREFIX)) {
            return `\0${id}`;
        }
        return null;
    }

    return {
        name: "unplugin-ajv-tools",

        async buildStart() {
            debug("build start");
            await initSchemaBuilder();

            if (vite_server) {
                schema_builder.watch({ watcher: vite_server.watcher });
            }
        },

        resolveId,

        async load(raw_id) {
            if (raw_id.startsWith(resolved_prefix)) {
                await build_promise;

                const { queries, str: id } = parseQueries(raw_id);
                const schema_ref = id.slice(resolved_prefix.length);
                //TODO make default instance user configurable
                const instance_q = queries.get("instance");
                const instance = instance_q ?? "server";

                debug_load("loading", id, queries, schema_ref, instance, "\n");

                if (id == resolved_prefix && queries.get("t")) {
                    const t = queries.get("t");

                    switch (t) {
                        case "all": {
                            const { files } = schema_builder;
                            const code = generateDynamicImportsCode(
                                [...files.keys()],
                                (file) => `$schemas/${file}`
                            );
                            debug({ code });
                            return code;
                        }
                        // case "ids":
                        //TODO
                        // case "routes":
                        //     // all schema with defined in config.routes
                        default:
                            throw new Error(`${t} unkown option for t param`);
                    }
                }

                // schema by path
                if (schema_ref.startsWith("/")) {
                    const raw_schema = queries.has("raw");
                    const schema_path = removeSchemaFileExt(schema_ref.slice(1));
                    if (!schema_path) {
                        throw new Error("Schema path must be supplied");
                    }

                    // console.log({ raw_schema });
                    if (raw_schema) {
                        debug("raw schema");
                        const code = schema_builder.getFileJsonSchemasCode(
                            schema_path,
                            instance == "server"
                        );
                        if (!code) {
                            throw new Error(
                                `Could not find schema for file ${schema_path}`
                            );
                        }
                        return code;
                    }
                    const code = schema_builder.getSchemaFileCode("server", schema_path);
                    //TODO move error to original function
                    if (!code) {
                        throw new Error(`Could not find schema for file ${schema_path}`);
                    }
                    return code;
                }

                // schema by id
                if (schema_ref.startsWith(":")) {
                    const id = schema_ref.slice(1);
                    if (!id) {
                        throw new Error("Schema id is not provided");
                    }
                    //TODO allow to customize instance and detect client builds with vite
                    return schema_builder.getSchemaCode(id, "server");
                }

                throw new Error(`Could not resovle schema import ${raw_id}`);
            }
        },

        vite: {
            configResolved(c) {
                config.root ??= c.root;
            },
            async configureServer(server) {
                vite_server = server;
            },

            resolveId(source, importer, { ssr }) {
                const raw_id = resolveId(source);
                if (raw_id != null) {
                    const instance = ssr ? "server" : "client";
                    const { queries, str: id } = parseQueries(raw_id);
                    const user_instance = queries.get("instance");
                    if (user_instance == "server" && !ssr) {
                        throw new Error("Using a server instance inside a client build");
                    } else if (!user_instance) {
                        queries.set("instance", instance);
                    }
                    return `${id}?${queries.toString()}`;
                }
            },
        },
    };
});
