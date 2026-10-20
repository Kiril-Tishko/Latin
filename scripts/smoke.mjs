// Smoke test: opens the built page in Chromium, clicks through every section,
// answers a few exercises, and saves screenshots. Fails on any page error.
// Usage: npm run build && npm run smoke -- [outDir]
import { chromium } from "playwright-core";
import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const out = resolve(process.argv[2] ?? "dist/screens");
mkdirSync(out, { recursive: true });
const page = resolve("dist/preview.html");
const exe = ["/opt/pw-browsers/chromium-1194/chrome-linux/chrome", "/opt/pw-browsers/chromium/chrome-linux/chrome"].find(existsSync);
const browser = await chromium.launch({ executablePath: exe });
const errors = [];

// A learner who has learned the rules of Lessons I-II and practises rule 3.1 (seen on an
// earlier day, so its reminder comes first): most tests run as this learner.
const LEARNED = ["1.1", "1.2", "1.3", "1.4", "1.5", "2.1", "2.2", "2.3", "2.4", "2.5", "2.6", "2.7"];
const SEED = JSON.stringify({
  version: 5,
  updatedAt: 1,
  lessonsDone: [1, 2, 3, 4],
  focusLesson: 3,
  parts: Object.fromEntries([...LEARNED.map((id) => [id, { seen: 1, right: 10, learned: 1 }]), ["3.1", { seen: 1, right: 2 }]]),
  // an earlier mistake on the rule in practice: it comes back in the rule's round
  mistakes: [{ at: 1000, kind: "ending", prompt: "I read the book.", answer: "a", expected: "um", skills: ["n2.acc.sg"], notes: [], words: ["liber", "lego"] }],
});
const seed = (ctx) =>
  ctx.addInitScript((data) => {
    if (!localStorage.getItem("tabula-latina-progress-v1")) localStorage.setItem("tabula-latina-progress-v1", data);
  }, SEED);

async function run(name, viewport, colorScheme) {
  const ctx = await browser.newContext({ viewport, colorScheme });
  await seed(ctx);
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(`${name}: ${e.message}`));
  p.on("console", (m) => m.type() === "error" && !/fonts\.g/.test(m.text()) && errors.push(`${name} console: ${m.text()}`));
  await p.goto(`file://${page}`);
  await p.waitForTimeout(1200);
  await p.screenshot({ path: `${out}/${name}-home.png`, fullPage: true });
  const mobile = viewport.width < 760;
  const nav = mobile ? ".bottomnav button" : ".nav button";
  const hash = async (h) => {
    await p.evaluate((h) => { location.hash = h; }, h);
    await p.waitForTimeout(300);
  };
  // Domus: one Continue button, saying what it will do; four tabs in all
  if ((await p.locator(nav).count()) !== 4) errors.push(`${name}: ${await p.locator(nav).count()} tabs (expected 4)`);
  if (!(await p.locator("#continue").count())) errors.push(`${name}: Domus has no Continue button`);
  if (!((await p.locator(".home-step").textContent()) ?? "").includes("3.1")) errors.push(`${name}: Domus does not name the rule in practice`);
  if (await p.locator(".also-card").count()) errors.push(`${name}: Domus has more than the Continue card`);
  for (const [label, file] of [["Lectiōnēs", "lessons"], ["Verba", "words"]]) {
    await p.locator(nav, { hasText: label }).first().click();
    await p.waitForTimeout(300);
    await p.screenshot({ path: `${out}/${name}-${file}.png`, fullPage: true });
  }
  // Verba: five mystery cards on top; an opened card turns face up where it lies
  await p.locator(nav, { hasText: "Verba" }).first().click();
  // (the mouse is moved off the tiles first: a hovered tile lifts by 2px)
  const spots = () => p.mouse.move(1, 1).then(() => p.waitForTimeout(300)).then(() => p.locator(".deck-strip .deck-tile").evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return `${Math.round(r.x)},${Math.round(r.y + scrollY)}`; }).join(" ")));
  const before = await spots();
  const backs = await p.locator(".deck-strip .deck-tile:not(.face)").count();
  if (backs < 1 || backs > 5) errors.push(`${name}: ${backs} unopened cards on the table (expected 1-5)`);
  await p.locator(".deck-strip .deck-tile:not(.face)").first().click();
  await p.waitForTimeout(700);
  await p.screenshot({ path: `${out}/${name}-card.png` });
  await p.locator("button", { hasText: "Next new card" }).click();
  await p.waitForTimeout(500);
  await p.locator(".card-modal button[aria-label='Close']").click();
  await p.waitForTimeout(500);
  if ((await spots()) !== before) errors.push(`${name}: the cards moved after opening some`);
  if ((await p.locator(".deck-strip .deck-tile.face").count()) < 2) errors.push(`${name}: opened cards are not shown face up`);
  await p.locator(".words-bar button", { hasText: /^Cards/ }).click();
  if ((await p.locator(".word-tile").count()) < 2) errors.push(`${name}: the Cards filter does not show the cards opened`);
  await p.screenshot({ path: `${out}/${name}-words-cards.png`, fullPage: true });
  // a lesson page: the video's sentences and story (its rules are on Lectiōnēs, its words on Verba, its practice in Continue)
  await hash("#lesson-4");
  if (await p.locator(".rule-row, .rule-detail, .rule-block").count()) errors.push(`${name}: the lesson page repeats the rules`);
  if (!(await p.locator(".ex-line").count())) errors.push(`${name}: the lesson page shows no sentences`);
  if (await p.locator("button", { hasText: "Practise them" }).count()) errors.push(`${name}: the lesson page has a practice of its own`);
  await p.screenshot({ path: `${out}/${name}-lesson4.png`, fullPage: true });
  // Lectiōnēs: the lessons learned fold into one line; the rule in hand is marked; a tap opens it,
  // with the full text closed under More detail
  await p.locator(nav, { hasText: "Lectiōnēs" }).first().click();
  await p.waitForTimeout(200);
  if ((await p.locator(".lesson-block[open] .rule-row:not(.story-row)").count()) !== 10) errors.push(`${name}: Lectiōnēs does not show the ten rules of Lessons III-IV (the learned ones folded)`);
  if ((await p.locator(".lesson-block .lesson-stories .story-row").count()) < 9) errors.push(`${name}: the stories are not under their lessons`);
  if ((await p.locator(".lesson-block:not([open])").count()) !== 2) errors.push(`${name}: the learned lessons are not folded`);
  if ((await p.locator(".rule-row.current").count()) !== 1) errors.push(`${name}: Lectiōnēs does not mark the rule you are on`);
  await p.locator(".rule-row.current").click();
  await p.waitForTimeout(200);
  if (!(await p.locator(".learn-line").count())) errors.push(`${name}: a tap on a rule does not open it`);
  if (await p.locator(".rule-detail").first().isVisible()) errors.push(`${name}: More detail is open from the start`);
  await p.locator(".rule-more summary").click();
  if (!(await p.locator(".rule-detail").first().isVisible())) errors.push(`${name}: More detail does not open`);
  await p.screenshot({ path: `${out}/${name}-rule-more.png`, fullPage: true });
  // Verba > Orīginēs: where the words come from: the reader, stories of culture in words, hidden links, families
  await p.locator(nav, { hasText: "Verba" }).first().click();
  await p.click("#origins-tab");
  await p.waitForTimeout(200);
  if ((await p.locator(".culture-card").count()) < 15) errors.push(`${name}: Orīginēs shows no stories of culture in words`);
  if ((await p.locator(".family-row").count()) < 20) errors.push(`${name}: Orīginēs shows no word families`);
  if (!(await p.locator(".english-card").count())) errors.push(`${name}: Latin in English is not under Orīginēs`);
  if (await p.locator(nav + "[aria-current='page']", { hasText: "Verba" }).count() === 0) errors.push(`${name}: Orīginēs is not under the Verba tab`);
  await p.fill("#family-search", "aquarium");
  if ((await p.locator(".family-row").count()) !== 1) errors.push(`${name}: the family search does not find aqua by "aquarium"`);
  await p.fill("#family-search", "");
  await p.screenshot({ path: `${out}/${name}-origins.png`, fullPage: true });
  await p.click("#culture-schola");
  await p.waitForTimeout(200);
  if (!(await p.locator(".culture-story", { hasText: "leisure" }).count())) errors.push(`${name}: a story of culture in words does not open`);
  await p.screenshot({ path: `${out}/${name}-origins-story.png` });
  await p.keyboard.press("Escape");
  // Latin in English: one screen at a time, Next, a quick question now and then
  await p.locator(".english-card").click();
  await p.waitForTimeout(300);
  if (!(await p.locator(".reader-card").count())) errors.push(`${name}: Latin in English is not a reader`);
  for (let i = 0; i < 8 && !(await p.locator(".reader-option").count()); i++) {
    await p.locator(".reader-nav .btn.big").click();
    await p.waitForTimeout(150);
  }
  if (!(await p.locator(".reader-option").count())) errors.push(`${name}: no quick question in the first screens of Latin in English`);
  else {
    if (!(await p.locator(".reader-nav .btn.big").isDisabled())) errors.push(`${name}: Next works before the question is answered`);
    await p.locator(".reader-option").first().click();
    if (!(await p.locator(".reader-verdict").count())) errors.push(`${name}: the quick question gives no verdict`);
  }
  if ((await p.evaluate(() => document.documentElement.scrollHeight - innerHeight)) > 2) errors.push(`${name}: a Latin in English screen scrolls`);
  await p.screenshot({ path: `${out}/${name}-english.png` });
  // Continue: the rule in practice (3.1, learned on an earlier day): a reminder first, then its
  // exercises in blocks of one kind; Help shows the rule; the fourth brings an earlier mistake back,
  // its ending typed into the sentence itself
  await p.locator(nav, { hasText: "Domus" }).first().click();
  await p.waitForTimeout(200);
  await p.locator("#continue").click();
  await p.waitForTimeout(200);
  await p.screenshot({ path: `${out}/${name}-rules-first.png`, fullPage: true });
  // the reminder's Start is in sight without scrolling (the learner once stopped there, the button below the fold)
  const startBox = await p.locator("button", { hasText: "Start exercises" }).boundingBox();
  if (!startBox || startBox.y + startBox.height > (await p.evaluate(() => innerHeight))) errors.push(`${name}: the reminder's Start is below the fold`);
  await p.locator("button", { hasText: "Start exercises" }).click();
  if (!((await p.locator(".part-count").textContent()) ?? "").includes("/ 10 right")) errors.push(`${name}: the round does not show the rule's count`);
  for (let i = 0; i < 4; i++) {
    await p.waitForTimeout(200);
    if (!(await p.locator(".task-line .task-text").count())) errors.push(`${name}: an exercise without a plain task line`);
    // what the answer is to be is always said ("only the missing letters", "1 word is extra")
    if (!(await p.locator(".task-line .task-expect").count())) errors.push(`${name}: an exercise does not say what the answer is to be`);
    if (i === 1) {
      await p.locator("#ex-help").click();
      await p.waitForTimeout(100);
      if (!(await p.locator(".rule-box").count())) errors.push(`${name}: Help shows no rule`);
    }
    if (i === 3) {
      if (!(await p.locator(".ex-source", { hasText: "earlier mistake" }).count())) errors.push(`${name}: the round does not bring an earlier mistake back`);
      if (!(await p.locator(".prompt .gap-input").count())) errors.push(`${name}: the ending is not typed into the sentence`);
      // who does what is in sight: the English above the gap, the gap's word marked in it
      if (!(await p.locator(".prompt .ex-english-top .en-mark").count())) errors.push(`${name}: a gap exercise does not show its English with the word marked`);
      await p.screenshot({ path: `${out}/${name}-gap.png` });
    }
    if (await p.locator(".tile-board").count()) {
      await p.locator(".tile-tray .tile").first().click();
      await p.locator("button", { hasText: "Check" }).click();
    } else if (await p.locator(".word-btn").count()) await p.locator(".word-btn").first().click();
    else if (await p.locator(".gap-input").count()) {
      await p.locator(".gap-input").fill("um");
      await p.locator(".gap-input").press("Enter");
    } else {
      await p.locator("#answer-input").fill(i === 0 ? "puella" : "agricola aquam portat");
      await p.screenshot({ path: `${out}/${name}-train-${i}-q.png` });
      await p.locator("#answer-input").press("Enter");
    }
    await p.waitForTimeout(250);
    await p.screenshot({ path: `${out}/${name}-train-${i}-a.png` });
    if (i === 2) {
      // after an answer: short; the rule and the rest under Why?, with Claude there
      if (await p.locator(".ex-side .rule-hint").count()) errors.push(`${name}: the rule shows before Why?`);
      await p.locator("#ex-why").click();
      if (!(await p.locator(".why-box button", { hasText: "Ask Claude" }).count())) errors.push(`${name}: Why? shows no way to ask Claude`);
      await p.screenshot({ path: `${out}/${name}-why.png` });
    }
    await p.locator("button", { hasText: "Next" }).click();
  }
  // a round left half-way (another tab) is picked up again from Domus, where it was
  await p.locator(nav, { hasText: "Lectiōnēs" }).first().click();
  await p.waitForTimeout(150);
  await p.locator(nav, { hasText: "Domus" }).first().click();
  await p.waitForTimeout(150);
  const resume = (await p.locator(".home-hero").textContent()) ?? "";
  if (!/Your round · 5 \//.test(resume)) errors.push(`${name}: Domus does not offer the round left half-way (${resume.slice(0, 80)})`);
  await p.locator("#continue").click();
  await p.waitForTimeout(200);
  if (!(await p.locator(".task-line .task-text").count())) errors.push(`${name}: Continue does not go back into the round`);
  // the round goes on to its end (every answer shown here), and ends with a question answered in your own Latin
  // (the "why" questions first: "Cūr aquam bibis?" also contains "bibis")
  const ANSWERS = { "Cūr labōrās": "Labōrō quod discō.", "Cūr aquam": "Aquam bibō quod labōrō.", legis: "Epistulam legō.", scrībis: "Epistulam scrībō.", bibis: "Aquam bibō.", vidēs: "Silvam videō.", habēs: "Librum habeō.", spectās: "Silvam spectō.", portās: "Aquam portō.", dēsīderās: "Amīcam dēsīderō.", discis: "Scrībere discō." };
  let last = false;
  for (let i = 0; i < 30 && !(await p.locator(".summary-head").count()); i++) {
    await p.waitForTimeout(120);
    if (await p.locator(".task-line", { hasText: "your turn" }).count()) {
      last = true;
      break;
    }
    await p.locator("button", { hasText: "Show answer" }).click();
    await p.locator("button", { hasText: "Next" }).click();
  }
  if (!last) errors.push(`${name}: the round does not end with a question to answer in your own Latin`);
  else {
    const question = (await p.locator(".answer-q").textContent()) ?? "";
    const key = Object.keys(ANSWERS).find((k) => question.includes(k));
    await p.locator("#answer-input").fill(key ? ANSWERS[key] : "Agricola labōrat.");
    const corrects = await p.locator("#answer-input").evaluate((el) => el.spellcheck || el.getAttribute("autocorrect") !== "off");
    if (corrects) errors.push(`${name}: the answer box spellchecks or autocorrects`);
    await p.screenshot({ path: `${out}/${name}-answer-q.png` });
    await p.locator("#answer-input").press("Enter");
    await p.waitForTimeout(300);
    if (!(await p.locator(".verdict").count())) errors.push(`${name}: an answer of your own gets no verdict (${question})`);
    if (key && !(await p.locator(".verdict.correct").count())) errors.push(`${name}: a good answer of your own is not accepted (${question} → ${ANSWERS[key]})`);
    await p.screenshot({ path: `${out}/${name}-answer-a.png` });
    await p.locator("button", { hasText: "Next" }).click();
    await p.waitForTimeout(200);
  }
  if (!(await p.locator(".summary-head").count())) errors.push(`${name}: the round does not end in its summary`);
  // between two rounds, Continue brings a story that has opened (those of Lessons I-II)
  await p.locator("button", { hasText: "Continue" }).first().click();
  await p.waitForTimeout(300);
  if (!(await p.locator(".story-line").count())) errors.push(`${name}: after a round, Continue does not bring the story that has opened`);
  // ask drawer opens (no Claude outside claude.ai: shows the fallback)
  await p.locator(".ask-btn").click();
  await p.waitForTimeout(300);
  await p.screenshot({ path: `${out}/${name}-ask.png` });
  await p.keyboard.press("Escape");
  // the next video on Lectiōnēs, ticked as watched with one tap: its rules join the path
  await hash("#lessons");
  if (!((await p.locator("#next-lesson").textContent()) ?? "").includes("Lesson V")) errors.push(`${name}: Lectiōnēs does not offer the next video (Lesson V)`);
  await p.locator("#next-lesson").screenshot({ path: `${out}/${name}-next-lesson.png` });
  await p.click("#watched-next");
  await p.waitForTimeout(300);
  if ((await p.locator("#lesson-block-5 .rule-row:not(.story-row)").count()) !== 4) errors.push(`${name}: after "I have watched it", Lesson V's four rules are not on Lectiōnēs`);
  if ((await p.locator("#lesson-block-5 .story-row").count()) !== 3) errors.push(`${name}: Lesson V's three stories are not under its rules`);
  if (await p.locator("#next-lesson").count()) errors.push(`${name}: the next video is still offered after the last lesson was ticked`);
  await p.screenshot({ path: `${out}/${name}-lesson5.png`, fullPage: true });
  await ctx.close();
}

