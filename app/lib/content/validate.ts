import type { Lesson, RootEntry } from './types';

// Hand-written validators (no schema library). Each returns human-readable errors, [] = valid.

const BINYANIM = ['paal', 'nifal', 'piel', 'pual', 'hifil', 'hufal', 'hitpael'];
const KINDS = ['past3ms', 'present_ms', 'future3ms', 'infinitive'];
const FREQS = ['speech', 'written', 'rare'];
const STATUSES = ['verified', 'ai-checked', 'unverified'];

type Obj = Record<string, unknown>;
const isObj = (x: unknown): x is Obj => typeof x === 'object' && x !== null && !Array.isArray(x);

function str(o: Obj, key: string, path: string, errs: string[], allowEmpty = false) {
  const v = o[key];
  if (typeof v !== 'string' || (!allowEmpty && v === '')) errs.push(`${path}.${key}: expected string`);
}

function oneOf(o: Obj, key: string, allowed: string[], path: string, errs: string[]) {
  if (typeof o[key] !== 'string' || !allowed.includes(o[key] as string))
    errs.push(`${path}.${key}: expected one of ${allowed.join('|')}`);
}

function obj(o: unknown, path: string, errs: string[]): Obj | null {
  if (isObj(o)) return o;
  errs.push(`${path}: expected object`);
  return null;
}

function arr(o: Obj, key: string, path: string, errs: string[]): unknown[] {
  const v = o[key];
  if (Array.isArray(v)) return v;
  errs.push(`${path}.${key}: expected array`);
  return [];
}

function verify(v: unknown, path: string, errs: string[]) {
  if (v === undefined) return void errs.push(`${path}: missing verify`);
  const o = obj(v, path, errs);
  if (!o) return;
  oneOf(o, 'status', STATUSES, path, errs);
  str(o, 'note', path, errs, true);
  if (!Array.isArray(o.sources)) return void errs.push(`${path}.sources: expected array`);
  o.sources.forEach((s, i) => {
    const so = obj(s, `${path}.sources[${i}]`, errs);
    if (so) {
      str(so, 'name', `${path}.sources[${i}]`, errs);
      str(so, 'url', `${path}.sources[${i}]`, errs);
    }
  });
}

function verifyAt(o: Obj, key: string, path: string, errs: string[]) {
  verify(o[key], `${path}.${key}`, errs);
}

function each<T>(list: unknown[], path: string, errs: string[], f: (o: Obj, p: string) => T) {
  list.forEach((x, i) => {
    const o = obj(x, `${path}[${i}]`, errs);
    if (o) f(o, `${path}[${i}]`);
  });
}

export function validateRoot(r: unknown): string[] {
  const errs: string[] = [];
  const o = obj(r, 'root', errs);
  if (!o) return errs;
  str(o, 'id', 'root', errs);
  if (!Array.isArray(o.letters) || o.letters.length !== 3 || o.letters.some((l) => typeof l !== 'string'))
    errs.push('root.letters: expected [string, string, string]');

  const bs = obj(o.binyanim, 'root.binyanim', errs);
  if (bs) {
    for (const b of BINYANIM) {
      const forms = bs[b];
      const p = `root.binyanim.${b}`;
      if (forms === null) continue;
      if (!Array.isArray(forms)) {
        errs.push(`${p}: expected array or null`);
        continue;
      }
      each(forms, p, errs, (f, fp) => {
        oneOf(f, 'kind', KINDS, fp, errs);
        str(f, 'he', fp, errs);
        str(f, 'meaning', fp, errs);
        oneOf(f, 'freq', FREQS, fp, errs);
        const ex = obj(f.example, `${fp}.example`, errs);
        if (ex) {
          str(ex, 'he', `${fp}.example`, errs);
          str(ex, 'en', `${fp}.example`, errs);
          verifyAt(ex, 'verify', `${fp}.example`, errs);
        }
        const vf = obj(f.verify, `${fp}.verify`, errs);
        if (vf) for (const k of ['form', 'meaning', 'freq']) verifyAt(vf, k, `${fp}.verify`, errs);
      });
    }
  }
  each(arr(o, 'traps', 'root', errs), 'root.traps', errs, (t, p) => {
    str(t, 'text', p, errs);
    verifyAt(t, 'verify', p, errs);
  });
  each(arr(o, 'family', 'root', errs), 'root.family', errs, (f, p) => {
    str(f, 'he', p, errs);
    str(f, 'meaning', p, errs);
    verifyAt(f, 'verify', p, errs);
  });
  return errs;
}

