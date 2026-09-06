// Unit tests for the write-temp-then-rename primitive (agentic-workflow-vhz69).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync, readdirSync, existsSync, renameSync as realRenameSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { writeFileAtomic, AtomicWriteError } from '../atomic-write.mjs';

function makeDir() {
  return mkdtempSync(path.join(tmpdir(), 'aw-atomic-write-'));
}

function cleanup(dir) {
  rmSync(dir, { recursive: true, force: true });
}

function tmpFilesIn(dir) {
  return readdirSync(dir).filter((n) => n.endsWith('.tmp'));
}

test('a forced rename throw leaves the target byte-identical to its prior content and no temp file in the directory', () => {
  const dir = makeDir();
  try {
    const target = path.join(dir, 'INDEX.md');
    writeFileSync(target, 'original content\n');

    assert.throws(
      () =>
        writeFileAtomic(target, 'new content\n', {
          renameSync: () => {
            throw new Error('forced rename failure');
          },
        }),
      /forced rename failure/
    );

    assert.equal(readFileSync(target, 'utf8'), 'original content\n');
    assert.deepEqual(tmpFilesIn(dir), []);
  } finally {
    cleanup(dir);
  }
});

test('an injected throw between the temp write and the rename leaves the target untouched and no temp file behind', () => {
  const dir = makeDir();
  try {
    const target = path.join(dir, 'protocol.md');
    writeFileSync(target, 'original protocol\n');

    assert.throws(
      () =>
        writeFileAtomic(target, 'new protocol\n', {
          injectFailureAfterWrite: () => {
            throw new Error('injected failure after temp creation');
          },
        }),
      /injected failure after temp creation/
    );

    assert.equal(readFileSync(target, 'utf8'), 'original protocol\n');
    assert.deepEqual(tmpFilesIn(dir), []);
  } finally {
    cleanup(dir);
  }
});

test('a successful write leaves exactly the target, no temp file, with the original CRLF preserved (EOL fixture)', () => {
  const dir = makeDir();
  try {
    const target = path.join(dir, 'INDEX.md');
    const crlfBefore = 'line one\r\nline two\r\n';
    writeFileSync(target, crlfBefore);

    const crlfAfter = 'line one\r\nline two\r\nline three\r\n';
    writeFileAtomic(target, crlfAfter);

    assert.equal(readFileSync(target, 'utf8'), crlfAfter);
    assert.deepEqual(tmpFilesIn(dir), []);
    // Only the target file exists in the directory -- nothing extra survives.
    assert.deepEqual(readdirSync(dir), ['INDEX.md']);
  } finally {
    cleanup(dir);
  }
});

test('rename-retry exhaustion on a transient EPERM/EBUSY throws a structured AtomicWriteError, target untouched, temp file removed', () => {
  const dir = makeDir();
  try {
    const target = path.join(dir, 'INDEX.md');
    writeFileSync(target, 'stays put\n');

    let calls = 0;
    assert.throws(
      () =>
        writeFileAtomic(target, 'attempted new content\n', {
          retryAttempts: 3,
          retryDelayMs: 1,
          renameSync: () => {
            calls += 1;
            const err = new Error('EBUSY: resource busy or locked');
            err.code = 'EBUSY';
            throw err;
          },
        }),
      (err) => err instanceof AtomicWriteError && err.code === 'atomic-write-rename-exhausted'
    );

    assert.equal(calls, 3, 'exactly retryAttempts rename calls should be made');
    assert.equal(readFileSync(target, 'utf8'), 'stays put\n');
    assert.deepEqual(tmpFilesIn(dir), []);
  } finally {
    cleanup(dir);
  }
});

test('a bounded EPERM retry that succeeds on a later attempt lands the write, temp file gone', () => {
  const dir = makeDir();
  try {
    const target = path.join(dir, 'INDEX.md');
    writeFileSync(target, 'old\n');

    let calls = 0;
    writeFileAtomic(target, 'new\n', {
      retryAttempts: 3,
      retryDelayMs: 1,
      renameSync: (from, to) => {
        calls += 1;
        if (calls < 2) {
          const err = new Error('EPERM: operation not permitted');
          err.code = 'EPERM';
          throw err;
        }
        realRenameSync(from, to);
      },
    });

    assert.equal(calls, 2);
    assert.equal(readFileSync(target, 'utf8'), 'new\n');
    assert.deepEqual(tmpFilesIn(dir), []);
  } finally {
    cleanup(dir);
  }
});

test('writeFileAtomic creates no temp file left behind when the target directory has no pre-existing file (fresh create)', () => {
  const dir = makeDir();
  try {
    const target = path.join(dir, 'new-task.md');
    writeFileAtomic(target, 'fresh body\n');
    assert.equal(readFileSync(target, 'utf8'), 'fresh body\n');
    assert.deepEqual(readdirSync(dir), ['new-task.md']);
  } finally {
    cleanup(dir);
  }
});
