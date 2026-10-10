// Smoke test: opens the built page in Chromium, clicks through every section,
// answers a few exercises, and saves screenshots. Fails on any page error.
// Usage: npm run build && npm run smoke -- [outDir]
import { chromium } from "playwright-core";
import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const out = resolve(process.argv[2] ?? "dist/screens");
mkdirSync(out, { recursive: true });
const page = resolve("dist/preview.html");
const exe = ["/opt/pw-browsers/chromium-1194/chrome-linux/chrome", "/opt/pw-browsers/chromium/chrome-linux/chrome"].find(existsSync);
const browser = await chromium.launch({ executablePath: exe });
const errors = [];

async function run(name, viewport, colorScheme) {
  const ctx = await browser.newContext({ viewport, colorScheme });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(`${name}: ${e.message}`));
  p.on("console", (m) => m.type() === "error" && !/fonts\.g/.test(m.text()) && errors.push(`${name} console: ${m.text()}`));
  await p.goto(`file://${page}`);
  await p.waitForTimeout(1200);
  await p.screenshot({ path: `${out}/${name}-home.png`, fullPage: true });
  const mobile = viewport.width < 760;
  const nav = mobile ? ".bottomnav button" : ".nav button";
  for (const label of ["Lessons", "Rules", "Words", "Discover"]) {
    await p.locator(nav, { hasText: label }).first().click();
    await p.waitForTimeout(300);
    await p.screenshot({ path: `${out}/${name}-${label.toLowerCase()}.png`, fullPage: true });
  }
  // open a mystery card
  await p.locator(nav, { hasText: "Discover" }).first().click();
  await p.locator(".card-front").click();
  await p.waitForTimeout(900);
  await p.screenshot({ path: `${out}/${name}-card.png`, fullPage: true });
  // a lesson page
  await p.locator(nav, { hasText: "Lessons" }).first().click();
  await p.locator(".lesson-card").nth(3).click();
  await p.waitForTimeout(300);
  await p.screenshot({ path: `${out}/${name}-lesson4.png`, fullPage: true });
  // train: mixed practice, answer three exercises
  await p.locator(nav, { hasText: "Train" }).first().click();
  await p.locator("button", { hasText: "Mixed practice" }).first().click();
  for (let i = 0; i < 3; i++) {
    await p.waitForTimeout(200);
    if (await p.locator(".word-btn").count()) await p.locator(".word-btn").first().click();
    else {
      await p.locator("#answer-input").fill(i === 0 ? "puella" : "agricola aquam portat");
      await p.screenshot({ path: `${out}/${name}-train-${i}-q.png`, fullPage: true });
      await p.locator("#answer-input").press("Enter");
    }
    await p.waitForTimeout(250);
    await p.screenshot({ path: `${out}/${name}-train-${i}-a.png`, fullPage: true });
    await p.locator("button", { hasText: "Next" }).click();
  }
  // ask drawer opens (no Claude outside claude.ai: shows the fallback)
  await p.locator(".fab").click();
  await p.waitForTimeout(300);
  await p.screenshot({ path: `${out}/${name}-ask.png` });
  await ctx.close();
}

// Audio, with a fake Italian voice (headless Chromium has none): speaker buttons
// appear, clicks speak the respelled Latin, listening exercises play by themselves.
async function audio() {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(() => {
    const voices = [{ name: "Alice", lang: "it-IT", voiceURI: "alice", localService: true, default: false }];
    window.__spoken = [];
    const synth = {
      getVoices: () => voices,
      speak: (u) => {
        window.__spoken.push(u.text);
        setTimeout(() => u.onend && u.onend(), 120);
      },
      cancel: () => {},
      addEventListener: () => {},
    };
    Object.defineProperty(window, "speechSynthesis", { value: synth, configurable: true });
    window.SpeechSynthesisUtterance = class {
      constructor(text) {
        this.text = text;
      }
    };
  });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(`audio: ${e.message}`));
  await p.goto(`file://${page}`);
  await p.waitForTimeout(800);
  await p.locator(".nav button", { hasText: "Lessons" }).click();
  await p.locator(".lesson-card").nth(1).click();
  const speakers = await p.locator(".speak").count();
  if (speakers < 20) errors.push(`audio: only ${speakers} speaker buttons on lesson II`);
  await p.locator(".speak").first().click();
  await p.waitForTimeout(300);
  await p.locator("button", { hasText: "Listen & repeat" }).click();
  await p.waitForTimeout(2500);
  await p.screenshot({ path: `${out}/audio-lesson.png` });
  await p.locator("button", { hasText: "Stop" }).first().click().catch(() => {});
  const spoken = await p.evaluate(() => window.__spoken);
  if (spoken.length < 3) errors.push(`audio: listen & repeat spoke ${spoken.length} lines`);
  if (!spoken.some((t) => /dischìpula|maghìstra/.test(t))) errors.push(`audio: no respelled Latin in ${JSON.stringify(spoken.slice(0, 3))}`);
  await p.locator(".nav button", { hasText: "Train" }).click();
  await p.locator("button", { hasText: "Listening" }).first().click();
  await p.waitForTimeout(400);
  const before = (await p.evaluate(() => window.__spoken)).length;
  if (before <= spoken.length) errors.push("audio: listening exercise did not play by itself");
  await p.screenshot({ path: `${out}/audio-listen.png` });
  await p.locator("#answer-input").fill("puella ambulat");
  await p.locator("#answer-input").press("Enter");
  await p.waitForTimeout(200);
  await p.screenshot({ path: `${out}/audio-listen-answer.png` });
  console.log(`audio ok: ${speakers} speakers, ${before} utterances, e.g. ${JSON.stringify(spoken.slice(1, 3))}`);
  await ctx.close();
}

await audio();
await run("desktop-light", { width: 1280, height: 900 }, "light");
await run("desktop-dark", { width: 1280, height: 900 }, "dark");
await run("phone-light", { width: 390, height: 844 }, "light");
await browser.close();
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`ok, screenshots in ${out}`);
