import type { Options as AjvOptions } from "ajv";
import Ajv from "ajv";
import FastGlob from "fast-glob";
import micromatch from "micromatch";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { createDebug, ensureArray, resolvePatterns } from "../utils";
import { AjvFilesStoreOptions, createAjvFileStore, overridenAjvOptions } from "./ajv";
import { defaultModuleLoader, ModuleLoader } from "./loader";
import chokidar from "chokidar";

const debug = createDebug("core");

export interface SchemaBuilderOptions {
    root?: string;

    baseDir?: string;

    include: string | string[];
    exclude?: string | string[];

    ajvOptions?: AjvOptions;

    moduleLoader?: ModuleLoader;

    useDirectImport?: boolean;

    resolveModule?: AjvFilesStoreOptions["resolveModule"];

    resolveSchema?: AjvFilesStoreOptions["resolveSchema"];

    onFile?(params: { relativePath: string; reason: UpdateType }): any;
}

type UpdateType = "change" | "remove" | "add";

export async function createSchemaBuilder(opts: SchemaBuilderOptions) {
    const resolved_config = resolveConfig(opts);

    const { root, exclude, include, baseDir, ajvOptions, onFile } = resolved_config;
    const root_base = path.resolve(root, baseDir || "");
    const module_loader = opts.moduleLoader ?? defaultModuleLoader;

    const ajvInstances = {
        server: new Ajv(ajvOptions),
    };

    //TODO refactor this to support multiple instances
    const addFormats = (await import("ajv-formats")).default;

    addFormats(ajvInstances.server, [
        "date-time",
        "time",
        "date",
        "email",
        "hostname",
        "ipv4",
        "ipv6",
        "uri",
        "uri-reference",
        "uuid",
        "uri-template",
        "json-pointer",
        "relative-json-pointer",
        "regex",
    ]);

    const schema_files = createAjvFileStore({
        ajvInstances,
        resolveModule,
        resolveSchema,
    });

    debug("config resolved", resolved_config);

    async function handleFileUpdate(type: UpdateType, _file: string) {
        const file = path.resolve(root_base, _file);

        const relative_path = path.relative(root_base, file);
        debug(`${type}: ${relative_path}`);

        if (!isSchemaFile(file)) {
            return;
        }

        if (type == "remove") {
            schema_files.removeFileSchemas(relative_path);
        } else {
            const modules = await module_loader({
                files: [file],
                config: resolved_config,
                defaultModuleLoader,
            });

            if (!modules[file]) {
                //TODO throw error
                return;
            }

            await schema_files.loadFileSchemas(relative_path, await modules[file]);
        }

        onFile?.({
            relativePath: relative_path,
            reason: type,
        });
    }

    function isSchemaFile(file: string) {
        return micromatch.isMatch(path.resolve(root_base, file), include, {
            cwd: root,
            ignore: exclude,
        });
    }

    async function build(outDir?: string) {
        const files = await FastGlob(include, {
            cwd: root,
            absolute: false,
            ignore: exclude,
        });

        debug("building: ", files);

        const promises = files.map((file) => {
            return handleFileUpdate("add", file);
        });

        const start = performance.now();

        await Promise.all(promises);

        debug("build all files in %d", performance.now() - start);

        if (outDir) {
            debug("writing to %s", outDir);
            return { files, out: writeFiles(files, outDir) };
        }

        return { files };
    }

    async function writeFiles(files: string[], outDir: string) {
        //TODO
        console.log({
            files,
            outDir,
        });
    }

    async function resolveModule(module: Record<string, any>, file: string) {
        return opts.resolveModule?.(module, file) ?? module;
    }

    async function resolveSchema(schema: any) {
        return opts.resolveSchema?.(schema) ?? schema;
    }

    function watch(watchParams: { watcher?: chokidar.FSWatcher }) {
        if (!watchParams.watcher) {
            watchParams.watcher = chokidar.watch(include, {
                ignoreInitial: true,
                ignorePermissionErrors: true,
                ignored: exclude,
            });
        }

        function watchFiles(reason: UpdateType) {
            return (filename: string) => {
                handleFileUpdate(reason, filename);
            };
        }

        watchParams.watcher.on("change", watchFiles("change"));
        watchParams.watcher.on("add", watchFiles("add"));
        watchParams.watcher.on("unlink", watchFiles("remove"));
    }

    return {
        ...schema_files,
        ajvInstances,
        build,
        watch,
        isSchemaFile,
        config: resolved_config,
    };
}

function resolveConfig(options: SchemaBuilderOptions) {
    const root = options.root ?? process.cwd();

    return {
        ...options,
        root,
        ajvOptions: { ...options.ajvOptions, ...overridenAjvOptions } as AjvOptions,
        include: resolvePatterns(ensureArray(options.include), root),
        exclude: resolvePatterns(ensureArray(options.exclude ?? []), root),
    };
}

export type ResolvedConfig = ReturnType<typeof resolveConfig>;

export type SchemaBuilder = Awaited<ReturnType<typeof createSchemaBuilder>>;
