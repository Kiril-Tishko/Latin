import { useEffect, useState } from "preact/hooks";
import { AskDrawer, onPractice, openAsk } from "./ask";
import { Hedera, Icon, Toaster } from "./components";
import { roman } from "../latin/text";
import { go, Route, useRoute } from "./nav";
import { Discover } from "./pages/discover";
import { Home } from "./pages/home";
import { LessonPage, Lessons } from "./pages/lessons";
import { Rules } from "./pages/rules";
import { startSession, Train } from "./pages/train";
import { Words } from "./pages/words";
import { Settings } from "./settings";
import { connect, getSync, useProgress } from "./store";
import { SKILL_BY_ID } from "../latin/skills";
import { setSpeechPrefs } from "../audio/speech";

// Section names in Latin; the English shows as a tooltip.
const TABS: { route: Route; label: string; en: string; icon: () => preact.JSX.Element }[] = [
  { route: { page: "home" }, label: "Domus", en: "Home", icon: Icon.home },
  { route: { page: "lessons" }, label: "Lectiōnēs", en: "Lessons", icon: Icon.scroll },
  { route: { page: "train" }, label: "Exercitium", en: "Train", icon: Icon.stylus },
  { route: { page: "words" }, label: "Verba", en: "Words", icon: Icon.book },
  { route: { page: "discover" }, label: "Inventiō", en: "Discover", icon: Icon.card },
  { route: { page: "rules" }, label: "Rēgulae", en: "Rules", icon: Icon.column },
];

const active = (r: Route, t: Route) => r.page === t.page || (r.page === "lesson" && t.page === "lessons");

const SYNC_TEXT = { local: "saved in this browser", connecting: "connecting…", synced: "saved to your account", saving: "saving…", error: "saving failed, will retry" };

export function App() {
  const route = useRoute();
  const p = useProgress();
  setSpeechPrefs({ voice: p.settings.voice, rate: p.settings.rate });
  const [settings, setSettings] = useState(false);

  useEffect(() => {
    void connect();
    onPractice((skills) => {
      startSession({ kind: "skills", skills, label: skills.map((s) => SKILL_BY_ID.get(s)?.title).join(", ") });
      go({ page: "train" });
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
    case "train":
      page = <Train />;
      break;
    case "words":
      page = <Words />;
      break;
    case "discover":
      page = <Discover />;
      break;
    case "rules":
      page = <Rules />;
      break;
    default:
      page = <Home />;
  }

  return (
    <div class="app">
      <header class="topbar">
        <div class="topbar-inner">
          <button class="brand" onClick={() => go({ page: "home" })}>
            TABVLA<span class="dot" aria-hidden="true" />LATINA
          </button>
          <nav class="nav" aria-label="Sections">
            {TABS.map((t) => (
              <button key={t.label} title={t.en} aria-label={`${t.label} (${t.en})`} aria-current={active(route, t.route) ? "page" : undefined} onClick={() => go(t.route)}>
                <t.icon /> {t.label}
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

      <main class={`page${route.page === "train" ? " wide" : ""}`} id="main">{page}</main>

      {route.page !== "train" && (
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
          </button>
        ))}
      </nav>

      <AskDrawer />
      <Toaster />
      {settings && <Settings onClose={() => setSettings(false)} />}
    </div>
  );
}
