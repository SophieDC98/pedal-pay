import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bundle, bookmarkUrl } from '../src/bookmark.js';

const a = "import { x } from './x.js';\nexport function one() { return 1; }\nexport const TWO = 2;\n";
const b = "const three = one() + TWO;\nwindow.__three = three;\n";

test('bundle drops imports and export keywords', () => {
  const out = bundle([a, b]);
  assert.doesNotMatch(out, /^\s*import /m);
  assert.doesNotMatch(out, /^\s*export /m);
  assert.match(out, /function one\(\)/);
  assert.match(out, /const TWO = 2;/);
});

test('bookmarkUrl is a javascript: URL that carries the app address and parses', () => {
  const url = bookmarkUrl([a, b], 'https://example.test/pedal-pay/');
  assert.ok(url.startsWith('javascript:'));
  const code = decodeURIComponent(url.slice('javascript:'.length));
  assert.match(code, /const PEDAL_PAY_URL = "https:\/\/example\.test\/pedal-pay\/";/);
  assert.doesNotThrow(() => new Function(code));
  const w = {};
  new Function('window', code)(w);
  assert.equal(w.__three, 3);
});
