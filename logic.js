// 純邏輯模組：題目、計分、結果編碼。無 DOM 依賴，方便測試。
export const QUESTIONS = [
  { q: '週五晚上，你最想做什麼？', a: [['揪一群朋友去熱炒', 'E'], ['窩在家追劇', 'I']] },
  { q: '旅行前你會…', a: [['排好每小時的行程', 'J'], ['訂好機票就出發', 'P']] },
  { q: '朋友跟你訴苦，你第一反應是？', a: [['幫他分析解決辦法', 'T'], ['先抱抱他、陪他罵', 'F']] },
  { q: '你比較相信？', a: [['看得到的數據', 'S'], ['說不出來的直覺', 'N']] },
  { q: '聚會上認識新朋友，你通常…', a: [['主動開話題', 'E'], ['等別人來找我', 'I']] },
  { q: '截止日前一週，你的進度是？', a: [['早就做完了', 'J'], ['還沒開始，但我不慌', 'P']] },
  { q: '看電影時你更在意？', a: [['劇情合不合理', 'T'], ['有沒有被打動', 'F']] },
  { q: '你的房間比較像？', a: [['東西都有固定位置', 'S'], ['亂中有序的藝術品', 'N']] },
];

// 8 種結果：依 E/I、J/P、T/F 三軸（S/N 作為副屬性顯示）
export const RESULTS = {
  EJT: { name: '指揮官柴犬', emoji: '🐕', desc: '天生的領袖，群組裡揪團、分工、訂位都是你。朋友說：「有你在就安心。」', match: 'IPF' },
  EJF: { name: '暖心企鵝', emoji: '🐧', desc: '大家的開心果兼保母，記得每個人的生日，也記得誰不吃香菜。', match: 'IPT' },
  EPT: { name: '冒險家狐狸', emoji: '🦊', desc: '想到就做，點子比誰都多。生活對你來說就是一場即興秀。', match: 'IJF' },
  EPF: { name: '派對海豚', emoji: '🐬', desc: '走到哪裡氣氛就嗨到哪裡，你的笑聲是最好的社交貨幣。', match: 'IJT' },
  IJT: { name: '策略家貓頭鷹', emoji: '🦉', desc: '安靜但什麼都看在眼裡，計畫永遠有 Plan B 和 Plan C。', match: 'EPF' },
  IJF: { name: '守護者水獺', emoji: '🦦', desc: '溫柔又可靠，默默把身邊的人照顧好，是朋友心中的避風港。', match: 'EPT' },
  IPT: { name: '神秘黑貓', emoji: '🐈‍⬛', desc: '有自己的節奏和小宇宙，偶爾說一句話就讓全場安靜三秒。', match: 'EJF' },
  IPF: { name: '夢想家樹懶', emoji: '🦥', desc: '慢慢來比較快。你的腦袋裡裝著整個奇幻世界。', match: 'EJT' },
};

export function score(answers) {
  if (!Array.isArray(answers) || answers.length !== QUESTIONS.length) {
    throw new Error('answers length mismatch');
  }
  const c = { E: 0, I: 0, J: 0, P: 0, T: 0, F: 0, S: 0, N: 0 };
  answers.forEach((choice, i) => {
    const opt = QUESTIONS[i].a[choice];
    if (!opt) throw new Error(`invalid choice at ${i}`);
    c[opt[1]]++;
  });
  // 平手時預設前者（每軸 2 題，可能 1:1）
  const key = (c.E >= c.I ? 'E' : 'I') + (c.J >= c.P ? 'J' : 'P') + (c.T >= c.F ? 'T' : 'F');
  const sub = c.S >= c.N ? '務實派' : '直覺派';
  return { key, sub };
}

export function encodeResult(key) {
  return RESULTS[key] ? `r=${key}` : '';
}

export function decodeResult(hash) {
  const m = /(?:^|[#&])r=([A-Z]{3})(?:&|$)/.exec(hash || '');
  return m && RESULTS[m[1]] ? m[1] : null;
}
