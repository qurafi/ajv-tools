import { ResolvedConfig, SchemaBuilder } from "../../index.js";

export interface SchemaBuilderHooks {
    /** after resolving config and everything is ready */
    init(context: { config: ResolvedConfig; builder: SchemaBuilder }): void;

    /** When file change handled */
    onFile(context: {
        config: ResolvedConfig;
        //TODO make it as shared type
        update: "change" | "remove" | "add";

        file: string;
        relativePath: string;
        /** affected schemas <export name, schema> */
        //TODO
        // schemas: Record<string, any>;
    }): void;
}
export type Plugin = Partial<SchemaBuilderHooks>;
