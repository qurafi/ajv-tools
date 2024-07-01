import { expect, it } from "vitest";
import { parseQueries } from "../src/utils";

it("parseQueries", () => {
	const queries = [
		"something?q=1",
		"two?q=2?q=1",
		"two?q=1?q=2",
		"?q=1?q=2",
		"?q=1",
		"q=1q=2",
		"",
		"hello?a&b=1",
	];

	const expected = [
		["something", { q: "1" }],
		["two?q=2", { q: "1" }],
		["two?q=1", { q: "2" }],
		["?q=1", { q: "2" }],
		["", { q: "1" }],
		["q=1q=2", {}],
		["", {}],
		["hello", { a: "", b: "1" }],
	];

	const result = queries.map((v) => {
		const q = parseQueries(v);
		return [q.str, Object.fromEntries(q.queries)];
	});

	expect(result).toEqual(expected);
});