// Audio, with fake Italian and Spanish voices (headless Chromium has none): speaker
// buttons appear, clicks speak the respelled Latin (Spanish preferred, stress marked
// with acute accents only), listening exercises play by themselves.
/**
 * The recorded voice: a lesson's sentence plays from its pack (loaded beside the
 * page, played with Web Audio), not with the device's voice, and the speakers
 * show for recorded texts even on a device with no Spanish or Italian voice.
 */
async function recorded() {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript((data) => localStorage.getItem("tabula-latina-progress-v1") || localStorage.setItem("tabula-latina-progress-v1", data), SEED);
  await ctx.addInitScript(() => {
    window.__spoken = [];
    window.__played = [];
    const voices = [{ name: "Samantha", lang: "en-US", voiceURI: "samantha", localService: true, default: true }];
    Object.defineProperty(window, "speechSynthesis", { value: { getVoices: () => voices, speak: (u) => { window.__spoken.push(u.text); setTimeout(() => u.onend && u.onend(), 100); }, cancel: () => {}, addEventListener: () => {} }, configurable: true });
    window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...args) {
      window.__played.push(args);
      return start.apply(this, args);
    };
  });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(`recorded: ${e.message}`));
  await p.goto(`file://${page}#lesson-2`);
  await p.waitForTimeout(800);
  const speakers = await p.locator(".ex-line .speak").count();
  if (speakers < 10) errors.push(`recorded: with no Spanish voice, only ${speakers} speakers for the recorded sentences`);
  await p.locator(".ex-line .speak").first().click();
  await p.waitForTimeout(2500);
  const state = await p.evaluate(() => ({ packs: Object.keys(window.__tabulaAudio ?? {}), played: window.__played.length, spoken: window.__spoken.length }));
  if (!state.packs.includes("lesson-2")) errors.push(`recorded: the lesson's pack did not load (${JSON.stringify(state)})`);
  if (state.played < 1 || state.spoken > 0) errors.push(`recorded: the sentence was not played from its recording (${JSON.stringify(state)})`);
  await ctx.close();
}

