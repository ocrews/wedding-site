import { describe, expect, it } from 'vitest';
import { FAKE_EMAIL_DOMAIN, FAKE_MARKER, fakeHouseholds } from './index.js';

describe('fakeHouseholds', () => {
  it('is deterministic for a given seed', () => {
    expect(fakeHouseholds(5, 1)).toEqual(fakeHouseholds(5, 1));
  });

  it('marks every guest as obviously fake', () => {
    for (const h of fakeHouseholds(20)) {
      expect(h.label).toContain(FAKE_MARKER);
      for (const g of h.guests) {
        expect(g.lastName).toContain(FAKE_MARKER);
        expect(g.email.endsWith(`@${FAKE_EMAIL_DOMAIN}`)).toBe(true);
      }
    }
  });
});
