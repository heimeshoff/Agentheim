import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  parseUnmergedPaths,
  parsePorcelainStatus,
  unmergedFromPorcelain,
  buildAllowList,
  findAdrNumberGuardHits,
  isResolved,
  conflictStateFromNameOnly,
  conflictStateFromPorcelain,
  buildResolveDispatchPrompt,
  createLadderState,
  onMergeBackConflict,
  decideAfterVerifierVerdict,
  onWorktreeTeardown,
} from '../merge-conflict-ladder.mjs';

// ---- parseUnmergedPaths ----

test('parseUnmergedPaths: splits diff --name-only --diff-filter=U output into trimmed, non-empty paths', () => {
  const out = 'src/a.mjs\nREADME.md\n\n';
  assert.deepEqual(parseUnmergedPaths(out), ['src/a.mjs', 'README.md']);
});

test('parseUnmergedPaths: empty output yields an empty list', () => {
  assert.deepEqual(parseUnmergedPaths(''), []);
  assert.deepEqual(parseUnmergedPaths('\n\n'), []);
});

test('parseUnmergedPaths: throws on a non-string input', () => {
  assert.throws(() => parseUnmergedPaths(undefined), TypeError);
  assert.throws(() => parseUnmergedPaths(null), TypeError);
});

// ---- parsePorcelainStatus / unmergedFromPorcelain ----

test('parsePorcelainStatus: parses XY code + path pairs', () => {
  const out = 'UU src/a.mjs\nAA .agentheim/knowledge/decisions/0072-x.md\n M README.md\n?? scratch.txt\n';
  assert.deepEqual(parsePorcelainStatus(out), [
    { path: 'src/a.mjs', code: 'UU' },
    { path: '.agentheim/knowledge/decisions/0072-x.md', code: 'AA' },
    { path: 'README.md', code: ' M' },
    { path: 'scratch.txt', code: '??' },
  ]);
});

test('parsePorcelainStatus: reduces a rename arrow to the NEW path', () => {
  const out = 'R  old-name.txt -> new-name.txt\n';
  assert.deepEqual(parsePorcelainStatus(out), [{ path: 'new-name.txt', code: 'R ' }]);
});

test('unmergedFromPorcelain: keeps only genuinely unmerged XY codes', () => {
  const out = 'UU src/a.mjs\n M README.md\nAA .agentheim/knowledge/decisions/0072-x.md\n?? scratch.txt\nDU deleted-by-us.txt\n';
  assert.deepEqual(unmergedFromPorcelain(out), [
    { path: 'src/a.mjs', code: 'UU' },
    { path: '.agentheim/knowledge/decisions/0072-x.md', code: 'AA' },
    { path: 'deleted-by-us.txt', code: 'DU' },
  ]);
});

// ---- buildAllowList ----

test('buildAllowList: dedupes and sorts', () => {
  assert.deepEqual(buildAllowList(['b.txt', 'a.txt', 'b.txt']), ['a.txt', 'b.txt']);
});

test('buildAllowList: throws on a non-array', () => {
  assert.throws(() => buildAllowList('a.txt'), TypeError);
});

// ---- findAdrNumberGuardHits ----

test('findAdrNumberGuardHits: flags AA entries under knowledge/decisions/, ignores others', () => {
  const entries = [
    { path: '.agentheim/knowledge/decisions/0072-x.md', code: 'AA' },
    { path: '.agentheim/knowledge/decisions/0072-y.md', code: 'UU' }, // AA-shaped path, wrong code
    { path: 'src/a.mjs', code: 'AA' }, // AA code, wrong path
  ];
  assert.deepEqual(findAdrNumberGuardHits(entries), [{ path: '.agentheim/knowledge/decisions/0072-x.md', code: 'AA' }]);
});

test('findAdrNumberGuardHits: empty when nothing matches', () => {
  assert.deepEqual(findAdrNumberGuardHits([{ path: 'src/a.mjs', code: 'UU' }]), []);
});

// ---- isResolved ----

test('isResolved: true only for an empty allow-list', () => {
  assert.equal(isResolved([]), true);
  assert.equal(isResolved(['a.txt']), false);
});

// ---- conflictStateFromNameOnly / conflictStateFromPorcelain ----

test('conflictStateFromNameOnly: resolved when the diff-filter=U output is empty', () => {
  assert.deepEqual(conflictStateFromNameOnly(''), { allowList: [], adrGuardHits: [], resolved: true });
});

test('conflictStateFromNameOnly: unresolved with the allow-list, no ADR guard info from this format', () => {
  assert.deepEqual(conflictStateFromNameOnly('src/a.mjs\nREADME.md\n'), {
    allowList: ['README.md', 'src/a.mjs'],
    adrGuardHits: [],
    resolved: false,
  });
});

test('conflictStateFromPorcelain: resolved when no unmerged entries remain', () => {
  const out = ' M README.md\n?? scratch.txt\n';
  assert.deepEqual(conflictStateFromPorcelain(out), { allowList: [], adrGuardHits: [], resolved: true });
});

test('conflictStateFromPorcelain: unresolved, allow-list from unmerged entries, AA-under-decisions/ flagged', () => {
  const out = 'UU src/a.mjs\nAA .agentheim/knowledge/decisions/0072-x.md\n M README.md\n';
  const state = conflictStateFromPorcelain(out);
  assert.deepEqual(state.allowList, ['.agentheim/knowledge/decisions/0072-x.md', 'src/a.mjs']);
  assert.deepEqual(state.adrGuardHits, [{ path: '.agentheim/knowledge/decisions/0072-x.md', code: 'AA' }]);
  assert.equal(state.resolved, false);
});

