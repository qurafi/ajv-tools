declare module "$schemas?t=all" {
    const Schemas: Record<string, () => Promise<Record<string, any>>>;
    export default Schemas;
}

// we cannot dynamically construct named export so we declare it
declare module "$schemas/*";

declare module "$schemas:*" {
    import { ValidateFunction } from "ajv";

    export default ValidateFn as ValidateFunction;
}
