// Static guards for the board-level prompt bar (agentic-workflow-023, rebuilt into
// the ADR-0050 docked two-row console by agentic-workflow-bz3az).
//
// aw-020's bare Quick Capture / Modeling column buttons were first relocated into a
// board-level prompt bar (aw-023), then restyled into launch cards (aw-065/aw-068).
// bz3az rebuilds that flat row of cards into the 1b DOCKED bottom-center console: a
// top row of PromptModeTab tabs (Quick Capture · Modeling · Inquire · Research,
// PROMPT_MODES from dashboard/app/prompt-mode.js) carrying a single committed
// `highlightedMode` (ADR-0050), and a bottom row of a chevron + the single-line
// auto-growing prompt field + a keyboard hint + an ochre Enter button.
// agentic-workflow-m3vhq appends a FIFTH tab, Plain — the first mode that can
// DECLINE to launch (an empty prompt is a true no-op, gated by the shared
// canFirePromptMode predicate, consulted by both fire() and the Enter button's
// disabled state). agentic-workflow-aqyqd (third ADR-0050 amendment)
// GENERALIZES the decline from Plain alone to all five modes — the bar
// itself now requires a prompt, not any one mode.
//
// Every trigger that can launch a mode's seeded command — clicking its tab, the
// Enter button, or Ctrl+Enter — routes through the ONE `fire(modeIndex)` function,
// so all three share the SAME launchOrCopy bridge-or-clipboard path, the same armed
// skipPermissions thread, and the same onResult clear-textarea + confetti + reset
// (mirroring aw-023's contract, now for five modes instead of independent buttons).
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

