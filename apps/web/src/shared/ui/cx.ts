/** Join class names, dropping falsy parts. The project's tiny classnames helper. */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