// ---- buildResolveDispatchPrompt ----

const BASE_DISPATCH_OPTS = {
  taskId: 'agentic-workflow-pcwnn',
  siblingId: 'agentic-workflow-swj2q',
  siblingSummary: 'argument grammar for /agentheim:work',
  newBaseSha: 'abc1234',
  allowList: ['skills/work/SKILL.md', 'lib/merge-conflict-ladder.mjs'],
  siblingStatScopedToAllowList: 'skills/work/SKILL.md | 12 +++++++--\n1 file changed, 10 insertions(+), 2 deletions(-)',
};

test('buildResolveDispatchPrompt: contains the orientation label (HEAD=yours, main=sibling)', () => {
  const prompt = buildResolveDispatchPrompt(BASE_DISPATCH_OPTS);
  assert.match(prompt, /<<<<<<< HEAD.*is \*your own\* work/s);
  assert.match(prompt, />>>>>>> main.*sibling/s);
});

test('buildResolveDispatchPrompt: contains the authority statement', () => {
  const prompt = buildResolveDispatchPrompt(BASE_DISPATCH_OPTS);
  assert.match(prompt, /may not undo or weaken the sibling's change/);
  assert.match(prompt, /[Bb]oth intents must survive/);
});

test('buildResolveDispatchPrompt: allow-list appears verbatim', () => {
  const prompt = buildResolveDispatchPrompt(BASE_DISPATCH_OPTS);
  for (const p of BASE_DISPATCH_OPTS.allowList) {
    assert.ok(prompt.includes(p), `expected prompt to include allow-listed path ${p}`);
  }
});

test('buildResolveDispatchPrompt: no git command instructs the worker to run anything', () => {
  const prompt = buildResolveDispatchPrompt(BASE_DISPATCH_OPTS);
  assert.doesNotMatch(prompt, /\bgit [a-z-]+/);
});

test('buildResolveDispatchPrompt: also carries the sibling id/summary and new base SHA', () => {
  const prompt = buildResolveDispatchPrompt(BASE_DISPATCH_OPTS);
  assert.ok(prompt.includes(BASE_DISPATCH_OPTS.siblingId));
  assert.ok(prompt.includes(BASE_DISPATCH_OPTS.siblingSummary));
  assert.ok(prompt.includes(BASE_DISPATCH_OPTS.newBaseSha));
});

test('buildResolveDispatchPrompt: throws on a missing/empty required field', () => {
  assert.throws(() => buildResolveDispatchPrompt({ ...BASE_DISPATCH_OPTS, taskId: '' }), TypeError);
  assert.throws(() => buildResolveDispatchPrompt({ ...BASE_DISPATCH_OPTS, allowList: [] }), TypeError);
  assert.throws(() => buildResolveDispatchPrompt({ ...BASE_DISPATCH_OPTS, allowList: undefined }), TypeError);
});

// ---- Budget arithmetic ----

test('createLadderState: fresh state has not used the ladder', () => {
  assert.deepEqual(createLadderState(), { ladderUsedThisWorktree: false });
});

test('a resolve dispatch leaves the FAIL iteration unchanged', () => {
  let iteration = 2; // whatever the task's FAIL-iteration counter already was
  const state = createLadderState();
  const { decision, state: nextState } = onMergeBackConflict(state);
  assert.equal(decision, 'dispatch-resolve');
  assert.equal(nextState.ladderUsedThisWorktree, true);
  assert.equal(iteration, 2); // untouched — onMergeBackConflict never sees or mutates it
});

test('a second conflict on the same worktree returns escalate without a dispatch', () => {
  const usedState = { ladderUsedThisWorktree: true };
  const { decision, state } = onMergeBackConflict(usedState);
  assert.equal(decision, 'escalate');
  assert.equal(state.ladderUsedThisWorktree, true); // still spent, no new dispatch fired
});

test('onMergeBackConflict: throws on a malformed state', () => {
  assert.throws(() => onMergeBackConflict(undefined), TypeError);
  assert.throws(() => onMergeBackConflict({}), TypeError);
});

test('a post-resolve FAIL continues the FAIL counter from its prior value, with cap 3', () => {
  // The task was already on iteration 2 (one prior FAIL) before the merge conflict fired;
  // dispatching the resolve never touched that counter (previous test). Now the re-verify
  // after resolution FAILs — continue from 2, not reset to 1.
  const result = decideAfterVerifierVerdict(2, 'FAIL');
  assert.deepEqual(result, { decision: 're-dispatch', nextIteration: 3 });
});

test('decideAfterVerifierVerdict: iteration 3 FAIL escalates (cap reached)', () => {
  assert.deepEqual(decideAfterVerifierVerdict(3, 'FAIL'), { decision: 'escalate', nextIteration: 3 });
});

test('decideAfterVerifierVerdict: PASS/SKIP integrate regardless of iteration', () => {
  assert.deepEqual(decideAfterVerifierVerdict(1, 'PASS'), { decision: 'integrate' });
  assert.deepEqual(decideAfterVerifierVerdict(3, 'SKIP'), { decision: 'integrate' });
});

test('decideAfterVerifierVerdict: throws on a bad iteration or verdict', () => {
  assert.throws(() => decideAfterVerifierVerdict(0, 'FAIL'), TypeError);
  assert.throws(() => decideAfterVerifierVerdict(1.5, 'FAIL'), TypeError);
  assert.throws(() => decideAfterVerifierVerdict(1, 'BOGUS'), TypeError);
});

test('teardown resets the ladder counter', () => {
  const usedState = { ladderUsedThisWorktree: true };
  assert.deepEqual(onWorktreeTeardown(usedState), { ladderUsedThisWorktree: false });
});
