import import_0 from "ajv-keywords/dist/definitions/transform.js";
import import_1 from "ajv/dist/runtime/ucs2length.js";

export default validate53;
const schema71 = {"type":"string","transform":["trim"],"minLength":1};
const func4 = import_0.transform.trim;
const func2 = import_1.default;

function validate53(data, {instancePath="", parentData, parentDataProperty, rootData=data}={}){
let vErrors = null;
let errors = 0;
if(typeof data !== "string"){
let dataType0 = typeof data;
let coerced0 = undefined;
if(!(coerced0 !== undefined)){
if(dataType0 == "number" || dataType0 == "boolean"){
coerced0 = "" + data;
}
else if(data === null){
coerced0 = "";
}
else {
const err0 = {instancePath,schemaPath:"#/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err0];
}
else {
vErrors.push(err0);
}
errors++;
}
}
if(coerced0 !== undefined){
data = coerced0;
if(parentData !== undefined){
parentData[parentDataProperty] = coerced0;
}
}
}
if(typeof data == "string" && parentData !== undefined){
data = func4(data);
parentData[parentDataProperty] = data;
}
if(typeof data === "string"){
if(func2(data) < 1){
const err1 = {instancePath,schemaPath:"#/minLength",keyword:"minLength",params:{limit: 1},message:"must NOT have fewer than 1 characters"};
if(vErrors === null){
vErrors = [err1];
}
else {
vErrors.push(err1);
}
errors++;
}
}
validate53.errors = vErrors;
return errors === 0;
}

validate53.schema = schema71;;export const exported_by_transform = true;