import { ensureArray, MaybePromise, removeSchemaFileExt } from "../utils/index.js";
import path from "node:path/posix";
import esbuild, { BuildOptions } from "esbuild";
import { type ResolvedConfig } from ".";
import { pathToFileURL } from "node:url";
import { createDebug } from "../utils/index.js";

const debug = createDebug("core:loader");

/** to bundle schema source files */
export const cache_path = "node_modules/.vite-plugin-ajv-cache";

export interface ModuleLoaderContext {
    config: ResolvedConfig;
    files: string[];
    defaultModuleLoader: typeof loader;
    [key: string]: unknown;
}

export type ModuleLoader = (
    context: ModuleLoaderContext
) => MaybePromise<Record<string, Promise<any>>>;

const _import = new Function("p", "return import(p)");

async function dynamicImport(file: string) {
    try {
        // this will throw errors when running code inside node:vm
        // sometimes will throw segmentation fault no matter what
        return await _import(pathToFileURL(file).href);
    } catch (error: any) {
        if (error.code == "ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING") {
            return import(file);
        }
        throw error;
    }
}

const loader = async function (context: ModuleLoaderContext) {
    //TODO some error handling?
    const bundled_files = await loader.build(context);

    return loader.load(context, bundled_files);
};

type BundledFiles = string[][];

loader.load = async function ({ config }: ModuleLoaderContext, bundled: BundledFiles) {
    debug("default loader: loading bundled files", bundled);

    const promises = bundled.map(([file, bundled_file]) => {
        return [
            file,
            config.useDirectImport ? import(bundled_file) : dynamicImport(bundled_file),
        ];
    });

    return Object.fromEntries(await Promise.all(promises));
};

loader.build = async function (
    context: ModuleLoaderContext,
    esbuildOptions?: BuildOptions
) {
    const { files, config } = context;
    // const root = config.root ?? process.cwd();

    debug("default loader: bundling sources ", files);

    await esbuild.build({
        entryPoints: ensureArray(files),
        outdir: cache_path,
        outbase: ".",
        absWorkingDir: config.root,
        format: "esm",
        platform: "node",
        bundle: true,
        outExtension: { ".js": ".mjs" },
        ...esbuildOptions,
    });

    return files.map((file) => [file, loader.resolveBundledFile(config.root, file)]);
};

loader.resolveBundledFile = function (root: string, file: string) {
    const rel_path = removeSchemaFileExt(path.relative(root, file));

    return path.resolve(root, cache_path, rel_path) + ".mjs";
};

export { loader as defaultModuleLoader };
