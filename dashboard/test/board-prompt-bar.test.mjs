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

test('every launch trigger (bare Enter, Ctrl+Enter, Enter button) routes through the SAME fire() function — tab click does NOT (p8k4d)', () => {
  const bar = barSrc();
  assert.match(bar, /const fire = useCallback\(/, 'a single fire(modeIndex) function must exist');
  assert.match(bar, /launchOrCopy\(/, 'fire must call the shared launchOrCopy bridge-or-clipboard path');
  // Tab click only moves the committed highlight — it must NOT call fire (p8k4d reverses bz3az/ADR-0050).
  const onTabClick = bar.match(/const onTabClick = useCallback\(\(index\) => \{[\s\S]*?\}, \[[^\]]*\]\);/);
  assert.ok(onTabClick, 'onTabClick must exist');
  assert.match(onTabClick[0], /setHighlightedMode\(index\)/, 'clicking a tab must move the committed highlight to it');
  assert.doesNotMatch(onTabClick[0], /fire\(/, 'clicking a tab must NOT launch anything (p8k4d)');
  // Enter button (agentic-workflow-q7r3x: the unforked EnterButton primitive).
  const enterButton = bar.match(/<\$\{EnterButton\}[\s\S]*?\/>/);
  assert.ok(enterButton, 'an EnterButton must exist');
  assert.match(enterButton[0], /onClick=\$\{\(\)\s*=>\s*fire\(highlightedMode\)\}/, 'the Enter button must call fire(highlightedMode)');
  // Bare Enter and Ctrl+Enter (both classify LAUNCH) must also call fire.
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

test('Shift+Enter classifies as NEWLINE via the same promptBarKeyIntent classifier and launches nothing (p8k4d)', () => {
  const bar = barSrc();
  const keyDownFn = bar.match(/const onPromptKeyDown = useCallback\(\(e\) => \{[\s\S]*?\}, \[fire, highlightedMode\]\);/)[0];
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

test('the Enter affordance is the unforked EnterButton primitive (ADR-0003), imported from the styleguide button.js', () => {
  assert.match(
    boardSrc,
    /import\s*\{[^}]*EnterButton[^}]*\}\s*from\s*"[^"]*styleguide\/app\/button\.js"/,
    'board.js must import EnterButton from the styleguide button.js, unforked',
  );
  const bar = barSrc();
  assert.match(bar, /<\$\{EnterButton\}/, 'the input row must render the EnterButton component');
  // The old soft-ochre text "Enter" button markup must be gone — the primitive
  // owns its own paint now (ADR-0003: consumed unforked, not re-styled here).
  assert.doesNotMatch(bar, /var\(--accent-ochre-soft\)/, 'board.js must not re-implement the Enter button\'s ochre-soft fill (unforked primitive)');
  assert.doesNotMatch(bar, />\s*Enter\s*</, 'the old literal "Enter" text button must be gone');
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
  const enterIdx = bar.lastIndexOf('<${EnterButton}');
  assert.ok(tablistIdx !== -1 && textareaIdx !== -1 && enterIdx !== -1, 'all three landmarks must be present');
  assert.ok(tablistIdx < textareaIdx, 'the tab row must render ABOVE the input row');
  assert.ok(textareaIdx < enterIdx, 'the Enter button must render after (beside) the textarea');
  assert.match(bar, />❯</, 'the input row must render the ❯ chevron');
  assert.match(bar, />↵</, 'the input row must render the ↵ keyboard hint (Enter is now the primary trigger, p8k4d)');
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
