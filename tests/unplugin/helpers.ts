import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout } from "node:timers/promises";
import { mkdirSync } from "fs-extra";
import { type InlineConfig, createServer } from "vite";
import unpluginAjv, { type PluginOptions } from "../../src/unplugin";

export function resolveFixturePath(fixture: string) {
	return path.resolve(__dirname, "../fixtures/", fixture);
}

export async function setupVite(opts: {
	pluginOptions?: Omit<PluginOptions, "include">;
	viteOptions?: InlineConfig;
	fixture: string;
	listenPort?: number;
}) {
	const fixtures = resolveFixturePath(opts.fixture);

	mkdirSync(fixtures, { recursive: true });

	opts.viteOptions = {
		root: fixtures,
		configFile: false,
		plugins: [],
		clearScreen: false,
		logLevel: "silent",
		...opts.viteOptions,
	};

	opts.viteOptions.plugins?.push(
		unpluginAjv.vite({
			include: [
				//
				"src/routes/**/schema.{?(d.)ts,js}",
				"src/schemas/**/*.{?(d.)ts,js}",
			],
			// TODO WIP d.ts loader
			exclude: ["**/*.d.ts"],
			...opts.pluginOptions,
			plugins: [
				{
					resolveModule(module, file) {
						if (file === "schemas/custom_resolver.ts") {
							// all .default properties will be treated as schema, other exports will be ignored
							return module.default as any;
						}
						return module;
					},
					transformSchema(schema, file, name) {
						if (file === "schemas/custom_resolver.ts") {
							if (name === "schema") {
								return schema();
							}
							if (name === "transformed_resolved") {
								return { title: "transformed" };
							}
						}
					},
					resolveSchema(schema, file, name) {
						if (file === "schemas/custom_resolver.ts") {
							if (name === "skipped_by_resolver") {
								return false;
							}
							if (name === "transformed_resolved") {
								return { type: "object", ...schema };
							}
						}
					},
					transformCode(code, instance) {
						return `${code};export const exported_by_transform = true;`;
					},
				},
				...(opts.pluginOptions?.plugins ?? []),
			],
		}),
	);

	// biome-ignore lint/style/noNonNullAssertion: <explanation>
	const src = path.resolve(opts.viteOptions.root!, "src");

	const server = await createServer(opts.viteOptions);
	if (opts.listenPort) {
		await server.listen(opts.listenPort);
	} else {
		await server.pluginContainer.buildStart({});
	}

	return { server, fixtures, src, fixture_path: fixtures };
}

export async function editFile(
	file: string,
	edit: (content: string) => string,
) {
	const contents = await readFile(file, "utf-8");

	return writeFile(file, edit(contents));
}

type MaybePromise<T> = T | Promise<T>;

export async function poll(
	tries: number,
	// biome-ignore lint/style/useDefaultParameterLast: <explanation>
	wait_time = 0,
	fn: () => MaybePromise<any>,
) {
	const interval = wait_time > 0 ? wait_time / tries : 25;
	for (let i = 0; i < tries; i++) {
		if (await fn()) {
			return;
		}
		await setTimeout(interval);
	}
}
