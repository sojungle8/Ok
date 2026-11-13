// 微光大陸：隊伍（AI 隊友）。之後上線化時，同一套隊伍資料可以換成真人玩家。
export const PARTY_MAX = 3;
export const COMPANIONS = {
  lena: { name: '蕾娜', title: '聖騎士', role: 'tank', color: '#ffd166', unlock: [1, 2], price: 300, hpMul: 1.6, atkMul: 0.35, range: 1, cool: 0.7, skillCd: 10,
    desc: '血最厚。每 10 秒「嘲諷」周圍怪物，讓牠們改打她。', skill: '神聖嘲諷',
    look: { hair: '#f6c945', outfit: { main: '#c8ccdb', dark: '#7a8399', trim: '#ffd166' }, trimClass: '#ffd166', cape: '#3f74d1', helm: { style: 'helm', color: '#e8e4f0', tier: 2 }, weapon: { type: 'sword', color: '#cfe3ff', tier: 2 }, gloves: '#a9bad6', boots: '#5d6f94' } },
  mia: { name: '米婭', title: '牧師', role: 'heal', color: '#7ad35a', unlock: [1, 2], price: 300, hpMul: 0.8, atkMul: 0.2, range: 5, cool: 1.1, skillCd: 4,
    desc: '幫血最少的隊友補血，倒地的隊友也能救起來。', skill: '聖光治癒',
    look: { hair: '#ffe8b0', outfit: { main: '#fff8e7', dark: '#d9c9a0', trim: '#f6c945' }, trimClass: '#f6c945', cape: null, helm: { style: 'hat', color: '#fff8e7', tier: 1 }, weapon: { type: 'staff', color: '#ffe066', tier: 3 } } },
  carlos: { name: '卡洛斯', title: '遊俠', role: 'dps', color: '#6fd36a', unlock: [2, 0], price: 600, hpMul: 0.85, atkMul: 0.55, range: 6, cool: 0.55, skillCd: 7,
    desc: '遠距離射擊，每 7 秒放一次「扇形連射」。', skill: '扇形連射',
    look: { hair: '#6b3e26', outfit: { main: '#3f7a3a', dark: '#24502a', trim: '#e8d29a' }, trimClass: '#e8d29a', cape: null, helm: { style: 'hood', color: '#2f6b3a', tier: 1 }, weapon: { type: 'bow', color: '#c98b4a', tier: 1 } } },
  nova: { name: '諾娃', title: '元素師', role: 'dps', color: '#ff7b54', unlock: [2, 0], price: 600, hpMul: 0.7, atkMul: 0.6, range: 5, cool: 0.85, skillCd: 8,
    desc: '火焰魔法輸出，每 8 秒丟一顆會爆炸的大火球。', skill: '爆炎球',
    look: { hair: '#d64550', outfit: { main: '#3a1f2e', dark: '#1f1018', trim: '#ff7b54' }, trimClass: '#ff7b54', cape: '#d64550', helm: null, weapon: { type: 'staff', color: '#ff8a3d', tier: 3 } } },
  buck: { name: '巴克', title: '拳師', role: 'dps', color: '#ffa94d', unlock: [3, 0], price: 900, hpMul: 1.15, atkMul: 0.45, range: 1, cool: 0.3, skillCd: 6,
    desc: '貼身高速連打，每 6 秒放一次「爆裂拳」。', skill: '爆裂拳',
    look: { hair: '#2b2230', outfit: { main: '#9c4f1c', dark: '#5e2f10', trim: '#fff1c4' }, trimClass: '#fff1c4', cape: null, helm: { style: 'band', color: '#d64550', tier: 1 }, weapon: { type: 'fist', color: '#9aa3b5', tier: 2 } } },
};
export const COMPANION_IDS = Object.keys(COMPANIONS);
export const ROLE_NAME = { tank: '坦克', heal: '治療', dps: '輸出' };
export function ensureParty(p) {
  if (!p.party || typeof p.party !== 'object') p.party = {};
  p.party.hired = (Array.isArray(p.party.hired) ? p.party.hired : []).filter((id) => COMPANIONS[id]);
  p.party.active = (Array.isArray(p.party.active) ? p.party.active : []).filter((id) => p.party.hired.includes(id)).slice(0, PARTY_MAX);
  if (!['assist', 'follow'].includes(p.party.tactic)) p.party.tactic = 'assist';
  return p;
}
// 招募條件：[章節, 該章至少到第幾步]
export function unlocked(p, id) { const [ch, step] = COMPANIONS[id].unlock; return p.ch > ch || (p.ch === ch && p.step >= step); }
export function hire(p, id) {
  const c = COMPANIONS[id];
  if (!c) return { ok: false, reason: '沒有這位夥伴' };
  if (p.party.hired.includes(id)) return { ok: false, reason: '已經招募了' };
  if (!unlocked(p, id)) return { ok: false, reason: `第 ${c.unlock[0]} 章之後才能招募` };
  if (p.coins < c.price) return { ok: false, reason: `金幣不足（需要 ${c.price}）` };
  p.coins -= c.price; p.party.hired.push(id);
  if (p.party.active.length < PARTY_MAX) p.party.active.push(id);
  return { ok: true };
}
export function toggleActive(p, id) {
  const a = p.party.active;
  if (a.includes(id)) { a.splice(a.indexOf(id), 1); return true; }
  if (!p.party.hired.includes(id) || a.length >= PARTY_MAX) return false;
  a.push(id); return true;
}
// 隊友數值跟著主角走：主角變強，隊友也一起變強
export function allyStats(c, st) { return { max: Math.round(st.hp * c.hpMul), atk: Math.max(1, Math.round(st.atk * c.atkMul)) }; }
