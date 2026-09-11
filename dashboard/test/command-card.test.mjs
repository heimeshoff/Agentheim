// Static guard for the /dashboard command card (ADR-0002 + infrastructure-010 addendum).
//
// History of the regression class this guards:
//   - infrastructure-008: a bare `node dashboard/launch.mjs` broke in every foreign
//     consumer project (project-root assumption). "Fixed" with ${CLAUDE_PLUGIN_ROOT:-.}.
//   - infrastructure-010: that fix was inert — $CLAUDE_PLUGIN_ROOT is EMPTY in the
//     command's Bash context for an installed plugin, so ${VAR:-.} collapsed back to
//     the project path and reproduced the exact module-not-found error. The card now
//     uses an env-INDEPENDENT `node -e` bootstrap that derives the launcher from
//     os.homedir() via dashboard/resolve-launcher.mjs.
//   - infrastructure-k9t2v: the card pasted that same bootstrap THREE times (one per
//     verb, differing only in a trailing literal). Collapsed to ONE bootstrap line
//     that forwards the verb at runtime via `$ARGUMENTS`. This is a **deliberate
//     seam adaptation, not a silent gutting**: the old "at least three invocations,
//     one per named verb" assertions are structurally impossible to satisfy with a
//     single pass-through line, so they are replaced below by (a) an
//     exactly-one-invocation assertion and (b) a $ARGUMENTS-forwarding assertion.
//     Per-verb *behavioural* coverage (does `stop` actually stop?) now lives
//     entirely in foreign-launch.test.mjs, which substitutes the real verb into the
//     single line and runs it — a strictly stronger guard than the static per-verb
//     text check it replaces.
//
// This test extracts the launcher invocation(s) from the card and asserts the
// env-independent resolver shape, so the next edit to the card can't silently
// reintroduce either the project-relative-path OR the $CLAUDE_PLUGIN_ROOT-dependent
// regression, and can't silently re-duplicate the bootstrap. It also guards the
// launcher's printed user-facing hint strings.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  extractLauncherInvocations,
  isPluginRooted,
  isEnvIndependentResolver,
  forwardsArguments,
} from './helpers/card.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(here, '..', '..');
const cardPath = path.join(repoRoot, 'commands', 'dashboard.md');
const launchPath = path.join(here, '..', 'launch.mjs');

test('the card contains exactly one launcher invocation (infrastructure-k9t2v: no re-duplication)', () => {
  const card = readFileSync(cardPath, 'utf8');
  const invocations = extractLauncherInvocations(card);
  assert.equal(
    invocations.length,
    1,
    `expected exactly one bootstrap invocation, found ${invocations.length}`
  );
});

test('the single invocation forwards the verb via $ARGUMENTS, not a hardcoded verb', () => {
  const card = readFileSync(cardPath, 'utf8');
  const [line] = extractLauncherInvocations(card);
  assert.ok(
    forwardsArguments(line),
    `card invocation must pass the verb through as $ARGUMENTS: ${line}`
  );
});

test('every launcher invocation in the card is the env-independent resolver bootstrap', () => {
  const card = readFileSync(cardPath, 'utf8');
  const invocations = extractLauncherInvocations(card);
  assert.ok(invocations.length >= 1, 'expected at least one launcher invocation in the card');
  for (const line of invocations) {
    assert.ok(
      isEnvIndependentResolver(line),
      `card invocation is not the env-independent resolver bootstrap ` +
        `(infrastructure-010 regression): ${line}`
    );
  }
});

test('no card invocation depends on $CLAUDE_PLUGIN_ROOT (infrastructure-010 field failure)', () => {
  const card = readFileSync(cardPath, 'utf8');
  for (const line of extractLauncherInvocations(card)) {
    assert.ok(
      !isPluginRooted(line),
      `card invocation depends on $CLAUDE_PLUGIN_ROOT, which is empty in installed ` +
        `consumers (infrastructure-010): ${line}`
    );
  }
});

