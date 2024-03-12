import type { ResolvedConfig, SchemaBuilder, UpdateType } from "../../index.js";
import type { ResolveModule, ResolveSchema } from "../ajv.js";

export interface SchemaBuilderHooks {
    /** after resolving config and everything is ready */
    init(ctx: { config: ResolvedConfig; builder: SchemaBuilder }): void;

    /** When file change handled */
    onFile(ctx: {
        builder: SchemaBuilder;

        config: ResolvedConfig;

        update: UpdateType;

        file: string;
        relativePath: string;

        initial: boolean;

        /** affected schemas <export name, schema> */
        //TODO
        // schemas: Record<string, any>;
    }): void;

    resolveModule: ResolveModule;

    resolveSchema: ResolveSchema;

    buildEnd(builder: SchemaBuilder): void;
}
export type Plugin = Partial<SchemaBuilderHooks>;
