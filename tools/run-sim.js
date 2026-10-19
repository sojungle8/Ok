// 無畫面跑模擬：每個產業用預設配置跑 N 天，看每日來客、營收與成本
// 用法：node tools/run-sim.js [天數] [產業id]
require('../js/data.js');
require('../js/fun.js');
require('../js/weird.js');
require('../js/activities.js');
require('../js/city.js');
require('../js/plots.js');
require('../js/portraits.js');
require('../js/industries.js');
require('../js/sim.js');
const { Sim } = globalThis.BossSim;
const { INDUSTRIES } = globalThis.BossIndustries;

const days = Number(process.argv[2]) || 14;
const only = INDUSTRIES.some((i) => i.id === process.argv[3]) ? process.argv[3] : null;
// 加上 smart：每天結束時，生氣離開超過 8% 就多請一個人
const smart = process.argv.includes('smart');
for (const ind of INDUSTRIES) {
  if (only && ind.id !== only) continue;
  const notes = [];
  const s = new Sim(ind.id, {
    callbacks: {
      notify: (t) => notes.push(t),
      // 自動測試：事件一律選第一個非小遊戲選項
      event: (ev) => {
        const i = ev.ev.choices.findIndex((c) => !c.minigame);
        s.resolve(ev, i);
      },
    },
  });
  if (smart) s.policy.autoStock = true;
  const t0 = Date.now();
  const rows = [];
  let lastCash = s.cash;
  s.cb.dayEnd = (r) => {
    rows.push(`  第${String(r.day).padStart(2)}天 來客${String(r.visitors).padStart(4)} 服務${String(r.served).padStart(4)} 生氣${String(r.angry).padStart(3)} 缺貨${String(r.soldOut).padStart(3)} 清潔${String(r.clean).padStart(3)} 太擠${String(r.balked).padStart(3)} 營收${String(Math.round(r.revenue)).padStart(7)} 薪資${String(r.wages).padStart(6)} 加班${r.ot.toFixed(1).padStart(5)}h | 現金${String(Math.round(s.cash)).padStart(8)} (${Math.round(s.cash - lastCash) >= 0 ? '+' : ''}${Math.round(s.cash - lastCash)}) ★${s.rating.toFixed(2)} 慣${s.jerk.toFixed(0)} 心情${s.morale.toFixed(0)} 員工${s.staff.length}`);
    lastCash = s.cash;
    if (smart && r.visitors && r.angry / r.visitors > 0.08 && s.staff.length < 10) s.hire(0);
  };
  while (s.day <= days && !s.over) s.tick(30);
  console.log(`\n${ind.icon} ${ind.name}（${((Date.now() - t0) / 1000).toFixed(1)} 秒）`);
  rows.forEach((r) => console.log(r));
  if (s.over) console.log('  結局：', s.ending.title);
  const w = s.history[s.history.length - 1];
  if (w) console.log(`  最後一週：營收 ${Math.round(w.revenue)} 進貨 ${Math.round(w.materials)}（報廢 ${w.waste}） 薪資 ${w.wages} 勞健保退 ${w.labor + w.health + w.pension} 房租 ${w.rent} 水電 ${w.utilities} 營業稅 ${w.tax}（${w.taxStatus}） 罰款 ${w.fines} 分店 ${w.branches} 淨利 ${Math.round(w.profit)}${w.rival ? ` | 對手 ${w.rival.name} ${w.rival.closed ? '已收攤' : w.rival.strength.toFixed(2)}` : ''}`);
  if (notes.length) console.log('  通知：', notes.slice(-4).join(' / '));
}
