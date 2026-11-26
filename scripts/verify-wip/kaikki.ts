import { readFileSync } from 'node:fs';
import type { Binyan } from '../../app/lib/content/types.ts';
import { normalizeFinal, normalizeHebrew, stripNiqqud } from '../../app/lib/hebrew.ts';

export type KaikkiEntry = {
  word: string;
  pos: string;
  url: string; // en.wiktionary page of this entry
  forms: string[]; // niqqud forms (head word + inflection table), NFC
  root?: string[]; // unvowelled letters, e.g. ['ל','מ','ד']
  binyan?: Binyan;
};

export type KaikkiIndex = { lookup(unvowelled: string): KaikkiEntry[] };

// he-verb template arg "1" -> Binyan (the only codes seen in the dump besides a few typos)
const BINYAN: Record<string, Binyan> = {
  pa: 'paal', nif: 'nifal', pi: 'piel', pu: 'pual', hif: 'hifil', huf: 'hufal', hit: 'hitpael',
};

// Tags on `forms` rows that are not real Hebrew word forms.
// ponytail: 'error-unrecognized-form' is NOT skipped on purpose: kaikki uses it for real table cells it could not tag (e.g. infinitives).
const SKIP_TAGS = new Set(['romanization', 'table-tags', 'inflection-template', 'noun-from-verb']);

export const key = (s: string) => normalizeHebrew(stripNiqqud(normalizeHebrew(s)));
export const rootKey = (letters: string[]) => letters.map((l) => normalizeFinal(stripNiqqud(l))).join('');

// Root strings look like "ל־מ־ד" (maqaf U+05BE, which stripNiqqud would remove, so split first).
function parseRoot(s: unknown): string[] | undefined {
  if (typeof s !== 'string') return undefined;
  const letters = s.split(/[־\-\s]+/).map(stripNiqqud).filter(Boolean);
  return letters.length >= 2 && letters.every((l) => /^[א-ת]$/.test(l)) ? letters : undefined;
}

type Raw = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

function toEntry(d: Raw): KaikkiEntry | null {
  if (typeof d.word !== 'string') return null;
  const forms = new Set<string>([normalizeHebrew(d.word)]);
  for (const f of (d.forms ?? []) as Raw[]) {
    if (typeof f.form !== 'string' || !/[א-ת]/.test(f.form)) continue;
    if ((f.tags ?? []).some((t: string) => SKIP_TAGS.has(t))) continue;
    forms.add(normalizeHebrew(f.form));
  }
  const entry: KaikkiEntry = {
    word: d.word,
    pos: d.pos,
    url: 'https://en.wiktionary.org/wiki/' + encodeURIComponent(d.word),
    forms: [...forms],
  };
  const verbT = (d.head_templates ?? []).find((h: Raw) => h.name === 'he-verb');
  const conj = (d.inflection_templates ?? []).find((h: Raw) => h.name === 'he-conj');
  entry.binyan = BINYAN[verbT?.args?.['1'] ?? conj?.args?.['1']];
  // Root, most to least reliable: {{he-rootbox}} in the etymology, the "belonging to the root" category, he-conj's root argument.
  const box = (d.etymology_templates ?? []).find((t: Raw) => t.name === 'he-rootbox');
  let root = parseRoot(box?.args?.['1']);
  if (!root)
    for (const s of d.senses ?? [])
      for (const c of s.categories ?? []) {
        const m = /^Hebrew terms belonging to the root (.+)$/.exec(c.name ?? '');
        if (!root && m) root = parseRoot(m[1]);
      }
  if (!root) {
    const r = parseRoot(conj?.args?.['2']); // ponytail: sound verbs only; arg 2 is the root as Wiktionary's conjugation module sees it
    if (r && r.length === 3) root = r;
  }
  if (root) entry.root = root;
  if (!entry.binyan) delete entry.binyan;
  return entry;
}

export function loadKaikki(path: string): KaikkiIndex {
  const map = new Map<string, KaikkiEntry[]>();
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    const e = toEntry(JSON.parse(line));
    if (!e) continue;
    for (const k of new Set(e.forms.map(key))) {
      const list = map.get(k);
      if (list) list.push(e);
      else map.set(k, [e]);
    }
  }
  return { lookup: (u) => map.get(key(u)) ?? [] };
}
