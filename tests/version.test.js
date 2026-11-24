import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { VERSION } from '../src/version.js';

test('VERSION is a date: YYYY.MM.DD', () => {
  assert.match(VERSION, /^\d{4}\.\d{2}\.\d{2}$/);
});

// When the latest commit changed the app, VERSION must carry that commit's date.
test('VERSION was updated with the latest change to the app', () => {
  let changed;
  try {
    changed = execFileSync('git', ['log', '-1', '--format=%cs', '--', 'src', 'fill', 'index.html', 'handoff.html', 'styles.css', 'sw.js'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch { return; } // no git history here
  if (!changed) return;
  assert.ok(VERSION >= changed.replaceAll('-', '.'), `VERSION ${VERSION} is older than the last change (${changed})`);
});
