
# Ajv Build Tools

A universal build tools plugin to handle json schemas compilation with ajv. This will allow you to use highly optmized standalone validation code for your json schemas without any efforts:

- Define your json schemas in files(javascript or typescript)
- The builder will take care of loading and watching your source schemas
- Access your compiled schemas with the virtual import `$schemas`. [See more](#importing-the-compiled-schemas)

## Features

- Server & client optmized builds.
- Warnings about insecure schemas.
- Different ajv options per schema*
- ajv-formats and ajv-errors added by default.
- Vite hmr support and auto ssr optmizations.
- Optmize the generated code by the bundlers.
- Extended with plugins.

## Content

- [Ajv Build Tools](#ajv-build-tools)
  - [Features](#features)
  - [Content](#content)
  - [Get Started](#get-started)
    - [Prerequisite](#prerequisite)
    - [Vite](#vite)
    - [Rollup and other bundlers](#rollup-and-other-bundlers)
    - [Plugin Options](#plugin-options)
      - [Basics](#basics)
      - [Advanced](#advanced)
  - [Importing the compiled schemas](#importing-the-compiled-schemas)
    - [By path relative to baseDir](#by-path-relative-to-basedir)
    - [By reference or $id (similar to calling `ajv.getSchema(id_or_key)`)](#by-reference-or-id-similar-to-calling-ajvgetschemaid_or_key)
    - [All schemas by file](#all-schemas-by-file)
  - [Types for the virtual imports](#types-for-the-virtual-imports)
  - [Resources](#resources)
  - [(WIP) Using the core schema builder interface](#wip-using-the-core-schema-builder-interface)

## Get Started

`npm i ajv-build-tools` / `pnpm i ajv-build-tools`

### Prerequisite

This guide assumes you have familiarity with json schemas and ajv. [See Resources](#resources)

### Vite

The plugin designed to work with vite and rollup first. This will inlcude features like hot reloading and ssr optmized builds.

```javascript
import {unpluginAjvTools} from "ajv-build-tools";
export default defineConfig({
    plugins: [
        unpluginAjvTools.vite({
            include: [
                "./src/routes/*.{js,ts}",
                "./src/**/schemas.{ts,js,\\.d.ts}"
            ]
        })
    ]
})
```

### Rollup and other bundlers

Other bundlers are supported as long it's supported by unplugin, but it's well tested and designed to work with vite and rollup.

### Plugin Options

The plugin extends the schema builder interface

```typescript
interface SchemaBuilderOptions {
    root?: string;
    baseDir?: string;
    include: string | string[];
    exclude?: string | string[];

    ajvOptions?: {
        all?: AjvOptions;
        server?: AjvOptions;
        client?: AjvOptions;
    };
    moduleLoader?: ModuleLoader;
    useDirectImport?: boolean;
    resolveModule?(module: Record<string, unknown>, file: string): Record<string, any>;
    resolveSchema?(schema: any, file: string): any;
    plugins?: Plugin[];
}
```

#### Basics

- **root** : The root directory where all files resolved from, it's either process.cwd() or vite's root.
- **baseDir**: `src` by default.
- **include/exlcude**: list of glob patterns passed to `fast-glob` and `micromatch`

#### Advanced

- **ajvOptions**: Pass diferent ajv options based on the instance. use `all` to apply to all instances.
- **resolveModule**: module -> schema map. by default all exports are treated as individual schemas, but sometimes you want a custom resolution, for example:

    ```javascript
    async function resolveModule(module, file) {
        if (file.startsWith("routes/")) {
            /*
            Resolve from:
            export GET = {queries: {}}
            export POST = {body: {}}
            export actions = {default: {body}}
            
            to:
            export GET_queries = {}                export POST_body = {}
            export actions_default_body = {}
            */
            return resolveRoutesSchemas(module, file);
        }

        return module;
    },
    ```

- **resolveSchema**:  Similarly you could resolve each schema invidually, the result should be a valid json schema. This could be used to convert another schema formats to a json schema.

<br>

- **Module loader**: Responsible for building and loading the source files for the schema. The default loader will bundle the files with esbuild and import them using a dynamic import. It's rare case to use a custom loader as the default loader will handle most cases including transpilling typescript. An example of custom loader that used by the vite plugin:

    ```typescript
    moduleLoader(context) {
        const { files, defaultModuleLoader } = context;

        // if vite dev server available use it to speed up dev speed
        if (vite_server) {
            return Object.fromEntries(
                files.map((file) => {
                    return [file, vite_server.ssrLoadModule(file)];
                })
            );
        }
        return defaultModuleLoader(context);
    },
    ```

- **useDirectImport**: used by the default loader to decide if to use direct dynamic import or indirectly by using `new Function("p", "return import(p)")`. This to avoid transpiling dynamic imports to require by some tools.

- **Plugins**: The builder could be extended with plugins, refer to plugins.types for the available hooks. altho this feature is very WIP and the api subjects to change.

## Importing the compiled schemas

#### By path relative to baseDir

```javascript
import schemas from "$schemas/routes/api/login/schemas";

// schemas
{
    GET_body: ...
}
```

- **Queries**:
  - **raw**: import the resolved raw json schemas
  - **instance**: server or client. This automatically set by vite depending on ssr property
  - **raw code**: return compiled code as raw string

#### By reference or $id (similar to calling `ajv.getSchema(id_or_key)`)

```javascript
import validateUser from "$schemas:User"

// the default export is the compiled validate function
// it's the same function that return by ajv.compile
// use validateUser.errors to access the last validation errors
// note that's it's a global so refer to ajv docs for more information
```

- **Queries:**
  - instance
  - raw code

#### All schemas by file

```javascript
import schemas from "$schemas?t=all";
```

- **Queries**:
  - instance
  - raw code

## Types for the virtual imports

Use `ajv-build-tools/types` to declare the virtaul modules.

## Resources

- [Ajv](http://ajv.js.org/)
- [Ajv Json Schema Guide](https://ajv.js.org/json-schema.html)

## (WIP) Using the core schema builder interface

You could refer to the unplugin source code or the tests to see how to use the core builder.
