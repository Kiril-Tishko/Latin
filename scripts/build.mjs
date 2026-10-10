// Bundles src/main.tsx into one self-contained page for a claude.ai artifact.
//
// The artifact publisher wraps the file in its own <!doctype html><head><body>
// skeleton, so the published file starts with <title> and <style> and holds no
// document tags of its own. dist/preview.html wraps the same content in an
// equivalent skeleton for local testing in a browser.
import * as esbuild from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";
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

/** @param {esbuild.OutputFile[]} files */
function assemble(files) {
  const js = files.find((f) => f.path.endsWith(".js"))?.text ?? "";
  const css = files.find((f) => f.path.endsWith(".css"))?.text ?? "";
  const safeJs = js.replace(/<\/script/gi, "<\\/script");
  const safeCss = css.replace(/<\/style/gi, "<\\/style");
  return [
    `<title>${TITLE}</title>`,
    `<style>${safeCss}</style>`,
    `<link rel="preconnect" href="https://fonts.googleapis.com">`,
    `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>`,
    `<link rel="stylesheet" href="${FONTS}">`,
    `<div id="app"></div>`,
    `<script>${safeJs}</script>`,
  ].join("\n");
}

function previewPage(content) {
  return (
    `<!doctype html><html><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">` +
    `<style>${SKELETON_RESET}</style></head><body>${content}</body></html>`
  );
}

async function emit(result) {
  if (result.errors.length) return;
  const page = assemble(result.outputFiles ?? []);
  await mkdir(outDir, { recursive: true });
  await writeFile(resolve(outDir, "tabula-latina.html"), page);
  await writeFile(resolve(outDir, "preview.html"), previewPage(page));
  const kb = (Buffer.byteLength(page) / 1024).toFixed(1);
  console.log(`built dist/tabula-latina.html (${kb} KB)`);
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
