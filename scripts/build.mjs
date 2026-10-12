// Bundles src/main.tsx into the page of a claude.ai artifact and its files.
//
// The artifact publisher wraps the page in its own <!doctype html><head><body>
// skeleton, so the published page starts with <title> and <style> and holds no
// document tags of its own. The code is a file beside it (tabula-<hash>.js,
// named by its content so a browser never runs an old copy with a new page),
// and so are the messenger's photos, portraits and engravings: dist/publish.json lists them all for the
// Artifact tool's `files`. dist/preview.html wraps the same page in an
// equivalent skeleton for local testing in a browser.
import * as esbuild from "esbuild";
import { createHash } from "node:crypto";
import { cp, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = resolve(root, "dist");
const watch = process.argv.includes("--watch");
const dev = watch || process.argv.includes("--dev");

const TITLE = "Tabula Latina";
const FONTS =
  "https://fonts.googleapis.com/css2?family=Alegreya:ital,wght@0,400..900;1,400..900" +
  "&family=Alegreya+Sans:ital,wght@0,400;0,500;0,700;1,400&family=Cinzel:wght@400..800&display=swap";

// The reset the artifact skeleton adds; repeated in the preview so both render alike.
const SKELETON_RESET =
  ":root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}" +
  "body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}";

// The page holds no code: with the minified code inlined, the publisher once
// took the page for a code-review page ("artifact-pr-review machinery") and
// refused it. It also reads `id="data…` anywhere in a page as that mark.
const REVIEW_MARK = /\bid\s*=\s*["'`]data/i;

/** @param {string} css @param {string} script */
function assemble(css, script) {
  const page = [
    `<title>${TITLE}</title>`,
    `<style>${css.replace(/<\/style/gi, "<\\/style")}</style>`,
    `<link rel="preconnect" href="https://fonts.googleapis.com">`,
    `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>`,
    `<link rel="stylesheet" href="${FONTS}">`,
    `<div id="app"></div>`,
    `<script src="${script}"></script>`,
  ].join("\n");
  if (REVIEW_MARK.test(page)) throw new Error('the page holds id="data…, which the publisher refuses');
  return page;
}

function previewPage(content) {
  return (
    `<!doctype html><html><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">` +
    `<style>${SKELETON_RESET}</style></head><body>${content}</body></html>`
  );
}

/** Files beside the page: the messenger's pictures (src/content/<dir>/*.webp) and the recorded voice's packs (audio/*.js). */
const MEDIA = ["photos", "portraits", "engravings", "audio"];

const kb = (text) => `${(Buffer.byteLength(text) / 1024).toFixed(1)} KB`;

async function emit(result) {
  if (result.errors.length) return;
  const files = result.outputFiles ?? [];
  const js = files.find((f) => f.path.endsWith(".js"))?.text ?? "";
  const css = files.find((f) => f.path.endsWith(".css"))?.text ?? "";
  const script = `tabula-${createHash("sha256").update(js).digest("hex").slice(0, 10)}.js`;
  const page = assemble(css, script);
  await mkdir(outDir, { recursive: true });
  for (const f of await readdir(outDir)) if (/^tabula-[0-9a-f]+\.js$/.test(f)) await rm(resolve(outDir, f));
  await writeFile(resolve(outDir, script), js);
  await writeFile(resolve(outDir, "tabula-latina.html"), page);
  await writeFile(resolve(outDir, "preview.html"), previewPage(page));
  const publish = { [script]: `dist/${script}` };
  for (const dir of MEDIA) {
    await rm(resolve(outDir, dir), { recursive: true, force: true });
    await cp(resolve(root, "src/content", dir), resolve(outDir, dir), { recursive: true });
    for (const f of (await readdir(resolve(outDir, dir))).sort()) publish[`${dir}/${f}`] = `dist/${dir}/${f}`;
  }
  await writeFile(resolve(outDir, "publish.json"), JSON.stringify(publish, null, 1) + "\n");
  console.log(`built dist/tabula-latina.html (${kb(page)}) and dist/${script} (${kb(js)})`);
}

const options = {
  entryPoints: [resolve(root, "src/main.tsx")],
  bundle: true,
  write: false,
  outdir: outDir,
  format: "iife",
  target: "es2020",
  minify: !dev,
  sourcemap: false,
  jsx: "automatic",
  jsxImportSource: "preact",
  legalComments: "none",
  logLevel: "info",
  define: { "process.env.NODE_ENV": watch ? '"development"' : '"production"' },
  plugins: [{ name: "assemble", setup: (b) => b.onEnd(emit) }],
};

if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  console.log("watching src/ for changes…");
} else {
  const result = await esbuild.build(options);
  if (result.errors.length) process.exit(1);
}
