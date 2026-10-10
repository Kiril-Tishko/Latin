// A tiny, safe renderer for rule texts and Claude's answers: paragraphs,
// lists, **bold**, *italic*, `code`, ### headings, and «Latin» with colored
// endings. Everything is built as elements, never as raw HTML.
import { ComponentChildren, Fragment } from "preact";
import { LatinText } from "./latin";

const INLINE = /(«[^»]+»|\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`)/g;

export function Inline({ text }: { text: string }) {
  const parts = text.split(INLINE).filter((p) => p !== "");
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith("«")) return <LatinText key={i} text={p.slice(1, -1)} />;
        if (p.startsWith("**")) return <strong key={i}><Inline text={p.slice(2, -2)} /></strong>;
        if (p.startsWith("`")) return <code key={i}>{p.slice(1, -1)}</code>;
        if (p.startsWith("*") && p.length > 2) return <em key={i}><Inline text={p.slice(1, -1)} /></em>;
        return <Fragment key={i}>{p}</Fragment>;
      })}
    </>
  );
}

export function Markup({ text }: { text: string }) {
  const blocks: ComponentChildren[] = [];
  const lines = text.replace(/\r/g, "").split("\n");
  let list: { ordered: boolean; items: string[] } | null = null;
  let para: string[] = [];
  const flushPara = () => {
    if (para.length) blocks.push(<p key={blocks.length}><Inline text={para.join(" ")} /></p>);
    para = [];
  };
  const flushList = () => {
    if (!list) return;
    const items = list.items.map((it, i) => <li key={i}><Inline text={it} /></li>);
    blocks.push(list.ordered ? <ol key={blocks.length}>{items}</ol> : <ul key={blocks.length}>{items}</ul>);
    list = null;
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
    const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    const heading = line.match(/^#{1,4}\s+(.*)$/);
    if (!line.trim()) {
      flushPara();
      flushList();
    } else if (heading) {
      flushPara();
      flushList();
      blocks.push(<h3 key={blocks.length} style={{ fontSize: "1.02rem" }}><Inline text={heading[1]} /></h3>);
    } else if (bullet || numbered) {
      flushPara();
      const ordered = !!numbered;
      if (!list || list.ordered !== ordered) {
        flushList();
        list = { ordered, items: [] };
      }
      list.items.push((bullet ?? numbered)![1]);
    } else {
      flushList();
      para.push(line.trim());
    }
  }
  flushPara();
  flushList();
  return <>{blocks}</>;
}
