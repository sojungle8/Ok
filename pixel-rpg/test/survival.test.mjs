import test from 'node:test';
import assert from 'node:assert/strict';
import * as S from '../survival.js';
import { newPlayer, stats } from '../world.js';

const rng = (seed) => () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);

test('怪潮：越後面越多、越快、越硬', () => {
  const a = S.wave(0), b = S.wave(450), c = S.wave(S.RUN_LEN);
  assert.ok(a.cap < b.cap && b.cap < c.cap);
  assert.ok(a.every > b.every && b.every > c.every);
  assert.ok(a.hpMul < 0.5 && a.hpMul < c.hpMul && c.hpMul <= 2.5, '開場單隻很弱');
  assert.equal(S.wavePool(1, 0).length, 3, '開場只出最弱 3 種');
  assert.equal(S.wavePool(1, S.RUN_LEN - 1).length, 13, '後段全部 13 種');
});

test('局內升級：經驗夠就升級、每升一級要選一次卡', () => {
  const p = newPlayer('sword'), run = S.newRun(p, 1);
  assert.deepEqual(Object.keys(run.skills), ['lampSlash'], '一開始只有起手技');
  const up = S.gainRunExp(run, S.runExpNeed(1) + S.runExpNeed(2));
  assert.equal(up, 2); assert.equal(run.lv, 3); assert.equal(run.pending, 2);
});

test('三選一：不重複、技能與能力有上限、可以覺醒', () => {
  const p = newPlayer('mage'), run = S.newRun(p, 1), r = rng(3);
  for (let i = 0; i < 40; i++) {
    const cs = S.rollCards(run, p, r);
    assert.ok(cs.length >= 1 && cs.length <= 3);
    assert.equal(new Set(cs.map((c) => c.kind + c.id)).size, cs.length, '三張不重複');
    S.applyCard(run, cs[0]);
  }
  assert.ok(Object.keys(run.skills).length <= S.RUN_SKILL_SLOTS);
  assert.ok(Object.keys(run.stats).length <= S.RUN_STAT_SLOTS);
  for (const v of Object.values(run.skills)) assert.ok(v <= S.RUN_SKILL_MAX);
  // 技能練滿＋對應能力 → 出現覺醒卡
  const r2 = S.newRun(p, 1); r2.skills.emberSeed = 5; r2.stats[S.pairOf('emberSeed')] = 1;
  const seen = new Set(); for (let i = 0; i < 30; i++) for (const c of S.rollCards(r2, p, rng(i + 1))) seen.add(c.kind);
  assert.ok(seen.has('awake'));
  S.applyCard(r2, { kind: 'awake', id: 'emberSeed' });
  assert.equal(S.runSkillMult(r2, 'emberSeed'), (1 + 0.3 * 4) * 2);
});

test('局內加成會進到角色數值，結算有獎勵', () => {
  const p = newPlayer('sword'), run = S.newRun(p, 2), base = stats(p);
  run.stats.might = 3; run.stats.focus = 2; p.runMods = S.runMods(run);
  const st = stats(p);
  assert.ok(st.atk > base.atk * 1.3, '攻擊 +36%');
  assert.ok(st.cdr >= base.cdr + 0.13);
  delete p.runMods;
  run.t = 600; run.kills = 300;
  const lose = S.runRewards(run, p); run.cleared = true; const win = S.runRewards(run, p);
  assert.ok(win.coins > lose.coins && win.gear > lose.gear);
});

test('技能池：職業一轉技能＋已學的二轉路線技能', () => {
  const p = newPlayer('archer');
  const pool = S.skillPool(p);
  assert.ok(pool.includes('twinStar') && pool.length >= 3);
  assert.ok(!pool.some((id) => ['hawk', 'trapper'].includes(id)));
});
