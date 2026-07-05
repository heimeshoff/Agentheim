// Static guards for the board-level prompt bar (agentic-workflow-023, rebuilt into
// the ADR-0050 docked two-row console by agentic-workflow-bz3az).
//
// aw-020's bare Quick Capture / Modeling column buttons were first relocated into a
// board-level prompt bar (aw-023), then restyled into launch cards (aw-065/aw-068).
// bz3az rebuilds that flat row of cards into the 1b DOCKED bottom-center console: a
// top row of four PromptModeTab tabs (Quick Capture · Modeling · Inquire · Research,
// PROMPT_MODES from dashboard/app/prompt-mode.js) carrying a single committed
// `highlightedMode` (ADR-0050), and a bottom row of a chevron + the single-line
// auto-growing prompt field + a keyboard hint + an ochre Enter button.
//
// Every trigger that can launch a mode's seeded command — clicking its tab, the
// Enter button, or Ctrl+Enter — routes through the ONE `fire(modeIndex)` function,
// so all three share the SAME launchOrCopy bridge-or-clipboard path, the same armed
// skipPermissions thread, and the same onResult clear-textarea + confetti + reset
// (mirroring aw-023's contract, now for four modes instead of independent buttons).
//
// The board's React glue has no DOM render harness in this project — the idiom
// (aw-016/020/022/065) is: pure string/interaction logic gets `node --test` coverage
// (modeling-command.test.mjs, prompt-mode.test.mjs), and the board's wiring is
// guarded by reading its source. This suite locks the bz3az acceptance criteria that
// are not pure logic already covered by prompt-mode.test.mjs.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dashboardDir = path.join(here, '..');
const boardSrc = readFileSync(path.join(dashboardDir, 'app', 'board.js'), 'utf8');

function barSrc() {
  const bar = boardSrc.match(/function BoardPromptBar[\s\S]*?\n}/);
  assert.ok(bar, 'BoardPromptBar component must exist');
  return bar[0];
}

function tabSrc() {
  const tab = boardSrc.match(/function PromptModeTab[\s\S]*?\n}/);
  assert.ok(tab, 'PromptModeTab component must exist');
  return tab[0];
}

test('BoardPromptBar imports the ADR-0050 pure keyboard model from prompt-mode.js', () => {
  assert.match(
    boardSrc,
    /import\s*\{[^}]*PROMPT_MODES[^}]*clampPromptModeIndex[^}]*nextPromptModeIndex[^}]*promptBarKeyIntent[^}]*\}\s*from\s*"\.\/prompt-mode\.js"/,
    'board.js must import PROMPT_MODES / clampPromptModeIndex / nextPromptModeIndex / promptBarKeyIntent from prompt-mode.js',
  );
});

