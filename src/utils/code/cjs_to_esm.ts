// ajv currently does not support esm import for some imports
// the code expected to work with ajv compiled code and does not handle every cjs cases
export function transformCJS(code: string, interop: boolean) {
    const paths: Record<string, number> = {};

    let prepend = "";
    let import_n = 0;

    const new_code = code.replace(
        /const (\w+) = require\("([^"]*)"\)((\.[^.;]+)+);/g,
        (s, fn, path, imports) => {
            const [, first] = imports.split(".");

            const m = first.match(/(\w+)(\["[^"]+"\])*/);
            if (!m) return "";

            const first_import = m[1];
            let property_access = m[2];

            if (!property_access) {
                property_access = imports.slice(first_import.length + 1);
            }

            if (!paths[path]) {
                let imported = `import_${import_n}`;
                let import_specifier = imported;
                if (path === "ajv-formats/dist/formats") {
                    import_specifier = `* as ${imported}`;
                }
                prepend += `import ${import_specifier} from "${path}";\n`;
                paths[path] = import_n;
                import_n++;
            }

            const is_default = first_import === "default";
            const use_default = interop && is_default ? ".default" : "";

            const alias = `import_${paths[path]}${use_default}${
                first_import && !is_default ? `.${first_import}` : ""
            }${property_access}`;
            return `const ${fn} = ${alias};`;
        }
    );
    return prepend + new_code.replace('"use strict";', "");
}
