import createDebugger from "debug";
import path from "node:path";

export type MaybePromise<T> = Promise<T> | T;
export type UnstrictReturnType<T> = T extends (...args: any) => infer R ? R : never;
export type UnstrictParameters<T> = T extends (...args: infer P) => any ? P : never;

export function resolvePatterns(patterns: string | string[], root: string) {
    return ensureArray(patterns).map((pattern) => {
        return path.resolve(root, pattern);
    });
}

export function ensureArray<T>(x: T | T[]) {
    if (x == undefined) {
        return [];
    }

    return Array.isArray(x) ? x : [x];
}

//TODO add json support
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