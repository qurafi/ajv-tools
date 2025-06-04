import { expect } from "vitest";

export function expectToMatchArray(arr_1: unknown[], arr_2: unknown[]) {
    expect(arr_1.slice().sort()).toStrictEqual(arr_2.slice().sort());
}
