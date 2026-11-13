import test from 'node:test';
import assert from 'node:assert/strict';
import * as Wd from '../pixel-rpg/world.js';

const g = Wd.buildWorld();

test('地圖尺寸正確、外框封閉', () => {
  assert.equal(g.length, Wd.H);
  g.forEach((row) => assert.equal(row.length, Wd.W));
  for (let x = 0; x < Wd.W; x++) { assert.ok(!Wd.walkable(g, x, 0)); assert.ok(!Wd.walkable(g, x, Wd.H - 1)); }
  for (let y = 0; y < Wd.H; y++) { assert.ok(!Wd.walkable(g, 0, y)); assert.ok(!Wd.walkable(g, Wd.W - 1, y)); }
});

test('出生點、NPC、告示牌前、頭目空地、河邊釣點都走得到', () => {
  const R = Wd.reachable(g, Wd.SPAWN);
  const ok = (x, y) => R.has(`${x},${y}`);
  for (const n of Wd.NPCS) assert.ok(Wd.walkable(g, n.x, n.y), n.name);
  // NPC 站的格子會被擋住，所以檢查旁邊至少一格可達
  for (const n of Wd.NPCS) assert.ok([[1,0],[-1,0],[0,1],[0,-1]].some(([dx, dy]) => ok(n.x + dx, n.y + dy)), n.name);
  assert.ok([[0,1],[0,-1],[1,0],[-1,0]].some(([dx, dy]) => ok(Wd.SIGN.x + dx, Wd.SIGN.y + dy)));
  assert.ok(ok(34, 5), '頭目空地');
  assert.ok(ok(Wd.INN_SPOT.x, Wd.INN_SPOT.y));
  assert.ok(ok(17, 8) || ok(18, 7) || ok(18, 9), '釣客附近');
  assert.ok([...R].filter((k) => +k.split(',')[0] >= Wd.FIELD_MIN_X).length > 150, '草原夠大');
});

test('怪物出生區夠多可走的格子', () => {
  let n = 0;
  for (let y = 1; y < Wd.H - 1; y++) for (let x = Wd.FIELD_MIN_X; x < Wd.W - 1; x++) if (Wd.walkable(g, x, y)) n++;
  assert.ok(n > 200);
});

test('升級：經驗溢出可連升、升級補滿血', () => {
  const p = Wd.newPlayer();
  p.hp = 1;
  const ups = Wd.gainExp(p, Wd.expNeed(1) + Wd.expNeed(2) + 1);
  assert.equal(ups, 2);
  assert.equal(p.lv, 3);
  assert.equal(p.exp, 1);
  assert.equal(p.hp, Wd.stats(p).hp);
});

test('節奏：1 級打露珠史萊姆 2 刀內、4 隻內升級', () => {
  const p = Wd.newPlayer();
  assert.ok(Math.ceil(Wd.MONSTERS.slime.hp / Wd.stats(p).atk) <= 2);
  assert.ok(Math.ceil(Wd.expNeed(1) / Wd.MONSTERS.slime.exp) <= 4);
});

test('裝備：更好的自動穿上並提升戰鬥力，較差的自動賣掉', () => {
  const p = Wd.newPlayer();
  const cp0 = Wd.stats(p).cp;
  const r1 = Wd.equipIfBetter(p, { slot: 'weapon', rarity: 'rare', name: '鐵劍', stat: 'atk', val: 10, lv: 3 });
  assert.ok(r1.equipped && r1.after > r1.before && r1.before === cp0);
  const c = p.coins;
  const r2 = Wd.equipIfBetter(p, { slot: 'weapon', rarity: 'common', name: '木劍', stat: 'atk', val: 3, lv: 1 });
  assert.equal(r2.equipped, false);
  assert.equal(p.coins, c + Wd.sellValue({ val: 3 }));
  assert.equal(p.gear.weapon.val, 10);
});

test('掉寶：稀有度分布合理、頭目必出稀有以上、數值為正', () => {
  const r = Wd.rng(9); const c = {};
  for (let i = 0; i < 20000; i++) { const it = Wd.rollGear(r, 1 + (i % 9)); c[it.rarity] = (c[it.rarity] || 0) + 1; assert.ok(it.val >= 1); assert.ok(Wd.SLOTS.includes(it.slot)); }
  assert.ok(c.common > c.good && c.good > c.rare && c.rare > c.epic && c.epic > c.legend && c.legend > 50);
  for (let i = 0; i < 500; i++) assert.ok(['rare', 'epic', 'legend'].includes(Wd.rollGear(r, 9, true).rarity));
});

test('怪物分區都有可走的格子', () => {
  for (const m of Object.values(Wd.MONSTERS)) {
    if (m.boss) continue;
    let n = 0;
    for (let y = 1; y < Wd.H - 1; y++) for (let x = m.zone[0]; x <= m.zone[1]; x++) if (Wd.walkable(g, x, y)) n++;
    assert.ok(n > 40, m.name);
  }
});

test('釣魚機率分布', () => {
  const r = Wd.rng(5); const c = {};
  for (let i = 0; i < 10000; i++) { const f = Wd.rollFish(r); c[f.id] = (c[f.id] || 0) + 1; }
  assert.ok(c.carp > c.trout && c.trout > c.gold && c.gold > 500);
});

test('讀檔：壞檔重開、舊版存檔升級、壞裝備清掉、血量夾在範圍內', () => {
  assert.equal(Wd.loadPlayer('x').lv, 1);
  const p = Wd.loadPlayer(JSON.stringify({ v: 1, lv: 2, hp: 999, coins: 'a', gear: { weapon: { slot: 'weapon', val: 'x' }, hat: {} } }));
  assert.equal(p.v, 2);
  assert.equal(p.hp, Wd.stats(p).hp);
  assert.equal(p.coins, 0);
  assert.deepEqual(p.gear, {});
  assert.deepEqual(p.fish, {});
});