async function audio() {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  // the earlier mistake to come back is a listening one: it plays by itself
  await ctx.addInitScript((data) => {
    if (localStorage.getItem("tabula-latina-progress-v1")) return;
    const p = JSON.parse(data);
    p.mistakes = [{ at: 1000, kind: "listen", prompt: "Listen", answer: "a", expected: "Amīcum videō.", skills: ["n2.acc.sg"], notes: [], words: ["amicus", "video"] }];
    // the device's voice is what this part checks: the recorded one is checked on its own (recorded())
    p.settings = { ...(p.settings ?? {}), recorded: false };
    localStorage.setItem("tabula-latina-progress-v1", JSON.stringify(p));
  }, SEED);
  await ctx.addInitScript(() => {
    const voices = [
      { name: "Alice", lang: "it-IT", voiceURI: "alice", localService: true, default: false },
      { name: "Mónica", lang: "es-ES", voiceURI: "monica", localService: true, default: false },
      { name: "Grandpa (Spanish (Spain))", lang: "es-ES", voiceURI: "grandpa", localService: true, default: false },
      { name: "Milena", lang: "ru-RU", voiceURI: "milena", localService: true, default: true },
      { name: "Samantha", lang: "en-US", voiceURI: "samantha", localService: true, default: false },
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
  await p.goto(`file://${page}#lesson-2`);
  await p.waitForTimeout(800);
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
  // a tap on one sentence during Listen & repeat ends the sequence: only that sentence is read
  await p.locator("button", { hasText: "Listen & repeat" }).click();
  await p.waitForTimeout(700);
  const n0 = (await p.evaluate(() => window.__spoken)).length;
  await p.locator(".ex-line .speak").nth(4).click();
  await p.waitForTimeout(3200);
  const after = (await p.evaluate(() => window.__spoken)).slice(n0);
  if (after.length !== 1) errors.push(`audio: after a tap on one sentence the voice read ${after.length} texts: ${JSON.stringify(after)}`);
  // the voice list offers only the voices that suit Latin
  await p.locator('button[aria-label^="Optiōnēs"]').click();
  const options = await p.locator("#voice option").allTextContents();
  if (options.length !== 3 || options.some((o) => /Milena|Samantha|Grandpa/.test(o))) errors.push(`audio: voice list ${JSON.stringify(options)}`);
  await p.keyboard.press("Escape");
  if (!spoken.some((t) => /disquípula|maguístra/.test(t))) errors.push(`audio: no respelled Latin in ${JSON.stringify(spoken.slice(0, 3))}`);
  if (spoken.some((t) => /[àèìòù]/.test(t))) errors.push(`audio: grave accents would be spelled out: ${JSON.stringify(spoken.slice(0, 3))}`);
  // the rule's round: three exercises shown and skipped, then the listening mistake plays by itself
  await p.locator(".nav button", { hasText: "Domus" }).click();
  await p.locator("#continue").click();
  await p.locator("button", { hasText: "Start exercises" }).click();
  for (let i = 0; i < 3; i++) {
    await p.waitForTimeout(150);
    await p.locator(".ex-actions button", { hasText: "Show answer" }).click();
    await p.locator("button", { hasText: "Next" }).click();
  }
  const heard = (await p.evaluate(() => window.__spoken)).length;
  await p.waitForTimeout(400);
  const before = (await p.evaluate(() => window.__spoken)).length;
  if (!((await p.locator(".task-text").textContent()) ?? "").includes("Listen")) errors.push("audio: the listening mistake did not come back");
  if (before <= heard) errors.push("audio: listening exercise did not play by itself");
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
  await seed(ctx);
  await ctx.addInitScript(() => {
    window.__asked = [];
    window.__opts = [];
    window.__fail = null;
    window.__reply = null;
    const sample = (input, opts) => {
      window.__asked.push(input);
      window.__opts.push({ modelTier: opts?.modelTier, effort: opts?.effort });
      if (window.__fail) return Promise.reject(window.__fail);
      return new Promise((res) => setTimeout(() => {
        const text = window.__reply ?? "The ending «-am» marks the object.";
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
  await p.locator(".ask-btn").click();
  await p.waitForTimeout(300);
  await p.locator("#ask-input").fill("What should I practise today?");
  if ((await p.evaluate(() => window.__asked.length)) !== 0) errors.push("ask: a question was sent without the learner pressing Ask");
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
  // in a new conversation the quick questions add to what is written, never replace it
  await p.locator(".drawer-head button", { hasText: "New" }).click();
  // with no word in view (Domus), general starters; they add to what is written
  if (await p.locator(".drawer-body button", { hasText: "Where does this word come from?" }).count()) errors.push("ask: questions about 'this word' with no word in view");
  await p.locator("#ask-input").fill("agricola:");
  await p.locator(".drawer-body button", { hasText: "How do I say this in Latin:" }).click();
  await p.locator(".drawer-body button", { hasText: "Explain the rule I am learning, simply" }).click();
  const box = await p.locator("#ask-input").inputValue();
  if (box !== "agricola: How do I say this in Latin: Explain the rule I am learning, simply") errors.push(`ask: quick questions do not add to the text (${box})`);
  if (await p.locator(".drawer-body button", { hasText: /right ending|Explain this rule/ }).count()) errors.push("ask: the old quick questions are still there");
  await p.locator("#ask-input").fill("Where does agricola come from? Which words are related to it?");
  await p.locator("#ask-input").press("Enter");
  await p.waitForTimeout(400);
  const originAsked = await lastAsked();
  if (!originAsked.includes("Relatives (checked)") || !originAsked.includes("agriculture")) errors.push("ask: a question about a word's origin carries no checked relatives");
  // the grammar engine's facts go with a question that names Latin words, the model thinks harder,
  // and an answer with a grammar mistake gets a note with the right form and a way to fix it
  await p.evaluate(() => { window.__reply = 'It is «Timida agricola spectat.»'; });
  await p.locator("#ask-input").fill("what if it's timid agricola watches?");
  await p.locator("#ask-input").press("Enter");
  await p.waitForTimeout(400);
  const asked = await lastAsked();
  if (!asked.includes("[Facts from the site's grammar engine") || !asked.includes("noun, masculine")) errors.push("ask: no grammar facts with a question about agricola");
  const opts = await p.evaluate(() => window.__opts.at(-1));
  if (opts.modelTier !== "default" || opts.effort !== "high") errors.push(`ask: model ${JSON.stringify(opts)}`);
  const note = await p.locator(".grammar-note").last().textContent().catch(() => "");
  if (!note.includes("masculine") || !note.includes("timidus")) errors.push(`ask: no grammar note for «timida agricola» (${note})`);
  await p.screenshot({ path: `${out}/ask-grammar-check.png` });
  await p.evaluate(() => { window.__reply = "Sorry: «Agricola timidus spectat.»"; });
  await p.locator(".grammar-note button", { hasText: "Fix this answer" }).click();
  await p.waitForTimeout(400);
  if (!(await lastAsked()).includes("The site's grammar engine found a mistake")) errors.push("ask: Fix this answer did not ask Claude to correct it");
  if (!(await p.locator(".msg-fix").count())) errors.push("ask: the fix request is not shown as a note");
  if ((await p.locator(".grammar-note").count()) !== 1) errors.push("ask: the corrected answer still gets a grammar note");
  // just a word: Claude is asked for its word card (with the checked relatives), which shows as labelled lines
  await p.evaluate(() => {
    window.__reply = "**aqua, aquae (f) · water**\n**Origin:** an old Italic word.\n**History:** Rome had eleven aqueducts.\n**Family:** aquārius; English aquarium.\n**Use:** «Aquam bibō.» I drink water.";
  });
  await p.locator("#ask-input").fill("aqua");
  await p.locator("#ask-input").press("Enter");
  await p.waitForTimeout(400);
  const word = await lastAsked();
  if (!word.includes("[Just a word: answer with its word card.]") || !word.includes("Relatives (checked)")) errors.push("ask: a word sent alone does not ask for its word card with its relatives");
  if ((await p.locator(".msg.assistant").last().locator("p.labelled").count()) !== 4) errors.push("ask: the word card's lines are not shown one by one");
  await p.screenshot({ path: `${out}/ask-word-card.png` });
  await p.evaluate(() => { window.__reply = null; });
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
  await p.locator(".nav button", { hasText: "Domus" }).click();
  await p.locator("#continue").click();
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
  await p.evaluate(() => { location.hash = "#lesson-2"; });
  await p.waitForTimeout(300);
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
// and its answer fills the room below. Only a new message that arrives below the
// screen, unseen, shows the "New message" button; reading higher up does not.
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
  const button = () => p.locator(".to-latest").count();
  if (await button()) errors.push("scroll: a New message button with every message seen");
  // reading and typing higher up leaves the conversation where it is, with no button
  await body.evaluate((b) => b.scrollTo({ top: 0 }));
  await p.waitForTimeout(150);
  await p.locator("#ask-input").pressSequentially("abc");
  await p.waitForTimeout(200);
  if ((await body.evaluate((b) => b.scrollTop)) !== 0) errors.push("scroll: typing moved the conversation");
  if (await button()) errors.push("scroll: a New message button for messages already seen");
  // a question glides to the top; its long answer arrives in view, without moving it
  await p.evaluate(() => { window.__delay = 1600; });
  await p.locator("#ask-input").fill("Three?");
  await p.locator("#ask-input").press("Enter");
  await p.waitForTimeout(1100);
  const at = (sel) => body.evaluate((b, sel) => { const q = [...b.querySelectorAll(sel)].pop(); return Math.round(q.getBoundingClientRect().top - b.getBoundingClientRect().top); }, sel);
  const glided = await at(".msg.user");
  if (Math.abs(glided - 12) > 30) errors.push(`scroll: the sent question did not glide to the top (${glided}px)`);
  await p.waitForTimeout(1000);
  if (Math.abs((await at(".msg.user")) - glided) > 2) errors.push("scroll: the arriving answer moved the conversation");
  if (await button()) errors.push("scroll: a New message button for an answer in view");
  // an answer that arrives while reading higher up shows the button, which goes down to it
  await p.evaluate(() => { window.__delay = 1400; });
  await p.locator("#ask-input").fill("Four?");
  await p.locator("#ask-input").press("Enter");
  await p.waitForTimeout(900);
  await body.evaluate((b) => b.scrollTo({ top: 0 }));
  await p.waitForTimeout(1000);
  if (!(await button())) errors.push("scroll: no New message button for an answer below the screen");
  await p.screenshot({ path: `${out}/ask-new-message.png` });
  await p.locator(".to-latest").click();
  await p.waitForTimeout(900);
  if (await button()) errors.push("scroll: the New message button does not go away at the message");
  const answerTop = await at(".msg.assistant");
  const height = await body.evaluate((b) => b.clientHeight);
  if (answerTop < 0 || answerTop > height - 16) errors.push(`scroll: the New message button did not bring the answer into view (${answerTop}px)`);
  // once seen, reading back up shows no button
  await body.evaluate((b) => b.scrollTo({ top: 0 }));
  await p.waitForTimeout(200);
  if (await button()) errors.push("scroll: the New message button came back for a message already seen");
  await ctx.close();
}

// Stories: read one (a tap on a line shows its English, a tap on a word its meaning),
// answer its questions (the story is then read), and Continue.
async function stories() {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await seed(ctx);
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(`stories: ${e.message}`));
  await p.goto(`file://${page}`);
  await p.waitForTimeout(700);
  await p.locator(".bottomnav button", { hasText: "Lectiōnēs" }).click();
  await p.waitForTimeout(300);
  if ((await p.locator(".lesson-stories .story-row:not(.locked)").count()) < 6) errors.push("stories: fewer than six stories open after Lessons I-II");
  if ((await p.locator(".lesson-stories .story-row.locked").count()) < 3) errors.push("stories: the stories of later rules are not waiting");
  await p.locator("#lesson-block-2 > summary").click();
  await p.screenshot({ path: `${out}/stories.png`, fullPage: true });
  await p.locator("#lesson-block-2 .story-row").nth(1).click();
  await p.waitForTimeout(300);
  await p.locator(".story-line").nth(1).click({ position: { x: 2, y: 2 } });
  if (!((await p.locator(".story-line").nth(1).locator(".story-tr").textContent()) ?? "").trim()) errors.push("stories: a tap on a line does not show its English");
  await p.locator(".story-line").nth(2).locator(".w").first().click();
  if (!(await p.locator(".story-gloss").count())) errors.push("stories: a tap on a word does not show its meaning");
  const qs = p.locator(".story-q");
  for (let i = 0; i < (await qs.count()); i++) {
    for (let j = 0; j < 3 && !(await qs.nth(i).locator(".q-note-right").count()); j++) {
      await qs.nth(i).locator("button").nth(j).click();
      await p.waitForTimeout(60);
    }
  }
  if (!(await p.locator(".story-done").count())) errors.push("stories: answering the questions does not mark the story read");
  await p.screenshot({ path: `${out}/story.png`, fullPage: true });
  // the story ends with Continue, which goes on with the day (here the rule in practice)
  if (await p.locator("button", { hasText: "Practise this story" }).count()) errors.push("stories: a story still has its own practice");
  await p.locator("#story-continue").click();
  await p.waitForTimeout(400);
  if ((await p.evaluate(() => location.hash)) !== "#train") errors.push("stories: Continue after a story does not go on to practice");
  await p.screenshot({ path: `${out}/story-continue.png` });
  await p.locator(".bottomnav button", { hasText: "Lectiōnēs" }).click();
  await p.waitForTimeout(300);
  await p.locator("#lesson-block-2 > summary").click();
  if (!(await p.locator(".story-row .story-read").count())) errors.push("stories: the list does not show the story as read");
  await ctx.close();
}

// Learning a rule: a new learner has no rule exercises until the first rule is read and
// its two questions answered. An answer with the idea's key words is right at once; an
// unclear one goes to Claude (faked here), or without Claude is compared with a good
// answer. Then practice starts with simple exercises.
async function learnFlow(name, viewport, withClaude) {
  const ctx = await browser.newContext({ viewport });
  if (withClaude) {
    await ctx.addInitScript(() => {
      window.__checks = [];
      const sample = async () => ({ text: "", truncated: false });
      sample.json = async (prompt, opts) => {
        window.__checks.push({ prompt, tier: opts?.modelTier });
        return { verdict: "partly", feedback: "Nearly: say which letter at the end shows it." };
      };
      window.claude = { use: async (n) => (n === "sample" ? sample : null) };
    });
  }
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(`${name}: ${e.message}`));
  await p.goto(`file://${page}`);
  await p.waitForTimeout(800);
  const nav = viewport.width < 760 ? ".bottomnav button" : ".nav button";
  if (!((await p.locator(".home-step").textContent()) ?? "").includes("Rule 1.1") || !(await p.locator(".home-new").count())) errors.push(`${name}: home does not offer the first rule as new`);
  await p.screenshot({ path: `${out}/${name}-home-new.png`, fullPage: true });
  await p.locator("#continue").click();
  await p.waitForTimeout(300);
  if ((await p.locator(".learn-line").count()) < 2) errors.push(`${name}: the rule is not explained`);
  if ((await p.locator(".part-tile").count()) !== 5) errors.push(`${name}: the rules of Lesson I are not shown as a path`);
  await p.screenshot({ path: `${out}/${name}-learn.png`, fullPage: true });
  const q = p.locator(".learn-q:not(.answered)");
  await q.locator("textarea").fill("it is about the verb");
  await q.locator("button", { hasText: "Check" }).click();
  await p.waitForTimeout(300);
  if (withClaude) {
    if (!(await q.locator(".verdict", { hasText: "Paene" }).count())) errors.push(`${name}: an unclear answer gets no verdict from Claude`);
    if (!((await q.locator(".learn-feedback").textContent()) ?? "").includes("which letter")) errors.push(`${name}: Claude's feedback is not shown`);
    const check = await p.evaluate(() => window.__checks[0]);
    if (!check?.prompt.includes("Rule 1.1") || !check.prompt.includes("it is about the verb") || check.tier !== "default") errors.push(`${name}: the check sent to Claude ${JSON.stringify(check)?.slice(0, 120)}`);
    await p.screenshot({ path: `${out}/${name}-learn-claude.png`, fullPage: true });
  } else {
    if (!(await q.locator("button", { hasText: "Yes, I had it" }).count())) errors.push(`${name}: without Claude there is no comparing with a good answer`);
    await q.locator("button", { hasText: "Not quite" }).click();
  }
  await q.locator("button", { hasText: "Try again" }).click();
  await q.locator("textarea").fill("The farmer works; the -t at the end says one person does it.");
  await q.locator("button", { hasText: "Check" }).click();
  await p.waitForTimeout(150);
  if (!(await q.locator(".verdict", { hasText: "Rēctē" }).count())) errors.push(`${name}: a right answer in the learner's words is not recognised`);
  if (withClaude && (await p.evaluate(() => window.__checks.length)) !== 1) errors.push(`${name}: a right answer was sent to Claude anyway`);
  await q.locator("button", { hasText: "Next question" }).click();
  await p.waitForTimeout(150);
  if (await p.locator(".learn-done").count()) errors.push(`${name}: practice opened before the second question`);
  await p.locator(".learn-q:not(.answered) button", { hasText: "I don't know" }).click();
  await p.locator(".learn-q:not(.answered) button", { hasText: "Done" }).click();
  await p.waitForTimeout(150);
  if (!(await p.locator(".learn-done").count())) errors.push(`${name}: the questions done do not open practice`);
  await p.screenshot({ path: `${out}/${name}-learn-done.png`, fullPage: true });
  await p.locator(".learn-done button", { hasText: "Start practising" }).click();
  await p.waitForTimeout(300);
  if (await p.locator(".rule-intro").count()) errors.push(`${name}: a reminder right after learning the rule`);
  if (!((await p.locator(".part-count").textContent()) ?? "").includes("0 / 10 right")) errors.push(`${name}: the round does not show the rule's exact progress`);
  for (let i = 0; i < 5; i++) {
    await p.waitForTimeout(150);
    const task = (await p.locator(".task-text").textContent()) ?? "";
    if (/Write this sentence in Latin|Change the Latin|Listen/.test(task)) errors.push(`${name}: a hard exercise while the rule is new (${task})`);
    if (i === 0) await p.screenshot({ path: `${out}/${name}-learn-first-exercise.png` });
    if (await p.locator(".tile-board").count()) {
      await p.locator(".tile-tray .tile").first().click();
      await p.locator("button", { hasText: "Check" }).click();
    } else if (await p.locator(".word-btn").count()) await p.locator(".word-btn").first().click();
    else {
      await p.locator("#answer-input").fill("t");
      await p.locator("#answer-input").press("Enter");
    }
    await p.waitForTimeout(150);
    // every answer says what it did to the rule: +1, or why not
    const note = (await p.locator(".part-plus").first().textContent().catch(() => "")) ?? "";
    if (!/of 10/.test(note)) errors.push(`${name}: an answer does not say what it added to the rule (${note})`);
    if (i === 0) await p.screenshot({ path: `${out}/${name}-learn-answered.png` });
    await p.locator("button", { hasText: "Next" }).click();
  }
  const count = (await p.locator(".part-count-num").textContent()) ?? "";
  await p.locator(".trainer-end").click();
  await p.screenshot({ path: `${out}/${name}-learn-summary.png`, fullPage: true });
  if (!((await p.locator(".panel h3", { hasText: "Rule 1.1" }).count()))) errors.push(`${name}: the end of the round does not show the rule's progress`);
  await p.locator("button", { hasText: "Done for now" }).click();
  await p.waitForTimeout(200);
  // Domus: the rule and its count, or what comes between two rounds (a story that opened, the words due);
  // the rule's line on Lectiōnēs has the same count
  const right = count.split(" / ")[0].trim();
  const hero = (await p.locator(".home-hero").textContent()) ?? "";
  if (await p.locator(".home-dots").count()) {
    if (!((await p.locator(".home-dots").textContent()) ?? "").includes(`${right} of 10`)) errors.push(`${name}: Domus does not show the same count (${count})`);
  } else if (!/Fābula|Your words/.test(hero)) errors.push(`${name}: Domus shows neither the rule nor what comes between rounds (${hero})`);
  if (/Rule 1\.1\s*new/.test(hero)) errors.push(`${name}: the rule in practice is still offered as new`);
  await p.screenshot({ path: `${out}/${name}-home-after.png` });
  await p.locator(name.includes("phone") ? ".bottomnav button" : ".nav button", { hasText: "Lectiōnēs" }).first().click();
  await p.waitForTimeout(200);
  if (!((await p.locator(".rule-row.current").textContent()) ?? "").includes(`${right}/10`)) errors.push(`${name}: the rule's line does not show the same count (${count})`);
  await ctx.close();
}

// The messenger: setup, a chat with a friend who is awake (the clock is set to 12:30 in
// Rome), the reply arriving after typing, read ticks, English on a tap, Check, the words
// sheet, someone new, a message from the phone routine, the other device, and the phone
// layout. Claude is played by the test; a message with a word the learner does not know
// must come back rewritten.
async function messenger() {
  const shared = new Map();
  const runtime = () => {
    const prompts = [];
    window.__prompts = prompts;
    const sample = async (prompt) => {
      prompts.push(prompt);
      await new Promise((r) => setTimeout(r, 300));
      if (String(prompt).includes("small window beside a beginner's chat")) return { text: "**-um** marks the object: «librum».", truncated: false };
      return { text: "", truncated: false };
    };
    sample.json = async (prompt) => {
      prompts.push(prompt);
      await new Promise((r) => setTimeout(r, 300));
      if (prompt.includes("TODAY'S BOARD")) {
        return {
          items: [
            { kind: "day", title: "Augustālia", titleEn: "The Augustalia", lines: [{ la: "Hodiē Augustālia!", en: "Today is the Augustalia!" }, { la: "Agricola nōn labōrat.", en: "The farmer does not work." }] },
            { kind: "friends", title: "Lūcius", titleEn: "Lucius", lines: [{ la: "Lūcius nōn dormit.", en: "Lucius does not sleep." }, { la: "Poēta epistulam scrībit.", en: "The poet writes a letter." }] },
            { kind: "notice", title: "Taurus", titleEn: "A bull", lines: [{ la: "Agricola taurum dēsīderat.", en: "A farmer misses his bull." }] },
          ],
        };
      }
      // the Sibyl's leaf, only where the test asks for one (a leaf must not fly over the other tests)
      if (prompt.includes("Sibyl of Cumae")) {
        return window.__sibyl
          ? { who: "gaius", lines: [{ la: "Agricola dormit…", en: "The farmer sleeps…" }, { la: "taurus magnus vīnum bibit!", en: "a big bull drinks the wine!" }], fate: "A neighbour's bull breaks into Gaius's cellar and drinks a jar of new wine.", mood: "furious", after: 10, hours: 20, public: true, signs: ["taurus"] }
          : {};
      }
      if (prompt.includes("Invent a real person")) return { about: "A loud baker who sings while kneading.", secret: "Cannot read.", happenings: [{ en: "the oven broke", mood: "furious", hours: [4, 12] }], first: [{ la: "Salvē! Quis es?", en: "Hi! Who are you?", gap: 1 }] };
      if (prompt.includes("ON THEIR OWN")) return { messages: [] };
      if (prompt.includes("kind Latin coach")) return { verdict: "almost", better: "Librum legō.", note: "The object takes -m: «librum»." };
      if (prompt.includes("break the learner's limits")) return { messages: [{ la: "Nōn dormiō.", en: "I'm not sleeping." }] };
      const id = (prompt.match(/Person ids: "([a-z0-9]+)"/) || [])[1] || "iulia";
      return { messages: [{ from: id, la: "Euge! 😄", en: "Great! 😄", gap: 1 }, { from: id, la: "Cēnam parō", en: "I'm making dinner", gap: 1 }], react: [{ from: id, emoji: "😂" }], remember: [] };
    };
    const docRef = (path) => ({
      get: async () => { const d = await window.__dbGet(path); return { exists: !!d, data: () => d ?? undefined }; },
      set: async (data) => void (await window.__dbSet(path, JSON.parse(JSON.stringify(data)))),
      delete: async () => void (await window.__dbDel(path)),
      collection: (sub) => colRef(`${path}/${sub}`),
      onSnapshot: (next) => {
        let last = "";
        const tick = async () => {
          const d = await window.__dbGet(path);
          const sig = JSON.stringify(d);
          if (sig === last) return;
          last = sig;
          next({ exists: !!d, data: () => d ?? undefined });
        };
        void tick();
        const t = setInterval(tick, 200);
        return () => clearInterval(t);
      },
    });
    const follow = (path, n = 1000) => (next) => {
      let last = "";
      const tick = async () => {
        // a slow account (window.__slowChats): the chats come in late
        if (path.endsWith("/messenger/threads") && Date.now() < (window.__slowChats ?? 0)) return;
        const docs = await window.__dbList(path);
        const sig = JSON.stringify(docs);
        if (sig === last) return;
        last = sig;
        next({ docs: docs.slice(0, n).map((d) => ({ id: d.id, data: () => d.data })) });
      };
      void tick();
      const t = setInterval(tick, 200);
      return () => clearInterval(t);
    };
    const colRef = (path) => ({
      doc: (id) => docRef(`${path}/${id}`),
      onSnapshot: follow(path),
      orderBy: () => ({ limit: (n) => ({ onSnapshot: follow(path, n) }) }),
    });
    const db = { doc: docRef, collection: colRef };
    window.claude = { use: async (n) => (n === "sample" ? sample : n === "db" ? db : n === "user" ? { id: async () => "u1" } : null) };
  };
  const device = async (name, viewport, time = "2026-10-12T10:30:00Z", before) => {
    // a phone is a touch screen (Enter makes a new line there)
    const ctx = await browser.newContext({ viewport, ...(viewport.width < 500 ? { isMobile: true, hasTouch: true } : {}) });
    await ctx.clock.install({ time: new Date(time) });
    await seed(ctx);
    await ctx.addInitScript(runtime);
    if (before) await ctx.addInitScript(before.fn, before.arg);
    const p = await ctx.newPage();
    p.on("pageerror", (e) => errors.push(`${name}: ${e.message}`));
    p.on("console", (m) => m.type() === "error" && !/fonts\.g/.test(m.text()) && errors.push(`${name} console: ${m.text()}`));
    await p.exposeFunction("__dbGet", (path) => shared.get(path) ?? null);
    await p.exposeFunction("__dbSet", (path, data) => void shared.set(path, data));
    await p.exposeFunction("__dbDel", (path) => void shared.delete(path));
    await p.exposeFunction("__dbList", (col) => [...shared.entries()].filter(([k]) => k.startsWith(col + "/") && !k.slice(col.length + 1).includes("/")).map(([k, data]) => ({ id: k.slice(col.length + 1), data })));
    await p.goto(`file://${page}#nuntii`);
    await p.waitForTimeout(700);
    return { p, ctx };
  };
  const { p, ctx } = await device("messenger", { width: 1280, height: 860 });
  await p.screenshot({ path: `${out}/messenger-setup.png` });
  await p.fill("#me-name", "Kiril");
  await p.click("#me-m");
  await p.click("#me-start");
  await p.waitForTimeout(600);
  if ((await p.locator(".chat-row:not(.acta-row)").count()) !== 6) errors.push(`messenger: expected 6 chats, found ${await p.locator(".chat-row:not(.acta-row)").count()}`);
  // the Ācta Diurna: today's board, written once a day, pinned on top; a tap on a line shows its English, on a word what it is
  await p.locator("#chat-acta .chat-row-preview", { hasText: "Augustālia" }).waitFor({ timeout: 6000 }).catch(() => {});
  if (!((await p.locator("#chat-acta .chat-row-preview").textContent()) ?? "").includes("Augustālia")) errors.push(`messenger: today's Ācta Diurna is not on top of the chats (${await p.locator("#chat-acta").textContent()} | ${await p.evaluate(() => window.__prompts.filter((x) => String(x).includes("TODAY'S BOARD")).length)} asked)`);
  if (!(await p.locator("#chat-acta .unread-badge").count())) errors.push("messenger: a new board does not show as unread");
  await p.click("#chat-acta");
  await p.waitForTimeout(300);
  if ((await p.locator(".acta-post").count()) !== 3) errors.push(`messenger: the board shows ${await p.locator(".acta-post").count()} items (expected 3)`);
  const line = p.locator(".acta-line").first();
  const lineBox = await line.boundingBox();
  await line.click({ position: { x: lineBox.width - 4, y: lineBox.height / 2 } });
  if (!(await p.locator(".acta-en", { hasText: "Today is the Augustalia!" }).count())) errors.push("messenger: a tap on a line of the board does not show its English");
  await p.locator(".acta-post .acta-line .w", { hasText: "Agricola" }).first().click();
  if (!(await p.locator(".acta .word-card", { hasText: "farmer" }).count())) errors.push("messenger: a tap on a word of the board shows no word card");
  if (!(await p.locator("#acta-continue").count())) errors.push("messenger: the board has no Continue");
  await p.screenshot({ path: `${out}/messenger-acta.png` });
  if (await p.locator("#chat-acta .unread-badge").count()) errors.push("messenger: the board stays unread after reading it");
  const boards = await p.evaluate(() => window.__prompts.filter((x) => String(x).includes("TODAY'S BOARD")));
  if (boards.length !== 1) errors.push(`messenger: the board was asked for ${boards.length} times`);
  else if (!boards[0].includes("THE DAY IN ROME") || !boards[0].includes("Iūlia")) errors.push("messenger: the board's prompt lacks the day or the friends");
  await p.click("#chat-iulia");
  await p.fill("#composer", "Salve Iulia! Librum lego.");
  await p.click("#composer-check");
  await p.waitForTimeout(900);
  if (!(await p.locator(".composer .check-note", { hasText: "Librum legō" }).count())) errors.push("messenger: Check shows no correction");
  // the coach's window stays while the learner types, and answers a question asked in it
  await p.fill("#composer", "Salve Iulia! Librum lego. Tu?");
  if (!(await p.locator(".coach-panel .check-note").count())) errors.push("messenger: typing closed the coach's window");
  await p.fill("#coach-ask", "Why -um?");
  await p.press("#coach-ask", "Enter");
  await p.waitForTimeout(700);
  if (!(await p.locator(".coach-a", { hasText: "marks the object" }).count())) errors.push("messenger: the coach does not answer in its window");
  const coachPrompts = await p.evaluate(() => window.__prompts.filter((x) => String(x).includes("kind Latin coach")).join("\n"));
  if (/Not in the learner's words/.test(coachPrompts)) errors.push("messenger: the check still points out words the learner has not learned");
  await p.screenshot({ path: `${out}/messenger-coach.png` });
  await p.fill("#composer", "Salve Iulia! Librum lego. Cor!");
  await p.click("#composer-send");
  await p.waitForTimeout(3500);
  // a word the site does not know (cor) is offered under the message, one tap from the learner's words
  if (!(await p.locator(".new-words .chip.new-word", { hasText: "cor" }).count())) errors.push("messenger: a new word in the learner's message is not offered to add");
  await p.screenshot({ path: `${out}/messenger-new-words.png` });
  // she is free at 12:30: she reads it within minutes and answers
  await ctx.clock.fastForward("20:00");
  await p.waitForTimeout(800);
  const theirs = await p.locator(".bubble:not(.mine) .bubble-text").allTextContents();
  if (!theirs.includes("Euge! 😄")) errors.push(`messenger: Iūlia's answer did not arrive (${JSON.stringify(theirs)})`);
  if (theirs.some((t) => t.includes("Cēnam"))) errors.push("messenger: a message with words the learner does not know was shown unchanged");
  if (!theirs.includes("Nōn dormiō.")) errors.push(`messenger: the slipped message was not rewritten (${JSON.stringify(theirs)})`);
  if (!(await p.locator(".bubble.mine .ticks.read").count())) errors.push("messenger: the learner's message never shows as read");
  const prompts = await p.evaluate(() => window.__prompts.join("\n---\n"));
  if (!prompts.includes("You write as Iūlia") || !prompts.includes("THE LEARNER: Kiril")) errors.push("messenger: the reply prompt lacks the person or the learner");
  // they live in Rome's calendar, know only what they were told (no omniscient news of the others), and read the learner's Latin literally
  if (!prompts.includes("THE DAY IN ROME") || !prompts.includes("a.d. IV Īd. Oct.")) errors.push("messenger: the reply prompt lacks the day in Rome");
  if (prompts.includes("THE OTHER FRIENDS, RIGHT NOW") || prompts.includes("WHAT THE OTHERS KNOW ABOUT")) errors.push("messenger: the reply prompt tells Iūlia what she was never told");
  if (!prompts.includes('"remember": [{"who"') || !prompts.includes('"tell"')) errors.push("messenger: the reply prompt asks for no memories or telling");
  if (!prompts.includes("Where Iūlia stands with the learner") || !prompts.includes('"levels"') || !prompts.includes('"ties"')) errors.push("messenger: the reply prompt carries no standing with the learner, or asks for no levels or ties");
  if (!prompts.includes("What Iūlia wants from life") || !prompts.includes('"goals"') || !prompts.includes('"happen"')) errors.push("messenger: the reply prompt carries no goals, or asks for no goals or happenings");
  if (!prompts.includes("HOW THE LEARNER'S LAST MESSAGE READS") || !prompts.includes("«Librum»: accusative singular")) errors.push("messenger: the reply prompt does not read the learner's message literally");
  if (!prompts.includes("PHOTOS THEY HAVE ON THEIR TABULA") || !prompts.includes('"voice": true') || !prompts.includes('"picture"')) errors.push("messenger: the reply prompt offers no photos, pictures or voice messages");
  if (!((await p.locator(".msgr-date").textContent()) ?? "").includes("Īd. Oct.")) errors.push("messenger: no Roman date over the chats");
  // with a mouse, a word under it shows a small card above it (its meaning and form)
  await p.locator(".bubble:not(.mine) .w").first().hover();
  if (!(await p.locator(".word-tip", { hasText: "great" }).count())) errors.push("messenger: hovering a word shows no card with its meaning");
  else {
    await p.waitForTimeout(300);
    await p.screenshot({ path: `${out}/messenger-word-tip.png` });
  }
  // a tap on a word shows a card under the message (what the word is); a tap elsewhere on the message, its English
  await p.locator(".bubble:not(.mine) .w").first().click();
  if (!(await p.locator(".word-card", { hasText: "great" }).count())) errors.push("messenger: a tap on a word shows no word card");
  await p.locator(".bubble:not(.mine) .bubble-meta").first().click();
  if (!(await p.locator(".bubble-en", { hasText: "Great!" }).count())) errors.push("messenger: a tap does not show the English");
  // she reacted to the learner's message; a tap on hers offers reactions and Reply
  if (!(await p.locator(".bubble.mine .react", { hasText: "😂" }).count())) errors.push("messenger: Iūlia's reaction does not show on the learner's message");
  await p.locator(".react-row .react-btn", { hasText: "❤️" }).first().click();
  if (!(await p.locator(".bubble:not(.mine) .react.mine", { hasText: "❤️" }).count())) errors.push("messenger: the learner's reaction does not show");
  await p.screenshot({ path: `${out}/messenger-chat.png` });
  // find in this chat, find a chat, an emoji from the ＋
  await p.click("button[aria-label='Find in this chat']");
  await p.fill("#chat-find", "dormio");
  if ((await p.locator(".bubble.hit").count()) !== 1) errors.push("messenger: Find in this chat does not find «Nōn dormiō»");
  await p.keyboard.press("Escape");
  await p.fill("#chat-search", "dormio");
  const found = await p.locator(".chat-row").evaluateAll((rows) => rows.map((r) => r.id));
  if (found.join() !== "chat-iulia") errors.push(`messenger: the chat search found ${JSON.stringify(found)}`);
  await p.fill("#chat-search", "");
  await p.click(".plus-btn");
  await p.locator(".emoji-pop button", { hasText: "🍷" }).click();
  if (!(await p.inputValue("#composer")).includes("🍷")) errors.push("messenger: the ＋ does not add an emoji");
  await p.fill("#composer", "");
  // the phrasebook beside the emoji: a greeting to her by name goes into the message
  if (!(await p.locator(".emoji-pop").count())) await p.click(".plus-btn");
  await p.click("#phrases-tab");
  await p.locator(".phrase-btn", { hasText: "Salvē, Iūlia!" }).click();
  await p.locator(".phrase-btn", { hasText: "Quid agis?" }).click();
  if ((await p.inputValue("#composer")) !== "Salvē, Iūlia! Quid agis?") errors.push(`messenger: the phrasebook does not put phrases into the message (${JSON.stringify(await p.inputValue("#composer"))})`);
  await p.screenshot({ path: `${out}/messenger-phrases.png` });
  await p.click("#phrases-tab");
  await p.press("#composer", "Escape");
  await p.fill("#composer", "");
  // Reply: the message answered is quoted above the learner's message
  if (!(await p.locator(".react-reply").count())) await p.locator(".bubble:not(.mine) .bubble-meta").first().click();
  await p.locator(".react-reply").first().click();
  if (!(await p.locator(".reply-banner", { hasText: "Answering Iūlia" }).count())) errors.push("messenger: Reply does not show what is answered");
  await p.fill("#composer", "Ita!");
  await p.click("#composer-send");
  await p.waitForTimeout(300);
  if (!(await p.locator(".bubble.mine").last().locator(".bubble-quote", { hasText: "Iūlia" }).count())) errors.push("messenger: a reply does not quote the message it answers");
  if (await p.locator(".reply-banner").count()) errors.push("messenger: the reply banner stays after sending");
  await p.screenshot({ path: `${out}/messenger-reply.png` });
  await p.click("button[aria-label='Your words']");
  if (!(await p.locator(".words-sheet .word-chip", { hasText: "salvē" }).count())) errors.push("messenger: the words sheet lacks the chat words");
  await p.keyboard.press("Escape");
  await p.click("#chat-profile");
  if (!(await p.locator(".profile", { hasText: "Today" }).count())) errors.push("messenger: the profile has no 'Today'");
  await p.screenshot({ path: `${out}/messenger-profile.png` });
  await p.keyboard.press("Escape");
  // the phone routine left messages in the inbox: they land in Marcus's chat, unread (one a voice message, one a photo)
  shared.set("data/users/u1/messenger/inbox/r1", { chat: "marcus", from: "marcus", la: "Salvē! Labōrō 😩", en: "Hi! I'm working 😩", at: Date.parse("2026-10-12T10:40:00Z") });
  shared.set("data/users/u1/messenger/inbox/r2", { chat: "marcus", from: "marcus", la: "Hahae! Labōrō", en: "Haha! I'm working", voice: true, at: Date.parse("2026-10-12T10:41:00Z") });
  shared.set("data/users/u1/messenger/inbox/r3", { chat: "marcus", from: "marcus", la: "Ecce!", en: "Look!", photo: "marcus-coins", at: Date.parse("2026-10-12T10:42:00Z") });
  await p.waitForTimeout(900);
  if (shared.has("data/users/u1/messenger/inbox/r1")) errors.push("messenger: the inbox message was not taken");
  if (!(await p.locator("#chat-marcus .unread-badge").count())) errors.push("messenger: the routine's message is not shown as unread");
  if (!((await p.locator("#chat-marcus .chat-row-preview").textContent()) ?? "").includes("📷")) errors.push("messenger: the chat list does not say a photo came");
  await p.click("#chat-marcus");
  await p.waitForTimeout(400);
  if (!(await p.locator(".voice-note").count())) errors.push("messenger: a voice message shows no player");
  // no Latin voice in this browser: its words show at once
  if (!(await p.locator(".bubble-text", { hasText: "Hahae" }).count())) errors.push("messenger: without a voice, a voice message's words do not show");
  if (!(await p.locator(".bubble-photo img").count())) errors.push("messenger: a photo does not show in its message");
  await p.locator(".bubble-photo").click();
  if (!(await p.locator(".photo-view", { hasText: "until payday" }).count())) errors.push("messenger: a tapped photo does not open with what it is");
  await p.screenshot({ path: `${out}/messenger-photo.png` });
  await p.keyboard.press("Escape");
  await p.click(".chat-back").catch(() => {});
  await p.click("#new-chat");
  await p.click("#find-someone");
  await p.waitForTimeout(2500);
  if (!(await p.locator(".chat-head-name").textContent())?.trim() || (await p.locator(".chat-row:not(.acta-row)").count()) !== 7) errors.push("messenger: someone new did not open a chat");
  await p.screenshot({ path: `${out}/messenger-stranger.png` });
  // with a mouse and a real keyboard the bars stay while typing
  await p.focus("#composer");
  if (await p.evaluate(() => document.documentElement.classList.contains("kb-open"))) errors.push("messenger: the bars step aside on a computer");
  await p.locator("#composer").blur();
  // the other device sees the same chats
  const other = await device("messenger-phone", { width: 390, height: 844 }, "2026-10-12T11:30:00Z");
  await other.p.waitForTimeout(1200);
  // the other device has today's board from the account, and does not write another
  if (!((await other.p.locator("#chat-acta .chat-row-preview").textContent()) ?? "").includes("Augustālia")) errors.push("messenger: the other device lacks today's board");
  if (await other.p.evaluate(() => window.__prompts.some((x) => String(x).includes("TODAY'S BOARD")))) errors.push("messenger: the other device wrote the board again");
  await other.p.click("#chat-acta");
  await other.p.waitForTimeout(300);
  await other.p.screenshot({ path: `${out}/messenger-phone-acta.png` });
  await other.p.click(".chat-back");
  await other.p.waitForTimeout(200);
  await other.p.click("#chat-iulia");
  await other.p.waitForTimeout(300);
  const there = await other.p.locator(".bubble .bubble-text").allTextContents();
  if (!there.some((t) => t.includes("Librum"))) errors.push(`messenger: the other device does not show the chat (${JSON.stringify(there)})`);
  // on a phone Enter makes a new line; the arrow sends
  const mine = await other.p.locator(".bubble.mine").count();
  await other.p.fill("#composer", "Salvē");
  await other.p.press("#composer", "Enter");
  await other.p.keyboard.type("Iūlia");
  if ((await other.p.inputValue("#composer")) !== "Salvē\nIūlia" || (await other.p.locator(".bubble.mine").count()) !== mine) errors.push(`messenger: on a phone Enter did not make a new line (${JSON.stringify(await other.p.inputValue("#composer"))})`);
  await other.p.fill("#composer", "");
  // no spellcheck or autocorrect: a tap on an underlined word would open suggestions, not move the cursor
  const box = await other.p.evaluate(() => {
    const el = document.querySelector("#composer");
    return { spell: el.spellcheck, auto: el.getAttribute("autocorrect"), complete: el.getAttribute("autocomplete") };
  });
  if (box.spell !== false || box.auto !== "off" || box.complete !== "off") errors.push(`messenger: the message box corrects what is typed (${JSON.stringify(box)})`);
  // while the phone's keyboard is up the top bar and the tabs step aside, and come back when it goes,
  // also when the field keeps its focus (the page growing back, as with Android's back button)
  const bars = async () => ({
    kb: await other.p.evaluate(() => document.documentElement.classList.contains("kb-open")),
    top: await other.p.locator(".topbar").isVisible(),
    tabs: await other.p.locator(".bottomnav").isVisible(),
  });
  await other.p.focus("#composer");
  await other.p.keyboard.type("Quid agis?");
  await other.p.setViewportSize({ width: 390, height: 500 });
  await other.p.waitForTimeout(150);
  let b = await bars();
  if (!b.kb || b.top || b.tabs) errors.push(`messenger: the bars stay while typing on a phone (${JSON.stringify(b)})`);
  const room = await other.p.evaluate(() => [document.querySelector(".composer")?.getBoundingClientRect().bottom ?? 0, innerHeight]);
  if (room[0] > room[1] + 1) errors.push(`messenger: the message box is below the keyboard (${room})`);
  await other.p.screenshot({ path: `${out}/messenger-phone-typing.png` });
  await other.p.setViewportSize({ width: 390, height: 844 });
  await other.p.waitForTimeout(150);
  b = await bars();
  if (b.kb || !b.top || !b.tabs) errors.push(`messenger: the bars do not return when the keyboard closes (${JSON.stringify(b)})`);
  await other.p.setViewportSize({ width: 390, height: 500 });
  await other.p.waitForTimeout(150);
  if (!(await bars()).kb) errors.push("messenger: the bars do not step aside when the keyboard opens again");
  await other.p.locator("#composer").blur();
  await other.p.waitForTimeout(150);
  b = await bars();
  if (b.kb || !b.top || !b.tabs) errors.push(`messenger: the bars do not come back after typing (${JSON.stringify(b)})`);
  await other.p.setViewportSize({ width: 390, height: 844 });
  await other.p.fill("#composer", "");
  await other.p.locator("#composer").blur();
  await other.p.waitForTimeout(150);
  await other.p.screenshot({ path: `${out}/messenger-phone-chat.png` });
  // on a phone an emoji from the ＋ goes in without bringing the keyboard back up
  await other.p.click(".plus-btn");
  await other.p.locator(".emoji-pop .emoji-btn").first().click();
  await other.p.waitForTimeout(100);
  if ((await other.p.evaluate(() => document.activeElement?.id)) === "composer") errors.push("messenger: on a phone an emoji from the ＋ brings the keyboard back up");
  if (!(await other.p.inputValue("#composer"))) errors.push("messenger: on a phone the ＋ does not add an emoji");
  await other.p.click(".plus-btn");
  await other.p.fill("#composer", "");
  await other.p.locator("#composer").blur();
  await other.p.click(".chat-back");
  await other.p.screenshot({ path: `${out}/messenger-phone-list.png` });
  await other.ctx.close();
  await ctx.close();
  // a device whose copy of Iūlia's chat is old, whose chats come in late, while a message of the phone
  // routine waits in the inbox: what the account had is not overwritten (the write waits, then goes up merged)
  const chat = shared.get("data/users/u1/messenger/threads/iulia");
  const old = { meta: shared.get("data/users/u1/messenger"), threads: { iulia: { ...chat, messages: chat.messages.slice(0, 1) } } };
  shared.set("data/users/u1/messenger/inbox/r9", { chat: "iulia", from: "iulia", la: "Ubi es?", en: "Where are you?", at: Date.parse("2026-10-12T11:50:00Z") });
  const late = await device("messenger-late", { width: 1280, height: 860 }, "2026-10-12T12:00:00Z", {
    fn: (data) => {
      window.__slowChats = Date.now() + 2000;
      if (!localStorage.getItem("tabula-latina-messenger-v1")) localStorage.setItem("tabula-latina-messenger-v1", data);
    },
    arg: JSON.stringify(old),
  });
  await late.p.waitForTimeout(3500);
  const kept = shared.get("data/users/u1/messenger/threads/iulia").messages.map((m) => m.id);
  if (chat.messages.some((m) => !kept.includes(m.id)) || !kept.includes("r9")) errors.push(`messenger: a device with an old copy overwrote the account's chat (${chat.messages.length} messages, now ${kept.length})`);
  await late.ctx.close();

  // The Sibyl's leaf: after a while on the page a leaf blows past; caught, it is read and kept in her book in the
  // chat list, and when a friend tells of what it foretold, the message has a leaf and the book says it came true.
  shared.clear();
  const sib = await device("sibyl", { width: 1280, height: 800 }, "2026-10-20T08:00:00Z");
  await sib.p.evaluate(() => (window.__sibyl = true));
  await sib.p.click("#me-name").catch(() => undefined);
  if (await sib.p.locator("#me-start").count()) {
    await sib.p.fill("#me-name", "Kiril");
    await sib.p.click("#me-m");
    await sib.p.click("#me-start");
  }
  await sib.p.click("body", { position: { x: 5, y: 5 } });
  // (runFor, not fastForward: the wind counts the time on the page in steps of five seconds)
  await sib.ctx.clock.runFor(60_000);
  await sib.p.waitForTimeout(400);
  await sib.ctx.clock.runFor(6000);
  await sib.p.waitForTimeout(300);
  await sib.ctx.clock.runFor(6000);
  const leaf = sib.p.locator(".sibyl-leaf");
  if (!(await leaf.count())) errors.push("sibyl: no leaf blew across the page");
  else {
    await sib.ctx.clock.runFor(3000);
    await sib.p.screenshot({ path: `${out}/sibyl-wind.png` });
    await leaf.dispatchEvent("click");
    await sib.ctx.clock.runFor(4000);
    await sib.p.waitForTimeout(300);
    if (!(await sib.p.locator(".sibyl-veil .sibyl-line.on").count())) errors.push("sibyl: the caught leaf shows no lines");
    await sib.p.click(".sibyl-veil .sibyl-line >> nth=1");
    await sib.p.waitForTimeout(200);
    if (!(await sib.p.locator(".sibyl-veil .sibyl-en").count())) errors.push("sibyl: a tap on a line does not show its English");
    await sib.p.screenshot({ path: `${out}/sibyl-leaf.png` });
    await sib.p.click(".sibyl-keep");
    await sib.p.waitForTimeout(300);
    if (!(await sib.p.locator("#chat-sibylla").count())) errors.push("sibyl: the book is not in the chat list");
    await sib.p.click("#chat-sibylla");
    await sib.p.waitForTimeout(300);
    if (!/Fātum manet/.test((await sib.p.locator(".sibyl-book").textContent()) ?? "")) errors.push("sibyl: the book does not say the fate is still to come");
    await sib.p.screenshot({ path: `${out}/sibyl-book.png` });
    // the fate comes; Gāius tells of it in his chat (a message the phone routine might have written)
    const fates = (shared.get("data/users/u1/messenger") ?? {}).world?.fates ?? [];
    if (fates.length !== 1 || fates[0].who !== "gaius") errors.push(`sibyl: the fate is not in the world (${JSON.stringify(fates)})`);
    else {
      const at = fates[0].at + 3600_000;
      await sib.ctx.clock.fastForward(at - (await sib.p.evaluate(() => Date.now())) + 5000);
      const path = "data/users/u1/messenger/threads/gaius";
      const t = shared.get(path) ?? { id: "gaius", kind: "dm", messages: [], readAt: 0, memory: [], updatedAt: 0 };
      shared.set(path, { ...t, messages: [...t.messages, { id: "rtaurus1", from: "gaius", la: "Heu! Taurus vīnum meum bibit! 😡", en: "Alas! A bull drank my wine! 😡", at, src: "routine" }], updatedAt: at });
      await sib.p.waitForTimeout(700);
      await sib.p.click(".chat-back").catch(() => undefined);
      await sib.p.click("#chat-sibylla");
      await sib.p.waitForTimeout(300);
      if (!/Implētum est/.test((await sib.p.locator(".sibyl-book").textContent()) ?? "")) errors.push("sibyl: the book does not say the leaf came true");
      if (await sib.p.locator("#chat-sibylla .unread-badge").count()) errors.push("sibyl: what came true still shows as new in the open book");
      await sib.p.screenshot({ path: `${out}/sibyl-done.png` });
      await sib.p.click(".sibyl-told");
      await sib.p.waitForTimeout(700);
      if (!(await sib.p.locator("#msg-rtaurus1 .leaf-mark").count())) errors.push("sibyl: the message that tells of it has no leaf");
      // opening the chat rolls their lives on: the fate is Gāius's life now
      const meta = shared.get("data/users/u1/messenger") ?? {};
      if (!meta.world?.fates?.[0]?.done || meta.life?.gaius?.event !== fates[0].en) errors.push("sibyl: the fate did not become Gāius's life");
      await sib.p.screenshot({ path: `${out}/sibyl-message.png` });
      // on a phone: the book, and a leaf caught there
      await sib.p.setViewportSize({ width: 390, height: 844 });
      await sib.p.click(".leaf-mark");
      await sib.p.waitForTimeout(500);
      await sib.p.screenshot({ path: `${out}/sibyl-book-phone.png` });
    }
  }
  await sib.ctx.close();
}

// What the learner can do in the messenger besides writing: a fresh picture someone sends
// (made by the pictures routine, fired through the connector), a photo of the learner's own
// (Claude sees it), a voice message, deleting a message, muting, blocking, a group of their
// own (renamed, someone removed), someone from the story, clearing a chat.
async function abilities() {
  const shared = new Map();
  const runtime = () => {
    window.__prompts = [];
    window.__images = [];
    window.__mcp = [];
    const sample = async () => ({ text: "", truncated: false });
    sample.limits = async () => ({ images: { maxCount: 4, mediaTypes: ["image/jpeg", "image/png"] } });
    sample.json = async (prompt, opts) => {
      window.__prompts.push(prompt);
      if (opts?.images) window.__images.push(opts.images.length);
      await new Promise((r) => setTimeout(r, 250));
      if (prompt.includes("TODAY'S BOARD")) return { items: [{ kind: "day", title: "Hodiē", titleEn: "Today", lines: [{ la: "Agricola labōrat.", en: "The farmer works." }] }] };
      if (prompt.includes("ON THEIR OWN")) return { messages: [] };
      if (prompt.includes("wants to write to someone from the story")) return { name: "Tertia", g: "f", age: 19, job: "Iūlia's younger sister", city: "Rome", about: "Nosy and clever.", link: { to: "iulia", how: "her sister" }, first: "Who is this?", happenings: [] };
      if (prompt.includes("break the learner's limits")) return { messages: [{ la: "Euge!", en: "Great!" }] };
      if (prompt.includes("group chat «Cēna")) return { messages: [{ from: "iulia", la: "Salvēte! 😄", en: "Hi all! 😄", gap: 1 }] };
      if (prompt.includes("attached to this prompt")) return { messages: [{ from: "iulia", la: "Euge! 😻", en: "Great! 😻", gap: 1 }], saw: "a ginger cat on a sofa" };
      const id = (prompt.match(/Person ids: "([a-z0-9]+)"/) || [])[1] || "iulia";
      return { messages: [{ from: id, la: "Ecce!", en: "Look!", gap: 1, picture: "a goat standing on the roof of a Roman house" }] };
    };
    const docRef = (path) => ({
      get: async () => { const d = await window.__dbGet(path); return { exists: !!d, data: () => d ?? undefined }; },
      set: async (data) => void (await window.__dbSet(path, JSON.parse(JSON.stringify(data)))),
      delete: async () => void (await window.__dbDel(path)),
      collection: (sub) => colRef(`${path}/${sub}`),
      onSnapshot: (next) => {
        let last = "";
        const tick = async () => {
          const d = await window.__dbGet(path);
          const sig = JSON.stringify(d);
          if (sig === last) return;
          last = sig;
          next({ exists: !!d, data: () => d ?? undefined });
        };
        void tick();
        const t = setInterval(tick, 200);
        return () => clearInterval(t);
      },
    });
    const colRef = (path) => ({
      doc: (id) => docRef(`${path}/${id}`),
      onSnapshot: (next) => {
        let last = "";
        const tick = async () => {
          const docs = await window.__dbList(path);
          const sig = JSON.stringify(docs);
          if (sig === last) return;
          last = sig;
          next({ docs: docs.map((d) => ({ id: d.id, data: () => d.data })) });
        };
        void tick();
        const t = setInterval(tick, 200);
        return () => clearInterval(t);
      },
      orderBy: () => ({ limit: () => ({ onSnapshot: () => () => undefined }) }),
    });
    const db = { doc: docRef, collection: colRef };
    const mcp = { callTool: async (server, tool, input) => (window.__mcp.push({ server, tool, input }), { payload: {} }) };
    window.claude = { use: async (n) => (n === "sample" ? sample : n === "db" ? db : n === "user" ? { id: async () => "u1" } : n === "mcp" ? mcp : null) };
  };
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  await ctx.clock.install({ time: new Date("2026-10-12T10:30:00Z") });
  await seed(ctx);
  await ctx.addInitScript(runtime);
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(`abilities: ${e.message}`));
  p.on("console", (m) => m.type() === "error" && !/fonts\.g/.test(m.text()) && errors.push(`abilities console: ${m.text()}`));
  await p.exposeFunction("__dbGet", (path) => shared.get(path) ?? null);
  await p.exposeFunction("__dbSet", (path, data) => void shared.set(path, data));
  await p.exposeFunction("__dbDel", (path) => void shared.delete(path));
  await p.exposeFunction("__dbList", (col) => [...shared.entries()].filter(([k]) => k.startsWith(col + "/") && !k.slice(col.length + 1).includes("/")).map(([k, data]) => ({ id: k.slice(col.length + 1), data })));
  await p.goto(`file://${page}#nuntii`);
  await p.waitForTimeout(700);
  await p.fill("#me-name", "Kiril");
  await p.click("#me-m");
  await p.click("#me-start");
  await p.waitForTimeout(800);
  const pics = () => [...shared.entries()].filter(([k]) => k.startsWith("data/users/u1/messenger/pics/")).map(([k, v]) => ({ id: k.split("/").pop(), ...v }));
  // a real picture to send (one of the portraits)
  const PNG = readFileSync(resolve("src/content/portraits", readdirSync("src/content/portraits").find((f) => f.endsWith(".webp"))));

  // a fresh picture: "on its way", the pictures routine fired once, then the picture itself
  await p.click("#chat-iulia");
  await p.fill("#composer", "Salvē, Iūlia!");
  await p.click("#composer-send");
  await p.waitForTimeout(3500);
  await ctx.clock.fastForward("20:00");
  await p.waitForTimeout(800);
  const wanted = pics().find((x) => x.status === "wanted");
  if (!wanted || !wanted.prompt.includes("goat")) errors.push(`abilities: the picture Iūlia sends does not wait to be made (${JSON.stringify(pics())})`);
  if (!(await p.locator(".pic-wait", { hasText: "on its way" }).count())) errors.push("abilities: a picture being made does not show as on its way");
  const fired = await p.evaluate(() => window.__mcp);
  if (fired.length !== 1 || fired[0].server !== "Claude Code Remote" || fired[0].tool !== "fire_trigger" || !String(fired[0].input.trigger_id).startsWith("trig_")) errors.push(`abilities: the pictures routine was not fired (${JSON.stringify(fired)})`);
  if (wanted) shared.set(`data/users/u1/messenger/pics/${wanted.id}`, { ...wanted, status: "done", type: "image/webp", b64: PNG.toString("base64") });
  await p.waitForTimeout(800);
  if (!(await p.locator(".bubble-photo img").count())) errors.push("abilities: the picture does not show once it is made");
  await p.screenshot({ path: `${out}/abilities-picture.png` });

  // the learner's own photo, with a caption: Claude is shown it, and they remember what it showed
  await p.click(".plus-btn");
  if (!(await p.locator("#attach-photo").count())) errors.push("abilities: no way to send a photo");
  await p.setInputFiles("input[type=file]", { name: "cat.webp", mimeType: "image/webp", buffer: PNG });
  await p.waitForTimeout(300);
  if (!(await p.locator(".photo-draft img").count())) errors.push("abilities: a picked photo is not shown before sending");
  await p.fill("#composer", "Fēlēs mea!");
  await p.click("#composer-send");
  await p.waitForTimeout(3500);
  await ctx.clock.fastForward("20:00");
  await p.waitForTimeout(800);
  if (!pics().some((x) => x.by === "me" && x.b64)) errors.push("abilities: the learner's photo is not saved");
  if (!(await p.locator(".bubble.mine .bubble-photo img").count())) errors.push("abilities: the learner's photo does not show in the chat");
  if (!(await p.evaluate(() => window.__images.includes(1)))) errors.push("abilities: Claude was not shown the learner's photo");
  const thread = shared.get("data/users/u1/messenger/threads/iulia");
  if (!thread?.messages?.some((m) => m.from === "me" && m.picEn === "a ginger cat on a sofa")) errors.push("abilities: what the photo showed is not remembered");
  await p.screenshot({ path: `${out}/abilities-photo.png` });

  // a voice message of the learner's own
  await p.click(".plus-btn");
  await p.click("#as-voice");
  await p.fill("#composer", "Salvē, Iūlia");
  await p.click("#composer-send");
  await p.waitForTimeout(400);
  if (!(await p.locator(".bubble.mine .voice-note").count())) errors.push("abilities: the learner's voice message shows no player");

  // delete a message of the learner's (two taps)
  await p.locator(".bubble.mine").last().click({ position: { x: 20, y: 10 } });
  await p.click(".delete-mine");
  await p.click(".delete-mine.sure");
  await p.waitForTimeout(300);
  if (!(await p.locator(".bubble.mine.deleted").count())) errors.push("abilities: a deleted message does not show as deleted");

  // mute and block
  await p.click('.chat-tools [aria-label="More"]');
  await p.click("#mute-chat");
  if (!(await p.locator("#chat-iulia .muted-mark").count())) errors.push("abilities: a muted chat is not marked in the list");
  await p.click('.chat-tools [aria-label="More"]');
  await p.click("#block-who");
  if (!(await p.locator(".blocked-bar").count()) || (await p.locator("#composer").count())) errors.push("abilities: blocking does not close the message box");
  await p.screenshot({ path: `${out}/abilities-blocked.png` });
  await p.click("#unblock");
  if (!(await p.locator("#composer").count())) errors.push("abilities: unblocking does not bring the message box back");

  // clear the chat
  await p.click('.chat-tools [aria-label="More"]');
  await p.click("#clear-chat");
  await p.click("#clear-yes");
  if (await p.locator(".chat-msgs .bubble").count()) errors.push("abilities: a cleared chat still shows its messages");

  // a group of the learner's own: made, answered, renamed, someone removed
  await p.click("#new-chat");
  await p.screenshot({ path: `${out}/abilities-new-chat.png` });
  await p.click("#new-group");
  await p.fill("#group-name", "Cēna");
  await p.click("#pick-iulia");
  await p.click("#pick-marcus");
  await p.click("#group-create");
  await p.waitForTimeout(3000);
  await ctx.clock.fastForward("20:00");
  await p.waitForTimeout(800);
  if (!(await p.locator(".chat-sys", { hasText: "You created the group «Cēna»." }).count())) errors.push("abilities: a new group does not say who made it");
  if (!(await p.locator(".bubble .bubble-text", { hasText: "Salvēte" }).count())) errors.push("abilities: nobody answers in the new group");
  if (!(await p.locator(".chat-row-name", { hasText: "Cēna" }).count())) errors.push("abilities: the new group is not in the list");
  await p.click("#chat-profile");
  await p.fill("#group-rename", "Cēna magna");
  await p.locator(".group-sheet button", { hasText: "Rename" }).click();
  await p.locator(".group-sheet .person-row", { hasText: "Marcus" }).locator("button").click();
  await p.click("#remove-marcus");
  await p.screenshot({ path: `${out}/abilities-group.png` });
  await p.keyboard.press("Escape");
  await p.waitForTimeout(300);
  if (!(await p.locator(".chat-sys", { hasText: "You renamed the group «Cēna magna»." }).count()) || !(await p.locator(".chat-sys", { hasText: "You removed Marcus." }).count())) errors.push("abilities: renaming or removing shows no line in the group");

  // someone from the story
  await p.click("#new-chat");
  await p.fill("#story-who", "Tertia, Iūlia's sister");
  await p.locator(".story-seek button").click();
  await p.waitForTimeout(1200);
  if (!((await p.locator(".chat-head-name").textContent()) ?? "").includes("Tertia")) errors.push("abilities: writing to someone from the story does not open their chat");
  if (!(await p.locator(".chat-row-name", { hasText: "Tertia" }).count())) errors.push("abilities: someone from the story is not in the list");
  await p.screenshot({ path: `${out}/abilities-story.png` });
  // on a phone: New chat and a group's sheet fit the screen
  await p.setViewportSize({ width: 390, height: 844 });
  await p.click(".chat-back");
  await p.click("#new-chat");
  await p.waitForTimeout(400);
  const wide = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  if (wide > 1) errors.push(`abilities: New chat is ${wide}px wider than a phone`);
  await p.screenshot({ path: `${out}/abilities-phone-new-chat.png` });
  await ctx.close();
}

// Own words: the Words page adds a word Claude fills in (shown before it is added, then under
// "Yours", with its story and a way to remove it); a word card in Ask Claude offers to add its word.
async function ownWords() {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await seed(ctx);
  await ctx.addInitScript(() => {
    window.__asked = [];
    const card = (dict, en, kind, extra = {}) => ({
      found: true, kind, dict, en, alt: [], tags: ["thing", "weapon", "long"],
      origin: "Probably borrowed from the Celts.", history: "Legionaries carried it.",
      from: { en: ["gladiator", "gladiolus"], ru: ["гладиатор"], uk: ["гладіатор"] }, kin: { en: [], ru: [], uk: [] },
      examples: [{ la: "Gladium teneō.", en: "I hold a sword." }], ...extra,
    });
    const sample = (input, opts) => {
      window.__asked.push(input);
      const text = "**pīlum, pīlī (n) · javelin**\n**Origin:** perhaps from pīla.\n**History:** each legionary carried two.\n**Family:** English pile.\n**Use:** «Pīlum teneō.» I hold a javelin.";
      opts?.onText?.({ text });
      return Promise.resolve({ text, truncated: false });
    };
    sample.json = async (prompt) => {
      window.__asked.push(prompt);
      await new Promise((r) => setTimeout(r, 200));
      if (prompt.includes('They typed: "lucerna"')) return card("lucerna, lucernae, f.", "lamp", "noun");
      if (prompt.includes('They typed: "pīlum"')) return card("pīlum, pīlī, n.", "javelin", "noun");
      return { found: false, why: "Not a word." };
    };
    window.claude = { use: async (name) => (name === "sample" ? sample : null) };
  });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(`own words: ${e.message}`));
  await p.goto(`file://${page}#words`);
  await p.waitForTimeout(700);
  await p.click("#add-word");
  await p.fill("#add-word-input", "lucerna");
  await p.press("#add-word-input", "Enter");
  await p.waitForTimeout(600);
  const preview = (await p.locator(".word-preview").textContent().catch(() => "")) ?? "";
  if (!preview.includes("lucerna") || !preview.includes("Origin") || !preview.includes("gladiator")) errors.push(`own words: no card before adding (${preview.slice(0, 120)})`);
  if (!(await p.locator(".word-preview .paradigm").count())) errors.push("own words: the card shows no forms");
  await p.screenshot({ path: `${out}/own-word-card.png` });
  await p.click("#add-word-confirm");
  await p.waitForTimeout(300);
  await p.locator(".seg button", { hasText: "Yours" }).click();
  const tiles = await p.locator(".word-tile .head").allTextContents();
  if (!tiles.includes("lucerna")) errors.push(`own words: the added word is not under Yours (${JSON.stringify(tiles)})`);
  await p.locator(".word-tile", { hasText: "lucerna" }).click();
  if (!(await p.locator(".modal", { hasText: "Origin" }).count()) || !(await p.locator(".modal button", { hasText: "Remove from my words" }).count())) errors.push("own words: the word dialog lacks its story or Remove");
  await p.screenshot({ path: `${out}/own-word-dialog.png` });
  await p.keyboard.press("Escape");
  // a known word is not looked up again (any form; a lesson word too)
  await p.click("#add-word");
  await p.fill("#add-word-input", "lucernam");
  await p.press("#add-word-input", "Enter");
  await p.waitForTimeout(300);
  if (!(await p.locator(".modal", { hasText: "is in your words already" }).count())) errors.push("own words: a word already added is not recognised in another form");
  await p.keyboard.press("Escape");
  await p.click("#add-word");
  await p.fill("#add-word-input", "gladius");
  await p.press("#add-word-input", "Enter");
  await p.waitForTimeout(300);
  if (!(await p.locator(".modal", { hasText: "is in your words already" }).count())) errors.push("own words: a lesson word is offered for adding");
  await p.keyboard.press("Escape");
  // Ask Claude: a word sent alone gets its card, and a button adds it
  await p.locator(".ask-btn").click();
  await p.locator("#ask-input").fill("pīlum");
  await p.locator("#ask-input").press("Enter");
  await p.waitForTimeout(400);
  const addBtn = p.locator(".add-from-answer", { hasText: "pīlum" });
  if (!(await addBtn.count())) errors.push("own words: the word card in Ask Claude offers no Add");
  else {
    await addBtn.click();
    await p.waitForTimeout(600);
    await p.click("#add-word-confirm");
    await p.waitForTimeout(300);
    if (await p.locator(".add-from-answer").count()) errors.push("own words: the Add button stays after the word was added");
  }
  const own = await p.evaluate(() => JSON.parse(localStorage.getItem("tabula-latina-progress-v1")).own.map((w) => w.dict));
  if (own.join("|") !== "lucerna, lucernae, f.|pīlum, pīlī, n.") errors.push(`own words: saved ${JSON.stringify(own)}`);
  await ctx.close();
}

// SMOKE_ONLY=messenger npm run smoke: just one part (messenger, abilities, ownWords, learn, stories, conversations, chatScroll, askClaude, audio, recorded, pages)
const only = process.env.SMOKE_ONLY;
const parts = {
  messenger: () => messenger(),
  abilities: () => abilities(),
  ownWords: () => ownWords(),
  learn: async () => {
    await learnFlow("learn-desktop", { width: 1280, height: 900 }, true);
    await learnFlow("learn-phone", { width: 390, height: 844 }, false);
  },
  stories: () => stories(),
  conversations: () => conversations(),
  chatScroll: () => chatScroll(),
  askClaude: () => askClaude(),
  audio: () => audio(),
  recorded: () => recorded(),
  pages: async () => {
    await run("desktop-light", { width: 1280, height: 900 }, "light");
    await run("desktop-dark", { width: 1280, height: 900 }, "dark");
    await run("phone-light", { width: 390, height: 844 }, "light");
  },
};
for (const [name, part] of Object.entries(parts)) if (!only || only === name) await part();
await browser.close();
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`ok, screenshots in ${out}`);
