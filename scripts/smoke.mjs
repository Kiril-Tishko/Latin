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
  for (const [label, file] of [["Lectiōnēs", "lessons"], ["Rēgulae", "rules"], ["Verba", "words"], ["Inventiō", "discover"]]) {
    await p.locator(nav, { hasText: label }).first().click();
    await p.waitForTimeout(300);
    await p.screenshot({ path: `${out}/${name}-${file}.png`, fullPage: true });
  }
  // open mystery cards: every card keeps its spot in the deck while others open
  await p.locator(nav, { hasText: "Inventiō" }).first().click();
  // (the mouse is moved off the tiles first: a hovered tile lifts by 2px)
  const spots = () => p.mouse.move(1, 1).then(() => p.waitForTimeout(300)).then(() => p.locator(".deck-tile").evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return `${Math.round(r.x)},${Math.round(r.y + scrollY)}`; }).join(" ")));
  const before = await spots();
  // five unopened cards at a time
  const backs = await p.locator(".deck-tile:not(.face)").count();
  if (backs < 1 || backs > 5) errors.push(`${name}: ${backs} unopened cards on the table (expected 1-5)`);
  await p.locator(".deck-head .btn").click();
  await p.waitForTimeout(700);
  await p.screenshot({ path: `${out}/${name}-card.png` });
  await p.locator("button", { hasText: "Next new card" }).click();
  await p.waitForTimeout(500);
  await p.locator(".card-modal button[aria-label='Close']").click();
  await p.waitForTimeout(500);
  if ((await spots()) !== before) errors.push(`${name}: deck tiles moved after opening cards`);
  if ((await p.locator(".deck-tile.face").count()) < 2) errors.push(`${name}: opened cards are not shown face up`);
  await p.screenshot({ path: `${out}/${name}-deck.png`, fullPage: true });
  // a lesson page
  await p.locator(nav, { hasText: "Lectiōnēs" }).first().click();
  await p.locator(".lesson-card").nth(3).click();
  await p.waitForTimeout(300);
  await p.screenshot({ path: `${out}/${name}-lesson4.png`, fullPage: true });
  // train: the current step (Lesson I), its rule refresher first, then three exercises
  await p.locator(nav, { hasText: "Exercitium" }).first().click();
  await p.waitForTimeout(200);
  await p.screenshot({ path: `${out}/${name}-chooser.png`, fullPage: true });
  await p.locator(".step-panel .btn.big").click();
  await p.waitForTimeout(200);
  await p.screenshot({ path: `${out}/${name}-rules-first.png`, fullPage: true });
  await p.locator("button", { hasText: "Start exercises" }).click();
  for (let i = 0; i < 3; i++) {
    await p.waitForTimeout(200);
    if (i === 1) {
      await p.locator(".ex-actions button", { hasText: "Rule" }).click();
      await p.waitForTimeout(100);
      if (!(await p.locator(".rule-box").count())) errors.push(`${name}: the Rule button shows no rule`);
    }
    if (await p.locator(".word-btn").count()) await p.locator(".word-btn").first().click();
    else {
      await p.locator("#answer-input").fill(i === 0 ? "puella" : "agricola aquam portat");
      await p.screenshot({ path: `${out}/${name}-train-${i}-q.png` });
      await p.locator("#answer-input").press("Enter");
    }
    await p.waitForTimeout(250);
    await p.screenshot({ path: `${out}/${name}-train-${i}-a.png` });
    await p.locator("button", { hasText: "Next" }).click();
  }
  // ask drawer opens (no Claude outside claude.ai: shows the fallback)
  await p.locator(".ask-btn").click();
  await p.waitForTimeout(300);
  await p.screenshot({ path: `${out}/${name}-ask.png` });
  await ctx.close();
}

// Audio, with fake Italian and Spanish voices (headless Chromium has none): speaker
// buttons appear, clicks speak the respelled Latin (Spanish preferred, stress marked
// with acute accents only), listening exercises play by themselves.
async function audio() {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(() => {
    const voices = [
      { name: "Alice", lang: "it-IT", voiceURI: "alice", localService: true, default: false },
      { name: "Mónica", lang: "es-ES", voiceURI: "monica", localService: true, default: false },
    ];
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
  await p.locator(".nav button", { hasText: "Lectiōnēs" }).click();
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
  if (!spoken.some((t) => /disquípula|maguístra/.test(t))) errors.push(`audio: no respelled Latin in ${JSON.stringify(spoken.slice(0, 3))}`);
  if (spoken.some((t) => /[àèìòù]/.test(t))) errors.push(`audio: grave accents would be spelled out: ${JSON.stringify(spoken.slice(0, 3))}`);
  await p.locator(".nav button", { hasText: "Exercitium" }).click();
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

// Ask Claude, with a fake sample capability: a suggested question waits in the box
// until it is sent, the answer appears, and a failure offers Try again.
async function askClaude() {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(() => {
    window.__asked = [];
    window.__fail = null;
    const sample = (input, opts) => {
      window.__asked.push(input);
      if (window.__fail) return Promise.reject(window.__fail);
      return new Promise((res) => setTimeout(() => {
        const text = "The ending «-am» marks the object.";
        opts?.onText?.({ text, delta: text });
        res({ text, truncated: false });
      }, 50));
    };
    sample.json = async () => ({ correct: false, explanation: "no" });
    window.claude = { use: async (name) => (name === "sample" ? sample : null) };
  });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(`ask: ${e.message}`));
  await p.goto(`file://${page}`);
  await p.waitForTimeout(800);
  await p.locator("button", { hasText: "Ask Claude what to practise today" }).click();
  await p.waitForTimeout(300);
  if (!(await p.locator("#ask-input").inputValue()).includes("practise")) errors.push("ask: no suggested question in the box");
  if ((await p.evaluate(() => window.__asked.length)) !== 0) errors.push("ask: the suggestion was sent without the learner pressing Ask");
  await p.locator("#ask-input").press("Enter");
  await p.waitForTimeout(400);
  const answer = await p.locator(".msg.assistant").last().textContent();
  if (!answer.includes("marks the object")) errors.push(`ask: no answer shown (${answer.slice(0, 80)})`);
  await p.evaluate(() => { window.__fail = { code: "upstream_error", message: "simulated" }; });
  await p.locator("#ask-input").fill("And the ablative?");
  await p.locator("#ask-input").press("Enter");
  await p.waitForTimeout(400);
  if (!(await p.locator("button", { hasText: "Try again" }).count())) errors.push("ask: a failed answer offers no Try again");
  await p.screenshot({ path: `${out}/ask-error.png` });
  await ctx.close();
}

await askClaude();
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
