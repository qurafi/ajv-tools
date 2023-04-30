import { expect, test } from "vitest";
import { generateDynamicImportsCode } from "./generate_import_code.js";

const test_refs = ["test", "test2"];

test("generate code for list of dynamic import with mapping", async () => {
    const code = generateDynamicImportsCode(test_refs, (v) => `someprefix/${v}`);
    expect(code).toMatchSnapshot();
});
