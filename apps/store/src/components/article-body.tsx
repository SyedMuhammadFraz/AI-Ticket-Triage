import { Fragment } from "react";

/**
 * Renders the small markdown subset used in help articles (paragraphs, "- "
 * and "1. " lists, **bold**) as React elements — no raw HTML is ever injected.
 */
function inline(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : <Fragment key={i}>{part}</Fragment>,
  );
}

export function ArticleBody({ body }: { body: string }) {
  const blocks = body.split(/\n{2,}/);
  return (
    <div className="space-y-4 text-[15px] leading-relaxed">
      {blocks.map((block, i) => {
        const lines = block.split("\n");
        const bulletRun = lines.every((l) => l.startsWith("- "));
        const numberRun = lines.every((l) => /^\d+\.\s/.test(l));
        if (bulletRun) {
          return (
            <ul key={i} className="list-disc space-y-1.5 pl-5">
              {lines.map((l, j) => (
                <li key={j}>{inline(l.slice(2))}</li>
              ))}
            </ul>
          );
        }
        if (numberRun) {
          return (
            <ol key={i} className="list-decimal space-y-1.5 pl-5">
              {lines.map((l, j) => (
                <li key={j}>{inline(l.replace(/^\d+\.\s/, ""))}</li>
              ))}
            </ol>
          );
        }
        // Mixed block: a lead-in line followed by list items.
        const firstListLine = lines.findIndex((l) => l.startsWith("- ") || /^\d+\.\s/.test(l));
        if (firstListLine > 0) {
          const ordered = /^\d+\.\s/.test(lines[firstListLine]);
          const items = lines.slice(firstListLine);
          const List = ordered ? "ol" : "ul";
          return (
            <div key={i}>
              <p>{inline(lines.slice(0, firstListLine).join(" "))}</p>
              <List className={`mt-2 space-y-1.5 pl-5 ${ordered ? "list-decimal" : "list-disc"}`}>
                {items.map((l, j) => (
                  <li key={j}>{inline(l.replace(/^(-|\d+\.)\s/, ""))}</li>
                ))}
              </List>
            </div>
          );
        }
        return <p key={i}>{inline(block)}</p>;
      })}
    </div>
  );
}
