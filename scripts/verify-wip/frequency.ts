import { readFileSync } from 'node:fs';
import type { Verify } from '../../app/lib/content/types.ts';
import { normalizeHebrew, stripNiqqud } from '../../app/lib/hebrew.ts';

export const SPEECH_URL = 'https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/he/he_50k.txt';
export const WRITTEN_URL = 'https://raw.githubusercontent.com/eyaler/hebrew_wordlists/master/cc100.csv';

const wordKey = (w: string) => normalizeHebrew(stripNiqqud(normalizeHebrew(w)));

/** "word<sep>count" lines, most frequent first -> word -> 1-based rank (first occurrence wins). */
export function parseRanks(text: string, sep: RegExp): Map<string, number> {
  const ranks = new Map<string, number>();
  for (const line of text.split('\n')) {
    const w = line.split(sep)[0]?.trim();
    if (!w) continue;
    const k = wordKey(w);
    if (!ranks.has(k)) ranks.set(k, ranks.size + 1);
  }
  return ranks;
}

export const loadRanks = (path: string, sep: RegExp) => parseRanks(readFileSync(path, 'utf8'), sep);

/**
 * Both maps are word -> rank (1 = most frequent), keyed by the unvowelled word.
 * Bands: speech if rank <= 5000 in the subtitle list; else written if rank <= 10000 in the written list; else rare.
 * ponytail: with no written list loaded (empty map) the speech list alone decides: <= 5000 speech, <= 20000 written.
 */
export function frequencyBand(
  word: string,
  speech: Map<string, number>,
  written: Map<string, number>,
): { band: 'speech' | 'written' | 'rare'; verify: Verify } {
  const k = wordKey(word);
  const s = speech.get(k);
  const w = written.get(k);
  const noWritten = written.size === 0;
  let band: 'speech' | 'written' | 'rare' = 'rare';
  if (s !== undefined && s <= 5000) band = 'speech';
  else if (noWritten ? s !== undefined && s <= 20000 : w !== undefined && w <= 10000) band = 'written';
  const sources = [{ name: 'FrequencyWords he_50k (OpenSubtitles 2018)', url: SPEECH_URL }];
  if (!noWritten) sources.push({ name: 'eyaler/hebrew_wordlists cc100.csv (CC-100 web text)', url: WRITTEN_URL });
  const ranks = `speech rank ${s ?? 'none'}` + (noWritten ? '' : `, written rank ${w ?? 'none'}`);
  return {
    band,
    verify: {
      status: 'verified',
      sources,
      note: `Band ${band}: ${ranks}. Lists are unvowelled, so counts pool every vocalization of "${k}".`,
    },
  };
}
