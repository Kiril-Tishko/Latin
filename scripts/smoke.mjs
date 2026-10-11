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
  // Latin in English, from the lessons list, and its find-the-Latin round
  await p.locator(nav, { hasText: "Lectiōnēs" }).first().click();
  await p.locator(".lesson-card", { hasText: "Latin in English" }).click();
  await p.waitForTimeout(300);
  if ((await p.locator(".en-section").count()) !== 12) errors.push(`${name}: the Latin in English page is missing sections`);
  if (!(await p.locator(".en-card").count())) errors.push(`${name}: no words of yours on the Latin in English page`);
  await p.screenshot({ path: `${out}/${name}-english.png` });
  await p.locator("button", { hasText: "Practise: find the Latin" }).first().click();
  await p.waitForTimeout(200);
  await p.locator("#answer-input").fill("aqua");
  await p.locator("#answer-input").press("Enter");
  await p.waitForTimeout(200);
  if (!(await p.locator(".verdict").count())) errors.push(`${name}: the find-the-Latin exercise gives no verdict`);
  await p.screenshot({ path: `${out}/${name}-english-quiz.png` });
  await p.locator(".trainer-top button", { hasText: "End" }).click();
  await p.locator("button", { hasText: "Choose another practice" }).click();
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
// until it is sent, the answer appears, and a failure offers Try again. Every
// question carries what is on screen: the exercise, the lines of a lesson in view
// and the line tapped, an open dialog (which stays open beside the chat).
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
  const lastAsked = () => p.evaluate(() => window.__asked.at(-1).at(-1).content);
  // on the home page Claude does not see the screen until the eye is switched on
  if (!(await lastAsked()).includes("[Screen not shared")) errors.push("ask: on the home page the screen should not be shared by default");
  await p.locator(".drawer-sees").click();
  if ((await p.locator(".drawer-sees").getAttribute("aria-pressed")) !== "true") errors.push("ask: the eye does not switch sharing on");
  await p.evaluate(() => { window.__fail = { code: "upstream_error", message: "simulated" }; });
  await p.locator("#ask-input").fill("And the ablative?");
  await p.locator("#ask-input").press("Enter");
  await p.waitForTimeout(400);
  if (!(await p.locator("button", { hasText: "Try again" }).count())) errors.push("ask: a failed answer offers no Try again");
  if (!(await lastAsked()).includes("[Where the learner is: Home")) errors.push("ask: with the eye on, the home page is not described");
  await p.screenshot({ path: `${out}/ask-error.png` });
  await p.evaluate(() => { window.__fail = null; });
  await p.keyboard.press("Escape");
  const askHere = async (q) => {
    await p.locator(".ask-btn").click();
    await p.waitForTimeout(150);
    const sees = await p.locator(".drawer-sees").textContent();
    await p.locator("#ask-input").fill(q);
    await p.locator("#ask-input").press("Enter");
    await p.waitForTimeout(200);
    await p.keyboard.press("Escape");
    return { sees, sent: await lastAsked() };
  };
  // an exercise: Claude sees it, and that it is not answered yet
  await p.locator(".nav button", { hasText: "Exercitium" }).click();
  await p.locator(".step-panel .btn.big").click();
  await p.locator("button", { hasText: "Start exercises" }).click();
  await p.waitForTimeout(200);
  const ex = await askHere("What goes here?");
  if (!ex.sees.includes("Exercise 1 of") || !ex.sent.includes("Not answered yet")) errors.push(`ask: the exercise on screen is not described (${ex.sees})`);
  // switched off mid-conversation: the next question goes without the screen or any pointer back to it
  await p.locator(".ask-btn").click();
  await p.locator(".drawer-sees").click();
  await p.locator("#ask-input").fill("And in general?");
  await p.locator("#ask-input").press("Enter");
  await p.waitForTimeout(200);
  const general = await p.evaluate(() => window.__asked.at(-1).map((m) => m.content).join("\n"));
  if (!general.includes("[Screen not shared") || general.includes("Not answered yet") || general.includes("[Asked on:")) errors.push("ask: with the eye off, the screen still reaches Claude");
  await p.locator(".drawer-sees").click();
  await p.keyboard.press("Escape");
  // a lesson page scrolled to its story, a word tapped
  await p.locator(".nav button", { hasText: "Lectiōnēs" }).click();
  await p.locator(".lesson-card").nth(1).click();
  await p.locator("[data-ask^='Story']").scrollIntoViewIfNeeded();
  await p.locator("[data-ask^='Story'] .ex-line .w").first().click();
  const story = await askHere("What does this line mean?");
  if (!story.sees.includes("Story") || !story.sent.includes("Last tapped") || !story.sent.includes("[Story")) errors.push(`ask: the lesson part in view or the line tapped is missing (${story.sees})`);
  // a word dialog stays open beside the chat and is read; Escape closes the chat first
  await p.locator(".nav button", { hasText: "Verba" }).click();
  await p.locator(".word-tile").first().click();
  await p.locator("button", { hasText: "Ask Claude about it" }).click();
  await p.waitForTimeout(150);
  if (!(await p.locator(".modal").count())) errors.push("ask: asking about a word closed the word");
  if (!(await p.locator(".modal", { hasText: "In English" }).count())) errors.push("ask: the word dialog shows no English relatives");
  await p.locator("#ask-input").press("Enter");
  await p.waitForTimeout(200);
  if (!(await lastAsked()).includes("Text of the open dialog")) errors.push("ask: the open word is not described");
  await p.screenshot({ path: `${out}/ask-beside-word.png` });
  await p.keyboard.press("Escape");
  await p.waitForTimeout(100);
  if ((await p.locator(".drawer").count()) || !(await p.locator(".modal").count())) errors.push("ask: Escape should close the chat and leave the word open");
  await ctx.close();
}

