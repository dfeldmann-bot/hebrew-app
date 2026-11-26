import { describe, expect, it } from 'vitest';
import { graphemes, normalizeFinal, normalizeHebrew, rootSegments, stripNiqqud } from './hebrew';

const idx = (w: string, r: string) => rootSegments(w, r).map((s) => s.rootIndex);

describe('hebrew utils', () => {
  it('normalizeHebrew equates different mark orders', () => {
    const a = 'שָׁלום'; // shin, shin-dot, qamats
    const b = 'שָׁלום'; // shin, qamats, shin-dot
    expect(a).not.toBe(b);
    expect(normalizeHebrew(a)).toBe(normalizeHebrew(b));
  });

  it('stripNiqqud removes marks', () => {
    expect(stripNiqqud('הִתְלַבֵּשׁ')).toBe('התלבש');
  });

  it('normalizeFinal maps final letters', () => {
    expect([...'ךםןףץא'].map(normalizeFinal).join('')).toBe('כמנפצא');
  });

  it('graphemes keeps marks with their letter', () => {
    expect(graphemes('שָׁ').length).toBe(1);
    expect(graphemes('שָׁלוֹם').length).toBe(4);
  });

  it('rootSegments handles a final-letter root', () => {
    const segs = rootSegments('תַּשְׁלוּם', 'שלמ');
    expect(segs.map((s) => s.text).join('')).toBe(normalizeHebrew('תַּשְׁלוּם'));
    expect(idx('תַּשְׁלוּם', 'שלמ')).toEqual([0, 1, 2, 0, 3]);
  });

  it('rootSegments does not mark the hitpael ת', () => {
    expect(idx('הִסְתַּפֵּר', 'ספר')).toEqual([0, 1, 0, 2, 3]);
  });
});
