import type { ResolvedConfig, SchemaBuilder, UpdateType } from "../../index.js";
import type { ResolveModule, ResolveSchema, TransformCode } from "../ajv.js";

/**
 * Transform other schema formats to JSON Schema
 *
 * Called before {@linkcode TransformSchema}
 *
 * Return `null` to pass to the next transformer
 */
export type TransformSchema = ResolveSchema;

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

    transformSchema: ResolveSchema;

    resolveSchema: ResolveSchema;

    transformCode: TransformCode;

    buildEnd(builder: SchemaBuilder): void;
}
export type Plugin = Partial<SchemaBuilderHooks>;
