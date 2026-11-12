import test from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../cat-nook/logic.js';

const T = '2026-11-12';
// 可重現的亂數
function seeded(seed = 1) { return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }

test('新存檔：有起始貓、金幣、3 個不同類型的每日任務', () => {
  for (let i = 1; i < 200; i++) {
    const s = L.newState(T, seeded(i));
    assert.equal(s.daily.quests.length, 3);
    assert.equal(new Set(s.daily.quests.map((q) => q.type)).size, 3);
    assert.ok(s.cats.mochi);
  }
});

test('每日任務：從新存檔出發一定都能完成並領取', () => {
  for (let i = 1; i < 200; i++) {
    const rand = seeded(i);
    const s = L.newState(T, rand);
    for (let k = 0; k < 3; k++) L.finishGame(s, 10, rand);
    for (let k = 0; k < 5; k++) L.pet(s, 'mochi');
    for (let k = 0; k < 2; k++) assert.ok(L.feed(s, 'mochi').ok);
    s.daily.quests.forEach((q, idx) => assert.ok(L.claimQuest(s, idx, rand).ok, q.text));
    assert.equal(L.claimQuest(s, 0, rand).ok, false, '不能重複領取');
  }
});

test('換日會重置任務，同日不會', () => {
  const s = L.newState(T, seeded(3));
  assert.equal(L.ensureDaily(s, T), false);
  assert.equal(L.ensureDaily(s, '2026-11-13'), true);
  assert.equal(s.daily.date, '2026-11-13');
  assert.equal(s.daily.petCookies, 0);
});

test('召喚：保底第 10 抽必出史詩以上', () => {
  const s = L.newState(T);
  s.coins = 10000;
  const alwaysCommon = () => 0;
  for (let i = 0; i < 9; i++) assert.equal(L.summon(s, alwaysCommon).cat.rarity, 'common');
  const r = L.summon(s, alwaysCommon);
  assert.ok(['epic', 'legendary'].includes(r.cat.rarity));
  assert.equal(s.pity, 0);
});

test('召喚：金幣不足不扣錢；重複貓給餅乾', () => {
  const s = L.newState(T);
  s.coins = 50;
  assert.equal(L.summon(s).ok, false);
  assert.equal(s.coins, 50);
  s.coins = 200;
  const c0 = s.cookies;
  const r = L.summon(s, () => 0); // 普通池第一隻 = mochi，已擁有
  assert.equal(r.cat.id, 'mochi');
  assert.equal(r.isNew, false);
  assert.equal(s.cookies, c0 + 3);
});

test('召喚分布大致符合公開機率', () => {
  const s = L.newState(T);
  s.coins = 1e9;
  const rand = seeded(42);
  const n = 20000; const cnt = {};
  for (let i = 0; i < n; i++) { const r = L.summon(s, rand); cnt[r.cat.rarity] = (cnt[r.cat.rarity] || 0) + 1; }
  assert.ok(cnt.common / n > 0.5 && cnt.common / n < 0.62);
  assert.ok(cnt.legendary > 0);
});

test('藍圖與製作：先買藍圖、材料足夠才能做、會扣材料', () => {
  const s = L.newState(T);
  assert.equal(L.craft(s, 'box').ok, false);
  assert.ok(L.buyBlueprint(s, 'box').ok);
  assert.equal(L.buyBlueprint(s, 'box').ok, false, '不能重複買');
  const r = L.craft(s, 'box');
  assert.equal(r.ok, false);
  assert.deepEqual(r.miss, { wood: 2, cloth: 1 });
  s.materials.wood = 2; s.materials.cloth = 1;
  assert.ok(L.craft(s, 'box').ok);
  assert.equal(s.materials.wood, 0);
  assert.deepEqual(s.furniture, ['box']);
});

test('只靠玩小遊戲就能做出所有家具（材料不會卡死）', () => {
  const rand = seeded(7);
  const s = L.newState(T, rand);
  let plays = 0;
  for (const f of L.FURNITURE) {
    while (!L.buyBlueprint(s, f.id).ok) { L.finishGame(s, 6, rand); plays++; }
    while (!L.craft(s, f.id).ok) { L.finishGame(s, 6, rand); plays++; }
  }
  assert.equal(s.furniture.length, L.FURNITURE.length);
  assert.ok(plays < 200, `plays=${plays}`);
});

test('買材料、餵食、摸摸餅乾每日上限', () => {
  const s = L.newState(T);
  s.coins = 10;
  assert.equal(L.buyMaterial(s, 'wood').ok, false);
  s.coins = 100;
  assert.ok(L.buyMaterial(s, 'wood').ok);
  assert.equal(s.materials.wood, 1);
  s.cookies = 0;
  assert.equal(L.feed(s, 'mochi').ok, false);
  let got = 0;
  for (let i = 0; i < 20; i++) got += L.pet(s, 'mochi').cookie;
  assert.equal(got, L.DAILY_PET_COOKIES);
  assert.equal(L.pet(s, 'nope').ok, false);
});

test('小遊戲星數與獎勵', () => {
  assert.deepEqual([0, 2, 3, 5, 6, 9, 10].map(L.starsFor), [0, 0, 1, 1, 2, 2, 3]);
  const s = L.newState(T);
  const r = L.finishGame(s, 0, seeded(1));
  assert.ok(r.coins > 0);
  assert.equal(Object.values(r.mats).reduce((a, b) => a + b, 0), 1, '0 星也有安慰獎');
});

test('讀檔：壞檔重開、缺欄位補齊、未知 id 清除', () => {
  assert.equal(L.loadState('not json', T).coins, 300);
  assert.equal(L.loadState(null, T).coins, 300);
  const s = L.loadState(JSON.stringify({ v: 1, coins: 5, materials: {}, cats: { ghost: {} }, blueprints: ['x', 'bed'], furniture: 'bad' }), T);
  assert.equal(s.coins, 5);
  assert.equal(s.materials.wood, 0);
  assert.ok(s.cats.mochi && !s.cats.ghost);
  assert.deepEqual(s.blueprints, ['bed']);
  assert.deepEqual(s.furniture, []);
  assert.equal(s.daily.date, T);
});

test('資料完整性：配方材料都存在、每種稀有度都有貓', () => {
  for (const f of L.FURNITURE) for (const k of Object.keys(f.recipe)) assert.ok(L.MATERIALS[k]);
  for (const r of Object.keys(L.RARITY)) assert.ok(L.CATS.some((c) => c.rarity === r));
  assert.equal(new Set(L.CATS.map((c) => c.id)).size, L.CATS.length);
});
