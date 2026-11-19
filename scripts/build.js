// Copies the plain site (no bundling) into dist/ for Hostinger auto-deploy.
const fs = require("fs"), path = require("path");
const out = "dist";
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out);
for (const f of fs.readdirSync(".")) if (f.endsWith(".html")) fs.copyFileSync(f, path.join(out, f));
for (const d of ["css", "js", "icons"]) fs.cpSync(d, path.join(out, d), { recursive: true });
for (const f of ["sw.js", "manifest.webmanifest"]) fs.copyFileSync(f, path.join(out, f));
fs.writeFileSync(path.join(out, ".htaccess"),
`# Keys99 CRM: plain multi-page site. Pages, scripts and styles are re-checked on every visit.
DirectoryIndex index.html
<IfModule mod_headers.c>
  <FilesMatch "\\.(html|js|css|webmanifest)$">
    Header set Cache-Control "no-cache"
  </FilesMatch>
</IfModule>
`);
// same safety check as the GitHub Pages workflow: every linked page must exist
let missing = 0;
const files = [...fs.readdirSync(out).filter(f => f.endsWith(".html")).map(f => path.join(out, f)),
  ...fs.readdirSync(path.join(out, "js")).map(f => path.join(out, "js", f))];
const refs = new Set();
for (const f of files) for (const m of fs.readFileSync(f, "utf8").matchAll(/[a-z0-9-]+\.html/g)) refs.add(m[0]);
for (const r of refs) if (!fs.existsSync(path.join(out, r))) { console.error(r + " is linked but missing"); missing = 1; }
console.log("built", out, fs.readdirSync(out).length, "entries");
process.exit(missing);
