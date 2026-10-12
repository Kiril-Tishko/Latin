import { useEffect, useState } from "preact/hooks";
import { AskDrawer, onPractice, openAsk } from "./ask";
import { AddWordHost } from "./addword";
import { Hedera, Icon, Toaster } from "./components";
import { roman } from "../latin/text";
import { go, Route, useRoute } from "./nav";
import { Home } from "./pages/home";
import { LessonPage, Lessons } from "./pages/lessons";
import { LearnPage } from "./pages/learn";
import { startSession, Train } from "./pages/train";
import { Words } from "./pages/words";
import { English } from "./pages/english";
import { StoryPage } from "./pages/stories";
import { Settings } from "./settings";
import { connect, getSync, useProgress } from "./store";
import { connectChats } from "./chats";
import { SKILL_BY_ID } from "../latin/skills";
import { setSpeechPrefs } from "../audio/speech";
import { useScreen } from "./screen";
import { ArrivalNotice, Messenger } from "./pages/messenger";
import { connectMessenger, unreadTotal, useMessenger } from "./messenger";

// Four sections, named in Latin (the English shows as a tooltip): today's next step,
// everything to read and learn, the learner's words, and the messenger.
const TABS: { route: Route; label: string; en: string; icon: () => preact.JSX.Element }[] = [
  { route: { page: "home" }, label: "Domus", en: "Today", icon: Icon.home },
  { route: { page: "lessons" }, label: "Lectiōnēs", en: "Lessons, rules, stories", icon: Icon.scroll },
  { route: { page: "words" }, label: "Verba", en: "Words", icon: Icon.book },
  { route: { page: "messenger" }, label: "Nūntiī", en: "Messages", icon: Icon.letter },
];

// a round of exercises belongs to Domus (Continue starts it); a lesson, a rule, the stories and Latin in English to Lectiōnēs
const UNDER: Partial<Record<Route["page"], Route["page"]>> = { train: "home", lesson: "lessons", learn: "lessons", english: "lessons", stories: "lessons", story: "lessons" };
const active = (r: Route, t: Route) => r.page === t.page || UNDER[r.page] === t.page;

const PAGE_NAME: Record<Route["page"], string> = { home: "Today", lessons: "Lessons", lesson: "A lesson", learn: "A rule to learn", train: "Practice", words: "Words", english: "Latin in English", stories: "Stories", story: "A story", messenger: "Messages" };

const SYNC_TEXT = { local: "saved in this browser", connecting: "connecting…", synced: "saved to your account", saving: "saving…", error: "saving failed, will retry" };

/** Unread messages in the messenger, as a small gold count. */
function UnreadBadge() {
  const now = useMessenger();
  const n = unreadTotal(now);
  return n > 0 ? <span class="tab-badge" aria-label={`${n} unread`}>{roman(n)}</span> : null;
}

export function App() {
  const route = useRoute();
  const p = useProgress();
  setSpeechPrefs({ voice: p.settings.voice, rate: p.settings.rate });
  const [settings, setSettings] = useState(false);
  // what is on screen, for Ask Claude (each page and dialog says more about itself)
  useScreen("app", PAGE_NAME[route.page], () => `The ${PAGE_NAME[route.page]} page.`);

  useEffect(() => {
    void connect();
    void connectChats();
    void connectMessenger();
    onPractice((skills) => {
      if (startSession({ kind: "skills", skills, label: skills.map((s) => SKILL_BY_ID.get(s)?.title).join(", ") })) go({ page: "train" });
    });
  }, []);

  let page;
  switch (route.page) {
    case "lessons":
      page = <Lessons />;
      break;
    case "lesson":
      page = <LessonPage n={route.n} />;
      break;
    case "learn":
      page = <LearnPage id={route.id} />;
      break;
    case "train":
      page = <Train />;
      break;
    case "words":
      page = <Words />;
      break;
    case "english":
      page = <English />;
      break;
    case "stories":
      page = <Lessons focus="stories" />;
      break;
    case "story":
      page = <StoryPage id={route.id} />;
      break;
    case "messenger":
      page = <Messenger thread={route.thread} />;
      break;
    default:
      page = <Home />;
  }

  return (
    <div class={`app${route.page === "messenger" ? " scene-on" : ""}`}>
      <header class="topbar">
        <div class="topbar-inner">
          <button class="brand" onClick={() => go({ page: "home" })}>
            TABVLA<span class="dot" aria-hidden="true" />LATINA
          </button>
          <nav class="nav" aria-label="Sections">
            {TABS.map((t) => (
              <button key={t.label} title={t.en} aria-label={`${t.label} (${t.en})`} aria-current={active(route, t.route) ? "page" : undefined} onClick={() => go(t.route)}>
                <t.icon /> {t.label}
                {t.route.page === "messenger" && <UnreadBadge />}
              </button>
            ))}
          </nav>
          <div class="top-actions">
            <button class="btn gold small ask-btn" onClick={() => openAsk(null)} aria-label="Rogā Claudium (ask Claude)" title="Ask Claude">
              <Icon.quill /> <span class="ask-label">Rogā Claudium</span><span class="ask-short">Rogā</span>
            </button>
            <button class="btn ghost small" onClick={() => setSettings(true)} aria-label="Optiōnēs (settings)" title={`Optiōnēs (settings) · ${SYNC_TEXT[getSync()]}`}>
              <Icon.gear />
            </button>
          </div>
        </div>
      </header>

      <main class={`page${route.page === "train" ? " wide" : route.page === "messenger" ? " wide msgr-page" : ""}`} id="main">{page}</main>

      {route.page !== "train" && route.page !== "messenger" && route.page !== "english" && (
        <footer class="site-foot" aria-label={`Tabula Latina, ${new Date().getFullYear()}`}>
          <Hedera />
          <span>{roman(new Date().getFullYear())}</span>
          <Hedera flip />
        </footer>
      )}

      <nav class="bottomnav" aria-label="Sections">
        {TABS.map((t) => (
          <button key={t.label} title={t.en} aria-label={`${t.label} (${t.en})`} aria-current={active(route, t.route) ? "page" : undefined} onClick={() => go(t.route)}>
            <t.icon />
            {t.label}
            {t.route.page === "messenger" && <UnreadBadge />}
          </button>
        ))}
      </nav>

      <AskDrawer />
      <AddWordHost />
      <Toaster />
      {p.settings.me && <ArrivalNotice current={route.page === "messenger" ? route.thread ?? null : null} />}
      {settings && <Settings onClose={() => setSettings(false)} />}
    </div>
  );
}
