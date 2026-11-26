// Types only: also imported by scripts/verify via node --experimental-strip-types.

export type Verify = {
  status: 'verified' | 'ai-checked' | 'unverified';
  sources: { name: string; url: string }[];
  note: string;
};

export type Binyan = 'paal' | 'nifal' | 'piel' | 'pual' | 'hifil' | 'hufal' | 'hitpael';
export type FormKind = 'past3ms' | 'present_ms' | 'future3ms' | 'infinitive';

export type RootForm = {
  kind: FormKind;
  he: string;
  meaning: string;
  freq: 'speech' | 'written' | 'rare';
  example: { he: string; en: string; verify: Verify };
  warning?: string;
  verify: { form: Verify; meaning: Verify; freq: Verify };
};

export type RootEntry = {
  id: string; // ascii transliteration, e.g. "spr"
  letters: [string, string, string];
  binyanim: Record<Binyan, RootForm[] | null>;
  traps: { text: string; verify: Verify }[];
  family: { he: string; meaning: string; pattern?: string; verify: Verify }[];
};

export type Token = {
  he: string;
  rootId?: string;
  binyan?: Binyan;
  formLabel?: string;
  meaning?: string;
  verify?: { form: Verify; root: Verify; binyan: Verify };
};

export type Question = { prompt: string; he?: string; choices: string[]; answer: number };

export type Lesson = {
  id: string;
  unit: string;
  order: number;
  title: string;
  explanation: { text: string; template: string; verify: Verify };
  sentences: { tokens: Token[]; en: string; verify: Verify }[];
  patternPanel: { spot: string; contrast: string };
  games: {
    rootHunt: { he: string; gloss: string; rootId: string; pattern: string }[];
    buildWord: { rootId: string; meaning: string; answer: { binyan: Binyan; kind: FormKind } }[];
    spotBinyan: { he: string; sentence?: string; binyan: Binyan }[];
  };
  endCheck: Question[];
  topic?: { note: string; url?: string };
};

export type Course = {
  units: { id: string; title: string; heTitle: string; available: boolean; lessons: string[] }[];
};
