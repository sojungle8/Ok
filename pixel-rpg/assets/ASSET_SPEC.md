# 微光大陸 美術素材規格書（給 Codex／繪師）

放進本資料夾 `pixel-rpg/assets/` 的素材，遊戲會自動換上；**缺的素材會繼續使用程式繪製的版本**，所以可以分批交付。
交付後執行 `node tools/build-manifest.mjs` 產生 `assets/manifest.json`，遊戲就會讀到。

---

## 1. 共通規則

| 項目 | 規定 |
|---|---|
| 格式 | PNG、透明背景、sRGB、不要有文字與浮水印 |
| 命名 | 全小寫英文、底線分隔，路徑完全照本文件 |
| 視角 | 俯視 3/4 角度（和目前遊戲相同），光源一律左上 |
| 定位點 | 角色、怪物、NPC、道具物件：**腳底中心**在畫布底部往上 8% 的正中央 |
| 留白 | 主體四周保留約 6% 透明邊，不要貼邊、不要被裁切 |
| 一致性 | 同一角色的所有部件請用同一張「角色設定圖」當參考，顏色碼統一 |
| 原創 | 不可模仿 Ragnarok Online、JoJo、伊蘭西亞或任何既有作品的角色、怪物、Logo |

### 共通風格提示詞（每張圖都接在最前面）
```
High-quality 2D game asset for a mobile fantasy RPG, chibi anime style (2.5 heads tall), clean cel shading with soft gradient highlights, crisp dark-brown outline (#2a1d2e), vibrant but harmonious palette, three-quarter top-down view, light from top-left, isolated on transparent background, centered, no text, no watermark, original design.
```

---

## 2. 角色（最重要）：分件（cutout）而不是逐格動畫

AI 很難畫出長相一致的連續動畫格，所以角色請畫成**分開的身體部件**，由遊戲程式組合、旋轉、位移做出待機、走路、攻擊、施法動作；換裝時只換對應部件。

- 每個部件一張 **256×256** PNG，部件的「關節點」放在畫布正中央（例如手臂的肩膀、腿的髖部、武器的握柄）。
- 三個朝向：`front`（面向鏡頭）、`back`（背向鏡頭）、`side`（**面向右**，左邊由程式翻轉）。

### 2-1 基本身體（四職業共用，膚色統一 #f7c9a3）
路徑：`char/body/{part}_{view}.png`

| part | 說明 |
|---|---|
| head | 頭部（不含頭髮）、大眼睛的 Q 版臉 |
| torso | 軀幹（素色內衣，會被護甲蓋住） |
| arm | 一隻手臂（肩到手腕），關節點＝肩膀 |
| hand | 手掌（握拳），關節點＝手腕 |
| leg | 一條腿（含素色褲子），關節點＝髖部 |

### 2-2 職業頭髮與臉部特徵
路徑：`char/{class}/hair_{view}.png`，class = `sword` `archer` `mage` `monk`

| class | 外型 |
|---|---|
| sword | 棕色短髮、紅色頭巾、堅毅的眼神 |
| archer | 金色馬尾、俐落瀏海 |
| mage | 銀白色長髮、溫和的眼神 |
| monk | 黑色刺蝟頭、額頭小疤痕 |

### 2-3 裝備部件（依稀有度 5 階：common good rare epic legend）
外觀要隨稀有度明顯升級：common 布料 → good 皮革 → rare 鋼鐵 → epic 紫色魔法金屬＋翅膀裝飾 → legend 金色＋寶石＋發光細節。

| 路徑 | 數量 | 說明 |
|---|---|---|
| `gear/helm/{style}_{tier}_{view}.png` | 4 款 × 5 階 × 3 朝向 | style：`helm`（劍士頭盔）、`hood`（弓手兜帽）、`hat`（法師帽）、`band`（拳師頭帶） |
| `gear/armor/{tier}_{view}.png` | 5 × 3 | 胸甲，蓋在 torso 上 |
| `gear/gloves/{tier}.png` | 5 | 護腕＋手套，蓋在 hand 上 |
| `gear/boots/{tier}.png` | 5 | 靴子，蓋在 leg 下半 |
| `gear/cape/{color}_{view}.png` | 2 × 3 | color：`purple`（史詩）、`red`（傳說） |
| `gear/weapon/{type}_{tier}.png` | 4 × 5 | type：`sword` `bow` `staff` `fist`；**橫放、握柄在畫布中心、尖端朝右** |

