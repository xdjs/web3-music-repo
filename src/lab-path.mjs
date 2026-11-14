// Keep the original domain working while publishing a separate Lab path.
export const LAB_PATH = "/web3-music-archive";
const roots = /(["'`(=]|,\s+)\/(?!\/)(?=(?:api|src|media|collectors|people|recovered|social|catalog|account|share|sequence|prototype|assets)\/|(?:favicon\.svg|musicnerd-lenses\.png)(?:["'`?#]))/g;
export function labText(text) {
  return text.replace(roots, "$1" + LAB_PATH + "/").replace(/(["'`])\/#/g, "$1" + LAB_PATH + "/#");
}
export function stripLabPath(path) {
  return path === LAB_PATH ? "/" : path.startsWith(LAB_PATH + "/") ? path.slice(LAB_PATH.length) : path;
}
export function labData(value) {
  if (typeof value === "string") return /^\/(?:media|people|collectors|recovered|social|assets)\//.test(value) ? LAB_PATH + value : value;
  if (Array.isArray(value)) return value.map(labData);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k,v]) => [k,labData(v)]));
  return value;
}
