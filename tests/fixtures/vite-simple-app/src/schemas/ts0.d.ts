import { External } from "../shared/external";
interface X {
    b: External;
}

export interface ref {
    a: number;
}
/**
 *
 * @$id t0
 * @errorMessage "invalid"
 *
 */
export interface Vector {
    /**
     * @minimum 2
     * @maximum 4
     * @default 0
     */
    x: number;
    /**
     * @minimum 0
     * @maximum 1
     * @default 1
     */
    y: number;

    z: number;

    /*
    @ref $ref
  */
    c: ref;

    s: string | number;

    e: [string][] | X;
}
