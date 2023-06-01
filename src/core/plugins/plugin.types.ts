import { ResolvedConfig, SchemaBuilder, UpdateType } from "../../index.js";

export interface SchemaBuilderHooks {
    /** after resolving config and everything is ready */
    init(context: { config: ResolvedConfig; builder: SchemaBuilder }): void;

    /** When file change handled */
    onFile(context: {
        config: ResolvedConfig;

        update: UpdateType;

        file: string;
        relativePath: string;

        initial: boolean;

        /** affected schemas <export name, schema> */
        //TODO
        // schemas: Record<string, any>;
    }): void;

    //
    buildEnd(): void;
}
export type Plugin = Partial<SchemaBuilderHooks>;
