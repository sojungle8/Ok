import test from 'node:test';
import assert from 'node:assert/strict';
import * as X from '../expedition.js';
import { newPlayer, stats, stdItemVal, SLOTS } from '../world.js';

const rng = (seed) => () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);

test('地圖：一章一張，依序解鎖（要打倒前一張的魔王、裝備分數要夠）', () => {
  assert.equal(X.STAGES.length, 6);
  const p = newPlayer('sword');
  assert.equal(X.stageLock(p, X.stageById(1)), null);
  assert.match(X.stageLock(p, X.stageById(2)), /魔王/);
  X.clearStage(p, X.stageById(1), 1);
  assert.equal(p.ch, 2);
  const st = X.stageById(2);
  for (const s of SLOTS) p.gear[s] = { slot: s, rarity: 'good', val: stdItemVal(s, st.lvLo), affixes: [], cards: [], refine: 0 };
  assert.equal(X.stageLock(p, st), null);
});

test('刷關難度：打過才開下一級，越難越硬、掉越多', () => {
  const p = newPlayer('mage'), st = X.stageById(1);
  assert.equal(X.maxDiff(p, st), 1);
  X.clearStage(p, st, 3); assert.equal(X.maxDiff(p, st), 4);
  const a = X.diffMods(1), b = X.diffMods(20);
  assert.ok(b.hp > a.hp && b.drop > a.drop && b.luck > a.luck);
});

test('怪潮：開場緩和、越後面越多越硬；出怪由弱到強', () => {
  const a = X.wave(10), b = X.wave(450), c = X.wave(X.RUN_LEN);
  assert.ok(a.cap < b.cap && b.cap < c.cap && a.every > c.every && a.hpMul < c.hpMul);
  const st = X.stageById(1);
  assert.equal(X.wavePool(st, 0).length, 3);
  assert.equal(X.wavePool(st, X.RUN_LEN - 1).length, 13);
});

test('局內：從 Lv1 開始、撿寶石升級、三選一；技能欄一轉 4 格、二轉 5 格', () => {
  const p = newPlayer('archer'), run = X.newRun(p, X.stageById(1), 1), r = rng(5);
  assert.equal(run.lv, 1); assert.equal(Object.keys(run.skills).length, 1);
  assert.equal(X.gainRunExp(run, X.runExpNeed(1)), 1);
  for (let i = 0; i < 60; i++) {
    const cs = X.rollCards(run, p, r);
    assert.ok(cs.length >= 1 && cs.length <= 3);
    X.applyCard(run, cs[0]);
  }
  assert.ok(Object.keys(run.skills).length <= 4, '一轉最多 4 個技能');
  for (const v of Object.values(run.skills)) assert.ok(v <= X.SKILL_MAX);
  p.job = { tier: 2, lv: 1, branch: 'hawk' }; assert.equal(X.skillSlots(p), 5);
});

test('加護：技能 Lv3 以上才會出現，改變技能運作', () => {
  const p = newPlayer('mage'), run = X.newRun(p, X.stageById(1), 1);
  run.skills = { emberSeed: 3 };
  const kinds = new Set(); for (let i = 0; i < 40; i++) for (const c of X.rollCards(run, p, rng(i + 1))) kinds.add(c.kind);
  assert.ok(kinds.has('bless'));
  X.applyCard(run, { kind: 'bless', id: 'emberSeed', b: 'blaze' });
  assert.ok(X.runSkillMult(run, 'emberSeed') > 2.5);
});

test('寶箱道具與等級加成進到角色數值；結算通關比失敗多', () => {
  const p = newPlayer('sword'), run = X.newRun(p, X.stageById(1), 1), base = stats(p);
  run.lv = 6; run.items = ['might', 'calm']; p.runMods = X.runMods(run);
  const st = stats(p); delete p.runMods;
  assert.ok(st.atk > base.atk * 1.3 && st.cdr > base.cdr);
  assert.equal(X.rollItems({ items: [] }, rng(2)).length, 3);
  run.t = 600; run.kills = 500;
  const lose = X.stageReward(p, run); run.cleared = true; const win = X.stageReward(p, run);
  assert.ok(win.coins > lose.coins && win.gear > lose.gear);
});
