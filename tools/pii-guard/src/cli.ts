import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { isSkipped, parseDenylist, scanText, type Finding } from './scan.js';

/**
 * Usage: pnpm pii-guard            # scan every tracked file
 *        pnpm pii-guard -- a b c   # scan specific files
 * Env:   PII_DENYLIST   private terms (GitHub secret); optional locally.
 *        PII_DENYLIST_REQUIRED=1   fail if the denylist is missing (set in CI once the secret exists).
 */
const repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
process.chdir(repoRoot);

const args = process.argv.slice(2).filter((a) => a !== '--');
const files = (
  args.length > 0
    ? args
    : execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean)
).filter((f) => !isSkipped(f));

const denylist = parseDenylist(process.env.PII_DENYLIST);
if (denylist.length === 0) {
  const msg = 'PII_DENYLIST is empty: only pattern rules ran (real-name denylist skipped).';
  if (process.env.PII_DENYLIST_REQUIRED === '1') {
    console.error(`::error::${msg}`);
    process.exit(1);
  }
  console.warn(`::warning::${msg}`);
}

const findings: Finding[] = [];
for (const file of files) {
  let text: string;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    continue; // deleted in working tree, or unreadable
  }
  if (text.includes('\u0000')) continue; // binary
  findings.push(...scanText(file, text, denylist));
}

for (const f of findings) {
  const detail = f.rule === 'denylist' ? 'matches private denylist' : `"${f.excerpt}"`;
  console.error(
    `::error file=${f.file},line=${f.line},title=PII guard (${f.rule})::${f.rule}: ${detail}`,
  );
}

console.log(
  `pii-guard: scanned ${files.length} files, ${denylist.length} denylist terms, ${findings.length} finding(s).`,
);
if (findings.length > 0) {
  console.error(
    'Real wedding/guest data must live in Postgres via the admin dashboard, never in git. ' +
      'If this is a reviewed false positive, add `pii-guard:allow` to that line.',
  );
  process.exit(1);
}
