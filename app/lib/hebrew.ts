// Hebrew text helpers. No imports: also run by scripts/verify via node --experimental-strip-types.

const MARK = /[֑-ׇ]/;
const MARKS = /[֑-ׇ]/g;

const FINALS: Record<string, string> = { ך: 'כ', ם: 'מ', ן: 'נ', ף: 'פ', ץ: 'צ' };

/** Remove all niqqud, cantillation and shin/sin dots (U+0591–U+05C7). */
export function stripNiqqud(s: string): string {
  return s.replace(MARKS, '');
}

/** NFC; it also puts Hebrew marks in canonical order. Use for every equality check. */
export function normalizeHebrew(s: string): string {
  return s.normalize('NFC');
}

/** Final letter form to its regular form. */
export function normalizeFinal(ch: string): string {
  return FINALS[ch] ?? ch;
}

/** Base letter plus its following marks. */
export function graphemes(word: string): string[] {
  const out: string[] = [];
  for (const ch of normalizeHebrew(word)) {
    if (MARK.test(ch) && out.length) out[out.length - 1] += ch;
    else out.push(ch);
  }
  return out;
}

/**
 * Split a word into graphemes tagged with which root letter they are (1-3), or 0.
 * ponytail: greedy left-to-right match, so a prefix letter equal to the first root
 * letter is taken as the root (same behaviour as the mockup's colorRoot).
 */
export function rootSegments(
  word: string,
  root: string,
): { text: string; rootIndex: 0 | 1 | 2 | 3 }[] {
  const letters = [...stripNiqqud(root)].map(normalizeFinal);
  let i = 0;
  return graphemes(word).map((text) => {
    const base = normalizeFinal(stripNiqqud(text));
    if (i < letters.length && i < 3 && base === letters[i]) {
      i++;
      return { text, rootIndex: i as 1 | 2 | 3 };
    }
    return { text, rootIndex: 0 };
  });
}
