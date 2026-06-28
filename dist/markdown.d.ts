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
export declare function renderMarkdown(md: string, opts?: RenderOptions): string;
