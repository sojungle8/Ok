import test from 'node:test';
import assert from 'node:assert/strict';
import { newPlayer, stats, expNeed, gainExp, LV_CAP, loadPlayer } from '../world.js';
import * as G from '../progress.js';
import { attrFree } from '../ro.js';

test('等級上限 99，50 級後經驗需求明顯變高', () => {
  assert.equal(LV_CAP, 99);
  assert.ok(expNeed(99) / expNeed(50) > 15, '99 級遠比 50 級難');
  const p = newPlayer(); p.ch = 7; gainExp(p, 1e15); assert.equal(p.lv, 99);
});

test('職業等級：打怪升級、一轉上限 50、得技能點', () => {
  const p = newPlayer('sword');
  assert.equal(G.skillPointsFree(p), 3, '職業 Lv1 先給 3 點');
  assert.ok(G.gainJobExp(p, G.jobExpNeed(1) + G.jobExpNeed(2)) === 2);
  assert.equal(p.job.lv, 3); assert.equal(G.skillPointsFree(p), 5);
  G.gainJobExp(p, 1e12); assert.equal(p.job.lv, 50);
});

test('技能等級：加點、上限、自動分配平均升級', () => {
  const p = newPlayer('mage'); p.job.lv = 20;
  const ids = ['nova', 'fireball', 'chain'];
  G.autoLearn(p, ids);
  assert.equal(G.skillPointsFree(p), 0);
  const lvs = ids.map((x) => G.skillLevel(p, x)); assert.ok(Math.max(...lvs) - Math.min(...lvs) <= 1);
  assert.ok(G.skillDmgMult(10) > G.skillDmgMult(1) && G.skillCdMult(10) < 1);
  p.job.lv = 50; G.autoLearn(p, ids); assert.ok(ids.every((x) => G.skillLevel(p, x) <= 10));
});

test('轉職：等級條件、兩條路線、加成生效', () => {
  const p = newPlayer('sword'); p.lv = 44; p.job.lv = 50;
  assert.ok(!G.canAdvance(p)); p.lv = 45; assert.ok(G.canAdvance(p));
  const atk0 = stats(p).atk;
  assert.ok(G.advanceJob(p, 'blademaster'));
  assert.equal(p.job.tier, 2); assert.equal(G.jobTitle(p, '劍士'), '劍聖');
  assert.ok(stats(p).atk > atk0);
  assert.ok(G.skillPointsTotal(p) > 50, '二轉保留一轉的技能點');
  for (const c of Object.keys(G.JOB2)) assert.equal(G.JOB2[c].length, 2);
});

test('轉生：回到 1 級、永久加成、多給能力點', () => {
  const p = newPlayer('archer'); p.lv = 99; p.job = { tier: 2, lv: 70, exp: 0, branch: 'sniper' };
  assert.ok(G.canReborn(p));
  assert.ok(G.doReborn(p));
  assert.equal(p.lv, 1); assert.equal(p.reborn, 1); assert.equal(p.job.tier, 1);
  const fresh = newPlayer('archer'); fresh.lv = 40; p.lv = 40;
  assert.ok(stats(p).atk > stats(fresh).atk && stats(p).hp > stats(fresh).hp);
  p.lv = 1;
  assert.equal(attrFree(p), 20);
});

test('舊存檔載入會補上職業資料', () => {
  const old = newPlayer('monk'); delete old.job; delete old.skillLv; delete old.reborn;
  const p = loadPlayer(JSON.stringify(old));
  assert.equal(p.job.tier, 1); assert.equal(p.reborn, 0); assert.deepEqual(p.skillLv, {});
});