test('the card derives the cache path from os.homedir() (never raw env vars)', () => {
  const card = readFileSync(cardPath, 'utf8');
  for (const line of extractLauncherInvocations(card)) {
    assert.match(line, /os\.homedir\(\)/, `card invocation must derive the path from os.homedir(): ${line}`);
  }
});

// infrastructure-k9t2v: the old static "all three verbs textually present" check
// cannot apply to a single $ARGUMENTS-forwarding line (there is no per-verb text
// to enumerate). Per-verb coverage now lives in foreign-launch.test.mjs, which
// substitutes each real verb into the one card line and runs it end-to-end
// against a foreign project — see that file's `cardCommandFor`.

test('the card issues no `cd` directive (launcher must run from the consumer cwd)', () => {
  const card = readFileSync(cardPath, 'utf8');
  const offending = card
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => /^cd\s+\S/.test(l));
  assert.deepEqual(offending, [], `card must not change directory: ${offending.join(' | ')}`);
});

test('the launcher prints no bare project-relative `node dashboard/launch.mjs` hint', () => {
  const src = readFileSync(launchPath, 'utf8');
  const stringLiterals = src.match(/(['"`])(?:\\.|(?!\1).)*\1/g) || [];
  for (const lit of stringLiterals) {
    assert.ok(
      !/node\s+dashboard\/launch\.mjs/.test(lit),
      `launcher prints a project-relative invocation hint (infrastructure-008 class): ${lit}`
    );
  }
});

// --- Meta: prove the extractor/predicates actually CATCH the regression classes. ---
// A passing guard against an already-correct card is worthless unless we show it
// would fail against the bad forms (both the 008 bare-relative and the 010
// $CLAUDE_PLUGIN_ROOT-dependent ones).

test('predicate REJECTS a bare project-relative card (infrastructure-008 Red proof)', () => {
  const badCard = [
    'No argument → launch:',
    '```',
    'node dashboard/launch.mjs',
    '```',
  ].join('\n');
  const invocations = extractLauncherInvocations(badCard);
  assert.equal(invocations.length, 1, 'extractor must find the bad invocation');
  assert.ok(
    !isEnvIndependentResolver(invocations[0]),
    'the resolver predicate must reject a bare `node dashboard/launch.mjs`'
  );
});

test('predicate REJECTS a $CLAUDE_PLUGIN_ROOT-dependent card (infrastructure-010 Red proof)', () => {
  const badCard = [
    '```',
    'node "${CLAUDE_PLUGIN_ROOT:-.}/dashboard/launch.mjs"',
    '```',
  ].join('\n');
  const invocations = extractLauncherInvocations(badCard);
  assert.equal(invocations.length, 1, 'extractor must find the env-dependent invocation');
  assert.ok(isPluginRooted(invocations[0]), 'plugin-rooted predicate must flag it');
  assert.ok(
    !isEnvIndependentResolver(invocations[0]),
    'the resolver predicate must reject a $CLAUDE_PLUGIN_ROOT-dependent invocation'
  );
});

test('predicate REJECTS a re-duplicated card (infrastructure-k9t2v Red proof)', () => {
  const line =
    "node -e \"const os=require('node:os');os.homedir();/*resolve-launcher.mjs*/\"";
  const badCard = ['```', line, '```', '```', `${line} stop`, '```'].join('\n');
  const invocations = extractLauncherInvocations(badCard);
  assert.equal(invocations.length, 2, 'extractor must find both pasted copies');
});

test('predicate REJECTS a card that hardcodes a verb instead of forwarding $ARGUMENTS (Red proof)', () => {
  const badLine =
    "node -e \"const os=require('node:os');os.homedir();/*resolve-launcher.mjs*/\" stop";
  assert.ok(
    !forwardsArguments(badLine),
    'forwardsArguments must reject a line with a hardcoded verb and no $ARGUMENTS'
  );
});
