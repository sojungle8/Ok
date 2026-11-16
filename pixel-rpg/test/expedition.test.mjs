import test from 'node:test';
import assert from 'node:assert/strict';
import * as X from '../expedition.js';
import { newPlayer, stdItemVal, SLOTS, gearScore } from '../world.js';

test('關卡：6 章 × 3 關，等級由低到高，魔王巢才有地區魔王', () => {
  assert.equal(X.STAGES.length, 18);
  for (let i = 1; i < X.STAGES.length; i++) assert.ok(X.STAGES[i].lvLo >= X.STAGES[i - 1].lvLo - 2, X.STAGES[i].id);
  assert.ok(X.STAGES.filter((s) => s.mvp).length === 6);
  assert.equal(X.stageById('1-3').mvp, 'king');
});

test('解鎖：要打過前一關、裝備分數要夠', () => {
  const p = newPlayer('sword');
  assert.equal(X.stageLock(p, X.stageById('1-1')), null, '第一關免門檻');
  assert.match(X.stageLock(p, X.stageById('1-2')), /先打過/);
  X.clearStage(p, X.stageById('1-1'), 1);
  const st = X.stageById('1-2'), gate = X.gateOf(st);
  if (gearScore(p) < gate) assert.match(X.stageLock(p, st), /裝備分數/);
  for (const s of SLOTS) p.gear[s] = { slot: s, rarity: 'good', val: stdItemVal(s, st.lvLo), affixes: [], cards: [], refine: 0 };
  assert.equal(X.stageLock(p, st), null);
});

test('刷關難度：打過才開下一級，越難掉越多、傳說越多', () => {
  const p = newPlayer('mage'), st = X.stageById('2-1');
  assert.equal(X.maxDiff(p, st), 1);
  X.clearStage(p, st, 1); assert.equal(X.maxDiff(p, st), 2);
  X.clearStage(p, st, 20); assert.equal(X.maxDiff(p, st), 20);
  const a = X.diffMods(1), b = X.diffMods(20);
  assert.ok(b.hp > a.hp && b.drop > a.drop && b.luck > a.luck);
  assert.ok(X.gearChance(20) > X.gearChance(1));
});

test('打過魔王巢開下一章；結算通關比失敗多', () => {
  const p = newPlayer('archer'); p.ch = 1;
  X.clearStage(p, X.stageById('1-3'), 1);
  assert.equal(p.ch, 2);
  const st = X.stageById('1-3');
  const win = X.stageReward(p, st, 5, true, false), lose = X.stageReward(p, st, 5, false, false);
  assert.ok(win.coins > lose.coins && win.shards > 0 && lose.shards === 0);
});
