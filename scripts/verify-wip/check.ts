import type { Binyan, Verify } from '../../app/lib/content/types.ts';
import { normalizeHebrew, stripNiqqud } from '../../app/lib/hebrew.ts';
import { rootKey, type KaikkiEntry, type KaikkiIndex } from './kaikki.ts';

type Expect = { rootLetters?: string[]; binyan?: Binyan };
type Result = { form: Verify; root?: Verify; binyan?: Verify };

const WIKT = 'en.wiktionary.org';
const ok = (e: KaikkiEntry, note: string): Verify => ({
  status: 'verified',
  sources: [{ name: WIKT, url: e.url }],
  note,
});
const no = (note: string): Verify => ({ status: 'unverified', sources: [], note });

type Part = 'ok' | 'conflict' | 'missing' | 'n/a';
function rootPart(e: KaikkiEntry, exp: Expect): Part {
  if (!exp.rootLetters) return 'n/a';
  if (!e.root) return 'missing';
  return rootKey(e.root) === rootKey(exp.rootLetters) ? 'ok' : 'conflict';
}
function binyanPart(e: KaikkiEntry, exp: Expect): Part {
  if (!exp.binyan) return 'n/a';
  if (!e.binyan) return 'missing';
  return e.binyan === exp.binyan ? 'ok' : 'conflict';
}
const score = (e: KaikkiEntry, exp: Expect) => {
  const p = [rootPart(e, exp), binyanPart(e, exp)];
  return p.includes('conflict') ? 0 : p.every((x) => x === 'ok' || x === 'n/a') ? 2 : 1;
};

/**
 * `he` is verified when a kaikki (Wiktionary) entry lists exactly this form (NFC-normalized).
 * Root/binyan are verified when that same entry's data matches. A form found only under a different
 * root or binyan is unverified with a "CONFLICT:" note.
 */
export function checkForm(idx: KaikkiIndex, he: string, expect: Expect): Result {
  const form = normalizeHebrew(he);
  const exact = idx.lookup(stripNiqqud(form)).filter((e) => e.forms.includes(form));
  const out = (form: Verify, root?: Verify, binyan?: Verify): Result => ({
    form,
    ...(expect.rootLetters ? { root } : {}),
    ...(expect.binyan ? { binyan } : {}),
  });
  if (exact.length === 0) {
    const why = `${form} not found as an exact form in the Wiktionary dump`;
    return out(no(why), no(why), no(why));
  }
  const best = exact.reduce((a, b) => (score(b, expect) > score(a, expect) ? b : a));
  const rp = rootPart(best, expect);
  const bp = binyanPart(best, expect);
  const described = `${best.root ? best.root.join('־') : 'unknown root'}, ${best.binyan ?? 'unknown binyan'}`;
  if (rp === 'conflict' || bp === 'conflict') {
    const wanted = `${expect.rootLetters?.join('־') ?? '?'}, ${expect.binyan ?? '?'}`;
    const note = `CONFLICT: ${form} is listed under ${best.word} (${described}), expected ${wanted}`;
    return out(no(note), rp === 'conflict' ? no(note) : undefined, bp === 'conflict' ? no(note) : undefined);
  }
  const part = (p: Part, what: string): Verify | undefined =>
    p === 'ok'
      ? ok(best, `${what} matches the Wiktionary entry ${best.word} (${described}).`)
      : p === 'missing'
        ? no(`Wiktionary entry ${best.word} has no ${what} data to compare.`)
        : undefined;
  return out(ok(best, `${form} listed in the Wiktionary entry ${best.word} (${described}).`), part(rp, 'root'), part(bp, 'binyan'));
}

const rank = (v: Verify) => (v.status === 'verified' ? 2 : v.status === 'ai-checked' ? 1 : 0);

/**
 * Combine what is stored with what the CLI just computed, never downgrading.
 * A `verified` status that has sources (e.g. set by the checker agent) is always kept; a CONFLICT is
 * allowed to replace anything weaker.
 */
export function mergeVerify(existing: Verify | undefined, computed: Verify | undefined): Verify | undefined {
  if (!computed) return existing;
  if (!existing) return computed;
  if (existing.status === 'verified' && existing.sources.length > 0) return existing;
  if (computed.note.startsWith('CONFLICT:')) return computed;
  return rank(computed) >= rank(existing) ? computed : existing;
}
