import test from 'node:test';
import assert from 'node:assert/strict';
import { newPlayer, MONSTERS } from '../world.js';
import * as M from '../meta.js';

const day = (s) => new Date(s + 'T10:00:00').getTime();

test('每日任務：同一天固定、換日重抽、5 個不重複', () => {
  const p = newPlayer('sword', 'A');
  assert.ok(M.refresh(p, day('2026-11-14')));
  const a = p.meta.daily.map((q) => q.id);
  assert.equal(a.length, 5); assert.equal(new Set(a).size, 5);
  assert.ok(!M.refresh(p, day('2026-11-14')));
  M.refresh(p, day('2026-11-15'));
  assert.equal(p.meta.daily.length, 5);
  for (const q of p.meta.daily) assert.ok(M.questLabel(q).length > 3);
});

test('任務進度、領獎、活躍度寶箱', () => {
  const p = newPlayer('sword', 'B'); M.refresh(p, day('2026-11-14'));
  for (const q of p.meta.daily) { M.track(p, q.ev, q.need, { type: q.mon }); }
  assert.ok(p.meta.daily.every((q) => q.prog >= q.need));
  assert.ok(M.claimable(p));
  let total = 0;
  for (const q of p.meta.daily) { const r = M.claimQuest(p, q); assert.ok(r.coins > 0); total++; }
  assert.equal(M.claimQuest(p, p.meta.daily[0]), null, '不能重複領');
  assert.equal(p.meta.act, 100);
  for (let i = 0; i < 5; i++) assert.ok(M.claimChest(p, i));
  assert.equal(M.claimChest(p, 0), null);
  assert.equal(p.meta.st.dailyAll, 1);
});

test('指定怪物任務只算那種怪', () => {
  const p = newPlayer('sword', 'C'); M.refresh(p);
  p.meta.daily = [{ id: 'killT', ev: 'kill', need: 2, prog: 0, mon: 'berry', claimed: false, reward: {} }];
  M.track(p, 'kill', 1, { type: 'slime' }); assert.equal(p.meta.daily[0].prog, 0);
  M.track(p, 'kill', 1, { type: 'berry' }); assert.equal(p.meta.daily[0].prog, 1);
  assert.equal(p.meta.codex.slime, 1);
});

test('簽到一天一次、累計天數', () => {
  const p = newPlayer();
  assert.equal(M.claimLogin(p, day('2026-11-14')).n, 1);
  assert.equal(M.claimLogin(p, day('2026-11-14')), null);
  assert.equal(M.claimLogin(p, day('2026-11-20')).n, 2, '漏簽不歸零');
  for (let n = 1; n <= 14; n++) assert.ok(M.loginReward(p, n));
});

test('圖鑑加成與成就', () => {
  const p = newPlayer(); M.ensureMeta(p);
  p.meta.codex.slime = 600; p.meta.codex.king = 1;
  const b = M.codexBonus(p);
  assert.ok(b.atkPct > 0 || b.hpPct > 0);
  M.track(p, 'kill', 100);
  assert.ok(M.achReady(p).some((a) => a.id === 'k100'));
  assert.equal(M.claimAch(p, 'k100').stones, 50);
  assert.equal(p.meta.title, '見習獵人');
  assert.equal(M.claimAch(p, 'k100'), null);
});

test('精英怪更強、獎勵更多', () => {
  const r = () => 0.5;
  const e = M.makeElite(MONSTERS.slime, r);
  assert.ok(e.hp > MONSTERS.slime.hp && e.atk >= MONSTERS.slime.atk && e.exp > MONSTERS.slime.exp && e.elite);
});

test('試煉之塔：越高越難、5 層一魔王、首通獎勵只一次', () => {
  const p = newPlayer(); p.ch = 3;
  const f1 = M.towerFloor(p, 1), f10 = M.towerFloor(p, 10), f5 = M.towerFloor(p, 5);
  assert.ok(f10.list[0].d.hp > f1.list[0].d.hp);
  assert.ok(f5.boss && f5.list.some((x) => x.d.boss) && !f1.boss);
  assert.ok(f5.list.every((x) => !x.d.mech));
  assert.ok(f10.ch <= 3, '只用已解鎖章節的地圖');
  const a = M.towerClear(p, 5); assert.ok(a.first && a.reward.stones && a.gear);
  const b = M.towerClear(p, 5); assert.ok(!b.first && !b.reward.stones);
  assert.equal(p.meta.tower.best, 5);
  assert.ok(!M.rewardText(a.reward).includes('×0'));
});

