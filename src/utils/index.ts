import path from "node:path/posix";
import createDebugger from "debug";
import { red, yellow } from "kleur/colors";

export type MaybePromise<T> = Promise<T> | T;
export type UnstrictReturnType<T> = T extends (...args: any) => infer R
	? R
	: never;
export type UnstrictParameters<T> = T extends (...args: infer P) => any
	? P
	: never;

export function resolvePatterns(patterns: string | string[], root: string) {
	return ensureArray(patterns).map((pattern) => {
		return path.join(posixify(root), pattern);
	});
}

export function ensureArray<T>(x: T | T[]) {
	if (x === undefined) {
		return [];
	}

	return Array.isArray(x) ? x : [x];
}

export function removeSchemaFileExt(file: string) {
	return file.replace(/\.(j|t)s$/, "");
}

export const createDebug = (ns: string) => createDebugger(`ajv-tools:${ns}`);

export function parseQueries(str: string) {
	const query_match = str.match(/\?([^?]*)$/);

	const query_string = query_match?.[0] || "";

	const query_params = new URLSearchParams(query_string);

	const stripped = str.slice(0, query_match?.index);

	return {
		queries: query_params,
		str: stripped,
	};
}

export const logger = {
	error: (...args: any[]) => console.error(red("error:"), ...args),
	warn: (...args: any[]) => console.error(yellow("warn: "), ...args),
	log: console.log,
};

export function posixify(str: string) {
	return str.replace(/\\/g, "/");
}

export function isObject(x: unknown): x is Record<string, any> {
	return !!x && typeof x === "object" && !Array.isArray(x);
}
