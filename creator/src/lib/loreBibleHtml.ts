import { exportLoreBible, type LoreBibleOptions } from "./exportLoreBible";
import type { WorldLore } from "@/types/lore";

/**
 * Convert the lore bible Markdown to a self-contained HTML document
 * styled for printing / Save as PDF.
 */
export function loreBibleToHtml(lore: WorldLore, options: LoreBibleOptions): string {
  const md = exportLoreBible(lore, options);

  // Simple Markdown → HTML conversion (handles the subset we generate)
  const html = md
    // Headings
    .replace(/^#### (.+)$/gm, "<h4>$1</h4>")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    // Horizontal rules
    .replace(/^---$/gm, "<hr/>")
    // Bold and italic
    .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    // Unordered lists (simple single-level)
    .replace(/^- \[(.+?)\]\(#.+?\)$/gm, "<li>$1</li>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    // Paragraphs (double newline → paragraph break)
    .replace(/\n\n+/g, "</p><p>")
    // Single newlines within a paragraph → <br>
    .replace(/(?<!>)\n(?!<)/g, "<br/>");

  // Wrap list items in <ul>
  const withLists = html.replace(
    /(<li>.*?<\/li>(?:\s*<\/p><p>\s*<li>.*?<\/li>)*)/gs,
    "<ul>$1</ul>",
  );

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>Lore Bible</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Crimson+Pro:ital,wght@0,400;0,600;0,700;1,400&display=swap');

  @page {
    size: A4;
    margin: 2.5cm 2cm;
  }

  body {
    font-family: 'Crimson Pro', Georgia, serif;
    font-size: 12pt;
    line-height: 1.65;
    color: #1a1a2e;
    max-width: 100%;
  }

  h1 {
    font-family: 'Cinzel', Palatino, serif;
    font-size: 28pt;
    font-weight: 700;
    margin: 0 0 0.3em;
    color: #2a3149;
    letter-spacing: 0.08em;
    text-align: center;
    page-break-after: avoid;
  }

  h2 {
    font-family: 'Cinzel', Palatino, serif;
    font-size: 18pt;
    font-weight: 600;
    margin: 2em 0 0.5em;
    color: #2a3149;
    letter-spacing: 0.04em;
    border-bottom: 1px solid #c0c0d0;
    padding-bottom: 0.3em;
    page-break-after: avoid;
  }

  h3 {
    font-family: 'Cinzel', Palatino, serif;
    font-size: 14pt;
    font-weight: 600;
    margin: 1.5em 0 0.4em;
    color: #3a4668;
    page-break-after: avoid;
  }

  h4 {
    font-family: 'Crimson Pro', Georgia, serif;
    font-size: 12pt;
    font-weight: 700;
    margin: 1em 0 0.3em;
    color: #56617d;
  }

  p { margin: 0.6em 0; }

  em { font-style: italic; }
  strong { font-weight: 700; }

  hr {
    border: none;
    border-top: 1px solid #ddd;
    margin: 2em 0;
  }

  ul {
    padding-left: 1.5em;
    margin: 0.5em 0;
  }

  li {
    margin: 0.2em 0;
  }

  @media print {
    body { color: #000; }
    h2 { page-break-before: always; }
    h2:first-of-type { page-break-before: avoid; }
  }
</style>
</head>
<body>
<p>${withLists}</p>
</body>
</html>`;
}
