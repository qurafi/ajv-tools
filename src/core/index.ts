import path from "node:path";
import { performance } from "node:perf_hooks";
import type { Options as AjvOptions } from "ajv";
import chokidar from "chokidar";
import FastGlob from "fast-glob";
import micromatch from "micromatch";
import {
	createDebug,
	ensureArray,
	posixify,
	resolvePatterns,
} from "../utils/index.js";
import {
	ajvOptionsClient,
	ajvOptionsServer,
	createAjvFileStore,
	enforcedAjvOptions,
	initInstances,
} from "./ajv.js";
import { Ajv } from "./deps.js";
import { type ModuleLoader, defaultModuleLoader } from "./loader.js";
import type { Plugin } from "./plugins/plugin.types.js";
import { createPluginContainer } from "./plugins/plugins.js";

const debug = createDebug("core");
const debug_build = createDebug("build");

export interface SchemaBuilderOptions {
	root?: string;

	baseDir?: string;

	include: string | string[];
	exclude?: string | string[];

	ajvOptions?: {
		all?: AjvOptions;
		server?: AjvOptions;
		client?: AjvOptions;
	};

	moduleLoader?: ModuleLoader;

	useDirectImport?: boolean;

	plugins?: Plugin[];
}

export type UpdateType = "change" | "remove" | "add";

export async function createSchemaBuilder(opts: SchemaBuilderOptions) {
	const resolved_config = resolveConfig(opts);
	debug("config resolved", resolved_config);

	const {
		root: root_,
		exclude,
		include,
		baseDir,
		ajvOptions,
	} = resolved_config;

	const root = posixify(root_);

	const root_base = path.posix.join(root, baseDir);
	const module_loader = opts.moduleLoader ?? defaultModuleLoader;

	const plugins = await createPluginContainer(opts.plugins);

	const ajvInstances = {
		server: new Ajv(ajvOptions.server),
		client: new Ajv(ajvOptions.client),
	};

	initInstances(ajvInstances);

	const schema_files = createAjvFileStore({
		ajvInstances,
		async resolveModule(mod, file) {
			const resolved = await plugins.transformFirst("resolveModule", mod, file);
			return resolved ?? mod;
		},
		async transformCode(code, instance) {
			const transformed = await plugins.transformFirst(
				"transformCode",
				code,
				instance,
			);
			return transformed ?? code;
		},
		async resolveSchema(schema, file, name) {
			const transformed = await plugins.transformFirst(
				"transformSchema",
				schema,
				file,
				name,
			);

			const resolved = await plugins.transformFirst(
				"resolveSchema",
				transformed ?? schema,
				file,
				name,
			);

			return resolved ?? transformed ?? schema;
		},
	});

	const builder = {
		...schema_files,
		ajvInstances,
		build,
		watch,
		isSchemaFile,
		handleFileUpdate,
		config: resolved_config,
	};

	await plugins.invokeConcurrent("init", {
		config: resolved_config,
		builder,
	});

	async function handleFileUpdate(
		type: UpdateType,
		_file: string,
		initial = false,
	) {
		const file = posixify(path.resolve(root_base, _file));
		const relative_path = posixify(path.relative(root_base, file));

		if (!isSchemaFile(_file)) {
			debug_build("not schema file", relative_path);
			return;
		}

		debug_build(`${type}: ${relative_path}`);

		if (type === "remove") {
			schema_files.removeFileSchemas(relative_path);
		} else {
			const modules = await module_loader({
				files: [file],
				config: resolved_config,
				defaultModuleLoader,
			});

			if (!modules[file]) {
				throw new Error(`Could not load schema file: ${file}`);
			}

			await schema_files.loadFileSchemas(relative_path, await modules[file]);
		}

		await plugins.invokeConcurrent("onFile", {
			builder,
			file,
			relativePath: relative_path,
			config: resolved_config,
			update: type,
			initial,
		});
	}

	function isSchemaFile(file: string) {
		const relative = path.posix.join(root_base, file);

		return micromatch.isMatch(
			path.isAbsolute(file) ? file : relative,
			include,
			{
				cwd: root_,
				ignore: exclude,
			},
		);
	}

	async function build(outDir?: string) {
		const files = await FastGlob(include, {
			cwd: root,
			absolute: false,
			ignore: exclude,
		});

		debug_build("building: ", files);

		const start = performance.now();

		const promises = files.map((file) => {
			return handleFileUpdate("add", file, true);
		});

		await Promise.all(promises);

		await plugins.invokeConcurrent("buildEnd", builder);

		debug_build("build all files in %d", performance.now() - start);

		if (outDir) {
			debug_build("writing to %s", outDir);
			return { files, out: writeFiles(files, outDir) };
		}

		return { files };
	}

	async function writeFiles(files: string[], outDir: string) {
		//TODO we focusing on vite for now
		throw new Error("not implemented yet");
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

	return builder;
}

function resolveConfig(options: SchemaBuilderOptions) {
	const root = options.root ?? process.cwd();

	return {
		baseDir: "",

		...options,

		root,

		ajvOptions: {
			server: {
				...ajvOptionsServer,
				...options.ajvOptions?.all,
				...options.ajvOptions?.server,
				...enforcedAjvOptions,
			},
			client: {
				...ajvOptionsClient,
				...options.ajvOptions?.all,
				...options.ajvOptions?.client,
				...enforcedAjvOptions,
			},
		},

		include: resolvePatterns(ensureArray(options.include), root),
		exclude: resolvePatterns(ensureArray(options.exclude ?? []), root),
	};
}

export type ResolvedConfig = ReturnType<typeof resolveConfig>;

export type SchemaBuilder = Awaited<ReturnType<typeof createSchemaBuilder>>;

export type { Plugin };