---

## 3. 怪物與魔王
路徑：`monster/{id}.png`，一般怪 **256×256**、魔王 **512×512**；每隻一張「面向鏡頭」的姿勢，由程式做彈跳、受擊、冰凍等動畫。

| 章 | id：名稱（外型提示） |
|---|---|
| 1 | `slime` 露珠史萊姆（水藍色水滴果凍）、`berry` 莓果史萊姆（粉紅色，頭上一顆莓果）、`ember` 餘燼史萊姆（橘紅色，身上有火星）、`king` 史萊姆王（綠色巨大果凍＋小王冠）※魔王 |
| 2 | `bat` 回音蝙蝠（紫色大耳蝙蝠）、`pebble` 碎石怪（砂岩小巨人）、`howl` 嚎叫蝙蝠（紅色獠牙蝙蝠）、`echo` 回音師（披著音波斗篷的巨大蝙蝠紳士）※魔王 |
| 3 | `cog` 齒輪兵（鐵灰色發條士兵）、`spark` 電光精（黃色電球精靈）、`smelter` 熔爐巨像（橘色熔爐機器人）、`clock` 時鐘匠（背著巨大時鐘的黃銅機械老匠人）※魔王 |
| 4 | `wisp` 湖畔幽光（藍色鬼火）、`armor` 空洞鎧甲（銀色無人騎士鎧）、`gargoyle` 石像鬼（灰色石翼小惡魔）、`mirror` 鏡之夫人（白色禮服、半透明、手持鏡子的幽靈貴婦）※魔王 |
| 5 | `crab` 紅鉗蟹、`lantern` 燈籠鬼（橘色紙燈籠妖怪）、`pirate` 霧港海盜（青綠色小惡魔海盜）、`faceless` 千面商人（戴多張面具的金色商人）※魔王 |
| 6 | `cultist` 蝕夜信徒（紫袍小惡魔）、`shade` 暗影（黑色剪影幽靈）、`eclipse` 蝕月史萊姆（深紫色史萊姆、月蝕光環）、`valde` 蝕夜教主瓦爾德（黑紫長袍、王冠、紅眼、三百歲的優雅魔王）※魔王 |
| 機關 | `mirror_obj` 魔鏡（金框落地鏡，鏡面有紫光） |

---

## 4. NPC
| 路徑 | 尺寸 | 說明 |
|---|---|---|
| `npc/{id}.png` | 256×256 | 全身站姿、面向鏡頭 |
| `portrait/{id}.png` | 512×512 | 對話框用的半身像，表情生動 |

id 與外型：`elder` 村長歐文（白髮紫袍老人）、`shop` 雜貨店莉莉（橘髮店員）、`inn` 旅店瑪莎（紅髮綠圍裙）、`smith` 鐵匠葛倫（黑髮壯漢）、`fisher` 釣客阿杰（黃色漁夫帽）、`porter` 傳送師小葵（水藍髮魔法少女）、`guide2` 峽谷嚮導露娜、`guide3` 工坊領班鐵叔、`guide4` 古堡管家賽巴、`guide5` 夜市老闆娘阿月、`guide6` 神殿守衛凱。
隊友：`ally_lena` 聖騎士蕾娜（銀甲金髮女騎士、大盾）、`ally_mia` 牧師米婭（白金法袍、聖光權杖）、`ally_carlos` 遊俠卡洛斯（綠斗篷長弓）、`ally_nova` 元素師諾娃（紅黑法袍、火焰法杖）、`ally_buck` 拳師巴克（光頭壯漢、鐵拳套）。

---

## 5. 魂像（守護靈）
| 路徑 | 尺寸 | 說明 |
|---|---|---|
| `soul/{id}.png` | 256×256 | 遊戲中跟著角色漂浮的小尺寸版本 |
| `soul_art/{id}.png` | 1024×1024 | 大招定格用的大型立繪：誇張透視、強烈戲劇姿勢、粗黑描邊 |

id：`gear` 鏽紅齒輪（齒輪頭紅色機械人）、`post` 千手郵差（很多手的藍色郵差）、`magnet` 磁極兄弟（紫粉雙子磁鐵人）、`cat` 午夜黑貓（金眼黑貓人形）、`thread` 白線裁縫（白色裁縫人偶、大剪刀與線）、`bird` 玻璃夜鶯（玻璃材質的發光夜鶯人形）。

