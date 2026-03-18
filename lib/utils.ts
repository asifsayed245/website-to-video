/** Split text into non-empty words */
export function splitWords(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

/** Count words in a string */
export function wordCount(text: string): number {
  return splitWords(text).length;
}

/** Promise-based delay */
export const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Extract error message from unknown thrown value */
export function getErrorMessage(err: unknown, fallback = 'Unknown error'): string {
  return err instanceof Error ? err.message : fallback;
}