test('the prompt bar renders all PROMPT_MODES tabs (five, since agentic-workflow-m3vhq), in fixed order', () => {
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

// agentic-workflow-m2vkp reverses ADR-0050's original default/reset rule: the
// highlight now SURVIVES a successful launch — onResult must never reset it.
test('the highlight SURVIVES a successful launch — onResult no longer resets it to Quick Capture (agentic-workflow-m2vkp reverses ADR-0050 default/reset)', () => {
  const bar = barSrc();
  const onResultFn = bar.match(/const onResult = useCallback\(\(res\) => \{[\s\S]*?\}, \[\]\);/);
  assert.ok(onResultFn, 'onResult callback must exist');
  assert.doesNotMatch(onResultFn[0], /setHighlightedMode/, 'a successful launch must NOT touch highlightedMode any more (agentic-workflow-m2vkp)');
});

test('every launch trigger (bare Enter, Ctrl+Enter, the split button\'s primary region) routes through the SAME fire() function — tab click does NOT (p8k4d)', () => {
  const bar = barSrc();
  assert.match(bar, /const fire = useCallback\(/, 'a single fire(modeIndex) function must exist');
  assert.match(bar, /launchOrCopy\(/, 'fire must call the shared launchOrCopy bridge-or-clipboard path');
  // Tab click only moves the committed highlight — it must NOT call fire (p8k4d reverses bz3az/ADR-0050).
  const onTabClick = bar.match(/const onTabClick = useCallback\(\(index\) => \{[\s\S]*?\}, \[[^\]]*\]\);/);
  assert.ok(onTabClick, 'onTabClick must exist');
  assert.match(onTabClick[0], /setHighlightedMode\(index\)/, 'clicking a tab must move the committed highlight to it');
  assert.doesNotMatch(onTabClick[0], /fire\(/, 'clicking a tab must NOT launch anything (p8k4d)');
  // The launch affordance is now ModelSplitButton (design-system-r9dtm), unforked (agentic-workflow-m2vkp).
  const splitButton = bar.match(/<\$\{ModelSplitButton\}[\s\S]*?\/>/);
  assert.ok(splitButton, 'a ModelSplitButton must exist');
  assert.match(splitButton[0], /onClick=\$\{\(\)\s*=>\s*fire\(highlightedMode\)\}/, 'the split button\'s primary region must call fire(highlightedMode)');
  // Bare Enter and Ctrl+Enter (both classify LAUNCH) must also call fire.
  const keyDownFn = bar.match(/const onPromptKeyDown = useCallback\(\(e\) => \{[\s\S]*?\}, \[fire, highlightedMode, modelLocked\]\);/);
  assert.ok(keyDownFn, 'onPromptKeyDown must exist and depend on [fire, highlightedMode, modelLocked]');
  assert.match(keyDownFn[0], /PROMPT_KEY_INTENT\.LAUNCH/, 'onPromptKeyDown must branch on the LAUNCH intent');
  assert.match(keyDownFn[0], /fire\(highlightedMode\)/, 'the LAUNCH branch must call fire(highlightedMode)');
});

// agentic-workflow-tkq7v (ADR-0050 amendment): the cycle trigger moves from
// Ctrl+arrow to Tab/Shift+Tab — the CYCLE branch now reads `e.shiftKey` for
// direction rather than `e.key` (ArrowLeft/ArrowRight).
test('Tab/Shift+Tab cycle the highlight via nextPromptModeIndex, direction from shiftKey, without launching (agentic-workflow-tkq7v)', () => {
  const bar = barSrc();
  const keyDownFn = bar.match(/const onPromptKeyDown = useCallback\(\(e\) => \{[\s\S]*?\}, \[fire, highlightedMode, modelLocked\]\);/)[0];
  assert.match(keyDownFn, /PROMPT_KEY_INTENT\.CYCLE/, 'onPromptKeyDown must branch on the CYCLE intent');
  assert.match(keyDownFn, /nextPromptModeIndex\(/, 'the CYCLE branch must compute the next index via nextPromptModeIndex');
  assert.match(keyDownFn, /setHighlightedMode\(/, 'the CYCLE branch must move the highlight');
  const cycleBlock = keyDownFn.match(/PROMPT_KEY_INTENT\.CYCLE\)\s*\{[\s\S]*?\n\s*\}/);
  assert.ok(cycleBlock, 'a CYCLE branch block must exist');
  assert.doesNotMatch(cycleBlock[0], /fire\(/, 'cycling must never call fire (no launch on Tab/Shift+Tab)');
  assert.match(cycleBlock[0], /e\.shiftKey/, 'the CYCLE branch must read e.shiftKey to pick direction, not e.key');
  assert.doesNotMatch(cycleBlock[0], /ArrowRight|ArrowLeft/, 'the CYCLE branch must no longer branch on arrow keys');
  assert.match(cycleBlock[0], /preventDefault\(\)/, 'the CYCLE branch must preventDefault so Tab does not move focus out of the textarea');
});

// agentic-workflow-tkq7v: Escape is the WCAG 2.1.2 keyboard-trap mitigation —
// since Tab is hijacked while the field has focus, Escape blurs it, handing
// focus navigation back to native Tab.
test('Escape blurs the prompt textarea, and does not clear the prompt (agentic-workflow-tkq7v)', () => {
  const bar = barSrc();
  const keyDownFn = bar.match(/const onPromptKeyDown = useCallback\(\(e\) => \{[\s\S]*?\}, \[fire, highlightedMode, modelLocked\]\);/)[0];
  assert.match(keyDownFn, /["']Escape["']/, 'onPromptKeyDown must check for the Escape key');
  assert.match(keyDownFn, /\.blur\(\)/, 'Escape must blur the textarea');
  const escapeBlock = keyDownFn.match(/if\s*\(\s*e\.key\s*===\s*["']Escape["']\s*\)\s*\{[\s\S]*?\n\s*\}/);
  assert.ok(escapeBlock, 'an Escape branch block must exist');
  assert.doesNotMatch(escapeBlock[0], /setPrompt\(/, 'Escape must never clear or mutate the typed prompt');
});

test('Shift+Enter classifies as NEWLINE via the same promptBarKeyIntent classifier and launches nothing (p8k4d)', () => {
  const bar = barSrc();
  const keyDownFn = bar.match(/const onPromptKeyDown = useCallback\(\(e\) => \{[\s\S]*?\}, \[fire, highlightedMode, modelLocked\]\);/)[0];
  assert.match(keyDownFn, /const intent = promptBarKeyIntent\(e\)/, 'the classifier must be the single source of the intent');
  assert.doesNotMatch(keyDownFn, /PROMPT_KEY_INTENT\.SWALLOW/, 'the retired SWALLOW label must not appear (p8k4d)');
  assert.match(keyDownFn, /PROMPT_KEY_INTENT\.NEWLINE/, 'the NEWLINE branch must exist');
  const newlineBlock = keyDownFn.match(/PROMPT_KEY_INTENT\.NEWLINE\)\s*\{[\s\S]*?\n\s*\}/);
  assert.ok(newlineBlock, 'a NEWLINE branch block must exist');
  assert.doesNotMatch(newlineBlock[0], /preventDefault\(\)/, 'NEWLINE must NOT preventDefault — the textarea inserts its own line break natively');
  assert.doesNotMatch(newlineBlock[0], /fire\(/, 'NEWLINE must never call fire — no collision with LAUNCH');
});

test('clicking a tab ONLY moves the committed highlight — it never launches (p8k4d reverses bz3az/ADR-0050 click-to-launch)', () => {
  const bar = barSrc();
  const onTabClick = bar.match(/const onTabClick = useCallback\(\(index\) => \{[\s\S]*?\}, \[[^\]]*\]\);/);
  assert.ok(onTabClick, 'onTabClick must exist');
  assert.match(onTabClick[0], /setHighlightedMode\(index\)/);
  assert.doesNotMatch(onTabClick[0], /fire\(/, 'clicking a tab must never call fire (p8k4d)');
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

// agentic-workflow-q7r3x: the highlighted tab is a filled CELL + a full-width
// underline (ADR-0051's inset-underline intent) — replacing the prior
// four-sided rounded-pill look. No corner rounding on an individual cell any
// more (rounding now belongs to the console shell alone).
test('the highlighted tab wears a filled cell background, gated behind `highlighted`; a tab cell has no corner rounding of its own', () => {
  const tab = tabSrc();
  assert.match(tab, /const background = [^;]+;/, 'a background expression must exist');
  const backgroundLine = tab.match(/const background = [^;]+;/)[0];
  assert.match(backgroundLine, /highlighted/, 'the fill must be gated behind `highlighted`');
  assert.doesNotMatch(backgroundLine, /^const background = "transparent";$/, 'the fill must no longer be unconditionally transparent');
  assert.doesNotMatch(tab, /borderRadius:\s*"var\(--radius-sm\)"/, 'an individual tab cell must not round its own corners (edge-to-edge cells)');
});

// agentic-workflow-m2vkp: the Enter affordance is swapped for ModelSplitButton
// (design-system-r9dtm), consumed UNFORKED (ADR-0003) — no ochre split button
// is hand-rolled in board.js.
test('the launch affordance is the unforked ModelSplitButton primitive (ADR-0003), imported from the styleguide button.js', () => {
  assert.match(
    boardSrc,
    /import\s*\{[^}]*ModelSplitButton[^}]*\}\s*from\s*"[^"]*styleguide\/app\/button\.js"/,
    'board.js must import ModelSplitButton from the styleguide button.js, unforked',
  );
  const bar = barSrc();
  assert.match(bar, /<\$\{ModelSplitButton\}/, 'the input row must render the ModelSplitButton component');
  // The old soft-ochre text "Enter" button markup must be gone — the primitive
  // owns its own paint now (ADR-0003: consumed unforked, not re-styled here).
  assert.doesNotMatch(bar, /var\(--accent-ochre-soft\)/, 'board.js must not re-implement the launch button\'s ochre-soft fill (unforked primitive)');
  assert.doesNotMatch(bar, />\s*Enter\s*</, 'the old literal "Enter" text button must be gone');
  // The old EnterButton import/usage must be gone entirely — ModelSplitButton
  // replaces it, not sits beside it.
  assert.doesNotMatch(boardSrc, /\bEnterButton\b/, 'board.js must no longer import or render EnterButton at all (agentic-workflow-m2vkp)');
});

test('the docked console is a position:fixed, ~780px, raised-surface console with a big shadow, above the board in z-order', () => {
  const bar = barSrc();
  assert.match(bar, /position:\s*"fixed"/, 'the console must be docked via position: fixed (never pushes board content, never breaks the aw-067 scroll-quiet container)');
  assert.match(bar, /width:\s*780\b/, 'the console must be ~780px wide');
  assert.match(bar, /boxShadow:\s*"var\(--shadow-lg\)"/, 'the console must wear the raised --shadow-lg elevation');
  assert.match(bar, /zIndex:\s*\d+/, 'the console must sit above the board in z-order');
});

// agentic-workflow-m2vkp: the bordered ↵ hint span is GONE — the split button
// is the only launch affordance on row 2.
test('the console renders TWO rows: the tablist above, and the chevron + field + split button below — the old bordered ↵ hint is gone', () => {
  const bar = barSrc();
  const tablistIdx = bar.indexOf('role="tablist"');
  const textareaIdx = bar.indexOf('<textarea');
  const splitButtonIdx = bar.lastIndexOf('<${ModelSplitButton}');
  assert.ok(tablistIdx !== -1 && textareaIdx !== -1 && splitButtonIdx !== -1, 'all three landmarks must be present');
  assert.ok(tablistIdx < textareaIdx, 'the tab row must render ABOVE the input row');
  assert.ok(textareaIdx < splitButtonIdx, 'the split button must render after (beside) the textarea');
  assert.match(bar, />❯</, 'the input row must render the ❯ chevron');
  assert.doesNotMatch(bar, />↵</, 'the old bordered ↵ keyboard-hint span must be gone (agentic-workflow-m2vkp) — its affordance moves into the split button\'s tooltip/aria-label');
});

// agentic-workflow-q7r3x: Section 1b layout deltas.

test('the tab row is four edge-to-edge equal-width cells: no inter-tab gap, no horizontal panel padding on the row', () => {
  const bar = barSrc();
  const tablistDiv = bar.match(/<div role="tablist"[\s\S]*?>/)[0];
  assert.doesNotMatch(tablistDiv, /gap:\s*[1-9]/, 'the tablist row must not add inter-tab gap');
  assert.doesNotMatch(tablistDiv, /padding:\s*"[^"]*\d/, 'the tablist row must carry no horizontal panel padding');
  const tab = tabSrc();
  assert.match(tab, /flex:\s*"1 1 0"/, 'each cell must be an equal-width flex-1 cell filling the row');
});

test('a thin --hairline divider separates each tab cell from its neighbor', () => {
  const tab = tabSrc();
  assert.match(tab, /--hairline/, 'a tab cell must carry a --hairline divider');
});

test('a horizontal --hairline divider separates the tab row from the input row', () => {
  const bar = barSrc();
  const tablistIdx = bar.indexOf('role="tablist"');
  const textareaIdx = bar.indexOf('<textarea');
  const between = bar.slice(tablistIdx, textareaIdx);
  assert.match(between, /var\(--hairline\)/, 'a --hairline divider must sit between the tab row and the input row');
});

test('the leading chevron is bright ochre and bold', () => {
  const bar = barSrc();
  const chevron = bar.match(/<span aria-hidden="true" style=\$\{\{[\s\S]*?\}\}>❯<\/span>/);
  assert.ok(chevron, 'the ❯ chevron span must exist');
  assert.match(chevron[0], /color:\s*"var\(--accent-ochre\)"/, 'the chevron must be ochre');
  assert.match(chevron[0], /fontWeight:\s*(700|"bold")/, 'the chevron must be bold');
});

test('the placeholder copy is unchanged', () => {
  const bar = barSrc();
  assert.match(bar, /placeholder="Type a prompt, then choose a mode to launch it…"/, 'the placeholder copy must be unchanged');
});

test('the keyboard hint and its title reconcile with Enter-as-primary-trigger (p8k4d reverses the ⌘↵/Ctrl+Enter framing)', () => {
  const bar = barSrc();
  assert.doesNotMatch(bar, />⌘↵</, 'the old ⌘↵-first hint glyph must be gone');
  assert.doesNotMatch(bar, /title="Ctrl\+Enter launches the highlighted mode"/, 'the old Ctrl+Enter-first title must be gone');
  assert.match(bar, /Enter launches/i, 'the hint title must say Enter launches');
  assert.match(bar, /Shift\+Enter/i, 'the hint title must mention Shift+Enter for a new line');
});

test('a window-scoped Ctrl+Space keydown listener focuses the prompt textarea, registered/torn down via useEffect (p8k4d)', () => {
  const bar = barSrc();
  assert.match(bar, /document\.addEventListener\(\s*["']keydown["']/, 'a document-level keydown listener must be registered');
  assert.match(bar, /document\.removeEventListener\(\s*["']keydown["']/, 'the listener must be torn down');
  assert.match(bar, /ctrlKey[\s\S]{0,60}["'] ["']/, 'the listener must check for Ctrl+Space (ctrlKey && key === " ")');
  assert.match(bar, /textareaRef\.current\.focus\(\)/, 'the listener must focus the textarea via textareaRef');
});

test('the field keeps its auto-grow contract (no wrap="off", hidden horizontal overflow, scrollHeight-driven growth) — now genuinely multi-line (p8k4d)', () => {
  const bar = barSrc();
  assert.doesNotMatch(bar, /wrap="off"/, 'the field must keep soft-wrap');
  assert.match(bar, /overflowX:\s*"hidden"/);
  assert.match(bar, /overflowY:\s*"auto"/);
  assert.match(bar, /scrollHeight/);
  assert.match(bar, /maxHeight/);
});

test("the field's onKeyDown routes every keystroke through the ONE promptBarKeyIntent classifier", () => {
  const bar = barSrc();
  assert.match(bar, /onKeyDown=\$\{onPromptKeyDown\}/, 'the field must wire onPromptKeyDown');
});

test('the field value is stored RAW — sanitizePromptLine is retired, newlines survive (p8k4d retires aw-038)', () => {
  const bar = barSrc();
  assert.doesNotMatch(boardSrc, /function sanitizePromptLine/, 'the sanitizePromptLine function definition must be removed from board.js');
  assert.doesNotMatch(bar, /setPrompt\(sanitizePromptLine\(/, 'onChange must no longer call the retired sanitizePromptLine');
  assert.match(bar, /const onPromptChange = useCallback\(\(e\) => \{[\s\S]*?setPrompt\(e\.target\.value\)/, 'onChange must feed setPrompt the raw, unsanitized value');
});

test('the aw-038 single-logical-line doc comment is rewritten to describe a genuinely multi-line field (p8k4d)', () => {
  assert.doesNotMatch(boardSrc, /SINGLE-LOGICAL-LINE/, 'the retired single-line framing must not remain in the doc comment');
  assert.match(boardSrc, /multi-line/i, 'the doc comment must describe the field as multi-line');
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

// infrastructure-c6fzb: every prompt-bar launch now carries a mode-derived
// session `name`, so the terminal tab / `/resume` picker entry stop reading
// "Claude" for dashboard-launched sessions.
test('fire() derives a session name via nameForPromptMode and threads it into launchOrCopy (infrastructure-c6fzb)', () => {
  assert.match(
    boardSrc,
    /import\s*\{[^}]*nameForPromptMode[^}]*\}\s*from\s*"\.\/prompt-mode\.js"/,
    'board.js must import nameForPromptMode from prompt-mode.js',
  );
  const bar = barSrc();
  const fireFn = bar.match(/const fire = useCallback\(\(modeIndex\) => \{[\s\S]*?\}, \[[^\]]*\]\);/)[0];
  assert.match(fireFn, /const name = nameForPromptMode\(idx,\s*prompt\)/, 'fire() must derive the name from the fired mode + live prompt');
  assert.match(fireFn, /launchOrCopy\(\{[^}]*name[^}]*\}\)/, 'fire() must pass the derived name into launchOrCopy');
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

// --- agentic-workflow-m3vhq: Plain mode + decline-to-launch,
// generalized to every mode by agentic-workflow-aqyqd -------------------

test('BoardPromptBar imports canFirePromptMode from prompt-mode.js (agentic-workflow-m3vhq)', () => {
  assert.match(
    boardSrc,
    /import\s*\{[^}]*canFirePromptMode[^}]*\}\s*from\s*"\.\/prompt-mode\.js"/,
    'board.js must import canFirePromptMode from prompt-mode.js',
  );
});

test('fire() early-returns before launchOrCopy when canFirePromptMode is false — no bridge call, no clipboard, no confetti, no reset (agentic-workflow-m3vhq)', () => {
  const bar = barSrc();
  const fireFn = bar.match(/const fire = useCallback\(\(modeIndex\) => \{[\s\S]*?\}, \[[^\]]*\]\);/);
  assert.ok(fireFn, 'fire must exist');
  assert.match(fireFn[0], /canFirePromptMode\(/, 'fire must consult the shared canFirePromptMode predicate');
  const guardIdx = fireFn[0].indexOf('canFirePromptMode(');
  const launchIdx = fireFn[0].indexOf('launchOrCopy(');
  assert.ok(guardIdx !== -1 && launchIdx !== -1 && guardIdx < launchIdx,
    'the canFirePromptMode guard must run BEFORE launchOrCopy, so a decline never bridges, copies, or confettis');
});

test('the split button renders disabled exactly when canFirePromptMode(highlightedMode, prompt) is false, via the unforked disabled prop — for ANY highlighted mode, legacy or Plain (agentic-workflow-m3vhq, widened by agentic-workflow-aqyqd, ModelSplitButton since agentic-workflow-m2vkp)', () => {
  const bar = barSrc();
  assert.match(bar, /canFirePromptMode\(highlightedMode,\s*prompt\)/, 'BoardPromptBar must consult the shared predicate for the button state');
  const splitButton = bar.match(/<\$\{ModelSplitButton\}[\s\S]*?\/>/);
  assert.ok(splitButton, 'a ModelSplitButton must exist');
  assert.match(splitButton[0], /disabled=\$\{!canFire\}/, 'the disabled prop must be forwarded to ModelSplitButton');
  assert.doesNotMatch(bar, /pointer-events:\s*["']none["']/, 'a disabled split button must never be faked with a pointer-events wrapper');
});

// agentic-workflow-aqyqd (third ADR-0050 amendment): the decline-to-launch
// guard generalizes from Plain alone to EVERY mode — a legacy mode
// (e.g. Modeling) highlighted with a blank prompt must ALSO render the Enter
// button disabled. Since this suite has no DOM render harness (see file
// header), the check is structural: `canFirePromptMode(highlightedMode,
// prompt)` (asserted above) is computed from `highlightedMode` alone — it is
// never re-derived per mode id/index, so the SAME disabled expression governs
// every mode, legacy or Plain, by construction rather than by a per-mode
// branch a reader could miss.
test('the disabled-Enter guard is NOT scoped to Plain — board.js contains no per-mode requiresPrompt check or mode-id branch, so a legacy mode highlighted with a blank prompt disables the Enter button exactly like Plain did (agentic-workflow-aqyqd)', () => {
  assert.doesNotMatch(boardSrc, /requiresPrompt/, 'requiresPrompt is retired; board.js must not special-case any one mode for the decline gate');
  assert.doesNotMatch(boardSrc, /activeMode\.id === ['"]plain['"]/, 'the decline gate must not branch on Plain\'s id — it must be uniform across all five modes');
});

test('the Enter affordance\'s title/aria-label never render an empty command string — Plain + blank prompt reads "Type a prompt to launch Plain" (agentic-workflow-m3vhq)', () => {
  const bar = barSrc();
  assert.match(bar, /Type a prompt to launch \$\{activeMode\.label\}/, 'the decline-hint text must read "Type a prompt to launch <Mode>"');
  assert.doesNotMatch(
    bar,
    /title=\$\{`Launch \$\{activeMode\.label\} — \$\{activeMode\.commandFor\(prompt\)\}`\}/,
    'the wrapper title must no longer unconditionally render the (possibly empty) command string',
  );
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

// agentic-workflow-spv0k: the Launched/Copied flash must anchor to the mode
// that actually FIRED, never to wherever the ADR-0050 success-reset leaves
// `highlightedMode` (Quick Capture, index 0). Firing Modeling (or any
// non-default mode) used to paint the flash on Quick Capture, because
// PromptModeTab derived `flashed` from `highlighted && feedback !== "idle"`
// and onResult's `setHighlightedMode(DEFAULT_PROMPT_MODE_INDEX)` batched into
// the same re-render as the feedback update. The fix introduces a
// `firedMode` index, captured at fire time, that the flash reads instead.

test('BoardPromptBar owns a firedMode index, captured in fire() before/alongside the feedback update, separate from highlightedMode (agentic-workflow-spv0k)', () => {
  const bar = barSrc();
  assert.match(bar, /const \[firedMode, setFiredMode\] = useState\(null\);/,
    'a firedMode state, distinct from highlightedMode, must exist');
  const fireFn = bar.match(/const fire = useCallback\(\(modeIndex\) => \{[\s\S]*?\}, \[[^\]]*\]\);/);
  assert.ok(fireFn, 'fire must exist');
  assert.match(fireFn[0], /setFiredMode\(idx\)/, 'fire() must record the mode index that actually fired');
  // firedMode must be set alongside (not after) the feedback word, in the SAME
  // branch that sets "launched"/"copied" — never unconditionally before the
  // bridge/clipboard outcome is known, so a fully-silent action cannot leak a
  // stale firedMode into a later flash.
  const launchedBranch = fireFn[0].match(/if\s*\(res\.via === "bridge"\)\s*\{[^}]*\}/);
  assert.ok(launchedBranch, 'the bridge-success branch must exist');
  assert.match(launchedBranch[0], /setFiredMode\(idx\)/, 'the bridge-success branch must set firedMode');
  assert.match(launchedBranch[0], /setFeedback\("launched"\)/, 'the bridge-success branch must set feedback to "launched"');
  const copiedBranch = fireFn[0].match(/else if\s*\(res\.copied\)\s*\{[^}]*\}/);
  assert.ok(copiedBranch, 'the clipboard-success branch must exist');
  assert.match(copiedBranch[0], /setFiredMode\(idx\)/, 'the clipboard-success branch must set firedMode');
  assert.match(copiedBranch[0], /setFeedback\("copied"\)/, 'the clipboard-success branch must set feedback to "copied"');
});

test('each PromptModeTab receives `flashed` keyed to firedMode === index, not to highlightedMode === index (agentic-workflow-spv0k)', () => {
  const bar = barSrc();
  assert.match(bar, /flashed=\$\{firedMode === index && feedback !== "idle"\}/,
    'the flash must be keyed to firedMode, the fired index — never to the highlighted index');
});

test('PromptModeTab takes `flashed` as a prop and no longer derives it from `highlighted && feedback !== "idle"` (agentic-workflow-spv0k)', () => {
  const tab = tabSrc();
  assert.match(tab, /function PromptModeTab\(\{[^}]*\bflashed\b[^}]*\}\)/, 'flashed must be a destructured prop');
  assert.doesNotMatch(tab, /const flashed = highlighted && feedback !== "idle";/,
    'PromptModeTab must not re-derive flashed from highlighted — that conflation is the bug this task fixes');
});

// agentic-workflow-m2vkp retires the success-reset spv0k's fix was written
// against — the highlight now survives a launch entirely (see the earlier
// "highlight SURVIVES a successful launch" test). The firedMode/flash
// independence this test locks down still holds, now simply because they are
// two separate pieces of state, not because a reset would otherwise conflate
// them.
test('firing a non-default mode (index > 0) flashes on THAT tab — firedMode is independent of highlightedMode, which no longer resets at all (agentic-workflow-spv0k, reset retired by agentic-workflow-m2vkp)', () => {
  const bar = barSrc();
  const onResultFn = bar.match(/const onResult = useCallback\(\(res\) => \{[\s\S]*?\}, \[\]\);/)[0];
  // onResult itself never touches firedMode OR highlightedMode any more —
  // only fire()'s own success branches set firedMode, at the index that
  // actually launched.
  assert.doesNotMatch(onResultFn, /setFiredMode/,
    'onResult must not set firedMode — only fire() may, at the index that actually launched');
  assert.doesNotMatch(onResultFn, /setHighlightedMode/,
    'onResult must not touch highlightedMode either — both selection channels survive a launch (agentic-workflow-m2vkp)');
  // Structurally: the tab's flash prop reads firedMode, and firedMode is only
  // ever assigned the fired `idx`, never DEFAULT_PROMPT_MODE_INDEX — so firing
  // Modeling (index > 0) paints the flash on Modeling's cell.
  const fireFn = bar.match(/const fire = useCallback\(\(modeIndex\) => \{[\s\S]*?\}, \[[^\]]*\]\);/)[0];
  assert.doesNotMatch(fireFn, /setFiredMode\(DEFAULT_PROMPT_MODE_INDEX\)/,
    'fire() must key firedMode to the actual fired idx, never hardcode it back to Quick Capture');
});

test('a declined launch (blank prompt) sets neither firedMode nor feedback — no flash on any tab (agentic-workflow-aqyqd invariant, re-pinned for firedMode)', () => {
  const bar = barSrc();
  const fireFn = bar.match(/const fire = useCallback\(\(modeIndex\) => \{[\s\S]*?\}, \[[^\]]*\]\);/)[0];
  const guardIdx = fireFn.indexOf('canFirePromptMode(');
  const firedModeIdx = fireFn.indexOf('setFiredMode(');
  assert.ok(guardIdx !== -1 && firedModeIdx !== -1 && guardIdx < firedModeIdx,
    'the canFirePromptMode decline guard must run before any setFiredMode call, so a decline sets firedMode on no tab');
});

// --- agentic-workflow-m2vkp: the model selector -------------------------
//
// One launch control, not two: the ochre split button now also names the
// session's model. `dashboard/app/prompt-model.js` carries the pure judgment
// (covered directly in prompt-model.test.mjs); this suite locks the board's
// WIRING of that module — the parts that are not pure logic.

test('BoardPromptBar imports the model axis from prompt-model.js and probeBridge from bridge-launch.js', () => {
  assert.match(
    boardSrc,
    /import\s*\{[^}]*PROMPT_MODELS[^}]*DEFAULT_PROMPT_MODEL_INDEX[^}]*nextPromptModelIndex[^}]*isModelLockedForMode[^}]*modelForMode[^}]*\}\s*from\s*"\.\/prompt-model\.js"/,
    'board.js must import PROMPT_MODELS / DEFAULT_PROMPT_MODEL_INDEX / nextPromptModelIndex / isModelLockedForMode / modelForMode from prompt-model.js',
  );
  assert.match(
    boardSrc,
    /import\s*\{[^}]*launchOrCopy[^}]*probeBridge[^}]*\}\s*from\s*"\.\/bridge-launch\.js"/,
    'board.js must import probeBridge alongside launchOrCopy from bridge-launch.js',
  );
});

test('BoardPromptBar owns a selectedModel index, defaulting to DEFAULT_PROMPT_MODEL_INDEX (Opus)', () => {
  const bar = barSrc();
  assert.match(bar, /const \[selectedModel, setSelectedModel\] = useState\(DEFAULT_PROMPT_MODEL_INDEX\)/,
    'selectedModel must default via DEFAULT_PROMPT_MODEL_INDEX, mirroring highlightedMode/DEFAULT_PROMPT_MODE_INDEX');
});

test('BoardPromptBar probes the bridge on mount via probeBridge and tracks bridgePresent', () => {
  const bar = barSrc();
  assert.match(bar, /const \[bridgePresent, setBridgePresent\] = useState\(false\)/, 'bridgePresent must default to false');
  assert.match(bar, /probeBridge\(fetchImpl\)\.then\(/, 'a mount effect must call probeBridge');
  assert.match(bar, /setBridgePresent\(/, 'the probe result must update bridgePresent');
});

test('modelLocked is true when the bridge is absent OR the highlighted mode is Quick Capture', () => {
  const bar = barSrc();
  assert.match(bar, /const modelLocked = !bridgePresent \|\| isModelLockedForMode\(highlightedMode\)/,
    'modelLocked must OR bridge-absence with the Quick Capture pin, never re-deriving either independently');
});

test('fire() resolves the model via modelForMode and threads it into launchOrCopy as `model`', () => {
  const bar = barSrc();
  const fireFn = bar.match(/const fire = useCallback\(\(modeIndex\) => \{[\s\S]*?\}, \[[^\]]*\]\);/)[0];
  assert.match(fireFn, /const model = PROMPT_MODELS\[modelForMode\(idx,\s*selectedModel\)\]\.id/,
    'fire() must resolve the model id via modelForMode(idx, selectedModel) — the ONE resolver');
  assert.match(fireFn, /launchOrCopy\(\{[^}]*model[^}]*\}\)/, 'fire() must pass the resolved model id into launchOrCopy');
});

test('the split button renders locked exactly when modelLocked, and never renders both locked and a real model name for Quick Capture unless the bridge is present', () => {
  const bar = barSrc();
  const splitButton = bar.match(/<\$\{ModelSplitButton\}[\s\S]*?\/>/)[0];
  assert.match(splitButton, /locked=\$\{modelLocked\}/, 'the locked prop must be wired to modelLocked');
  assert.match(splitButton, /label=\$\{modelLabel\}/, 'the label prop must be wired to the resolved modelLabel');
  assert.match(splitButton, /options=\$\{PROMPT_MODELS\.map\(/, 'the options prop must be derived from PROMPT_MODELS');
  assert.match(splitButton, /onSelect=\$\{onSelectModel\}/, 'the onSelect prop must be wired');
});

test('with no bridge reachable, the resolved label names no model ("Default") regardless of mode/selection', () => {
  const bar = barSrc();
  assert.match(bar, /const modelLabel = bridgePresent \? resolvedModel\.label : "Default"/,
    'modelLabel must fall back to a name that names no real model when the bridge is absent');
});

test('Ctrl+M cycles selectedModel via nextPromptModelIndex, both field-focused (onPromptKeyDown/CYCLE_MODEL) and window-scoped (like Ctrl+Space) — a no-op when modelLocked', () => {
  const bar = barSrc();
  // Field-focused: the CYCLE_MODEL branch inside onPromptKeyDown.
  const keyDownFn = bar.match(/const onPromptKeyDown = useCallback\(\(e\) => \{[\s\S]*?\}, \[fire, highlightedMode, modelLocked\]\);/)[0];
  assert.match(keyDownFn, /PROMPT_KEY_INTENT\.CYCLE_MODEL/, 'onPromptKeyDown must branch on the CYCLE_MODEL intent');
  const cycleModelBlock = keyDownFn.match(/PROMPT_KEY_INTENT\.CYCLE_MODEL\)\s*\{[\s\S]*?\n\s*\}/)[0];
  assert.match(cycleModelBlock, /if\s*\(modelLocked\)\s*return/, 'the CYCLE_MODEL branch must no-op when modelLocked');
  assert.match(cycleModelBlock, /setSelectedModel\(\(current\)\s*=>\s*nextPromptModelIndex\(current,\s*1\)\)/,
    'the CYCLE_MODEL branch must cycle selectedModel via nextPromptModelIndex');
  assert.doesNotMatch(cycleModelBlock, /fire\(/, 'cycling the model must never launch anything');
  // Window-scoped: the same document keydown listener that handles Ctrl+Space.
  const windowListenerFn = bar.match(/function onWindowKeyDown\(e\) \{[\s\S]*?\n    \}\s*document\.addEventListener/)[0];
  assert.match(windowListenerFn, /["'][mM]["']/, 'the window-scoped listener must also check for the m/M key');
  assert.match(windowListenerFn, /if\s*\(modelLocked\)\s*return/, 'the window-scoped Ctrl+M must also no-op when modelLocked');
  assert.match(windowListenerFn, /setSelectedModel\(/, 'the window-scoped listener must cycle selectedModel too');
});

// Iteration 1 verification caught: the window-scoped listener above hand-rolled
// its own Ctrl+M check with NO guard against the field already owning the same
// keystroke, so a Ctrl+M pressed while the prompt field was focused was handled
// TWICE (field's onPromptKeyDown AND this window listener, since the native
// event still bubbles to `document` under React's createRoot) — stepping
// selectedModel by two instead of one. This test locks the WIRING of the fix:
// the window listener must consult `shouldWindowCtrlMHandle` (prompt-model.js's
// mutual-exclusion guard, behaviorally proven in prompt-model.test.mjs) and
// bail out before touching selectedModel when the field already owns the
// keystroke. The actual "advances by exactly one" invariant is NOT
// approximated by regex here — see prompt-model.test.mjs's
// 'a single Ctrl+M keydown advances selectedModel by exactly one ...' test,
// which drives the real exported functions (promptBarKeyIntent,
// shouldWindowCtrlMHandle, nextPromptModelIndex) through the same two-path
// scenario and asserts the net step.
test('the window-scoped Ctrl+M branch consults shouldWindowCtrlMHandle before acting, so a keystroke the field already owns is never double-handled', () => {
  const bar = barSrc();
  assert.match(
    boardSrc,
    /import\s*\{[^}]*shouldWindowCtrlMHandle[^}]*\}\s*from\s*"\.\/prompt-model\.js"/,
    'board.js must import shouldWindowCtrlMHandle from prompt-model.js',
  );
  const windowListenerFn = bar.match(/function onWindowKeyDown\(e\) \{[\s\S]*?\n    \}\s*document\.addEventListener/)[0];
  const ctrlMBlock = windowListenerFn.match(/\(e\.key === "m" \|\| e\.key === "M"\)\)\s*\{[\s\S]*?\n      \}/)[0];
  assert.match(
    ctrlMBlock,
    /if\s*\(!shouldWindowCtrlMHandle\(e,\s*textareaRef\.current\)\)\s*return;/,
    'the window-scoped Ctrl+M branch must bail out via shouldWindowCtrlMHandle BEFORE preventDefault/setSelectedModel, so the field-focused case is left entirely to onPromptKeyDown',
  );
  // The guard must run before preventDefault/modelLocked/setSelectedModel, not after.
  const guardIndex = ctrlMBlock.indexOf('shouldWindowCtrlMHandle');
  const preventDefaultIndex = ctrlMBlock.indexOf('preventDefault');
  assert.ok(guardIndex >= 0 && preventDefaultIndex >= 0 && guardIndex < preventDefaultIndex,
    'the mutual-exclusion guard must be checked before preventDefault/setSelectedModel');
});

test('the window-scoped keydown effect depends on [modelLocked] so its Ctrl+M branch always reads the current lock state', () => {
  const bar = barSrc();
  assert.match(bar, /document\.addEventListener\("keydown", onWindowKeyDown\);\s*return \(\) => document\.removeEventListener\("keydown", onWindowKeyDown\);\s*\}, \[modelLocked\]\);/,
    'the window-scoped listener effect must depend on [modelLocked]');
});

test('the split button tooltip/aria-label carries the Enter-launches/Shift+Enter-newline affordance that used to live in the deleted ↵ hint span', () => {
  const bar = barSrc();
  assert.match(bar, /const splitButtonTitle = `[^`]*Enter launches[^`]*Shift\+Enter[^`]*`/,
    'the split button\'s title must fold in the old ↵ hint\'s "Enter launches / Shift+Enter for a new line" copy');
  assert.match(bar, /<span title=\$\{splitButtonTitle\}>/, 'the split button must be wrapped in a title tooltip span');
});
