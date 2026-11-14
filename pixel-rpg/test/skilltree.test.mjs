import test from 'node:test';
import assert from 'node:assert/strict';
import * as S from '../skilltree.js';
const mk = (cls, tier, lv, branch = '') => ({ cls, job: { tier, lv, branch } });
test('每個職業 8～9 招、每條路線 10 招，前置都存在', () => {
  for (const [c, rs] of Object.entries(S.ROUTES)) {
    assert.ok(S.SKILLS.filter((s) => s.owner === c).length >= 8);
    for (const r of rs) assert.equal(S.SKILLS.filter((s) => s.owner === r.id).length, 10, r.name);
  }
  for (const s of S.SKILLS) for (const [p] of s.pre) assert.ok(S.BY_ID[p], s.name);
});
test('一開始會第一招、沒有技能點', () => {
  const p = S.ensureTree(mk('sword', 1, 1));
  assert.equal(S.lvOf(p, 'lampSlash'), 1); assert.equal(S.skillPoints(p).free, 0); assert.equal(p.bar[0], 'lampSlash');
});
test('前置條件與點數限制', () => {
  const p = S.ensureTree(mk('sword', 1, 50));
  assert.equal(S.skillPoints(p).free, 49);
  assert.match(S.whyNot(p, 'ringSlash'), /守燈斬 Lv3/);
  S.learnSkill(p, 'lampSlash'); S.learnSkill(p, 'lampSlash'); assert.equal(S.whyNot(p, 'ringSlash'), '');
  assert.match(S.whyNot(p, 'armorBreak'), /轉職/);
});
test('一鍵配點：一轉 49 點全部用完，二轉後照代表配點走', () => {
  for (const cls of Object.keys(S.ROUTES)) {
    const p = S.ensureTree(mk(cls, 1, 50)); S.autoLearnSkills(p);
    assert.equal(S.skillPoints(p).free, 0, cls);
    p.job = { tier: 2, lv: 70, branch: S.ROUTES[cls][0].id }; S.autoLearnSkills(p);
    const pt = S.skillPoints(p); assert.equal(pt.free, 0, cls); assert.ok(pt.s2 <= 69);
  }
});
test('數值規則：主動 Lv1＝滿級的 55%（10 級技）', () => {
  const s = S.BY_ID.lampSlash; assert.equal(S.skillAt(s, 'c', 10), 320); assert.equal(S.skillAt(s, 'c', 1), 176);
});
