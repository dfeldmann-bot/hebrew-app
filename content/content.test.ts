import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { RootEntry } from '../app/lib/content/types';
import { validateCourse, validateLesson, validateRoot } from '../app/lib/content/validate';

const dir = __dirname;
const readJson = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
const jsonFiles = (sub: string) => {
  const d = join(dir, sub);
  return existsSync(d) ? readdirSync(d).filter((f) => f.endsWith('.json')).sort() : [];
};

const rootFiles = jsonFiles('roots');
const lessonFiles = jsonFiles('lessons');
const roots = new Map<string, RootEntry>();
for (const f of rootFiles) {
  const r = readJson(join(dir, 'roots', f));
  roots.set(r.id, r);
}

describe('content/', () => {
  it('course.json is valid and lists every existing lesson', () => {
    const ids = new Set(lessonFiles.map((f) => f.replace(/\.json$/, '')));
    expect(validateCourse(readJson(join(dir, 'course.json')), ids)).toEqual([]);
  });

  for (const f of rootFiles)
    it(`roots/${f} is valid`, () => {
      const r = readJson(join(dir, 'roots', f));
      expect(validateRoot(r)).toEqual([]);
      expect(r.id + '.json').toBe(f);
    });

  for (const f of lessonFiles)
    it(`lessons/${f} is valid`, () => {
      const l = readJson(join(dir, 'lessons', f));
      expect(validateLesson(l, roots)).toEqual([]);
      expect(l.id + '.json').toBe(f);
    });
});

