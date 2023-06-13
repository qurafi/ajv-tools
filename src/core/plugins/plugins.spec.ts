import { setTimeout } from "node:timers/promises";
import { describe, expect, it } from "vitest";
import { createPluginContainer } from "./plugins.js";

const timeout_duration = 25;

const plugin = (state: any) => {
    return {
        anotherThing() {
            return;
        },
        async onSomething(param: number) {
            await setTimeout(timeout_duration);

            return {
                something: true,
            };
        },
        returnRes() {
            if (state.i++ > 0) {
                return state.i * 100;
            }
            return null;
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

describe("plugins.ts", async () => {
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
            1
        );

        expect(calls).toHaveLength(1);
        expect(calls[0].hook).toBe("onSomething");
        expect(calls[0].ret).resolves.toStrictEqual({ something: true });
        expect(calls[0].args).toStrictEqual([1]);
    });

    it("should return only the first non-null results when returnFirstResult=true", async () => {
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
            async () => {
                const { container } = await setupContainer();
                const start = Date.now();

                await container.invoke(
                    {
                        action: "onSomething",
                        concurrent,
                    },
                    1
                );

                const elapsed = Date.now() - start;
                const expected = concurrent ? timeout_duration : timeout_duration * 3;

                const e = process.env.CI ? 100 : 15;
                console.log({ elapsed });
                expect(elapsed >= expected - e && elapsed <= expected + e).toBe(true);
            },
            { retry: 3 }
        );
    }

    testConcurrent(true);
    testConcurrent(false);
});
