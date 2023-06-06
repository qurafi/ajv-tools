import { Type } from "@sinclair/typebox";

const X = Type.Object({
    b: Type.Number(),
});

export const ref = Type.Object({
    a: Type.Number(),
});

export const Vector = Type.Object(
    {
        x: Type.Number({ minimum: 2, maximum: 4, default: 0 }),
        y: Type.Number({ minimum: 0, maximum: 1, default: 1 }),
        z: Type.Number(),
        c: ref,
        s: Type.Union([Type.String(), Type.Number()]),
        e: Type.Union([Type.Array(Type.Tuple([Type.String()])), X]),
    },
    { $id: "t", errorMessage: { string: "x" } }
);