// Saved conversations, with a fake account store shared by two "devices": the draft
// survives a reload, a conversation started on one device continues on the other
// (and shows up there live), and a deletion reaches both.
async function conversations() {
  const shared = new Map();
  const runtime = () => {
    const sample = (input, opts) => new Promise((res) => setTimeout(() => {
      const text = "An answer.";
      opts?.onText?.({ text, delta: text });
      res({ text, truncated: false, modelTierApplied: "default" });
    }, 100));
    sample.json = async () => ({});
    const docRef = (path) => ({
      get: async () => { const d = await window.__dbGet(path); return { exists: !!d, data: () => d ?? undefined }; },
      set: async (data) => void (await window.__dbSet(path, JSON.parse(JSON.stringify(data)))),
      delete: async () => void (await window.__dbDel(path)),
      collection: (sub) => colRef(`${path}/${sub}`),
      onSnapshot: () => () => {},
    });
    const colRef = (path) => ({
      doc: (id) => docRef(`${path}/${id}`),
      orderBy: () => ({ limit: (n) => ({ onSnapshot: (next) => {
        let last = "";
        const tick = async () => {
          const docs = await window.__dbList(path);
          const sig = JSON.stringify(docs);
          if (sig === last) return;
          last = sig;
          next({ docs: docs.slice(0, n).map((d) => ({ id: d.id, data: () => d.data })) });
        };
        void tick();
        const t = setInterval(tick, 150);
        return () => clearInterval(t);
      } }) }),
    });
    const db = { doc: docRef, collection: colRef };
    window.claude = { use: async (n) => (n === "sample" ? sample : n === "db" ? db : n === "user" ? { id: async () => "u1" } : null) };
  };
  const device = async (name) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await ctx.addInitScript(runtime);
    const p = await ctx.newPage();
    p.on("pageerror", (e) => errors.push(`${name}: ${e.message}`));
    await p.exposeFunction("__dbGet", (path) => shared.get(path) ?? null);
    await p.exposeFunction("__dbSet", (path, data) => void shared.set(path, data));
    await p.exposeFunction("__dbDel", (path) => void shared.delete(path));
    await p.exposeFunction("__dbList", (col) => [...shared.entries()].filter(([k]) => k.startsWith(col + "/") && !k.slice(col.length + 1).includes("/")).map(([k, data]) => ({ id: k.slice(col.length + 1), data })));
    await p.goto(`file://${page}`);
    await p.waitForTimeout(700);
    return { p, ctx };
  };
  const pc = await device("pc");
  await pc.p.locator(".ask-btn").click();
  await pc.p.locator("#ask-input").fill("Why -t?");
  await pc.p.waitForTimeout(400);
  await pc.p.reload();
  await pc.p.waitForTimeout(900);
  if ((await pc.p.locator("#ask-input").inputValue()) !== "Why -t?") errors.push("conversations: the typed question was lost on reload");
  await pc.p.locator("#ask-input").press("Enter");
  await pc.p.waitForTimeout(600);
  const phone = await device("phone");
  await phone.p.locator(".ask-btn").click();
  await phone.p.locator("button", { hasText: "Conversations" }).click();
  await phone.p.waitForTimeout(300);
  if ((await phone.p.locator(".chat-title").allTextContents())[0] !== "Why -t?") errors.push("conversations: the other device does not list the conversation");
  await phone.p.locator(".chat-open").first().click();
  await phone.p.locator("#ask-input").fill("And with tū?");
  await phone.p.locator("#ask-input").press("Enter");
  await pc.p.waitForTimeout(900);
  const onPc = await pc.p.locator(".msg.user .msg-text").allTextContents();
  if (!onPc.includes("And with tū?")) errors.push(`conversations: the follow-up did not reach the first device (${JSON.stringify(onPc)})`);
  await phone.p.locator("button", { hasText: "Conversations" }).click();
  await phone.p.locator(".chat-row button[title='Delete']").first().click();
  await phone.p.locator(".chat-row button", { hasText: "Delete" }).click();
  await pc.p.waitForTimeout(700);
  await pc.p.locator("button", { hasText: "Conversations" }).click();
  if (await pc.p.locator(".chat-title").count()) errors.push("conversations: a deleted conversation stayed on the other device");
  await pc.ctx.close();
  await phone.ctx.close();
}

