import test from 'node:test';
import assert from 'node:assert/strict';
import * as Wd from '../pixel-rpg/world.js';

const g = Wd.buildWorld();

test('地圖尺寸正確、外框封閉（只有東門開口）', () => {
  assert.equal(g.length, Wd.H);
  g.forEach((row) => assert.equal(row.length, Wd.W));
  for (let x = 0; x < Wd.W; x++) { assert.ok(!Wd.walkable(g, x, 0)); assert.ok(!Wd.walkable(g, x, Wd.H - 1)); }
  for (let y = 0; y < Wd.H; y++) {
    assert.ok(!Wd.walkable(g, 0, y));
    assert.equal(Wd.walkable(g, Wd.W - 1, y), Wd.GATE_Y.includes(y), `東邊 y=${y}`);
  }
  const R = Wd.reachable(g, Wd.SPAWN);
  for (const y of Wd.GATE_Y) assert.ok(R.has(`${Wd.W - 1},${y}`), '東門走得到');
});

test('野外地圖：左右出入口相連，最後一章東邊封閉', () => {
  for (const c of Wd.CHAPTERS) {
    const f = Wd.buildField(c.n), R = Wd.reachable(f, Wd.FIELD.spawn);
    for (const y of Wd.GATE_Y) {
      assert.ok(R.has(`0,${y}`), `第 ${c.n} 章西側出入口`);
      assert.equal(R.has(`${Wd.W - 1},${y}`), c.n < 6, `第 ${c.n} 章東側出入口`);
    }
  }
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

test('等級上限：依章節提高，超過的經驗不累積', () => {
  const p = Wd.newPlayer();
  Wd.gainExp(p, 1e12);
  assert.equal(p.lv, 15);
  assert.equal(p.exp, 0);
  p.ch = 3; Wd.gainExp(p, 1e12); assert.equal(p.lv, 35);
  p.ch = 7; Wd.gainExp(p, 1e12); assert.equal(p.lv, Wd.LV_CAP);
});

test('舊存檔已過覺醒劇情：讀檔補發鏽紅齒輪、換算章節進度', () => {
  const p = Wd.loadPlayer(JSON.stringify({ v: 3, cls: 'mage', lv: 9, hp: 10, quest: 2 }));
  assert.equal(p.ch, 1); assert.equal(p.step, 2);
  const q = Wd.loadPlayer(JSON.stringify({ v: 4, cls: 'mage', lv: 15, hp: 10, quest: 4 }));
  assert.equal(q.ch, 2); assert.equal(q.step, 0);
  assert.equal(p.souls.gear, 1);
  assert.equal(p.soul, 'gear');
});

test('第 2～6 章：怪物資料齊全、地圖走得到傳送點、嚮導、魔王區、三個怪物區', () => {
  for (const c of Wd.CHAPTERS) {
    for (const k of [...c.mons, c.boss]) { const m = Wd.MONSTERS[k]; assert.ok(m && m.hp > 0 && m.atk > 0 && m.tpl && m.pal, k); }
    assert.ok(Wd.MONSTERS[c.boss].boss);
    if (c.n === 1) continue;
    const g = Wd.buildField(c.n);
    const R = Wd.reachable(g, Wd.FIELD.spawn);
    const ok = (x, y) => R.has(`${x},${y}`);
    assert.ok(ok(Wd.FIELD.portal.x, Wd.FIELD.portal.y), `ch${c.n} portal`);
    assert.ok([[1,0],[-1,0],[0,1],[0,-1]].some(([dx, dy]) => ok(Wd.FIELD.guide.x + dx, Wd.FIELD.guide.y + dy)), `ch${c.n} guide`);
    assert.ok(ok(34, 4), `ch${c.n} boss`);
    for (const k of c.mons) { const [a, b] = Wd.MONSTERS[k].zone; let n = 0; for (const key of R) { const x = +key.split(',')[0]; if (x >= a && x <= b) n++; } assert.ok(n > 40, `ch${c.n} ${k} zone`); }
    assert.ok(c.intro.length && c.bossHint.length && c.memory.length);
  }
});

test('數值曲線：怪物越後面越強，每章入口等級的玩家 4 刀內打倒小怪', () => {
  const lvls = Wd.CHAPTERS.flatMap((c) => c.mons.map((k) => Wd.MONSTERS[k]));
  for (let i = 1; i < lvls.length; i++) assert.ok(lvls[i].hp >= lvls[i - 1].hp * 0.9, lvls[i].name);
  for (const c of Wd.CHAPTERS.slice(1)) {
    const p = Wd.newPlayer('sword'); p.lv = Wd.CHAPTERS[c.n - 2].cap;
    const weak = Wd.MONSTERS[c.mons[0]];
    const gearAtk = 2 * (1 + p.lv * 0.7) * 1.4 + 1.2 * (1 + p.lv * 0.7) * 1.4 + (1 + p.lv * 0.7) * 1.4;
    const atk = Wd.stats(p).atk + gearAtk;
    assert.ok(weak.hp / atk <= 4, `ch${c.n}: ${weak.hp} / ${atk}`);
  }
});

import * as It from '../pixel-rpg/items.js';
const gearOf = (o) => ({ slot: 'weapon', rarity: 'common', name: 'x', stat: 'atk', val: 10, lv: 5, affixes: [], slots: 1, refine: 0, cards: [], ...o });

test('背包：舊存檔的藥水搬進背包、預設只自動賣普通裝備', () => {
  const p = It.ensureInv(Wd.loadPlayer(JSON.stringify({ v: 4, lv: 3, hp: 5, potions: 4 })));
  assert.equal(It.count(p, 'red'), 4);
  assert.equal(p.potions, 0);
  assert.equal(It.count(It.ensureInv(Wd.newPlayer()), 'red'), 3, '新角色的 3 瓶藥水也放進背包');
  assert.equal(p.autoSell.equip.common, true);
  assert.equal(p.autoSell.equip.rare, false);
});

test('自動販賣依稀有度：普通賣掉、稀有收進背包；更好的自動穿上，換下的依設定處理', () => {
  const p = It.ensureInv(Wd.newPlayer());
  const c0 = p.coins;
  assert.equal(It.pickupGear(p, gearOf({ val: 10 })).action, 'equip');
  assert.equal(It.pickupGear(p, gearOf({ val: 5 })).action, 'sell');
  assert.ok(p.coins > c0);
  assert.equal(It.pickupGear(p, gearOf({ val: 5, rarity: 'rare' })).action, 'bag');
  const r = It.pickupGear(p, gearOf({ val: 50, rarity: 'epic' }));
  assert.equal(r.action, 'equip'); assert.equal(r.old, 'sell', '換下的普通武器依設定賣掉');
  p.autoSell.autoEquip = false; p.autoSell.equip.legend = true;
  assert.equal(It.pickupGear(p, gearOf({ val: 999, rarity: 'legend' })).action, 'sell');
});

test('有精煉、卡片或上鎖的裝備不會被自動賣掉；背包滿了才賣', () => {
  const p = It.ensureInv(Wd.newPlayer());
  p.autoSell.autoEquip = false;
  assert.equal(It.pickupGear(p, gearOf({ refine: 3 })).action, 'bag');
  assert.equal(It.pickupGear(p, gearOf({ locked: true })).action, 'bag');
  p.autoSell.equip.common = false;
  for (let i = 0; i < It.BAG_SIZE; i++) It.pickupGear(p, gearOf({}));
  assert.equal(p.bag.gear.length, It.BAG_SIZE);
  assert.equal(It.pickupGear(p, gearOf({})).action, 'full');
});

test('道具依品級自動販賣，卡片預設保留；一鍵賣雜物', () => {
  const p = It.ensureInv(Wd.newPlayer());
  p.autoSell.item.junk = true;
  assert.equal(It.pickupItem(p, 'mat_slime').action, 'sell');
  assert.equal(It.pickupItem(p, 'card_slime').action, 'bag');
  p.autoSell.item.junk = false;
  It.pickupItem(p, 'mat_bat', 5); It.pickupItem(p, 'ore', 2);
  const c = p.coins; It.sellAllJunk(p);
  assert.ok(p.coins > c); assert.equal(It.count(p, 'mat_bat'), 0); assert.equal(It.count(p, 'ore'), 2);
});

test('卡片：要有空卡槽，插入後屬性上升', () => {
  const p = It.ensureInv(Wd.newPlayer()); p.lv = 40;
  It.pickupGear(p, gearOf({ slots: 1 }));
  const uid = p.gear.weapon.uid;
  It.addStack(p, 'card_berry', 2);
  const atk0 = Wd.stats(p).atk, hp0 = Wd.stats(p).hp;
  assert.ok(It.insertCard(p, uid, 'card_berry').ok);
  assert.equal(It.insertCard(p, uid, 'card_berry').ok, false, '卡槽已滿');
  const card = It.ITEMS.card_berry;
  const s1 = Wd.stats(p);
  assert.ok(s1.atk > atk0 || s1.hp > hp0 || s1.crit > 0.1 || s1.aspd > 1 || s1.skill > 1 || s1.dr > 0 || s1.leech > 0 || s1.soulGain > 1, card.stat);
});

test('精煉：+4 以內必成功、失敗只扣材料不掉級、+7 起要強化原石', () => {
  const p = It.ensureInv(Wd.newPlayer());
  It.pickupGear(p, gearOf({}));
  const uid = p.gear.weapon.uid;
  p.coins = 1e7; It.addStack(p, 'ore', 20); It.addStack(p, 'ore2', 20);
  for (let i = 0; i < 4; i++) assert.ok(It.refine(p, uid, () => 0.99).success);
  const fail = It.refine(p, uid, () => 0.99);
  assert.equal(fail.success, false); assert.equal(p.gear.weapon.refine, 4);
  for (let i = 0; i < 2; i++) It.refine(p, uid, () => 0);
  assert.equal(It.refineCost(p.gear.weapon).ore, 'ore2');
  const atk6 = Wd.stats(p).atk;
  It.refine(p, uid, () => 0);
  assert.ok(Wd.stats(p).atk > atk6);
  for (let i = 0; i < 10; i++) It.refine(p, uid, () => 0);
  assert.equal(p.gear.weapon.refine, 10);
  assert.equal(It.refine(p, uid, () => 0).ok, false);
});

test('掉落與商店：每隻怪都有素材與卡片、商店依章節開放', () => {
  for (const k of Object.keys(Wd.MONSTERS)) { assert.ok(It.ITEMS['mat_' + k]); assert.ok(It.ITEMS['card_' + k].val > 0); }
  let cards = 0; const r = Wd.rng(4);
  for (let i = 0; i < 20000; i++) cards += It.rollDrops(r, 'slime').filter((d) => d.id.startsWith('card_')).length;
  assert.ok(cards > 20 && cards < 120, `cards ${cards}`);
  assert.deepEqual(It.shopList(1), ['red']);
  assert.ok(It.shopList(4).includes('white'));
  const p = It.ensureInv(Wd.newPlayer()); p.coins = 100;
  assert.ok(It.buy(p, 'red', 2).ok); assert.equal(It.buy(p, 'red', 10).ok, false);
  assert.equal(It.pickPotion(p, 0.9), 'red');
});

import * as Pt from '../pixel-rpg/party.js';
test('隊伍：招募條件、價格、出戰上限 3 人、數值跟著主角', () => {
  const p = Pt.ensureParty(Wd.newPlayer());
  p.coins = 99999;
  assert.equal(Pt.hire(p, 'lena').ok, false, '第 1 章覺醒前不能招募');
  p.step = 2;
  assert.ok(Pt.hire(p, 'lena').ok); assert.ok(Pt.hire(p, 'mia').ok);
  assert.equal(Pt.hire(p, 'carlos').ok, false, '第 2 章才開放');
  p.ch = 3; p.step = 0;
  for (const id of ['carlos', 'nova', 'buck']) assert.ok(Pt.hire(p, id).ok, id);
  assert.equal(p.party.active.length, 3);
  assert.equal(Pt.toggleActive(p, 'buck'), false, '出戰已滿');
  Pt.toggleActive(p, 'lena'); assert.ok(Pt.toggleActive(p, 'buck'));
  const st = Wd.stats(p);
  const a = Pt.allyStats(Pt.COMPANIONS.lena, st);
  assert.ok(a.max > st.hp, '坦克血比主角多');
  const back = Pt.ensureParty(JSON.parse(JSON.stringify(p)));
  assert.deepEqual(back.party, p.party);
  assert.deepEqual(Pt.ensureParty({ party: { hired: ['nope', 'mia'], active: ['nope', 'mia', 'x'], tactic: 'bad' } }).party, { hired: ['mia'], active: ['mia'], tactic: 'assist' });
});