test('the prompt bar renders the four mode tabs from PROMPT_MODES, in fixed order', () => {
  const bar = barSrc();
  assert.match(bar, /role="tablist"/, 'the top row must be a tablist');
  assert.match(bar, /PROMPT_MODES\.map\(/, 'the tabs must be rendered by mapping PROMPT_MODES');
  assert.match(bar, /<\$\{PromptModeTab\}/, 'each tab must render a PromptModeTab');
});

test('BoardPromptBar owns a single committed highlightedMode index (ADR-0050) defaulting to Quick Capture', () => {
  const bar = barSrc();
  assert.match(bar, /useState\(DEFAULT_PROMPT_MODE_INDEX\)/, 'highlightedMode must default via DEFAULT_PROMPT_MODE_INDEX');
  // No per-tab boolean state (e.g. four separate useState(false) selection flags) —
  // a single index, not four independent booleans.
  assert.doesNotMatch(bar, /quickCaptureHighlighted|modelingHighlighted|inquireHighlighted|researchHighlighted/,
    'there must be no per-mode boolean selection state');
});

test('the highlight resets to Quick Capture (0) after a successful launch (ADR-0050 default/reset)', () => {
  const bar = barSrc();
  const onResultFn = bar.match(/const onResult = useCallback\(\(res\) => \{[\s\S]*?\}, \[\]\);/);
  assert.ok(onResultFn, 'onResult callback must exist');
  assert.match(onResultFn[0], /setHighlightedMode\(DEFAULT_PROMPT_MODE_INDEX\)/, 'a successful launch must reset the highlight to Quick Capture');
});

test('every launch trigger (tab click, Enter button, Ctrl+Enter) routes through the SAME fire() function', () => {
  const bar = barSrc();
  assert.match(bar, /const fire = useCallback\(/, 'a single fire(modeIndex) function must exist');
  assert.match(bar, /launchOrCopy\(/, 'fire must call the shared launchOrCopy bridge-or-clipboard path');
  // Tab click routes through fire via onTabClick.
  assert.match(bar, /const onTabClick = useCallback\(\(index\) => \{[\s\S]*?fire\(index\)/, 'clicking a tab must call fire(index)');
  assert.match(bar, /setHighlightedMode\(index\)/, 'clicking a tab must also move the committed highlight to it');
  // Enter button.
  const enterButton = bar.match(/<button[\s\S]*?Enter\s*<\/button>/);
  assert.ok(enterButton, 'an Enter button must exist');
  assert.match(enterButton[0], /onClick=\$\{\(\)\s*=>\s*fire\(highlightedMode\)\}/, 'the Enter button must call fire(highlightedMode)');
  // Ctrl+Enter (via promptBarKeyIntent LAUNCH) must also call fire.
  const keyDownFn = bar.match(/const onPromptKeyDown = useCallback\(\(e\) => \{[\s\S]*?\}, \[fire, highlightedMode\]\);/);
  assert.ok(keyDownFn, 'onPromptKeyDown must exist and depend on [fire, highlightedMode]');
  assert.match(keyDownFn[0], /PROMPT_KEY_INTENT\.LAUNCH/, 'onPromptKeyDown must branch on the LAUNCH intent');
  assert.match(keyDownFn[0], /fire\(highlightedMode\)/, 'the LAUNCH branch must call fire(highlightedMode)');
});

test('Ctrl+ arrow keys cycle the highlight via nextPromptModeIndex, without launching', () => {
  const bar = barSrc();
  const keyDownFn = bar.match(/const onPromptKeyDown = useCallback\(\(e\) => \{[\s\S]*?\}, \[fire, highlightedMode\]\);/)[0];
  assert.match(keyDownFn, /PROMPT_KEY_INTENT\.CYCLE/, 'onPromptKeyDown must branch on the CYCLE intent');
  assert.match(keyDownFn, /nextPromptModeIndex\(/, 'the CYCLE branch must compute the next index via nextPromptModeIndex');
  assert.match(keyDownFn, /setHighlightedMode\(/, 'the CYCLE branch must move the highlight');
  // The cycle branch must not itself call fire (no launch on cycle).
  const cycleBlock = keyDownFn.match(/PROMPT_KEY_INTENT\.CYCLE\)\s*\{[\s\S]*?\n\s*\}/);
  assert.ok(cycleBlock, 'a CYCLE branch block must exist');
  assert.doesNotMatch(cycleBlock[0], /fire\(/, 'cycling must never call fire (no launch on Ctrl+arrow)');
});

test('bare Enter still swallows via the same promptBarKeyIntent classifier (no collision with Ctrl+Enter)', () => {
  const bar = barSrc();
  const keyDownFn = bar.match(/const onPromptKeyDown = useCallback\(\(e\) => \{[\s\S]*?\}, \[fire, highlightedMode\]\);/)[0];
  assert.match(keyDownFn, /const intent = promptBarKeyIntent\(e\)/, 'the classifier must be the single source of the intent');
  assert.match(keyDownFn, /PROMPT_KEY_INTENT\.SWALLOW/, 'the SWALLOW branch must exist');
  const swallowBlock = keyDownFn.match(/PROMPT_KEY_INTENT\.SWALLOW\)\s*\{[\s\S]*?\n\s*\}/);
  assert.ok(swallowBlock, 'a SWALLOW branch block must exist');
  assert.match(swallowBlock[0], /preventDefault\(\)/, 'SWALLOW must preventDefault (no newline, no launch)');
  assert.doesNotMatch(swallowBlock[0], /fire\(/, 'SWALLOW must never call fire — no collision with LAUNCH');
});

test('clicking a tab both moves the highlight AND launches — reusing the same fire() as Ctrl+Enter/the Enter button', () => {
  const bar = barSrc();
  const onTabClick = bar.match(/const onTabClick = useCallback\(\(index\) => \{[\s\S]*?\}, \[fire\]\);/);
  assert.ok(onTabClick, 'onTabClick must exist');
  assert.match(onTabClick[0], /setHighlightedMode\(index\)/);
  assert.match(onTabClick[0], /fire\(index\)/);
});

test('PromptModeTab never mutates highlightedMode on hover — hover is a separate transient channel (ADR-0050)', () => {
  const tab = tabSrc();
  assert.match(tab, /onMouseEnter=\$\{\(\)\s*=>\s*setHover\(true\)\}/, 'hover must set local, presentation-only state');
  assert.match(tab, /onMouseLeave=\$\{\(\)\s*=>\s*setHover\(false\)\}/);
  assert.doesNotMatch(tab, /onMouseEnter[\s\S]{0,80}(setHighlightedMode|onClick\(\))/, 'hover handlers must never move the committed highlight or launch');
});

test('the highlighted tab renders ochre (ADR-0051), the other three de-emphasize by opacity (ADR-0016)', () => {
  const tab = tabSrc();
  assert.match(tab, /highlighted\s*\?\s*"var\(--accent-ochre\)"/, 'the highlighted tab must use the ochre accent for its color');
  assert.match(tab, /highlighted\s*&&\s*!flashed\s*\?\s*"inset 0 -2px 0 var\(--accent-ochre\)"\s*:\s*"none"/, 'the highlighted tab must wear an ochre inset mark, mirroring the nav-rail idiom');
  // Non-highlighted tabs de-emphasize via opacity, never a different accent hue.
  assert.match(tab, /opacity/, 'non-highlighted tabs must de-emphasize via opacity');
});

test('a non-highlighted tab never renders the ochre accent token', () => {
  const tab = tabSrc();
  // The color/boxShadow expressions gate ochre strictly behind `highlighted` (and
  // the shared flash) — there is no unconditional var(--accent-ochre) that would
  // paint a resting, non-highlighted tab.
  const colorLine = tab.match(/const color = [^;]+;/)[0];
  assert.match(colorLine, /highlighted \? "var\(--accent-ochre\)"/, 'ochre in the color expression must be gated behind `highlighted`');
  assert.doesNotMatch(colorLine, /:\s*"var\(--accent-ochre\)"\s*;/, 'ochre must not be the unconditional fallback color');
});

test('the Enter button renders ochre (ADR-0048 primed-primary-action carve-out)', () => {
  const bar = barSrc();
  const enterButton = bar.match(/<button[\s\S]*?Enter\s*<\/button>/)[0];
  assert.match(enterButton, /var\(--accent-ochre\)/, 'the Enter button must use the ochre accent');
  assert.match(enterButton, /var\(--accent-ochre-soft\)/, 'the Enter button must use the ochre-soft fill (ADR-0048 cta treatment)');
});

test('the docked console is a position:fixed, ~780px, raised-surface console with a big shadow, above the board in z-order', () => {
  const bar = barSrc();
  assert.match(bar, /position:\s*"fixed"/, 'the console must be docked via position: fixed (never pushes board content, never breaks the aw-067 scroll-quiet container)');
  assert.match(bar, /width:\s*780\b/, 'the console must be ~780px wide');
  assert.match(bar, /boxShadow:\s*"var\(--shadow-lg\)"/, 'the console must wear the raised --shadow-lg elevation');
  assert.match(bar, /zIndex:\s*\d+/, 'the console must sit above the board in z-order');
});

test('the console renders TWO rows: the tablist above, and the chevron + field + hint + Enter button below', () => {
  const bar = barSrc();
  const tablistIdx = bar.indexOf('role="tablist"');
  const textareaIdx = bar.indexOf('<textarea');
  const enterIdx = bar.lastIndexOf('<button');
  assert.ok(tablistIdx !== -1 && textareaIdx !== -1 && enterIdx !== -1, 'all three landmarks must be present');
  assert.ok(tablistIdx < textareaIdx, 'the tab row must render ABOVE the input row');
  assert.ok(textareaIdx < enterIdx, 'the Enter button must render after (beside) the textarea');
  assert.match(bar, />❯</, 'the input row must render the ❯ chevron');
  assert.match(bar, />⌘↵</, 'the input row must render the ⌘↵ keyboard hint');
});

test('the field keeps the aw-038 single-line auto-grow contract (no wrap="off", hidden horizontal overflow, scrollHeight-driven growth)', () => {
  const bar = barSrc();
  assert.doesNotMatch(bar, /wrap="off"/, 'the field must keep soft-wrap');
  assert.match(bar, /overflowX:\s*"hidden"/);
  assert.match(bar, /overflowY:\s*"auto"/);
  assert.match(bar, /scrollHeight/);
  assert.match(bar, /maxHeight/);
});

test("bare Enter (no Ctrl) still inserts no newline: SWALLOW preventDefault()s, exercised via the field's onKeyDown", () => {
  const bar = barSrc();
  assert.match(bar, /onKeyDown=\$\{onPromptKeyDown\}/, 'the field must wire onPromptKeyDown');
});

test('the field value is sanitized single-line before storage (sanitizePromptLine unchanged, aw-038)', () => {
  const bar = barSrc();
  assert.match(bar, /setPrompt\(sanitizePromptLine\(/, 'onChange must feed setPrompt the sanitized value');
  assert.match(
    boardSrc,
    /function sanitizePromptLine[\s\S]*?replace\([^)]*\\[rn][\s\S]*?\)/,
    'sanitizePromptLine must replace newline characters with a space',
  );
});

test('every mode reads the same live prompt value through PROMPT_MODES[i].commandFor(prompt) (fire + the Enter button title)', () => {
  const bar = barSrc();
  assert.match(bar, /PROMPT_MODES\[idx\]\.commandFor\(prompt\)/, 'fire() must seed the command from the live prompt');
  assert.match(bar, /activeMode\.commandFor\(prompt\)/, 'the Enter button must reflect the live prompt in its title');
});

test('skipPermissions is threaded from BoardPromptBar into the shared fire() launchOrCopy call', () => {
  const bar = barSrc();
  assert.match(bar, /function BoardPromptBar\(\{\s*skipPermissions\s*=\s*false\s*\}\)/, 'BoardPromptBar must accept skipPermissions');
  assert.match(bar, /skipPermissions:\s*skipPermissions\s*===\s*true/, 'fire() must thread the armed skipPermissions flag into launchOrCopy');
});

test('DashboardBoard threads skipPermissions into the docked BoardPromptBar', () => {
  assert.match(
    boardSrc,
    /<\$\{BoardPromptBar\}\s+skipPermissions=\$\{skipPermissions\}/,
    'DashboardBoard must pass skipPermissions to BoardPromptBar',
  );
});

test('a successful launch/copy clears the textarea and fires confetti; silent (no copy) does neither', () => {
  const bar = barSrc();
  assert.match(bar, /via === "bridge"|res\.via/, 'must inspect the launchOrCopy result');
  assert.match(bar, /res\.copied/, 'must check whether the clipboard copy landed');
  assert.match(bar, /setConfettiKey/, 'a successful action must fire confetti');
  assert.match(bar, /<\$\{BoardConfetti\}\s+fireKey=\$\{confettiKey\}/, 'BoardConfetti must still be mounted off confettiKey');
});

test('board.js still imports WORK_COMMAND from modeling-command (the topbar Work launch, untouched by this rebuild)', () => {
  assert.match(
    boardSrc,
    /import\s*\{[^}]*WORK_COMMAND[^}]*\}\s*from\s*"\.\/modeling-command\.js"/,
    'board.js must import the WORK_COMMAND constant',
  );
});

test('the prompt bar no longer imports the four per-mode command builders directly — they are reached via PROMPT_MODES[i].commandFor', () => {
  // The mode-specific builders now live behind prompt-mode.js's PROMPT_MODES table,
  // not as loose board.js imports — a single seam for all four modes.
  const modelingImportLine = boardSrc.match(/import \{[^}]*\} from "\.\/modeling-command\.js";/)[0];
  assert.doesNotMatch(modelingImportLine, /quickCaptureCommandFor|modelingCommandFor|researchCommandFor|inquireCommandFor/,
    'board.js must not re-import the per-mode builders directly (prompt-mode.js owns that seam now)');
});

// agentic-workflow-034/042/014: the canvas-confetti celebration machinery is
// untouched by this rebuild — still guarded here since it lives inside
// BoardPromptBar's render tree.
test('confetti honours prefers-reduced-motion and drives via canvas-confetti (unchanged by this rebuild)', () => {
  assert.match(boardSrc, /prefers-reduced-motion/, 'confetti must be gated on prefers-reduced-motion (ADR-0014)');
  const confettiFn = boardSrc.match(/function BoardConfetti[\s\S]*?\n}/);
  assert.ok(confettiFn, 'a board-local BoardConfetti component must exist');
  assert.match(confettiFn[0], /if\s*\(\s*reduce\s*\|\|\s*!fireKey\s*\)\s*return/, 'the fire path must early-return under reduce (and on a falsy fireKey)');
  assert.match(confettiFn[0], /fireConfetti\(/, 'BoardConfetti must drive the canvas-confetti call once unguarded');
});
