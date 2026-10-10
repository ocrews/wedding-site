/**
 * PII guard: enforces "nothing real about the wedding goes in git".
 *
 * Two layers:
 *  1. Pattern rules (emails, phone numbers, street addresses, invite-code-shaped strings).
 *  2. A private denylist (real names, venue, hotels…) supplied via the PII_DENYLIST
 *     secret — never committed. Denylist hits are reported WITHOUT the matched text
 *     so CI logs don't leak the list.
 *
 * Escape hatch for an intentional, reviewed false positive: put `pii-guard:allow`
 * on the same line. Reviewers should question every one.
 */

export type RuleId = 'email' | 'phone' | 'street-address' | 'household-code' | 'denylist';

export interface Finding {
  file: string;
  line: number;
  rule: RuleId;
  /** Redacted excerpt; undefined for denylist hits. */
  excerpt?: string;
}

const ALLOW_MARKER = 'pii-guard:allow';

/** Domains that are safe by definition (RFC 2606 / 6761) or are bot/no-reply addresses. */
const SAFE_EMAIL_DOMAINS = [
  /(^|\.)example\.(com|org|net)$/i,
  /\.(test|example|invalid|localhost)$/i,
  /^users\.noreply\.github\.com$/i,
  /^noreply\.github\.com$/i,
  /^anthropic\.com$/i, // commit co-author trailer
];

const EMAIL = /[A-Za-z0-9._%+-]+@([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,})/g;

// NANP numbers: (816) 555-1234, 816-555-1234, 816.555.1234, +1 816 555 1234.
// 555-01xx is reserved for fiction and allowed.
const PHONE = /(?<![\w.-])(?:\+?1[\s.-]?)?\(?([2-9]\d{2})\)?[\s.-]?(\d{3})[\s.-](\d{4})(?![\w-])/g;

const STREET_SUFFIX =
  'St|Street|Ave|Avenue|Rd|Road|Blvd|Boulevard|Dr|Drive|Ln|Lane|Ct|Court|Way|Pkwy|Parkway|Hwy|Highway|Pl|Place|Ter|Terrace|Cir|Circle';
const STREET_ADDRESS = new RegExp(
  `\\b\\d{2,6}\\s+(?:[NSEW]\\.?\\s+)?(?:[A-Z][a-z]+\\s+){1,3}(?:${STREET_SUFFIX})\\b\\.?`,
  'g',
);

// Household code format from the architecture doc: 4 letters, dash, 4 from the unambiguous alphabet.
// Requires at least one digit in the second group so ordinary words like "MOSS-TENT" don't match.
const HOUSEHOLD_CODE = /\b[A-HJKMNP-Z]{4}-(?=[A-HJKMNP-Z2-9]{0,3}[2-9])[A-HJKMNP-Z2-9]{4}\b/g;
const DOC_EXAMPLE_CODES = new Set(['MOSS-7K4Q']);

function redact(s: string): string {
  if (s.length <= 4) return '*'.repeat(s.length);
  return `${s.slice(0, 2)}${'*'.repeat(s.length - 4)}${s.slice(-2)}`;
}

function isSafeEmailDomain(domain: string): boolean {
  return SAFE_EMAIL_DOMAINS.some((re) => re.test(domain));
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Parse the PII_DENYLIST secret: one term per line or comma-separated; `#` comments allowed. */
export function parseDenylist(raw: string | undefined): RegExp[] {
  if (!raw) return [];
  return raw
    .split(/[\n,]/)
    .map((t) => t.replace(/#.*/, '').trim())
    .filter((t) => t.length >= 3)
    .map((t) => new RegExp(`(?<![A-Za-z0-9])${escapeRegExp(t)}(?![A-Za-z0-9])`, 'i'));
}

export function scanText(file: string, text: string, denylist: RegExp[] = []): Finding[] {
  const findings: Finding[] = [];
  const lines = text.split(/\r?\n/);

  lines.forEach((content, idx) => {
    if (content.includes(ALLOW_MARKER)) return;
    const line = idx + 1;

    for (const m of content.matchAll(EMAIL)) {
      const domain = m[1] ?? '';
      const gitSshRemote = m[0] === `git@${domain}` && /^(github|gitlab)\.com$/i.test(domain);
      if (!isSafeEmailDomain(domain) && !gitSshRemote) {
        findings.push({ file, line, rule: 'email', excerpt: redact(m[0]) });
      }
    }

    for (const m of content.matchAll(PHONE)) {
      const [, , exchange, subscriber] = m;
      const fictional = exchange === '555' && /^01\d\d$/.test(subscriber ?? '');
      if (!fictional) findings.push({ file, line, rule: 'phone', excerpt: redact(m[0]) });
    }

    for (const m of content.matchAll(STREET_ADDRESS)) {
      findings.push({ file, line, rule: 'street-address', excerpt: redact(m[0]) });
    }

    for (const m of content.matchAll(HOUSEHOLD_CODE)) {
      if (!DOC_EXAMPLE_CODES.has(m[0])) {
        findings.push({ file, line, rule: 'household-code', excerpt: redact(m[0]) });
      }
    }

    if (denylist.some((re) => re.test(content))) {
      findings.push({ file, line, rule: 'denylist' });
    }
  });

  return findings;
}

/** Files the guard never reads (generated, binary, or the guard's own fixtures). */
export function isSkipped(file: string): boolean {
  return (
    file === 'pnpm-lock.yaml' ||
    file.startsWith('tools/pii-guard/src/') ||
    /\.(png|jpe?g|gif|webp|ico|svg|woff2?|ttf|otf|mp3|ogg|wav|zip|gz)$/i.test(file)
  );
}
