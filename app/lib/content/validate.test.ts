import { describe, expect, it } from 'vitest';
import type { Lesson, RootEntry, Verify } from './types';
import { releaseBarErrors, validateCourse, validateLesson, validateRoot } from './validate';

const v = (status: Verify['status'] = 'verified'): Verify => ({ status, sources: [], note: '' });
const BINYANIM = ['paal', 'nifal', 'piel', 'pual', 'hifil', 'hufal', 'hitpael'] as const;

const root = (): RootEntry => ({
  id: 'spr',
  letters: ['ס', 'פ', 'ר'],
  binyanim: Object.fromEntries(
    BINYANIM.map((b) => [
      b,
      b === 'piel'
        ? [
            {
              kind: 'past3ms',
              he: 'סִפֵּר',
              meaning: 'told',
              freq: 'speech',
              example: { he: 'הוא סִפֵּר', en: 'He told', verify: v() },
              verify: { form: v(), meaning: v(), freq: v() },
            },
          ]
        : null,
    ]),
  ) as RootEntry['binyanim'],
  traps: [{ text: 't', verify: v() }],
  family: [{ he: 'סֵפֶר', meaning: 'book', verify: v() }],
});

const lesson = (): Lesson => ({
  id: 'piel-1',
  unit: 'piel',
  order: 1,
  title: 'Pi\'el present',
  explanation: { text: 'x', template: 'y', verify: v() },
  sentences: [
    {
      tokens: [
        { he: 'הוא' },
        {
          he: 'מְסַפֵּר',
          rootId: 'spr',
          binyan: 'piel',
          verify: { form: v(), root: v(), binyan: v() },
        },
      ],
      en: 'He tells',
      verify: v(),
    },
  ],
  patternPanel: { spot: 'a', contrast: 'b' },
  games: {
    rootHunt: [{ he: 'מְסַפֵּר', gloss: 'tells', rootId: 'spr', pattern: 'מְ□ַ□ֵּ□' }],
    buildWord: [{ rootId: 'spr', meaning: 'told', answer: { binyan: 'piel', kind: 'past3ms' } }],
    spotBinyan: [{ he: 'סִפֵּר', binyan: 'piel' }],
  },
  endCheck: [{ prompt: 'q', choices: ['a', 'b'], answer: 1 }],
});

const roots = () => new Map([['spr', root()]]);

describe('validateRoot', () => {
  it('accepts a valid root', () => expect(validateRoot(root())).toEqual([]));
  it('names the path of a missing verify', () => {
    const r = root();
    delete (r.traps[0] as Partial<(typeof r.traps)[0]>).verify;
    expect(validateRoot(r).join('\n')).toContain('traps[0].verify');
  });
  it('rejects non-objects', () => expect(validateRoot(null)).not.toEqual([]));
});

describe('validateLesson', () => {
  it('accepts a valid lesson', () => expect(validateLesson(lesson(), roots())).toEqual([]));
  it('names the path of a missing verify', () => {
    const l = lesson();
    delete (l.sentences[0] as Partial<(typeof l.sentences)[0]>).verify;
    expect(validateLesson(l, roots()).join('\n')).toContain('sentences[0].verify');
  });
  it('flags a token rootId not in roots', () => {
    const l = lesson();
    l.sentences[0].tokens[1].rootId = 'zzz';
    expect(validateLesson(l, roots()).join('\n')).toContain('zzz');
  });
  it('flags an out-of-range answer', () => {
    const l = lesson();
    l.endCheck[0].answer = 5;
    expect(validateLesson(l, roots()).join('\n')).toContain('endCheck[0].answer');
  });
});

describe('releaseBarErrors', () => {
  it('passes when only meaning-level items are unverified', () => {
    const l = lesson();
    l.sentences[0].verify = v('unverified');
    l.explanation.verify = v('unverified');
    expect(releaseBarErrors(l, roots())).toEqual([]);
  });
  it('flags an unverified token form', () => {
    const l = lesson();
    l.sentences[0].tokens[1].verify!.form = v('unverified');
    expect(releaseBarErrors(l, roots()).join('\n')).toContain('sentences[0].tokens[1]');
  });
});

describe('validateCourse', () => {
  const course = {
    units: [
      { id: 'u', title: 'U', heTitle: 'י', available: true, lessons: ['a-1'] },
      { id: 'w', title: 'W', heTitle: 'ו', available: false, lessons: [] },
    ],
  };
  it('accepts a valid course', () => expect(validateCourse(course, new Set(['a-1']))).toEqual([]));
  it('accepts listed lessons that have no file yet', () => {
    expect(validateCourse(course, new Set())).toEqual([]);
  });
  it('flags an existing lesson the course does not list', () => {
    expect(validateCourse(course, new Set(['a-1', 'b-9'])).join('\n')).toContain('b-9');
  });
  it('flags a lesson listed twice', () => {
    const dup = { units: [{ ...course.units[0], lessons: ['a-1', 'a-1'] }] };
    expect(validateCourse(dup, new Set()).join('\n')).toContain('a-1');
  });
  it('flags a malformed unit', () => {
    expect(validateCourse({ units: [{ id: 'u' }] }, new Set()).join('\n')).toContain('units[0].title');
  });
});
