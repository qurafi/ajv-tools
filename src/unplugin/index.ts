import { createUnplugin } from "unplugin";
import type { ViteDevServer } from "vite";
import {
    createSchemaBuilder,
    type SchemaBuilder,
    type SchemaBuilderOptions,
} from "../core/index.js";
import { generateDynamicImportsCode } from "../utils/code/generate_import_code.js";
import { createDebug, parseQueries, removeSchemaFileExt } from "../utils/index.js";
import builderHmrVitePlugin from "./vite_hmr.js";

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

    let vite_build_mode: boolean;

    let schema_builder: SchemaBuilder;
    let build_promise: Promise<any>;

    const resolved_prefix = "\0" + IMPORT_PREFIX;

    async function initSchemaBuilder() {
        const plugins = config.plugins ?? [];
        plugins.push(builderHmrVitePlugin(vite_server));

        schema_builder = await createSchemaBuilder({
            ...config,
            plugins,
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

    function raw_code_if(s: string, b: boolean) {
        return b ? `export default ${JSON.stringify(s)}` : s;
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
            if (!raw_id.startsWith(resolved_prefix)) {
                return;
            }

            await build_promise;

            const { queries, str: id } = parseQueries(raw_id);
            const schema_ref = id.slice(resolved_prefix.length);
            const instance = queries.has("server") ? "server" : "client";

            // const interop = vite_build_mode && instance == "server";
            const interop = instance == "server";

            //TODO we need to think of a way to produce the raw code as transformed by vite
            const raw_code = queries.has("code");

            debug_load("loading", id, queries, schema_ref, instance, "\n");

            if (id == resolved_prefix && queries.get("t")) {
                const t = queries.get("t");
                const propagate_queries = `?${instance}${raw_code ? "&code" : ""}`;

                if (t == "all") {
                    const files = [...schema_builder.files.keys()];
                    const code = generateDynamicImportsCode(
                        files,
                        (file) => `$schemas/${file}${propagate_queries}`,
                        raw_code ? "default" : undefined
                    );

                    debug({ code });
                    return code;
                } else {
                    throw new Error(`${t} unknown option for t param`);
                }
            }

            // schema by path
            if (schema_ref.startsWith("/")) {
                const raw_schema = queries.has("raw");
                const schema_path = removeSchemaFileExt(schema_ref.slice(1));
                if (!schema_path) {
                    throw new Error("Schema path must be supplied");
                }

                if (raw_schema) {
                    debug("raw schema");
                    const schemas = schema_builder.getFileJsonSchemas(
                        schema_path,
                        instance == "server"
                    );
                    if (!schemas) {
                        throw new Error(`Could not find schemas for file ${schema_path}`);
                    }
                    const code = `export default ${JSON.stringify(schemas)}`;
                    return code;
                }

                const code = await schema_builder.getSchemaFileCode(
                    instance,
                    schema_path,
                    interop
                );
                //TODO move error to original function
                if (!code) {
                    throw new Error(`Could not find schema for file ${schema_path}`);
                }

                return raw_code_if(code, raw_code);
            }

            // schema by id
            if (schema_ref.startsWith(":")) {
                const id = schema_ref.slice(1);
                if (!id) {
                    throw new Error("Schema id is not provided");
                }

                const code = await schema_builder.getSchemaCode(id, instance, interop);
                return raw_code_if(code, raw_code);
            }

            throw new Error(`Could not resolve schema import ${raw_id}`);
        },

        vite: {
            configResolved(c) {
                config.root ??= c.root;
                vite_build_mode = c.command == "build";
            },
            async configureServer(server) {
                vite_server = server;
            },

            resolveId(source, importer, { ssr }) {
                const raw_id = resolveId(source);
                if (raw_id != null) {
                    const instance = ssr ? "server" : "client";
                    const { queries, str: id } = parseQueries(raw_id);
                    const has_server = queries.has("server");
                    const has_client = queries.has("client");

                    if (has_client && has_server) {
                        throw new Error("Cannot have both server & client query");
                    }

                    if (has_server && !ssr) {
                        throw new Error("Using a server instance inside a client build");
                    }

                    if (!has_client && !has_server) {
                        queries.set(instance, "");
                    }

                    return `${id}?${queries.toString()}`;
                }
            },
        },
    };
});
