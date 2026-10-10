import { describe, expect, it } from 'vitest';
import { isSkipped, parseDenylist, scanText } from './scan.js';

const rules = (text: string, deny?: string) =>
  scanText('f.ts', text, parseDenylist(deny)).map((f) => f.rule);

describe('email', () => {
  it('flags real-looking emails', () => {
    expect(rules('contact jane.doe@gmail.com')).toEqual(['email']);
  });
  it('allows reserved and bot domains', () => {
    expect(rules('guest-1@example.test a@example.com x@users.noreply.github.com')).toEqual([]);
    expect(rules('Co-Authored-By: Claude <noreply@anthropic.com>')).toEqual([]);
  });
  it('allows git SSH remotes', () => {
    expect(rules('git clone git@github.com:org/repo.git')).toEqual([]);
  });
  it('redacts the excerpt', () => {
    const [f] = scanText('f', 'jane.doe@gmail.com');
    expect(f?.excerpt).not.toContain('jane.doe');
  });
});

describe('phone', () => {
  it('flags NANP numbers in common formats', () => {
    for (const p of ['(816) 867-5309', '816-867-5309', '816.867.5309', '+1 816 867 5309']) {
      expect(rules(`call ${p}`)).toEqual(['phone']);
    }
  });
  it('allows 555-01xx fiction numbers', () => {
    expect(rules('call 816-555-0142')).toEqual([]);
  });
  it('ignores versions, dates, and ports', () => {
    expect(rules('next@16.4.0 2027-05-22 localhost:3000 sha 1234567')).toEqual([]);
  });
});

describe('street address', () => {
  it('flags street addresses', () => {
    expect(rules('meet at 1428 Elm Street')).toEqual(['street-address']);
    expect(rules('42 N Maple Ave.')).toEqual(['street-address']);
  });
  it('ignores ordinary prose', () => {
    expect(rules('we have 200 guests and 4 GB of RAM')).toEqual([]);
  });
});

describe('household code', () => {
  it('flags code-shaped strings', () => {
    expect(rules('code: FERN-9X2M')).toEqual(['household-code']);
  });
  it('allows the documented example and plain words', () => {
    expect(rules('e.g. MOSS-7K4Q, or MOSS-TENT')).toEqual([]);
  });
});

describe('denylist', () => {
  it('matches case-insensitively on word boundaries', () => {
    expect(rules('Thanks to the Zebulon family', 'zebulon')).toEqual(['denylist']);
    expect(rules('zebulonish', 'zebulon')).toEqual([]);
  });
  it('parses newline/comma lists with comments and ignores short terms', () => {
    expect(parseDenylist('alpha, beta\n# comment\ngamma # trailing\nab')).toHaveLength(3);
  });
  it('does not include the matched text in the finding', () => {
    const [f] = scanText('f', 'Zebulon', parseDenylist('zebulon'));
    expect(f).toEqual({ file: 'f', line: 1, rule: 'denylist' });
  });
});

describe('allow marker', () => {
  it('skips lines with pii-guard:allow', () => {
    expect(rules('jane@gmail.com // pii-guard:allow')).toEqual([]);
  });
});

describe('isSkipped', () => {
  it('skips lockfile, binaries, and own fixtures', () => {
    expect(isSkipped('pnpm-lock.yaml')).toBe(true);
    expect(isSkipped('public/a.png')).toBe(true);
    expect(isSkipped('tools/pii-guard/src/scan.test.ts')).toBe(true);
    expect(isSkipped('apps/web/app/page.tsx')).toBe(false);
  });
});
