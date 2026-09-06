// Convention guard (agentic-workflow-mvt8x, ADR-0070 mechanize-or-drop C1): a
// component subscribes to the shared live-tree hub and never constructs its own
// live-update source. A future panel that opened its own EventSource would pass
// every behavioral test in the suite while silently restoring the fan-out bug
// this task closes — this static source-regex guard is what catches the next
// author, matching the codebase's established idiom (launch-button-hover.test.mjs).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(here, '..', 'app');

// live-tree-hub.js is the ONE sanctioned caller of createLiveUpdate(...).
// live-update.js is where createLiveUpdate is DEFINED (its own declaration text
// matches the same regex) and where its default sourceFactory constructs
// `new EventSource(...)` — both exclusions are the definition site, not a
// second call site.
const HUB_FILE = 'live-tree-hub.js';
const LIVE_UPDATE_FILE = 'live-update.js';

function appFiles() {
  return readdirSync(appDir).filter((f) => f.endsWith('.js'));
}

test('createLiveUpdate( is called ONLY from the live-tree hub — no component constructs its own source', () => {
  for (const file of appFiles()) {
    if (file === HUB_FILE || file === LIVE_UPDATE_FILE) continue;
    const src = readFileSync(path.join(appDir, file), 'utf8');
    assert.doesNotMatch(
      src,
      /createLiveUpdate\(/,
      `${file} must not call createLiveUpdate(...) directly — subscribe to the live-tree hub (live-tree-hub.js) instead, ADR-0070`,
    );
  }
});

test('the live-tree hub itself is the one createLiveUpdate( call site', () => {
  const hubSrc = readFileSync(path.join(appDir, HUB_FILE), 'utf8');
  assert.match(hubSrc, /createLiveUpdate\(/, 'live-tree-hub.js must call createLiveUpdate(...)');
});

test('new EventSource( is constructed ONLY inside live-update.js — no other module (including the hub) builds one directly', () => {
  for (const file of appFiles()) {
    if (file === LIVE_UPDATE_FILE) continue;
    const src = readFileSync(path.join(appDir, file), 'utf8');
    assert.doesNotMatch(
      src,
      /new EventSource\(/,
      `${file} must not construct EventSource directly — live-update.js's default sourceFactory is the one call site, ADR-0070`,
    );
  }
});

// agentic-workflow-bmn29, ADR-0070 §6 mechanize-or-drop: visibility gating has
// exactly ONE home, the same way source construction does above. A component
// that read `document.visibilityState`/`document.hidden` or listened for
// `visibilitychange` itself would silently restore the hidden-tab waste this
// task closes (its own re-fetch fan-out, unpaused) while passing every
// behavioral test — this static guard is what catches the next author.
const VISIBILITY_PATTERNS = [
  { name: 'visibilitychange', re: /visibilitychange/ },
  { name: 'visibilityState', re: /visibilityState/ },
  { name: 'document.hidden', re: /document\.hidden/ },
];

test('visibilitychange / visibilityState / document.hidden appear under dashboard/app/** ONLY in live-tree-hub.js', () => {
  for (const file of appFiles()) {
    if (file === HUB_FILE) continue;
    const src = readFileSync(path.join(appDir, file), 'utf8');
    for (const { name, re } of VISIBILITY_PATTERNS) {
      assert.doesNotMatch(
        src,
        re,
        `${file} must not reference ${name} — tab-visibility gating has exactly one home, the injectable visibility adapter in live-tree-hub.js (ADR-0070 §6)`,
      );
    }
  }
});

test('live-tree-hub.js is the one module that references the visibility signals', () => {
  const hubSrc = readFileSync(path.join(appDir, HUB_FILE), 'utf8');
  for (const { name, re } of VISIBILITY_PATTERNS.filter((p) => p.name !== 'document.hidden')) {
    assert.match(hubSrc, re, `live-tree-hub.js must reference ${name} (its default visibility adapter)`);
  }
});
