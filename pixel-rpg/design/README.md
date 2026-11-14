# 長夜燈火：數值設計腳本

設計文件裡的數字都由這裡的腳本算出來，改公式後重跑即可更新。

| 檔案 | 內容 |
|---|---|
| `levels.py` | Lv1–200 經驗曲線、各種玩法效率、效率保護、到達天數 |
| `roster.py` | 怪物名單（名稱、屬性、種族、體型、原型、特性、素材） |
| `monsters.py` | 依公式產生怪物圖鑑 → `monsters.csv`、`monsters.json` |
| `skills.py` | 12 條二轉路線的技能數值與 120 秒戰鬥模擬（輸出、群體、隊伍貢獻、有效生命、治療） |
| `gen_docs.py` | 產生設計文件分頁用的 `monster_tab.md`、`skill_tab.md` |

```
python3 levels.py
python3 monsters.py
python3 skills.py
python3 gen_docs.py
```