// The chat never jumps while reading or typing: a sent question glides to the top
// and its answer fills the room below; anything new below the screen shows a
// "New message" button instead of moving the view.
async function chatScroll() {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 700 } });
  await ctx.addInitScript(() => {
    window.__delay = 120;
    const long = Array.from({ length: 16 }, (_, i) => `Line ${i + 1}: the ending «-am» marks the object, so the words can come in any order.`).join("\n\n");
    const sample = (input, opts) => new Promise((res) => setTimeout(() => {
      opts?.onText?.({ text: long, delta: long });
      res({ text: long, truncated: false });
    }, window.__delay));
    sample.json = async () => ({});
    window.claude = { use: async (n) => (n === "sample" ? sample : null) };
  });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(`scroll: ${e.message}`));
  await p.goto(`file://${page}`);
  await p.waitForTimeout(700);
  await p.locator(".ask-btn").click();
  for (const q of ["One?", "Two?"]) {
    await p.locator("#ask-input").fill(q);
    await p.locator("#ask-input").press("Enter");
    await p.waitForTimeout(700);
  }
  const body = p.locator(".drawer-body");
  // typing while reading higher up leaves the conversation where it is
  await body.evaluate((b) => b.scrollTo({ top: 0 }));
  await p.waitForTimeout(100);
  await p.locator("#ask-input").pressSequentially("abc");
  await p.waitForTimeout(200);
  if ((await body.evaluate((b) => b.scrollTop)) !== 0) errors.push("scroll: typing moved the conversation");
  // a question glides to the top; its long answer arrives without moving the view
  await p.evaluate(() => { window.__delay = 1600; });
  await p.locator("#ask-input").fill("Three?");
  await p.locator("#ask-input").press("Enter");
  await p.waitForTimeout(1100);
  const at = () => body.evaluate((b) => { const q = [...b.querySelectorAll(".msg.user")].pop(); return Math.round(q.getBoundingClientRect().top - b.getBoundingClientRect().top); });
  const glided = await at();
  if (Math.abs(glided - 12) > 30) errors.push(`scroll: the sent question did not glide to the top (${glided}px)`);
  await p.waitForTimeout(1000);
  if (Math.abs((await at()) - glided) > 2) errors.push("scroll: the arriving answer moved the conversation");
  if (!(await p.locator(".to-latest.new").count())) errors.push("scroll: no New message button for an answer below the screen");
  await p.screenshot({ path: `${out}/ask-new-message.png` });
  await p.locator(".to-latest").click();
  await p.waitForTimeout(900);
  if (await p.locator(".to-latest").count()) errors.push("scroll: the New message button does not go down to the message");
  await ctx.close();
}

await conversations();
await chatScroll();
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
