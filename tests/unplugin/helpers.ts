import path from "path";
import fse from "fs-extra";
import { InlineConfig, createServer } from "vite";
import unpluginAjv, { PluginOptions } from "../../src/unplugin";
import { readFile, writeFile } from "fs/promises";
import { setTimeout } from "timers/promises";

export async function setupVite(opts: {
    pluginOptions?: PluginOptions;
    viteOptions?: InlineConfig;
    fixture: string;
}) {
    const fixtures = path.resolve(__dirname, `../fixtures/${opts.fixture}`);

    opts.viteOptions = {
        root: fixtures,
        configFile: false,
        plugins: [],
        clearScreen: false,
        ...opts.viteOptions,
    };

    opts.viteOptions.plugins?.push(
        unpluginAjv.vite({
            include: ["./src/routes/**/schema.{ts,js}", "./src/schemas/**/*.{ts,js}"],
            ...opts.pluginOptions,
        })
    );

    const src = path.resolve(opts.viteOptions.root!, "src");

    const server = await createServer(opts.viteOptions);

    await server.pluginContainer.buildStart({});

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
