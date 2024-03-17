import { setTimeout } from "node:timers/promises";
import { beforeEach, describe, expect, it } from "vitest";
import { createPluginContainer } from "./plugins.js";

const timeout_duration = 25;

const plugin = (state: any) => {
    return {
        anotherThing() {
            return;
        },
        async onSomething(params: { n: number }) {
            await setTimeout(timeout_duration);
            if (++params.n > 1) {
                return {
                    something: true,
                };
            }
        },
        returnRes() {
            if (state.i++ > 0) {
                return state.i * 100;
            }
        },
        transform(_x: string, n: number) {
            return n + 2;
        },

        transformOptional(n: number) {
            if (n == 1) {
                return n * 10;
            }
            return ++n;
        },

        transformFirst(str: string, a: number, b: boolean) {
            return str + "a";
        },

        doto() {
            return "string";
        },

        badPlugin() {
            throw new Error("error inside plugin");
        },
        badPluginSeq() {
            if (!state.ok) {
                state.ok = true;
            } else {
                throw new Error("error inside plugin seq");
            }
        },
    };
};

async function setupContainer() {
    const calls: any[] = [];
    const createPlugin: typeof plugin = (state) => {
        return new Proxy(plugin(state), {
            get(t: any, k) {
                if (Object.prototype.hasOwnProperty.call(t, k)) {
                    return (...args: any[]) => {
                        const ret = t[k](...args);
                        calls.push({ hook: k, args, ret });
                        return ret;
                    };
                }
                return t[k];
            },
        });
    };

    const state = { i: 0 };
    const container = await createPluginContainer([
        createPlugin(state),
        createPlugin(state),
        createPlugin(state),
    ]);
    return { container, calls };
}

describe("custom error handler", async () => {
    const { container, calls } = await setupContainer();
    let errs: any[] = [];
    container.setErrorHandler((name, err) => {
        if (name.startsWith("badPlugin")) {
            errs.push(err);
            return;
        }
        throw err;
    });
    beforeEach(() => {
        errs = [];
    });

    it("concurrent with error handler", async () => {
        await container.invokeConcurrent("badPlugin");
        console.log(errs);
        expect(errs).toHaveLength(3);
    });

    it("sequential plugin with error handler", async () => {
        await container.getHookResult("badPluginSeq");
        expect(errs).toHaveLength(2);
    });
});

it("should return all results when returnFirstResult=false", async () => {
    const { container, calls } = await setupContainer();

    const result = await container.invoke({
        action: "returnRes",
        returnFirstResult: false,
    });

    expect(calls).toHaveLength(3);
    expect(result).toHaveLength(3);
});

it("should invoke a plugin hook once when returnFirstResult=true", async () => {
    const { container, calls } = await setupContainer();
    const res = await container.invoke(
        {
            action: "onSomething",
            returnFirstResult: true,
        },
        { n: 0 }
    );

    expect(res).toHaveLength(1);
    expect(res?.[0]).toHaveProperty("something");
    expect(calls).toHaveLength(2);
});

it("should return only the first non-undefined results when returnFirstResult=true", async () => {
    const { container, calls } = await setupContainer();

    const result = await container.invoke({
        action: "returnRes",
        returnFirstResult: true,
    });

    expect(calls).toHaveLength(2);
    expect(result).toStrictEqual([200]);
});

it("should transform with transformer function", async () => {
    const { container, calls } = await setupContainer();

    const result = await container.invoke(
        {
            action: "transform",
            transformer: (result, params) => [params[0], result],
        },
        "increment_me",
        0
    );

    expect(calls).toHaveLength(3);
    expect(result).toStrictEqual([6]);
});

it("should transform with transformer function: custom conditions", async () => {
    const { container, calls } = await setupContainer();

    const result = await container.invoke(
        {
            action: "transformOptional",
            transformer: (result, params) => [result],
        },
        0
    );

    expect(calls).toHaveLength(3);
    expect(result).toStrictEqual([11]);
});

it("transform first args", async () => {
    const { container, calls } = await setupContainer();

    const result = await container.transformFirst("transformFirst", "", 0, true);
    expect(result).toBe("aaa");
});

function testConcurrent(concurrent: boolean) {
    it(
        `should invoke concurrently when concurrent is ${concurrent}`,
        { retry: 3 },
        async () => {
            const { container } = await setupContainer();
            const start = Date.now();

            await container.invoke(
                {
                    action: "onSomething",
                    concurrent,
                },
                { n: 0 }
            );

            const elapsed = Date.now() - start;
            const expected = concurrent ? timeout_duration : timeout_duration * 3;

            const e = process.env.CI ? 100 : 15;
            expect(elapsed >= expected - e && elapsed <= expected + e).toBe(true);
        }
    );
}

testConcurrent(true);
testConcurrent(false);
