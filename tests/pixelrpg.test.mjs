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

test('節奏：每個職業 1 級打露珠史萊姆都在 0.8 秒內、4 隻內升級', () => {
  for (const c of Wd.CLASS_IDS) {
    const p = Wd.newPlayer(c);
    const hits = Math.ceil(Wd.MONSTERS.slime.hp / Wd.stats(p).atk);
    assert.ok(hits * Wd.CLASSES[c].cool <= 0.8, `${c}: ${hits} hits`);
  }
  const p = Wd.newPlayer();
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
  const p = Wd.loadPlayer(JSON.stringify({ v: 1, lv: 2, hp: 999, coins: 'a', gear: { weapon: { slot: 'weapon', val: 'x' }, hat: {}, ring: 'junk' }, souls: { fake: 1 }, soul: 'fake' }));
  assert.deepEqual(p.souls, {}); assert.equal(p.soul, '');
  assert.equal(p.v, 4);
  assert.equal(p.cls, 'sword');
  assert.equal(p.hp, Wd.stats(p).hp);
  assert.equal(p.coins, 0);
  assert.deepEqual(p.gear, {});
  assert.deepEqual(p.fish, {});
});

test('職業：四職業都有 3 個技能、名稱齊全，各職業的 DPS 差距不超過 1.6 倍', () => {
  const dps = [];
  for (const c of Wd.CLASS_IDS) {
    const k = Wd.CLASSES[c];
    assert.equal(k.skills.length, 3);
    assert.equal(k.names.weapon.length, 5); assert.equal(k.names.helm.length, 5);
    const st = Wd.stats(Wd.newPlayer(c));
    dps.push(st.atk / k.cool);
  }
  assert.ok(Math.max(...dps) / Math.min(...dps) < 1.6, dps.join(','));
});

test('裝備名稱依職業與稀有度決定', () => {
  const r = Wd.rng(3);
  for (let i = 0; i < 300; i++) {
    const it = Wd.rollGear(r, 5, false, 'archer');
    if (it.slot === 'weapon') assert.equal(it.name, Wd.CLASSES.archer.names.weapon[Wd.rarityIdx(it.rarity)]);
    assert.ok(typeof it.name === 'string' && it.name.length > 0);
  }
});

test('新角色名稱與職業', () => {
  const p = Wd.newPlayer('mage', '小明小明小明小明小明');
  assert.equal(p.cls, 'mage'); assert.equal(p.name.length, 8);
  assert.equal(Wd.newPlayer('nope').cls, 'sword');
});

test('天賦：點數上限、分支門檻、重置', () => {
  const p = Wd.newPlayer('sword');
  assert.equal(Wd.learn(p, 0, 0), false, '1 級沒有點數');
  p.lv = 10;
  assert.equal(Wd.canLearn(p, 0, 1), false, '第 2 格要先投 2 點');
  Wd.learn(p, 0, 0); Wd.learn(p, 0, 0);
  assert.ok(Wd.learn(p, 0, 1));
  assert.equal(Wd.learn(p, 0, 0), true); assert.equal(Wd.learn(p, 0, 0), false, '每格最多 3 點');
  const before = Wd.stats(p).atk;
  Wd.resetTalents(p);
  assert.ok(Wd.stats(p).atk < before);
  for (let i = 0; i < 50; i++) Wd.learn(p, i % 3, 0);
  assert.equal(Wd.talentSpent(p), 9 > Wd.talentPoints(p) ? Wd.talentPoints(p) : 9);
  assert.ok(Wd.talentSpent(p) <= Wd.talentPoints(p));
});

test('召喚：魂石不足不扣、保底 8 抽內必出魂像、升星上限', () => {
  const p = Wd.newPlayer();
  assert.equal(Wd.summon(p, () => 0.99).ok, false);
  p.stones = 100000;
  let got = 0;
  for (let i = 0; i < 8; i++) if (Wd.summon(p, () => 0.99).kind === 'soul') got++;
  assert.equal(got, 1, '運氣最差也會在第 8 抽拿到');
  for (let i = 0; i < 200; i++) Wd.summon(p, Wd.rng(i + 1));
  for (const v of Object.values(p.souls)) assert.ok(v <= Wd.SOUL_MAX_STAR);
  assert.ok(!p.souls.gear, '劇情魂像不在召喚池');
});

test('魂像被動與詞綴會反映在屬性上', () => {
  const p = Wd.newPlayer('archer');
  const s0 = Wd.stats(p);
  p.souls = { post: 1, gear: 1 }; p.soul = 'post';
  assert.ok(Math.abs(Wd.stats(p).crit - s0.crit - 0.08) < 1e-9);
  p.soul = 'gear';
  assert.ok(Wd.stats(p).cdr >= 0.12);
  p.gear.ring = { slot: 'ring', rarity: 'epic', name: 'x', stat: 'atk', val: 1, affixes: [{ id: 'aspd', val: 10 }, { id: 'leech', val: 3 }] };
  const s1 = Wd.stats(p);
  assert.ok(Math.abs(s1.aspd - 1.1) < 1e-9 && Math.abs(s1.leech - 0.03) < 1e-9);
});

test('裝備：6 部位、詞綴數依稀有度、不重複', () => {
  const r = Wd.rng(11); const slots = new Set();
  for (let i = 0; i < 3000; i++) {
    const it = Wd.rollGear(r, 6, i % 5 === 0, 'mage');
    slots.add(it.slot);
    assert.equal(it.affixes.length, Math.max(0, Wd.rarityIdx(it.rarity) - 1));
    assert.equal(new Set(it.affixes.map((a) => a.id)).size, it.affixes.length);
  }
  assert.equal(slots.size, 6);
});

test('離線收益：不到 1 分鐘沒有、上限 12 小時、等級越高打越好的區域', () => {
  const p = Wd.newPlayer();
  assert.equal(Wd.offlineReward(p, 0.5, Wd.rng(1)), null);
  const a = Wd.offlineReward(p, 99999, Wd.rng(1));
  assert.equal(a.mins, Wd.OFFLINE_MAX_MIN);
  assert.ok(a.items.length <= 8);
  p.lv = 8;
  const b = Wd.offlineReward(p, 60, Wd.rng(1));
  assert.equal(b.zone, Wd.MONSTERS.ember.name);
});

test('等級上限：第 1 章最高 Lv 15，超過的經驗不累積', () => {
  const p = Wd.newPlayer();
  Wd.gainExp(p, 1e9);
  assert.equal(p.lv, Wd.LV_CAP);
  assert.equal(p.exp, 0);
  assert.equal(Wd.talentPoints(p), Wd.LV_CAP - 1);
});

test('舊存檔已過覺醒劇情：讀檔補發鏽紅齒輪', () => {
  const p = Wd.loadPlayer(JSON.stringify({ v: 3, cls: 'mage', lv: 9, hp: 10, quest: 2 }));
  assert.equal(p.souls.gear, 1);
  assert.equal(p.soul, 'gear');
});
