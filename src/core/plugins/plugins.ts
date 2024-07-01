import type {
	UnstrictParameters,
	UnstrictReturnType,
} from "../../utils/index.js";

interface InvokeOptions<T, A extends keyof T> {
	action: A;

	concurrent?: boolean;

	returnFirstResult?: boolean;

	transformer?(
		last_result: HookReturnType<T, A>,
		args: HookParams<T, A>,
	): HookParams<T, A> | undefined | null;
}

type HookReturnType<T, A extends keyof T> = Awaited<UnstrictReturnType<T[A]>>;
type HookInvocationReturn<T, A extends keyof T> = Promise<
	HookReturnType<T, A>[] | undefined | null
>;
type HookParams<T, A extends keyof T> = UnstrictParameters<T[A]>;

export type PluginsOptions<T> = Partial<T | undefined | false | null>[];

export async function createPluginContainer<PluginDefs>(
	plugins_input: PluginsOptions<PluginDefs> = [],
) {
	type T = Partial<PluginDefs>;

	const resolved_plugins = await Promise.all(plugins_input);

	const plugins = resolved_plugins.filter(Boolean) as T[];

	let handleError = (plugin: keyof PluginDefs, err: any): any => {
		throw err;
	};

	async function invoke<A extends keyof T>(
		opts: InvokeOptions<T, A>,
		...params: HookParams<T, A>
	): HookInvocationReturn<T, A> {
		const { action, concurrent, returnFirstResult, transformer } = opts;

		const results = [];

		// biome-ignore lint/suspicious/noImplicitAnyLet: <explanation>
		let prev_result;

		const use_transformer = !concurrent && typeof transformer === "function";

		for (const plugin of plugins) {
			const hook = plugin[action];

			if (typeof hook !== "function") {
				continue;
			}

			const args =
				use_transformer && prev_result
					? transformer(prev_result as any, params)
					: params;

			try {
				// wraps non-async function so we could catch them individually during concurrent execution
				// eslint-disable-next-line prefer-spread
				const result: any = (async () => hook.apply(null, args))();
				results.push(concurrent ? result : await result);
				if (!concurrent && !use_transformer && returnFirstResult) {
					const res = await result;
					if (res !== undefined) {
						return [res];
					}
				}

				if (use_transformer) {
					prev_result = await result;
				}
			} catch (e) {
				handleError(action, e);
			}
		}

		if (use_transformer) {
			return [prev_result];
		}
		if (concurrent) {
			return Promise.allSettled(results).then((res) => {
				return res
					.map((v) => {
						if (v.status === "rejected") {
							handleError(action, v.reason);
							return;
						}
						return v.value;
					})
					.filter(Boolean);
			});
		}
		return results;
	}

	return {
		plugins,

		setErrorHandler(handler: typeof handleError) {
			handleError = handler;
		},

		invoke,

		async getHookResult<A extends keyof T>(
			action: A,
			...params: HookParams<T, A>
		) {
			const results = await this.invoke(
				{
					action,
					returnFirstResult: true,
				},
				...params,
			);
			return results?.[0];
		},

		async invokeConcurrent<A extends keyof T>(
			action: A,
			...params: HookParams<T, A>
		) {
			return this.invoke({ action, concurrent: true }, ...params);
		},

		// TODO better name
		// pass the return value as first parameter to the next hook
		async transformFirst<A extends keyof T>(
			action: A,
			...params: HookParams<T, A>
		) {
			const results = await this.invoke(
				{
					action,
					transformer(last_result, args) {
						const [_, ...remaining] = args;
						return [last_result, ...remaining] as any;
					},
				},
				...params,
			);
			return results?.[0];
		},
	};
}
