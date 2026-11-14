import test from 'node:test';
import assert from 'node:assert/strict';
import * as Pg from '../progress.js';
import * as S from '../skilltree.js';
import * as Wd from '../world.js';
import * as B from '../balance.js';

test('等級上限：上線開到 150，經驗表到 200', () => {
  assert.equal(Wd.LV_CAP, 150); assert.equal(B.LV_MAX, 200);
  assert.ok(Wd.expNeed(150) > Wd.expNeed(100) * 4);
});
test('職業等級：打怪升級、一轉上限 50、技能點 49', () => {
  const p = Pg.ensureJob(Wd.newPlayer('sword'));
  assert.ok(Pg.gainJobExp(p, 1e9) > 0); assert.equal(p.job.lv, 50);
  assert.equal(S.skillPoints(p).free, 49);
});
test('轉職：條件、兩條路線、二轉多 69 點與路線技能', () => {
  const p = Pg.ensureJob(Wd.newPlayer('archer'));
  assert.equal(Pg.advanceJob(p, 'hawk'), false, '等級不夠不能轉');
  p.lv = 45; p.job.lv = 40;
  assert.equal(Pg.advanceJob(p, 'guard'), false, '別的職業的路線不行');
  assert.equal(Pg.advanceJob(p, 'hawk'), true);
  assert.equal(Pg.jobTitle(p, '射手'), '鷹眼射手');
  Pg.gainJobExp(p, 1e12); assert.equal(p.job.lv, 70);
  assert.equal(S.skillPoints(p).free, 49 + 69);
  assert.equal(S.whyNot(p, 'starEye'), '需要 觀星 Lv5');
});
test('技能被動會反映在能力值', () => {
  const p = Pg.ensureJob(Wd.newPlayer('sword')); p.lv = 30; p.job.lv = 30;
  const a0 = Wd.stats(p).atk;
  for (let i = 0; i < 10; i++) S.learnSkill(p, 'lampSword');
  assert.ok(Wd.stats(p).atk > a0 * 1.15);
});
test('舊存檔：舊路線 id 換成新的、舊技能等級免費重置、轉生拿掉', () => {
  const p = Pg.ensureJob({ cls: 'sword', lv: 80, job: { tier: 2, lv: 30, branch: 'blademaster' }, skillLv: { spin: 5 }, reborn: 2 });
  assert.equal(p.job.branch, 'heavy'); assert.equal(p.skillLv, undefined); assert.equal(p.reborn, undefined);
  assert.equal(S.lvOf(p, 'lampSlash'), 1);
});
