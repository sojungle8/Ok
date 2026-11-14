import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as B from '../balance.js';
const ref = JSON.parse(readFileSync(new URL('../design/levels.json', import.meta.url)));
test('經驗表和設計腳本 levels.py 完全一致', () => {
  for (let L = 1; L < 200; L++) assert.equal(B.levelExp(L), ref.expNeed[L - 1], `Lv${L}`);
  for (let L = 1; L <= 200; L++) assert.equal(B.monExp(L), ref.monExp[L - 1]);
});
test('每一級都比前一級需要更多經驗', () => { for (let L = 1; L < 198; L++) assert.ok(B.levelExp(L + 1) > B.levelExp(L), `Lv${L}`); });
test('效率保護：任何打法上限是標準的 2.5 倍', () => {
  assert.equal(B.guardedRatio(1.5), 1.5); assert.equal(B.guardedRatio(3), 2.25); assert.equal(B.guardedRatio(35), 2.5);
  const p = { lv: 100 }, std = B.stdExpPerHour(100), t = 1e12;
  let got = 0; for (let i = 0; i < 350; i++) got += B.guardExp(p, std / 10, t);   // 打了 35 倍
  assert.ok(Math.abs(got / std - 2.5) < 0.01, `拿到 ${got / std} 倍`);
  assert.equal(B.guardExp(p, std, t + 3600000), std, '下一個小時重算');
});
test('等級差與組隊', () => {
  assert.equal(B.levelGapMult(50, 45), 1); assert.equal(B.levelGapMult(50, 30), 0.1); assert.ok(Math.abs(B.levelGapMult(50, 38) - 0.8) < 1e-9);
  assert.equal(B.partyShare(1), 1); assert.ok(Math.abs(B.partyShare(5) - 0.32) < 1e-9);
});