---

## 6. 地圖
| 路徑 | 尺寸 | 說明 |
|---|---|---|
| `tile/{theme}_ground_{1-3}.png` | 128×128 | 可無縫拼接的地面，3 種變化 |
| `tile/{theme}_path.png` | 128×128 | 道路，可無縫拼接 |
| `tile/{theme}_water.png` | 128×128 | 水面（meadow、castle、harbor 才需要） |
| `prop/{theme}_obstacle_{1-2}.png` | 256×256 | 擋路物（樹、岩柱、木箱…），腳底定位 |
| `prop/{theme}_deco_{1-3}.png` | 128×128 | 不擋路的小裝飾（花、碎石、螺絲…） |
| `prop/house_{red,blue,green,purple}.png` | 384×384 | 村莊房屋（3×3 格） |
| `prop/fountain.png`、`prop/signpost.png`、`prop/portal.png` | 256×256 | |

theme：`meadow` 草原、`canyon` 峽谷、`factory` 工坊城、`castle` 古堡、`harbor` 夜市碼頭、`temple` 神殿。

---

## 7. 道具圖示
路徑：`icon/{id}.png`，**128×128**，物件置中、帶一點立體光影。
- 裝備：`weapon_{type}_{tier}`、`helm_{tier}`、`armor_{tier}`、`gloves_{tier}`、`boots_{tier}`、`ring_{tier}`
- 道具：`red`、`orange`、`white`（三種藥水瓶）、`scroll`、`feather`、`elixir`、`ore`、`ore2`
- 素材：`mat_{怪物id}`（每種怪物一個，例如 `mat_slime` 黏液、`mat_bat` 蝙蝠翅膀）
- 卡片：`card_frame`（空白卡片外框，程式會把怪物圖放進去）

---

## 8. 技能特效貼圖（重要：做出有氣勢的技能）
路徑：`vfx/{id}.png`，**512×512**，**白色或淺灰、黑色以外全透明**（程式會上色並用「發光疊加」混合）。

| id | 內容 |
|---|---|
| `slash_arc` | 一道新月形刀光（揮砍軌跡） |
| `slash_heavy` | 粗重、帶裂痕的大刀光 |
| `glow_soft` | 柔和的圓形光暈 |
| `spark_star` | 四角星形閃光（命中火花） |
| `impact_burst` | 放射狀衝擊爆裂 |
| `ring_wave` | 一圈衝擊波 |
| `smoke_puff` | 一團煙霧 |
| `magic_circle` | 魔法陣（圓形符文，可旋轉） |
| `light_pillar` | 垂直光柱 |
| `lightning` | 一道閃電 |
| `ice_shard` | 冰晶碎片 |
| `fire_burst` | 火焰爆炸 |
| `wind_swirl` | 旋風氣流 |
| `feather_glow` | 發光羽毛（技能粒子用） |

---

## 9. 介面與宣傳
| 路徑 | 尺寸 | 說明 |
|---|---|---|
| `ui/skill_{skillId}.png` | 128×128 | 12 個技能圖示：spin wave quake triple rain pierce nova fireball chain barrage shock dragon |
| `ui/btn_attack.png`、`ui/btn_dodge.png`、`ui/btn_potion.png` | 128×128 | 操作按鈕 |
| `ui/logo.png` | 1024×512 | 「微光大陸」中文標題字 Logo（這張需要文字） |
| `ui/title_bg.png` | 1920×1080 | 標題畫面背景：微光村俯瞰、黃昏、星痕流星 |
| `promo/key_art.png` | 1920×1080 | 宣傳主視覺：四職業主角＋魂像 |
| `promo/app_icon.png` | 1024×1024 | App 圖示 |

---

## 10. 優先順序（建議分三批交付）
1. **第一批（效果最明顯）**：技能特效貼圖（第 8 節）、怪物與魔王（第 3 節）、魂像大招立繪（`soul_art`）
2. **第二批**：角色分件與裝備部件（第 2 節）、NPC 與對話頭像（第 4 節）
3. **第三批**：地圖（第 6 節）、道具圖示（第 7 節）、介面與宣傳（第 9 節）
