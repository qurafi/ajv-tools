//TODO take security into considerations.
type MapImport = (ref: string) => string;

export function generateDynamicImportsCode(
    refs: string[],
    map: MapImport,
    export_name?: string
) {
    const named_import = export_name ? `.then(v=>v[${JSON.stringify(export_name)}])` : "";
    const refsKeys = refs.map((ref) => {
        return `"${ref}":import("${map(ref)}")${named_import}`;
    });
    return `export default {${refsKeys.join(",")}}`;
}
