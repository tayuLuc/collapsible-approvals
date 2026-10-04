// collapsible-approvals — host-side stub entry. Exists so the cordis loader has
// a plugin entry whose package declares `dsh.client`; the web client-module
// scanner serves lib/client.js to the browser. Logic lives in the client half.
const name = "collapsible-approvals";
const inject = [];
function apply() {}
export { name, inject, apply };
