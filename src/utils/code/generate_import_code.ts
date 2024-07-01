const json = JSON.stringify;

export function generateDynamicImportsCode(
	refs: string[],
	map = (ref: string) => ref,
	export_name?: string,
) {
	const named_import = export_name ? `.then(v=>v[${json(export_name)}])` : "";
	const refsKeys = refs.map((ref) => {
		return `${json(ref)}:() => import(${json(map(ref))})${named_import}`;
	});
	return `export default {${refsKeys.join(",")}}`;
}
