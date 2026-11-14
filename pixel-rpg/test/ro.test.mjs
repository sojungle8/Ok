import test from 'node:test';
import assert from 'node:assert/strict';
import { newPlayer, stats, MONSTERS } from '../world.js';
import * as RO from '../ro.js';

test('屬性相剋：剋 1.75、被剋 0.75、同屬 0.5、最低 0.5', () => {
  assert.equal(RO.elemMod('水', '火'), 1.75); assert.equal(RO.elemMod('火', '水'), 0.75);
  assert.equal(RO.elemMod('火', '火'), 0.5); assert.equal(RO.elemMod('聖', '不死'), 1.75); assert.equal(RO.elemMod('無', '念'), 0.5);
  for (const a of RO.ELEMS) for (const d of RO.ELEMS) assert.ok(RO.elemMod(a, d) >= 0.5 && RO.elemMod(a, d) <= 1.75, `${a}→${d}`);
});

test('每種怪物都有屬性、種族、體型與卡片效果', () => {
  for (const k of Object.keys(MONSTERS)) {
    const pr = RO.MON_PROFILE[k];
    assert.ok(pr && RO.ELEMS.includes(pr.elem) && RO.RACES.includes(pr.race) && RO.BODY_SIZES.includes(pr.size), k);
    assert.ok(RO.cardDesc(k).length > 3, k);
  }
});

test('能力點：等級 1 不改變舊數值；升級得點；自動分配照職業比例', () => {
  const p = newPlayer('sword'); const s0 = stats(p);
  assert.equal(RO.attrFree(p), 10);
  const q = newPlayer('sword'); q.attrs = RO.newAttrs(); assert.equal(stats(q).atk, s0.atk);
  p.lv = 30; RO.autoAllocate(p);
  assert.equal(RO.attrFree(p), 0);
  assert.ok(p.attrs.str > p.attrs.vit && p.attrs.vit > p.attrs.dex && p.attrs.int === 1);
  const m = newPlayer('mage'); m.lv = 30; RO.autoAllocate(m); assert.ok(m.attrs.int > m.attrs.str);
  assert.ok(stats(p).atk > stats({ ...p, attrs: RO.newAttrs() }).atk, '力量提高攻擊');
});

test('加點上限與手動加點', () => {
  const p = newPlayer('archer'); p.lv = 5; p.autoAttr = false;
  assert.equal(RO.addAttr(p, 'dex', 100), 26);
  assert.equal(RO.attrFree(p), 0); assert.equal(RO.addAttr(p, 'agi', 1), 0);
  RO.resetAttrs(p); assert.equal(RO.attrFree(p), 26);
});

test('卡片：效果匯總、武器附加屬性、傷害倍率', () => {
  const p = newPlayer('sword');
  p.gear.weapon = { slot: 'weapon', stat: 'atk', val: 5, name: '劍', rarity: 'rare', affixes: [], cards: [{ id: 'card_ember' }, { id: 'card_howl' }] };
  p.gear.armor = { slot: 'armor', stat: 'hp', val: 5, name: '甲', rarity: 'rare', affixes: [], cards: [{ id: 'card_slime' }] };
  const st = stats(p);
  assert.equal(st.weaponElem, '火');
  assert.equal(st.mods.race['動物'], 20);
  assert.equal(st.attrs.vit, 3);
  const vsHowl = RO.damageMult(p, st.mods, '火', 'howl', 18, false), vsCog = RO.damageMult(p, st.mods, '火', 'cog', 18, false);
  assert.ok(vsHowl.mult > vsCog.mult, '對動物加成');
  assert.ok(RO.damageMult(p, st.mods, '火', 'berry', 4, false).elem === 1.75, '火剋地');
});

test('輔助狀態：祝福與加速會提高能力、到期消失', () => {
  const p = newPlayer('priest'); const t = 1000000;
  const s0 = RO.attrBonus(p, t);
  RO.addBuff(p, 'bless', 60, t); RO.addBuff(p, 'agi', 30, t);
  const s1 = RO.attrBonus(p, t + 1000);
  assert.ok(s1.atkPct > s0.atkPct && s1.aspd > s0.aspd);
  assert.deepEqual(RO.activeBuffs(p, t + 61000), []);
});

test('命中下限 85%、閃避上限 50%＋完全迴避', () => {
  assert.equal(RO.hitChance(1, 99), 0.85); assert.equal(RO.hitChance(200, 1), 1);
  assert.equal(RO.dodgeChance(1, 50), 0); assert.ok(RO.dodgeChance(500, 1, 5) <= 0.55);
});
