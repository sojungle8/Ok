# 首版素材唯讀稽核

稽核日期：2026-11-17。所有檢查均為唯讀；沒有修改舊 RO 目錄、沒有啟動服務、沒有讀取登入資料。

## Canonical source

- 根目錄：`C:\Users\user\Downloads\RO-Server\browser-research\client-assets\kro2021`
- `data.grf`：2,966,717,458 bytes；SHA-256 `FA3B7BBDBD650C3468ECA5E978A44E7A848D533F2735E6F5AF2B668E1D1DC3B6`
- `rdata.grf`：306,697,843 bytes；SHA-256 `FA6367B8ABC5D1297DE742A127CFF4E1DA626AB3D6B1B0A81BA563CB3CB5124E`
- BGM 實體目錄：`C:\Users\user\Downloads\RO-Server\browser-research\client-assets\kro2021\BGM`
- 白名單 48 筆的 CP949 hex 與 UTF-8 URI 已逐列 round-trip 驗證，零錯誤。

## 玩家疊圖

男女劍士各使用 body、hair、weapon、shield 四層。八組 ACT 都是 2.4、104 actions，可按相同 action／direction／frame clock 合成；每層仍使用自己的 pivot。地面物品 `data\sprite\아이템\소드.*` 不是人物武器 overlay，不得混用。

預設 palette：

- `data\palette\몸\검사_남_0.pal`
- `data\palette\몸\검사_여_0.pal`
- `data\palette\머리\머리1_남_0.pal`
- `data\palette\머리\머리1_여_0.pal`

每個 palette 都是 1,024 bytes。

## 魔物

12 組魔物檔均已透過既有 GRF reader 實際解包；SPR magic 均為 `SP 2.1`、ACT magic 均為 `AC`，沒有 parser error。

| ID | Aegis | basename | 用途 | ACT |
| ---: | --- | --- | --- | --- |
| 1002 | PORING | `poring` | 普通／菁英共用 | 2.5 / 72 actions |
| 1113 | DROPS | `drops` | 普通 | 2.5 / 72 |
| 1007 | FABRE | `fabre` | 普通 | 2.4 / 48 |
| 1063 | LUNATIC | `lunatic` | 普通 | 2.5 / 64 |
| 1011 | CHONCHON | `chocho` | 普通 | 2.5 / 72 |
| 1010 | WILOW | `wilow` | 普通 | 2.4 / 40 |
| 1052 | ROCKER | `rocker` | 普通 | 2.5 / 64 |
| 1088 | VOCAL | `vocal` | 小頭目 | 2.4 / 40 |
| 1020 | MANDRAGORA | `mandragora` | 普通 | 2.4 / 40 |
| 1167 | SAVAGE_BABE | `savage_babe` | 普通 | 2.5 / 64 |
| 1031 | POPORING | `poporing` | 普通／菁英共用 | 2.5 / 72 |
| 1090 | MASTERING | `mastering` | MVP | 2.4 / 40 |

菁英來源 ID 2696 `C3_PORING` 與 2701 `C3_POPORING` 分別共用 Poring／Poporing 圖像，由本作加 outline、色調與單一額外機制辨識，不複製一份 atlas。

## 地圖

選用 `prt_fild08`，rAthena map index 201。它從普隆德拉南門直連；checked Renewal spawn 含 Poring、Lunatic、Fabre，Pre-Renewal 含 Poring、Lunatic、Drops。其餘首版怪物是本作的倖存者波次，不宣稱為原圖 spawn。

| 檔案 | Bytes | 格式驗證 | SHA-256 |
| --- | ---: | --- | --- |
| `data\prt_fild08.rsw` | 219,402 | `GRSW`；引用同名 GND／GAT | `1ebc0c9621e7652c56b5d9d48395f6a5420f9c9df03f34b0b36f6875cfdbb9c6` |
| `data\prt_fild08.gnd` | 5,272,734 | `GRGN 1.7`；200×200 tiles | `9e5bdbc8c0a1ce1f2c1e98b928535745eedd80c72f363206d6963d817f858dc6` |
| `data\prt_fild08.gat` | 3,200,014 | `GRAT 1.2`；400×400 cells | `bb7908930002a276e59efd0dbc2c46efa15f05a01e6573ee7b78d9a2b1b4a0f0` |

`mp3nametable.txt` 對應 `prt_fild08.rsw#bgm\12.mp3#`。`BGM\12.mp3` 為 SoundTeMP〈Streamside〉，1,476,608 bytes，SHA-256 `814A8484603741406BDB5AD0F16F4B9D4BCA6218F8C23D88CBF6983E6C6DA58E`。

## 技能 ID

以下只作名稱／來源對應，不匯入 rAthena 戰鬥公式：

| ID | Constant | Max | Quest |
| ---: | --- | ---: | --- |
| 2 | SM_SWORD | 10 | no |
| 3 | SM_TWOHAND | 10 | no |
| 4 | SM_RECOVERY | 10 | no |
| 5 | SM_BASH | 10 | no |
| 6 | SM_PROVOKE | 10 | no |
| 7 | SM_MAGNUM | 10 | no |
| 8 | SM_ENDURE | 10 | no |
| 144 | SM_MOVINGRECOVERY | 1 | yes |
| 145 | SM_FATALBLOW | 1 | yes |
| 146 | SM_AUTOBERSERK | 1 | yes |

## Parser 與 gateway 驗收

1. GRF lookup 先使用 `raw_name_hex`，再以 `normalized_request_path` 驗證同一 entry；不依 OS locale 猜路徑。
2. ACT parser 的 fixture 必須至少含一個 2.4 與一個 2.5 檔，並驗證 action count、8 directions、frame timing、pivot、mirror、sound event。
3. 玩家四層使用單一 animation clock；缺少 overlay frame 時回報明確 asset ID，不靜默錯位。
4. RSW 只允許載入其宣告的 GND／GAT 與依賴圖；先輸出 dependency report，再擴大 RSM 白名單。
5. GAT debug view 必須逐格顯示 walk type；碰撞與畫面障礙抽樣比對後才能開始戰鬥施工。
6. 每次抽取都記 source GRF hash、entry raw hex、converter version、output hash；輸出只放 `.local-assets`。
7. `rights:check` 必須證明原始及衍生素材都未進 Git index、Git objects 或 `dist`。

## 本機證據位置

- 怪物 ID：`C:\Users\user\Downloads\RO-Amatsu\server\db\re\mob_db.yml`
- 地圖 index：`C:\Users\user\Downloads\RO-Amatsu\server\db\map_index.txt`
- 生怪表：`server\npc\re\mobs\fields\prontera.txt` 與 `pre-re\mobs\fields\prontera.txt`
- 技能：`server\db\re\skill_db.yml`
- 技能常數：`server\src\map\skill.hpp`
- 資源映射：`C:\Users\user\Downloads\RO-Server\browser-research\roBrowserLegacy\src\DB\Monsters\MonsterTable.js`
- 路徑規則：`roBrowserLegacy\src\DB\DBManager.js`

上述舊目錄皆維持唯讀。