test('難度：越難越強、獎勵越多', () => {
  const p = newPlayer(); const d = MONSTERS.berry;
  assert.equal(M.applyDiff(d, p), d);
  p.diff = 2; const h = M.applyDiff(d, p);
  assert.ok(h.hp > d.hp && h.atk > d.atk && h.exp > d.exp && h.coin[1] > d.coin[1]);
  assert.equal(M.diffOf({ diff: 9 }).name, M.DIFFS.at(-1).name);
});

test('寶箱：每天固定位置、一天只能開一次', () => {
  const g = Array.from({ length: 28 }, () => Array(40).fill(0));
  const a = M.chestSpots(g, 2, '2026-11-14', () => true), b = M.chestSpots(g, 2, '2026-11-14', () => true), c = M.chestSpots(g, 2, '2026-11-15', () => true);
  assert.equal(a.length, 3); assert.deepEqual(a, b); assert.notDeepEqual(a, c);
  assert.ok(a.every((s) => s.y < 11 || s.y > 15));
  const p = newPlayer(); const r = () => 0.1;
  assert.ok(M.openChest(p, '2-0', r, '2026-11-14'));
  assert.equal(M.openChest(p, '2-0', r, '2026-11-14'), null);
  assert.ok(M.chestOpened(p, '2-0', '2026-11-14'));
  assert.ok(M.openChest(p, '2-0', r, '2026-11-15'), '隔天重置');
});

test('快速掛機：每天免費 2 次，之後花魂石，有上限；月卡多 2 次', () => {
  const p = newPlayer(); p.stones = 1000; const t = day('2026-11-14');
  assert.deepEqual(M.useQuickIdle(p, t), { cost: 0 }); assert.deepEqual(M.useQuickIdle(p, t), { cost: 0 });
  assert.equal(M.useQuickIdle(p, t).cost, M.QUICK_COST);
  M.useQuickIdle(p, t); M.useQuickIdle(p, t);
  assert.equal(M.useQuickIdle(p, t), null, '超過上限');
  assert.equal(M.quickIdleState(p, day('2026-11-15')).freeLeft, 2, '隔天重置');
  M.buySku(p, 'month', t);
  assert.equal(M.quickIdleState(p, day('2026-11-15')).freeLeft, 4);
});

test('商城：首購雙倍、每日限購、限購一次、月卡每天領', () => {
  const p = newPlayer(); const t = day('2026-11-14');
  assert.equal(M.buySku(p, 's60', t).stones, 120, '首購雙倍');
  assert.equal(M.buySku(p, 's60', t).stones, 60);
  assert.ok(M.buySku(p, 'daily', t)); assert.equal(M.buySku(p, 'daily', t), null); assert.ok(M.buySku(p, 'daily', day('2026-11-15')));
  assert.ok(M.buySku(p, 'grow', t)); assert.equal(M.buySku(p, 'grow', day('2026-12-01')), null);
  assert.equal(M.buySku(p, 'month', t).stones, 300);
  assert.equal(M.claimMonthDaily(p, t).stones, 100); assert.equal(M.claimMonthDaily(p, t), null);
  assert.ok(M.claimMonthDaily(p, day('2026-12-13')), '第 30 天還能領');
  assert.equal(M.claimMonthDaily(p, day('2026-12-15')), null, '過期');
  assert.equal(M.monthDaysLeft(p, t), 30);
});

test('一鍵全領：任務、寶箱、簽到、成就一次領完', () => {
  const p = newPlayer('sword', 'Z'); const t = day('2026-11-14'); M.refresh(p, t);
  for (const q of p.meta.daily) M.track(p, q.ev, q.need, { type: q.mon });
  M.track(p, 'kill', 100);
  const r = M.claimAll(p, t);
  assert.ok(r.coins > 0 && r.stones > 0);
  assert.ok(p.meta.daily.every((q) => q.claimed)); assert.equal(p.meta.chests.length, 5); assert.equal(p.meta.login.n, 1); assert.ok(p.meta.ach.k100);
  assert.equal(M.claimAll(p, t), null, '沒東西可領');
});
