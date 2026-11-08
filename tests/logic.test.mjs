import test from 'node:test';
import assert from 'node:assert/strict';
import { QUESTIONS, RESULTS, score, encodeResult, decodeResult } from '../logic.js';

test('所有作答組合都對應到有效結果', () => {
  const n = QUESTIONS.length;
  const seen = new Set();
  for (let mask = 0; mask < 1 << n; mask++) {
    const ans = Array.from({ length: n }, (_, i) => (mask >> i) & 1);
    const { key } = score(ans);
    assert.ok(RESULTS[key], key);
    seen.add(key);
  }
  assert.equal(seen.size, 8, '8 種結果都能被測出');
});

test('速配對象都存在', () => {
  for (const r of Object.values(RESULTS)) assert.ok(RESULTS[r.match]);
});

test('錯誤輸入會拋錯', () => {
  assert.throws(() => score([0]));
  assert.throws(() => score(Array(QUESTIONS.length).fill(5)));
});

test('結果編碼可來回轉換，且拒絕非法值', () => {
  for (const k of Object.keys(RESULTS)) assert.equal(decodeResult('#' + encodeResult(k)), k);
  assert.equal(decodeResult('#r=XYZ'), null);
  assert.equal(decodeResult('#r=<script>'), null);
  assert.equal(decodeResult(''), null);
});
