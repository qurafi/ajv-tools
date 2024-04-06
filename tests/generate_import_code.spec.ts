import { expect, test } from "vitest";
import { generateDynamicImportsCode } from "../src/utils/code/generate_import_code.js";

const test_refs = ["test", "test2"];

test("generate code for list of dynamic import with mapping", async () => {
    const code = generateDynamicImportsCode(test_refs, (v) => `someprefix/${v}`);
    expect(code).toMatchSnapshot();
});

test("generate import code with named export", () => {
    const code = generateDynamicImportsCode(test_refs, undefined, "default");
    expect(code).toMatchSnapshot();
});

test("generate safe code", async () => {
    const code = generateDynamicImportsCode(['"hello']);
    expect(code).toMatchSnapshot();
});
