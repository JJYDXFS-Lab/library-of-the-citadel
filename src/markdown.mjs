// A deliberately small Markdown reader for authored manuscripts.
//
// It is the same bargain src/schema-validate.mjs makes about JSON Schema: this
// module implements only the constructs the manuscripts under content/ actually
// use, and it *fails* on anything else rather than passing it through as plain
// text. A silently mis-read manuscript is the one failure mode that matters
// here — it would publish an author's text with a mark dropped, a heading
// demoted to a paragraph, or a link quietly pointing nowhere — so every line it
// cannot account for is a build error naming the line number.
//
// Supported, and nothing more:
//
//   # / ## / ###   headings
//   >              a block quotation
//   text           a paragraph; consecutive lines are one paragraph, and a line
//                  ending in two spaces keeps its break
//   **strong**     inline emphasis
//   [text](target) an inline link; the caller decides what a target resolves to
//
// It returns plain data and imports nothing. No template, no locale, no path
// helper — a manuscript is parsed the same way whoever is reading it.

/** @typedef {{type:'text',text:string}|{type:'strong',text:string}|{type:'link',text:string,target:string}} Span */

const LINK = /\[([^\]]*)\]\(([^)\s]+)\)/;

/**
 * Split one line into spans. Markers are consumed in source order, so a strong
 * run and a link cannot swallow each other, and an unterminated marker is an
 * error rather than a literal asterisk reaching the page.
 *
 * @returns {{spans: Span[], errors: string[]}}
 */
function inlineSpans(line, at) {
  const spans = [];
  const errors = [];
  let rest = line;

  const pushText = (text) => {
    if (text === '') return;
    if (text.includes('[')) errors.push(`${at}: "[" is not part of a complete [text](target) link`);
    if (text.includes('*')) errors.push(`${at}: a "*" survived inline parsing; only **strong** is supported`);
    spans.push({ type: 'text', text });
  };

  while (rest !== '') {
    const strongAt = rest.indexOf('**');
    const linkMatch = LINK.exec(rest);
    const linkAt = linkMatch ? linkMatch.index : -1;

    // Whichever marker opens first wins; neither opening means the rest is text.
    if (strongAt === -1 && linkAt === -1) {
      pushText(rest);
      break;
    }
    const takeStrong = strongAt !== -1 && (linkAt === -1 || strongAt < linkAt);

    if (takeStrong) {
      pushText(rest.slice(0, strongAt));
      const after = rest.slice(strongAt + 2);
      const close = after.indexOf('**');
      if (close === -1) {
        errors.push(`${at}: an opening "**" is never closed`);
        pushText(after);
        break;
      }
      const text = after.slice(0, close);
      if (text.trim() === '') errors.push(`${at}: an empty **strong** run`);
      spans.push({ type: 'strong', text });
      rest = after.slice(close + 2);
      continue;
    }

    pushText(rest.slice(0, linkAt));
    const [whole, text, target] = linkMatch;
    if (text.trim() === '') errors.push(`${at}: a link with no text`);
    spans.push({ type: 'link', text, target });
    rest = rest.slice(linkAt + whole.length);
  }

  return { spans, errors };
}

/**
 * Parse a manuscript into an ordered list of blocks.
 *
 * @param {string} text  the manuscript, verbatim
 * @param {string} label used in error messages; a file name, not a path
 * @returns {{blocks: object[], errors: string[]}}
 *   A block is one of:
 *     {type:'heading', level, spans}
 *     {type:'paragraph', lines: {spans, hard_break}[]}
 *     {type:'quote',     lines: {spans, hard_break}[]}
 *   Errors are collected rather than thrown, so one run reports the whole file.
 */
export function parseMarkdown(text, label = 'manuscript') {
  const blocks = [];
  const errors = [];
  const lines = String(text).split('\n');

  // An open paragraph or quotation, accumulating its lines until a blank line,
  // a heading, or a change of kind closes it.
  let open = null;
  const closeOpen = () => {
    if (open) blocks.push(open);
    open = null;
  };

  lines.forEach((rawLine, i) => {
    const at = `${label}:${i + 1}`;

    if (rawLine.trim() === '') {
      if (rawLine !== '') errors.push(`${at}: a blank line carrying whitespace; it should be empty`);
      closeOpen();
      return;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(rawLine);
    if (heading) {
      closeOpen();
      const level = heading[1].length;
      if (level > 3) {
        errors.push(`${at}: heading level ${level} is deeper than this reader renders`);
        return;
      }
      const { spans, errors: inlineErrors } = inlineSpans(heading[2].trimEnd(), at);
      errors.push(...inlineErrors);
      blocks.push({ type: 'heading', level, spans });
      return;
    }

    if (rawLine.startsWith('#')) {
      errors.push(`${at}: "#" with no space after it is not a heading this reader accepts`);
      return;
    }

    const quote = /^>\s?(.*)$/.exec(rawLine);
    const kind = quote ? 'quote' : 'paragraph';
    const body = quote ? quote[1] : rawLine;

    if (open && open.type !== kind) closeOpen();
    if (!open) open = { type: kind, lines: [] };

    // Every line of a block is rendered on its own line, so a line that joins
    // another one must have said so with Markdown's two-space hard break. A
    // soft wrap would render as a break the author did not write, which is the
    // quiet kind of change this reader exists to refuse.
    const previous = open.lines[open.lines.length - 1];
    if (previous && !previous.hard_break) {
      errors.push(`${at}: continues the previous line, which has no two-space hard break; this reader does not re-wrap an author's lines`);
    }

    const { spans, errors: inlineErrors } = inlineSpans(body.trimEnd(), at);
    errors.push(...inlineErrors);
    open.lines.push({ spans, hard_break: /\s\s$/.test(body) });
  });

  closeOpen();
  return { blocks, errors };
}

/**
 * The visible text of one span list, with every marker gone. Used by the gates
 * and the tests to compare what a page renders against what the manuscript
 * says, without either side having to know about markup.
 */
export const spansText = (spans) => spans.map((s) => s.text).join('');

/** The visible text of a whole manuscript, one line per entry, in order. */
export function documentText(blocks) {
  const out = [];
  for (const b of blocks) {
    if (b.type === 'heading') out.push(spansText(b.spans));
    else for (const line of b.lines) out.push(spansText(line.spans));
  }
  return out;
}

/** Headings only, in order — the spine the structure gate checks. */
export const headings = (blocks) => blocks
  .filter((b) => b.type === 'heading')
  .map((b) => ({ level: b.level, text: spansText(b.spans) }));
