"use strict";
const fs = require("fs");
const path = require("path");
const root = __dirname;
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const re = /(?:src|href)="([^"]+)"/g;
const refs = [...html.matchAll(re)].map(m => m[1]).filter(u => !u.startsWith("http"));
const bad = [];
for (const r of refs) {
  const f = path.join(root, r.split("#")[0]);
  if (!fs.existsSync(f)) bad.push(r);
}
console.log(bad.length ? "MISSING: " + bad.join(", ") : "ALL " + refs.length + " LOCAL REFS OK");
console.log("refs:", refs.join(" | "));
