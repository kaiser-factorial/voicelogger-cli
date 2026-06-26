/**
 * Render a readable subset of Markdown for the terminal with light ANSI styling.
 * No dependency — covers what the cleaned voice-log template produces: headings,
 * a summary blockquote, metadata bullets, the `---` divider, and **bold**.
 *
 * Color auto-disables for non-TTY output (pipes) or when NO_COLOR is set, in which
 * case markers are stripped to clean plain text. Pass { color: false } to force it.
 */
export interface RenderOptions {
  color?: boolean;
}

const ESC = "\x1b[";

function styler(color: boolean) {
  const wrap = (open: string, close: string) => (s: string) =>
    color ? `${ESC}${open}m${s}${ESC}${close}m` : s;
  return {
    bold: wrap("1", "22"),
    dim: wrap("2", "22"),
    italic: wrap("3", "23"),
    underline: wrap("4", "24"),
  };
}

export function renderMarkdown(md: string, opts: RenderOptions = {}): string {
  const color = opts.color ?? (Boolean(process.stdout.isTTY) && !process.env.NO_COLOR);
  const { bold, dim, italic, underline } = styler(color);

  const inline = (s: string): string => s.replace(/\*\*(.+?)\*\*/g, (_, t) => bold(t));

  const out: string[] = [];
  for (const raw of md.split("\n")) {
    const line = raw.replace(/\s+$/, "");
    const heading = line.match(/^(#{1,6})\s+(.*)$/);

    if (heading) {
      const text = inline(heading[2]);
      out.push(heading[1].length <= 1 ? bold(underline(text)) : bold(text));
    } else if (/^\s*>\s?/.test(line)) {
      out.push(dim(italic(`│ ${inline(line.replace(/^\s*>\s?/, ""))}`)));
    } else if (/^\s*-{3,}\s*$/.test(line)) {
      out.push(dim("─".repeat(48)));
    } else if (/^\s*[-*]\s+/.test(line)) {
      out.push(`  • ${inline(line.replace(/^\s*[-*]\s+/, ""))}`);
    } else {
      out.push(inline(line));
    }
  }
  return out.join("\n");
}
