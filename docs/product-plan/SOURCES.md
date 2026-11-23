# RO 倖存者研究與技術來源

最新資料截點為 2026-11-18；2026-11-17 的鎖定快照仍保留。RO Survivors 與 HANS 仍快速更新；版本數字、交易規則與內容量只代表查閱當時。實作規格以本計畫重新整理的內容資料為準，不在 runtime 抓取其他遊戲網站。

# 第一手作品來源

| 來源 | 性質 | 本計畫使用範圍 |
| --- | --- | --- |
| [RO Survivors 官方站](https://ro-survivors.com/) | Reven4nt 唯一官方入口 | 遊戲定位、瀏覽器／PWA、現行介面與功能概況 |
| [RO Survivors 法律、規則與隱私](https://ro-survivors.com/legal.html) | 原作者第一手；最後審閱頁面標示 2026-11-01 | 唯一官方網址、原作者程式與系統權利、RO 素材歸屬、交易驗證、物品履歷、塔 replay |
| [RO Survivors Credits](https://www.ro-survivors.com/credits.html) | 原作者第一手 | Claude 的角色、PixiJS、Three.js、Vite、TypeScript、Node.js、rAthena 與 roBrowser 使用情形 |
| [RO Survivors 天賦樹](https://www.ro-survivors.com/talents.html) | 原作者第一手 | 職業／二轉輪廓、每職三分支與 Job 等級天賦概念 |
| [作者 Reddit 首發與更新串](https://www.reddit.com/r/RagnarokOnline/comments/1xmyhng/ro_survivors_a_free_browser_survivors_game_with/) | 作者第一手加玩家回覆；2026-11-03 起 | 初版內容、手機記憶體優化、平衡、多人主機負載與實際回饋 |
| [HANS 主站](https://ro.hans-webgametw.com/) | HANS 自己的版本與公告 | HANS 功能清單及版本差異；不能證明取得原作者授權 |
| [HANS Credits](https://ro.hans-webgametw.com/credits.html) | HANS 第一手自述 | HANS 明載「改作自 RO Survivors」、繁中化、多人伺服器與營運 |
| [HANS 公開版本公告 JSON](https://ro.hans-webgametw.com/hans-news.json) | HANS 第一手；2026-11-18 查閱 | V0.13.5；節慶雙王／闖入者、改名、待選升級保存、聊天泡泡及營運限制；只保存我方摘要與 response hash |
| [HANS 即時公告](https://ro.hans-webgametw.com/api/notice) | HANS 第一手；2026-11-18 rev 29 | 六周目、新章節／爬塔方向、拾取計數、信件到期與穩定性修正；不鏡像公告全文 |
| [官方／HANS 公開狀態](https://ro-survivors.com/status.json)／[HANS status](https://ro.hans-webgametw.com/status.json)／[HANS guest status](https://ro.hans-webgametw.com/api/guest-status) | 公開 read-only 狀態端點 | 只記錄來源健康度與時間點，不成為 runtime 功能旗標或爬取許可 |
| [官方 PWA Manifest](https://ro-survivors.com/app-manifest.json)／[HANS Manifest](https://ro.hans-webgametw.com/app-manifest.json) | 公開 app metadata | 語言、scope、start URL、standalone、方向與 icon |
| `handoff/public-client-artifacts.csv` | Codex 於 2026-11-17 計算的非保存式指紋 | 官網公開 client 的 URL、bytes、ETag、Last-Modified、SHA-256；不含原始碼 |

# 權利與營運商來源

| 來源 | 日期／範圍 | 重點 |
| --- | --- | --- |
| [日本 GungHo RO 著作物利用規範](https://ragnarokonline.gungho.jp/support/play-manner/copyright.html) | 2026-10-27 更新；日本營運範圍 | 列同人遊戲為粉絲活動例子，但限定非商業與權利標示；Q&A 說客戶端內除 BGM 外資料不可直接作二創，並限制以客戶端／官網素材作 AI 來源。不可當成台灣或全球授權。 |
| [台灣 RO 官方 私服請勿下載](https://ro.gnjoy.com.tw/notice/notice_view.aspx?id=348) | 2016-11-02；台灣營運商公告 | 台灣營運商對架設、協助與遊玩私服的公開立場。 |
| [台灣 RO 遊戲管理規則](https://ro.gnjoy.com.tw/Rule) | 頁面標示更新於 2026-03-03 | 未授權程式修改、RMT、外掛與帳號／電磁記錄規則。 |

本文件不是法律意見。計畫按使用者的非營利同人用途先完成 `fan-local`，公開部署保留獨立權利閘門。

# 中文與台灣介紹、攻略及社群資料

| 來源 | 日期／性質 | 可支持的觀察 |
| --- | --- | --- |
| [NOWnews 遊戲介紹](https://www.nownews.com/amp/news/6891655) | 2026-11-12 媒體 | 六職、瀏覽器遊玩、裝備卡片、廣場、組隊與非官方身分 |
| [Yahoo 台灣爆紅與經濟問題](https://tw.news.yahoo.com/%E3%80%8Aro%E5%80%96%E5%AD%98%E8%80%85%E3%80%8B%E9%81%8A%E6%88%B2%E5%A4%B1%E6%8E%A7%EF%BC%9F%E5%8F%B0%E7%81%A3%E7%88%86%E7%B4%85%E3%80%8C%E5%A4%96%E6%8E%9B%E5%92%8C%E7%8F%BE%E9%87%91%E8%B2%B7%E8%B3%A3%E3%80%8D%E4%BD%9C%E8%80%85%E6%80%A5%E6%94%B9%E8%A6%8F%E5%89%87-064302485.html) | 2026-11-15 媒體 | 爆量、排隊、機器人、RMT、交易限制與台灣版爭議 |
| [亞洲電玩通完整攻略](https://asiagamemaster.com/guide-ro-survivors) | 2026-11-16；攻略整理 | 核心循環、難度、寶箱、組隊、六職、二轉、關卡、裝備、精煉、寵物與交易規則 |
| [RO 倖存者小百科](https://jtnhrbpvvm-spec.github.io/taiwan_game2/RO%E5%80%96%E5%AD%98%E8%80%85/) | 2026-11-16；非官方資料整理 | 當時內容量、掉落與組隊規則；資料快速過期，不當成正式 API |
| [PTT／Disp 玩家討論](https://disp.cc/b/ACG/iku5) | 2026-11；玩家分享 | 即開即玩、手機與懷舊感等反應 |
| [HANS 與原版差異整理](https://twgamex.com/games/ro-survivors/1878/) | 2026-11-16；二手整理 | HANS 擺攤、關卡、寵物、卡片、裝備及原作者否認合作等差異；以第一手頁面覆核 |

# 海外玩家與競品資料

| 來源 | 性質 | 可支持的觀察 |
| --- | --- | --- |
| [三款 RO 倖存者比較討論](https://www.reddit.com/r/RagnarokOnline/comments/1xqzt5h/if_were_gonna_make_like_3_ragnarok_survivors/) | 國際玩家經驗 | RO 手感、冷卻與詠唱、手機 UI、特效雜亂、內容量和平衡差異 |
| [Midgard Survivors 發布與玩家回饋](https://www.reddit.com/r/RagnarokOnline/comments/1xqcn8m/hi_again_after_your_feedback_on_my_last_two_posts/) | 開發者聲明加玩家留言 | 大量內容、四人合作、跨平台需求、手機按鈕、誤售、音訊、特效與裝備資訊痛點 |
| [Midgard Survival 發布帖](https://www.reddit.com/r/RagnarokOnline/comments/1xqvxgu/midgard_survival_a_free_prerenewal_ro_survivors/) | 競品開發者及玩家 | 預更新定位、手機實測與內容量取捨 |
| [Midgard Survivors 開發紀錄](https://www.reddit.com/r/RagnarokOnline/comments/1xej5de/ragnarok_survivors_is_now_midgard_survivors_heres/) | 競品開發者 | 名稱變更、AI 輔助、方向與行動版需求 |

玩家留言屬經驗資料，不代表整體母體。計畫只把多次出現、能轉成測試條件的問題列入驗收，例如 iPhone 記憶體、觸控尺寸、特效可讀性、首領判定、host-based co-op 與平衡差距。

# 技術第一手來源

| 來源 | 用途 |
| --- | --- |
| [Three.js InstancedMesh 官方文件](https://threejs.org/docs/pages/InstancedMesh.html) | 大量相同模型以 instancing 降低 draw calls |
| [PixiJS 8 效能指引](https://pixijs.com/8.x/guides/concepts/performance-tips) | 雖本方案不以 Pixi 作主 renderer，仍用來交叉檢查 atlas、批次、貼圖卸載、文字與手機記憶體原則 |
| [Colyseus 官方概念文件](https://docs.colyseus.io/) | Phase 6 重新確認權威房間、同步與媒合；版本在該階段才固定 |
| [roBrowserLegacy GitHub](https://github.com/MrAntares/roBrowserLegacy) | GPL 的 RO WebGL 客戶端與格式解析來源；實作使用本機固定 commit |
| [roBrowserLegacy Remote Client](https://github.com/FranciscoWallison/roBrowserLegacy-RemoteClient-JS) | GPL 的 GRF／WebSocket 資產服務；實作使用本機固定 commit |
| [rAthena](https://github.com/rathena/rathena) | GPL 的 RO 伺服器及資料結構參考；不直接當倖存者戰鬥核心 |

# 本機實證來源

以下資料只存在使用者電腦，不應公開成下載連結：

- `C:\Users\user\Downloads\RO-Amatsu\目前進度與啟動方式.md`
- `C:\Users\user\Downloads\RO-Amatsu\繁中驗收範圍.md`
- `C:\Users\user\Downloads\RO-Server\browser-research\SOURCES.md`
- `C:\Users\user\Downloads\RO-Server\驗證結果.md`
- `C:\Users\user\Downloads\RO-Server\browser-research\roBrowserLegacy\LICENSE`
- `C:\Users\user\Downloads\RO-Server\browser-research\roBrowserLegacy\package.json`
- `C:\Users\user\Downloads\RO-Server\browser-research\remote-client\package.json`

這些檔案支持本機 GRF 雜湊、rAthena／roBrowser commit、Safari／瀏覽器測試狀態、繁中資料量與舊工作樹已有修改等結論。

