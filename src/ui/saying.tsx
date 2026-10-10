// A famous Latin saying that uses a word: the Latin with colored endings, its
// meaning, where it comes from, and a note tying it to what the learner knows.
import { Saying, sayingsFor } from "../content/sayings";
import { LatinText } from "./latin";
import { Speak } from "./speak";

export function Sayings({ wordId, max = 1 }: { wordId: string; max?: number }) {
  const list = sayingsFor(wordId).slice(0, max);
  if (!list.length) return null;
  return (
    <div class="stack" style={{ gap: "8px" }}>
      <span class="eyebrow" style={{ color: "var(--ink-2)" }}>{list.length > 1 ? "Famous sayings" : "Famous saying"}</span>
      {list.map((s, i) => (
        <SayingView key={s.la} s={s} id={`saying-${wordId}-${i}`} />
      ))}
    </div>
  );
}

function SayingView({ s, id }: { s: Saying; id: string }) {
  return (
    <figure class="saying">
      <blockquote>
        <LatinText text={s.la} />
        <Speak text={s.la} id={id} />
      </blockquote>
      <figcaption>
        {s.en}
        {s.source && <span class="saying-source"> · {s.source}</span>}
      </figcaption>
      {s.note && <p class="small muted">{s.note}</p>}
    </figure>
  );
}
