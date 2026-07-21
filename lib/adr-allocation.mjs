// adr-allocation — collision-proof ADR number allocation (ADR-0058,
// agentic-workflow-hmgav).
//
// Why this exists: manual ADR numbering ("look at existing ADRs, pick the
// next number") is exactly the single-writer-owning-a-global-counter
// assumption ADR-0028 already diagnosed and fixed for task ids. Under
// ADR-0032's per-worker worktree isolation a worker's own guess at the next
// free ADR number can never see a sibling worker's freshly-minted-but-not-
// yet-merged ADR in its own worktree — two workers can guess the same
// number, and a bounced/failed task's guessed number can (under the OLD,
// unmechanized convention) leave a permanent hole if nobody records it was
// abandoned.
//
// The fix mirrors ADR-0042's "composition owned by the caller at the
// squash-merge boundary" shape rather than ADR-0028's random-token answer:
// ADR-0032 already establishes that `main` is written only by the
// conductor, only sequentially — that single-threaded choke point is where
// a number can be assigned authoritatively with zero coordination cost,
// while still keeping the human-readable ordinal convention ADR ids have
// always had (unlike task ids, which gave that up in ADR-0028).
//
// Two functions, matching the two moments in the choreography:
//   - `nextAdrNumber` — a PROVISIONAL mint, called by a worker inside its own
//     worktree (or by any direct-commit skill) when it first writes an ADR
//     file. This is just "look at the decisions dir and pick max + 1",
//     mechanized instead of eyeballed — the guess is not authoritative.
//   - `finalizeAdrNumbering` — the FINAL, authoritative assignment, called by
//     the conductor against `main`'s true `decisions/` state, after a
//     worker's squash-merge has staged its ADR file(s) into the working tree
//     but BEFORE the integrating `git add`/commit. Recomputes the true
//     next-free number(s) and renumbers (filename + frontmatter `id:` +
//     H1 heading) whenever the provisional number turns out wrong — whether
//     because a sibling already landed it (collision) or because the guess
//     was too high (a gap). A discarded provisional file (FAIL/BOUNCE,
//     ADR-0032 quarantine) is simply never passed to this function, so it
//     never consumes a slot on `main` and leaves no hole by construction.
//
// Git-free (ADR-0038): never shells out to `git`. Plain fs reads/writes only,
// exactly like `applyTaskMove`'s move-on-disk. Makes no judgment call beyond
// "what is the true next-free number" — the caller decides WHEN to invoke it
// and what to do with the returned manifest (ADR-0038 Ruling B, layer 2/3
// split).

import fs from 'node:fs';
import path from 'node:path';

const ADR_FILENAME_RE = /^(\d{4})-(.+)\.md$/;

/** List every well-formed `NNNN-slug.md` entry in a decisions dir. Loss-tolerant. */
function listAdrEntries(decisionsDir) {
  if (!fs.existsSync(decisionsDir)) return [];
  let names;
  try {
    names = fs.readdirSync(decisionsDir);
  } catch {
    return [];
  }
  const out = [];
  for (const name of names) {
    const m = ADR_FILENAME_RE.exec(name);
    if (m) out.push({ number: parseInt(m[1], 10), slug: m[2], filename: name });
  }
  return out;
}

/**
 * A PROVISIONAL next ADR number — the current highest `NNNN-*.md` in
 * `decisionsDir` plus one, zero-padded to 4 digits. Not authoritative: it is
 * a local guess against whatever `decisionsDir` looks like at the moment of
 * the call (a worker's own worktree, mid-batch). The conductor's
 * `finalizeAdrNumbering` is the authority.
 *
 * @param {string} decisionsDir Absolute path to `.agentheim/knowledge/decisions/`.
 * @returns {string} Zero-padded 4-digit number, e.g. `'0058'`.
 */
export function nextAdrNumber(decisionsDir) {
  const entries = listAdrEntries(decisionsDir);
  const max = entries.reduce((m, e) => Math.max(m, e.number), 0);
  return String(max + 1).padStart(4, '0');
}

/** Replace the frontmatter `id:` line's digits, preserving whatever prefix it had (`ADR-` or bare). */
function rewriteFrontmatterId(content, oldPadded, newPadded) {
  return content.replace(
    /^(id:\s*(?:ADR-)?)(\d{4})(\s*)$/m,
    (full, pre, num, post) => (num === oldPadded ? `${pre}${newPadded}${post}` : full)
  );
}

