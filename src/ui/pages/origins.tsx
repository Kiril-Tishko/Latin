// Verba > Orīginēs: where the learner's words come from and what they still
// explain, as the learner asked (etymology is "one of the main reasons I am
// learning Latin… the cultural influence… reflected in the words and the way
// we perceive things"). Four things, one page: the Latin in English reader,
// stories of culture in words, the hidden links Claude has found for them, and
// every word's family in English, Russian and Ukrainian.
import { useState } from "preact/hooks";
import { CULTURE, CultureStory } from "../../content/culture";
import { Relatives } from "../../content/deck";
import { STORY_ONLY } from "../../content/words";
import { Entry } from "../../latin/types";
import { Family, familyMatches, hiddenLinks, wordFamilies } from "../../trainer/origins";
import { openAsk } from "../ask";
import { useChats } from "../chats";
import { Hedera, Icon, Modal } from "../components";
import { NO_CORRECTION } from "../keyboard";
import { Inline } from "../markup";
import { go } from "../nav";
import { useScreen } from "../screen";
import { derived, useProgress } from "../store";
import { englishProgress } from "./english";
import { headword, VerbaSwitch, WordModal } from "./words";

const family = (r: Relatives) => [...(r.en ?? []), ...(r.ru ?? []), ...(r.uk ?? [])];

