import path from "path";
import { InlineConfig, createServer } from "vite";
import unpluginAjv, { PluginOptions } from "../../src/unplugin";
import { readFile, writeFile } from "fs/promises";
import { setTimeout } from "timers/promises";

export function resolveFixturePath(fixture: string) {
    return path.resolve(__dirname, `../fixtures/${fixture}`);
}

export async function setupVite(opts: {
    pluginOptions?: Omit<PluginOptions, "include">;
    viteOptions?: InlineConfig;
    fixture: string;
    listenPort?: number;
}) {
    const fixtures = resolveFixturePath(opts.fixture);

    opts.viteOptions = {
        root: fixtures,
        configFile: false,
        plugins: [],
        clearScreen: false,
        ...opts.viteOptions,
    };

    opts.viteOptions.plugins?.push(
        unpluginAjv.vite({
            include: [
                // ?(d.)
                "./src/routes/**/schema.{?(d.)ts,js}",
                "./src/schemas/**/*.{?(d.)ts,js}",
            ],
            // TODO WIP d.ts loader
            exclude: ["**/*.d.ts"],
            ...opts.pluginOptions,
        })
    );

    const src = path.resolve(opts.viteOptions.root!, "src");

    const server = await createServer(opts.viteOptions);
    if (opts.listenPort) {
        await server.listen(opts.listenPort);
    } else {
        await server.pluginContainer.buildStart({});
    }

    return { server, fixtures, src, fixture_path: fixtures };
}

export async function editFile(file: string, edit: (content: string) => string) {
    const contents = await readFile(file, "utf-8");

    return writeFile(file, edit(contents));
}

type MaybePromise<T> = T | Promise<T>;
export async function poll(tries: number, wait_time = 0, fn: () => MaybePromise<any>) {
    const interval = wait_time > 0 ? wait_time / tries : 25;
    for (let i = 0; i < tries; i++) {
        if (await fn()) {
            return;
        }
        await setTimeout(interval);
    }
}