export function validateLesson(l: unknown, roots: Map<string, RootEntry>): string[] {
  const errs: string[] = [];
  const o = obj(l, 'lesson', errs);
  if (!o) return errs;
  for (const k of ['id', 'unit', 'title']) str(o, k, 'lesson', errs);
  if (typeof o.order !== 'number') errs.push('lesson.order: expected number');

  const ex = obj(o.explanation, 'lesson.explanation', errs);
  if (ex) {
    str(ex, 'text', 'lesson.explanation', errs);
    str(ex, 'template', 'lesson.explanation', errs);
    verifyAt(ex, 'verify', 'lesson.explanation', errs);
  }

  const checkRoot = (id: unknown, p: string) => {
    if (typeof id !== 'string' || !roots.has(id)) errs.push(`${p}: unknown rootId "${String(id)}"`);
  };

  each(arr(o, 'sentences', 'lesson', errs), 'sentences', errs, (s, p) => {
    str(s, 'en', p, errs);
    verifyAt(s, 'verify', p, errs);
    each(arr(s, 'tokens', p, errs), `${p}.tokens`, errs, (t, tp) => {
      str(t, 'he', tp, errs);
      if (t.rootId !== undefined) checkRoot(t.rootId, `${tp}.rootId`);
      if (t.binyan !== undefined) oneOf(t, 'binyan', BINYANIM, tp, errs);
      if (t.verify !== undefined || t.rootId !== undefined || t.binyan !== undefined) {
        const tv = obj(t.verify, `${tp}.verify`, errs);
        if (tv) for (const k of ['form', 'root', 'binyan']) verifyAt(tv, k, `${tp}.verify`, errs);
      }
    });
  });

  const pp = obj(o.patternPanel, 'lesson.patternPanel', errs);
  if (pp) {
    str(pp, 'spot', 'lesson.patternPanel', errs);
    str(pp, 'contrast', 'lesson.patternPanel', errs);
  }

  const g = obj(o.games, 'lesson.games', errs);
  if (g) {
    each(arr(g, 'rootHunt', 'lesson.games', errs), 'games.rootHunt', errs, (x, p) => {
      for (const k of ['he', 'gloss', 'pattern']) str(x, k, p, errs);
      checkRoot(x.rootId, `${p}.rootId`);
    });
    each(arr(g, 'buildWord', 'lesson.games', errs), 'games.buildWord', errs, (x, p) => {
      str(x, 'meaning', p, errs);
      checkRoot(x.rootId, `${p}.rootId`);
      const a = obj(x.answer, `${p}.answer`, errs);
      if (a) {
        oneOf(a, 'binyan', BINYANIM, `${p}.answer`, errs);
        oneOf(a, 'kind', KINDS, `${p}.answer`, errs);
      }
    });
    each(arr(g, 'spotBinyan', 'lesson.games', errs), 'games.spotBinyan', errs, (x, p) => {
      str(x, 'he', p, errs);
      oneOf(x, 'binyan', BINYANIM, p, errs);
    });
  }

  each(arr(o, 'endCheck', 'lesson', errs), 'endCheck', errs, (q, p) => {
    str(q, 'prompt', p, errs);
    if (!Array.isArray(q.choices) || q.choices.length < 2 || q.choices.some((c) => typeof c !== 'string'))
      errs.push(`${p}.choices: expected at least 2 strings`);
    else if (!Number.isInteger(q.answer) || (q.answer as number) < 0 || (q.answer as number) >= q.choices.length)
      errs.push(`${p}.answer: expected index into choices`);
  });

  if (o.topic !== undefined) {
    const t = obj(o.topic, 'lesson.topic', errs);
    if (t) str(t, 'note', 'lesson.topic', errs);
  }
  return errs;
}

/** lessonIds = lesson files that exist; each must be listed once in the course. Listed ids without a file are fine. */
export function validateCourse(c: unknown, lessonIds: Set<string>): string[] {
  const errs: string[] = [];
  const o = obj(c, 'course', errs);
  if (!o) return errs;
  const listed = new Set<string>();
  each(arr(o, 'units', 'course', errs), 'units', errs, (u, p) => {
    for (const k of ['id', 'title', 'heTitle']) str(u, k, p, errs);
    if (typeof u.available !== 'boolean') errs.push(`${p}.available: expected boolean`);
    for (const id of arr(u, 'lessons', p, errs)) {
      if (typeof id !== 'string') errs.push(`${p}.lessons: expected strings`);
      else if (listed.has(id)) errs.push(`${p}.lessons: "${id}" is listed twice`);
      else listed.add(id);
    }
  });
  for (const id of lessonIds) if (!listed.has(id)) errs.push(`lesson "${id}" exists but is not listed in the course`);
  return errs;
}

/**
 * A lesson may ship only when every token's form/root/binyan claim is `verified` (ai-checked is not enough).
 * Meaning-level items (explanations, translations, glosses) may stay unverified.
 */
export function releaseBarErrors(l: Lesson, roots: Map<string, RootEntry>): string[] {
  const errs: string[] = [];
  l.sentences.forEach((s, i) =>
    s.tokens.forEach((t, j) => {
      if (t.rootId === undefined && t.binyan === undefined && t.verify === undefined) return; // plain word
      for (const k of ['form', 'root', 'binyan'] as const) {
        if (t.verify?.[k]?.status !== 'verified')
          errs.push(`sentences[${i}].tokens[${j}].verify.${k} is not verified ("${t.he}")`);
      }
    }),
  );
  // ponytail: root forms are only checked for the roots this lesson's tokens use, form claim only
  const used = new Set(l.sentences.flatMap((s) => s.tokens.map((t) => t.rootId).filter(Boolean) as string[]));
  for (const id of used) {
    const r = roots.get(id);
    if (!r) continue;
    for (const [b, forms] of Object.entries(r.binyanim))
      forms?.forEach((f, i) => {
        if (f.verify.form.status !== 'verified')
          errs.push(`root ${id}.binyanim.${b}[${i}].verify.form is not verified ("${f.he}")`);
      });
  }
  return errs;
}