/** Replace the first `# ADR[- ]NNNN` H1 heading's digits, preserving its exact prefix style. */
function rewriteHeading(content, oldPadded, newPadded) {
  return content.replace(
    /^(#\s*ADR[- ]?)(\d{4})(:?.*)$/m,
    (full, pre, num, rest) => (num === oldPadded ? `${pre}${newPadded}${rest}` : full)
  );
}

/** Append a short, machine-generated trail note so a stale cross-reference elsewhere still resolves to this file. */
function appendRenumberNote(content, oldPadded, newPadded) {
  const note =
    `\n## Note on ADR numbering\n\n` +
    `Minted provisionally as ADR-${oldPadded} in its worker worktree. A sibling task's ADR ` +
    `already claimed that number (or the guess overshot the true count) by the time this task's ` +
    `conductor finalized numbering at squash-merge integration (\`lib/adr-allocation.mjs\`'s ` +
    `\`finalizeAdrNumbering\`, ADR-0058) — this ADR was renumbered to **ADR-${newPadded}**, the ` +
    `true next-free number on \`main\` at that moment. No content besides this identity changed.\n`;
  return content.replace(/\s*$/, '') + '\n' + note;
}

/**
 * The AUTHORITATIVE, conductor-only finalize step (ADR-0058). Call this
 * against `main`'s real `decisionsDir` after a worker's squash-merge has
 * staged its ADR file(s) onto the working tree, but BEFORE the integrating
 * `git add`/commit. `provisionalFilenames` are the basenames (in
 * `decisionsDir`) of the ADR file(s) this one task just contributed, in the
 * order they should be assigned if more than one.
 *
 * Every OTHER `NNNN-*.md` file already in `decisionsDir` is treated as
 * already-final (true by ADR-0032's single-threaded-sequential-`main`-writer
 * invariant: any earlier same-batch task's ADR has already been finalized
 * and committed by the time this call runs). The provisional file(s) are
 * assigned sequential numbers starting at that true max + 1, REGARDLESS of
 * what number they currently carry — a collision (a sibling already used the
 * guessed number) and an over-guess (leaving a gap) are corrected by the
 * same uniform rule, so `main`'s ADR sequence is always contiguous and two
 * parallel workers can never end up with the same final number.
 *
 * Git-free: performs plain fs rename + content rewrite only, never shells
 * out to `git`. Returns an enumerated manifest for the caller's scoped
 * `git add` (ADR-0026 / ADR-0038), mirroring `applyTaskMove`'s
 * `changed: [fromPath, toPath]` convention for a rename.
 *
 * @param {string} decisionsDir Absolute path to `.agentheim/knowledge/decisions/` on `main`.
 * @param {string[]} provisionalFilenames Basenames of this task's just-staged ADR file(s).
 * @returns {{changed: string[], renumbered: Array<{from:string,to:string,oldFilename:string,newFilename:string}>}}
 */
export function finalizeAdrNumbering(decisionsDir, provisionalFilenames) {
  const entries = listAdrEntries(decisionsDir);
  const provisionalSet = new Set(provisionalFilenames);
  const existingMax = entries
    .filter((e) => !provisionalSet.has(e.filename))
    .reduce((m, e) => Math.max(m, e.number), 0);

  const changed = [];
  const renumbered = [];
  let cursor = existingMax;

  for (const filename of provisionalFilenames) {
    cursor += 1;
    const entry = entries.find((e) => e.filename === filename);
    if (!entry) {
      throw new Error(`finalizeAdrNumbering: provisional file not found in ${decisionsDir}: ${filename}`);
    }

    const oldNumber = entry.number;
    const newNumber = cursor;
    if (oldNumber === newNumber) continue; // already correct — no-op, nothing to change

    const oldPadded = String(oldNumber).padStart(4, '0');
    const newPadded = String(newNumber).padStart(4, '0');
    const oldPath = path.join(decisionsDir, filename);
    const newFilename = `${newPadded}-${entry.slug}.md`;
    const newPath = path.join(decisionsDir, newFilename);

    const original = fs.readFileSync(oldPath, 'utf8');
    let updated = rewriteFrontmatterId(original, oldPadded, newPadded);
    updated = rewriteHeading(updated, oldPadded, newPadded);
    updated = appendRenumberNote(updated, oldPadded, newPadded);

    fs.writeFileSync(newPath, updated);
    fs.unlinkSync(oldPath);

    changed.push(oldPath, newPath);
    renumbered.push({
      from: `ADR-${oldPadded}`,
      to: `ADR-${newPadded}`,
      oldFilename: filename,
      newFilename,
    });
  }

  return { changed, renumbered };
}
