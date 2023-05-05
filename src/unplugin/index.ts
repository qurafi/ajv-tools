import generateAjvStandaloneCode from "ajv/dist/standalone/index.js";
import { createUnplugin } from "unplugin";
import { ViteDevServer } from "vite";
import {
    createSchemaBuilder,
    SchemaBuilder,
    SchemaBuilderOptions,
} from "../core/index.js";
import { transformCJS } from "../utils/code/cjs_to_esm.js";
import { generateDynamicImportsCode } from "../utils/code/generate_import_code.js";
import { createDebug, parseQueries, removeSchemaFileExt } from "../utils/index.js";
import { resolveSchemaRef } from "../core/ajv.js";

const IMPORT_PREFIX = "$schemas";

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface PluginOptions extends SchemaBuilderOptions {
    //
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

                const module = vite_server.moduleGraph.getModuleById(
                    `\0$schemas/${file}`
                );

                if (module) {
                    await vite_server.reloadModule(module);
                }

                //TODO reload by id
            },
        });

        build_promise = schema_builder.build();
        await build_promise;
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

        resolveId(id, _importer, _options) {
            if (id.startsWith(IMPORT_PREFIX)) {
                return `\0${id}`;
            }
        },

        async load(raw_id) {
            if (raw_id.startsWith(resolved_prefix)) {
                await build_promise;

                const { queries, str: id } = parseQueries(raw_id);
                const schema_ref = id.slice(resolved_prefix.length);
                debug_load("loading", id, queries, schema_ref, "\n");

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
                    const raw_schema = queries.get("raw");
                    const schema_path = removeSchemaFileExt(schema_ref.slice(1));
                    if (!schema_path) {
                        throw new Error("Schema path must be supplied");
                    }
                    if (raw_schema !== undefined) {
                        debug("raw schema");
                        const file_schemas = schema_builder.getFileSchemas(schema_path);
                        if (!file_schemas) {
                            return;
                        }

                        const schemas = [...file_schemas.entries()].map(
                            ([ref, schema]) => {
                                return [
                                    ref,
                                    raw_schema == "resolved"
                                        ? schema
                                        : schema_builder.ajvInstances.server.getSchema(
                                              resolveSchemaRef(schema_path, ref)
                                          )?.schema,
                                ];
                            }
                        );
                        debug({ schemas, file_schemas });
                        return `export default ${JSON.stringify(
                            Object.fromEntries(schemas)
                        )}`;
                    }
                    const code = schema_builder.getSchemaFileCode("server", schema_path);
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
                    const ajv = schema_builder.ajvInstances.server;
                    const schema = ajv.getSchema(id);
                    if (!schema) {
                        throw new Error(`schema with $id:${id} is not found`);
                    }
                    const code = generateAjvStandaloneCode(ajv, schema);
                    const esm = transformCJS(code);
                    //TODO allow user to customize code?
                    return esm;
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
        },
    };
});
