import en from './en.json';

/**
 * The single locale bundle.  Every user-facing string lives in `en.json`; import
 * this (rather than the JSON directly) so components share one typed shape.
 */
export const strings = en;

export type Strings = typeof en;

/**
 * Fill `{{name}}` placeholders in a locale string, so a sentence with numbers in
 * it stays in `en.json` instead of being assembled in a component:
 *
 * ```ts
 * format(strings.rubix.message.solved, { count: 18 })
 * ```
 *
 * An unknown placeholder is left as written, which makes the mistake visible.
 */
export function format(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}