export function Origins() {
  const p = useProgress();
  const d = derived();
  const chats = useChats();
  const [story, setStory] = useState<CultureStory | null>(null);
  const [open, setOpen] = useState<Entry | null>(null);
  const [query, setQuery] = useState("");
  const links = hiddenLinks(p.own ?? [], chats);
  const words = d.words.filter((w) => w.kind !== "fixed" && !STORY_ONLY.has(w.id));
  const all = wordFamilies(words);
  const families = all.filter((f) => familyMatches(f, query));
  useScreen("page", "Origins (Verba > Orīginēs)", () =>
    [
      "Orīginēs, under Verba: where the learner's words come from (the learner loves etymology and how Latin explains today's words and culture).",
      `The Latin in English reader: ${englishProgress()}.`,
      `Culture in words, short stories: ${CULTURE.map((s) => s.title).join("; ")}.`,
      links.length ? `Hidden links found so far: ${links.slice(0, 12).map((l) => `${l.word}: ${l.text}`).join(" | ")}.` : "No hidden links collected yet.",
      `Word families of ${all.length} words${query ? `, searching "${query}"` : ""}.`,
    ].join("\n"),
  );

  return (
    <div class="stack-lg origins-page">
      <VerbaSwitch at="origins" />
      <div class="stack" style={{ gap: "4px" }}>
        <h1 class="origins-title">Orīginēs</h1>
        <p class="muted">Where your words come from, and what they still explain about the world.</p>
      </div>

      <button class="panel lesson-card english-card" onClick={() => go({ page: "english" })}>
        <span class="numeral" aria-hidden="true"><Hedera /></span>
        <span class="stack" style={{ gap: "4px" }}>
          <h2 style={{ fontSize: "1.25rem" }}>Latin in English</h2>
          <span class="muted small">What English took from Latin, a short piece at a time, with a quick question now and then.</span>
          <span class="small ui">{englishProgress()}</span>
        </span>
      </button>

      <section class="stack" data-ask="Culture in words">
        <h2 class="origins-h">Culture in words</h2>
        <div class="culture-grid">
          {CULTURE.map((s) => (
            <button key={s.id} id={`culture-${s.id}`} class="panel culture-card" onClick={() => setStory(s)}>
              <span class="culture-latin"><Inline text={s.latin} /></span>
              <span class="culture-title">{s.title}</span>
              <span class="small muted">{s.teaser}</span>
              {s.words.length > 0 && <span class="chip culture-yours">your word{s.words.length > 1 ? "s" : ""}</span>}
            </button>
          ))}
        </div>
      </section>

      <section class="stack" data-ask="Hidden links">
        <h2 class="origins-h">
          Hidden links {links.length > 0 && <span class="muted small ui">{links.length}</span>}
        </h2>
        {links.length ? (
          <ul class="link-list">
            {links.map((l) => (
              <li key={`${l.word}-${l.at}`}>
                <span class="link-word latin" lang="la">{l.word}</span>
                <span class="link-text"><Inline text={l.text} /></span>
                <span class="small muted ui">{l.from === "own" ? "your word's card" : "Ask Claude"} · {new Date(l.at).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p class="muted">
            Every surprising link Claude finds for a word (euge → Eugene → eugenics) is kept here. Send a word alone to Ask Claude, or add a word of your own, to find one.
          </p>
        )}
      </section>

      <section class="stack" data-ask="Word families">
        <h2 class="origins-h">Word families</h2>
        <input
          id="family-search"
          class="search"
          type="search"
          value={query}
          placeholder="A Latin word, its meaning, or a relative (aquarium, вода…)"
          aria-label="Search the word families"
          {...NO_CORRECTION}
          autocapitalize="off"
          onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
        />
        <div class="family-list">
          {families.map((f) => (
            <FamilyRow key={f.entry.id} f={f} onOpen={() => setOpen(f.entry)} />
          ))}
          {!families.length && <p class="muted">No word of yours has "{query}" in its family.</p>}
        </div>
      </section>

      {story && <StoryModal s={story} onClose={() => setStory(null)} onWord={(e) => setOpen(e)} />}
      {open && <WordModal e={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

/** One word and its relatives: borrowed from it, cousins from the same ancient root, and a look-alike that is not related. */
function FamilyRow({ f, onOpen }: { f: Family; onOpen: () => void }) {
  const from = family(f.from);
  const kin = family(f.kin);
  return (
    <div class="family-row">
      <button class="linkish family-word" onClick={onOpen} title="Open the word">
        <span class="latin" lang="la">{headword(f.entry)}</span> <span class="muted small">{f.entry.en}</span>
      </button>
      <div class="family-rel small">
        {from.length > 0 && (
          <p><span class="rel-label">borrowed</span> {from.join(", ")}</p>
        )}
        {kin.length > 0 && (
          <p><span class="rel-label kin">same root</span> {kin.join(", ")}</p>
        )}
        {f.trap && (
          <p><span class="rel-label trap">not related</span> {f.trap}</p>
        )}
        {f.note && <p class="muted"><Inline text={f.note} /></p>}
      </div>
    </div>
  );
}

/** A story of culture in words, with the learner's own words in it one tap away. */
function StoryModal({ s, onClose, onWord }: { s: CultureStory; onClose: () => void; onWord: (e: Entry) => void }) {
  const d = derived();
  const mine = s.words.map((id) => d.words.find((w) => w.id === id)).filter((w): w is Entry => !!w);
  const today = [...s.modern.en, ...s.modern.ru, ...s.modern.uk];
  return (
    <Modal onClose={onClose} label={s.title}>
      <div class="stack culture-story">
        <div class="spread">
          <span class="eyebrow">Culture in words</span>
          <button class="btn ghost small" onClick={onClose} aria-label="Close"><Icon.close /></button>
        </div>
        <p class="culture-latin big"><Inline text={s.latin} /></p>
        <h2>{s.title}</h2>
        {s.text.map((t, i) => (
          <p key={i}><Inline text={t} /></p>
        ))}
        {today.length > 0 && (
          <p class="small"><span class="rel-label">today</span> {today.join(", ")}</p>
        )}
        {mine.length > 0 && (
          <div class="row small ui" style={{ gap: "6px" }}>
            <span class="muted">Your words in it:</span>
            {mine.map((w) => (
              <button key={w.id} class="chip latin" lang="la" onClick={() => onWord(w)}>{headword(w)}</button>
            ))}
          </div>
        )}
        <div>
          <button class="btn ghost small" onClick={() => openAsk({ label: `Culture in words: ${s.title}`, detail: s.text.join(" ").replace(/[«»]/g, "") }, "Tell me one more surprising thing about this.")}>
            <Icon.quill /> Ask Claude about it
          </button>
        </div>
      </div>
    </Modal>
  );
}
