import { ResolvedConfig, SchemaBuilder, UpdateType } from "../../index.js";

export interface SchemaBuilderHooks {
    /** after resolving config and everything is ready */
    init(context: { config: ResolvedConfig; builder: SchemaBuilder }): void;

    /** When file change handled */
    onFile(context: {
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

    resolveModule(module: Record<string, any>, file: string): Record<string, any>;
    resolveSchema(schema: any, file: string): Record<string, any>;

    buildEnd(builder: SchemaBuilder): void;
}
export type Plugin = Partial<SchemaBuilderHooks>;
