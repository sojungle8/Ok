# 第四批美術需求（長夜燈火改版）

> 這份由 `node tools/art_batch4.mjs` 自動產生，已有的圖會自動跳過。完整提示詞在 `request.json`。

世界觀：長夜燈火。三百年的長夜吞掉了人和地方的名字，守燈人用燈火守住名字。怪物多半是「失去名字的東西」：有點哀傷、有點可愛，不血腥。

## 交件規則

- 尺寸、透明背景、外框顏色照 `assets/ASSET_SPEC.md`。
- 怪物：面向鏡頭；攻擊圖和站姿同畫布、同比例、腳底同高。交件前跑 `python3 tools/check_attack.py <檔案們>`。
- 怪物不要畫成血腥或恐怖；「失去名字」的感覺用空白名牌、褪色、破洞、半透明來表現。
- 深夜版不用另外畫，遊戲會用同一張圖加夜色。
- 所有名字、造型都是本作原創，不要參考或模仿其他遊戲的角色、職業外觀。

## 優先順序

1. A 怪物（同一區的怪現在只有 6 種造型，最影響觀感）
2. B 斥候（有圖才能開放這個職業）
3. C 技能圖示
4. D 新道具、E 素材圖示

共 404 張：A 怪物 120、E 素材圖示 60、B 斥候 46、C 技能圖示 170、D 新道具 8

## A 怪物

| 檔案 | 尺寸 | 內容 |
|---|---|---|
| `monster/rabbit.png` | 256×256 | 忘歸野兔（守燈草原・Lv3・動物・無屬性・小型・敏捷）特性：被動；生命低於 30% 會逃跑 |
| `monster/rabbit_attack.png` | 256×256 | 忘歸野兔 攻擊姿勢（同一隻、同畫布、腳底同高） |
| `monster/dandelion.png` | 256×256 | 無名絮（守燈草原・Lv4・植物・風屬性・小型・群聚）特性：被動；死亡時飄散，減速周圍 1 秒 |
| `monster/dandelion_attack.png` | 256×256 | 無名絮 攻擊姿勢（同一隻、同畫布、腳底同高） |
| `monster/mouse.png` | 256×256 | 糧倉鼠（守燈草原・Lv7・動物・地屬性・小型・敏捷）特性：主動；會偷地上的掉落物 |
| `monster/mouse_attack.png` | 256×256 | 糧倉鼠 攻擊姿勢（同一隻、同畫布、腳底同高） |
| `monster/beetle.png` | 256×256 | 舊犁甲蟲（守燈草原・Lv9・昆蟲・地屬性・小型・硬殼）特性：被動；正面受到的傷害 −30% |
| `monster/beetle_attack.png` | 256×256 | 舊犁甲蟲 攻擊姿勢（同一隻、同畫布、腳底同高） |
| `monster/bee.png` | 256×256 | 迷蜂（守燈草原・Lv10・昆蟲・風屬性・小型・群聚）特性：主動；攻擊一隻，附近的會一起來 |
| `monster/bee_attack.png` | 256×256 | 迷蜂 攻擊姿勢（同一隻、同畫布、腳底同高） |
| `monster/mushroom.png` | 256×256 | 睡菇（守燈草原・Lv12・植物・毒屬性・小型・法術）特性：被動；被打時放出孢子，機率睡眠 1 秒 |
| `monster/mushroom_attack.png` | 256×256 | 睡菇 攻擊姿勢（同一隻、同畫布、腳底同高） |
| `monster/frog.png` | 256×256 | 啞蛙（守燈草原・Lv15・動物・水屬性・小型・遠程）特性：被動；吐水泡遠程攻擊 |
| `monster/frog_attack.png` | 256×256 | 啞蛙 攻擊姿勢（同一隻、同畫布、腳底同高） |
| `monster/foxfire.png` | 256×256 | 狐火（守燈草原・Lv17・動物・火屬性・小型・敏捷）特性：主動；會短距離閃現 |
| `monster/foxfire_attack.png` | 256×256 | 狐火 攻擊姿勢（同一隻、同畫布、腳底同高） |
| `monster/scarecrow.png` | 256×256 | 空心稻草人（守燈草原・Lv18・無形・念屬性・中型・硬殼）特性：被動；不會移動，嚇退靠近的小動物 |
| `monster/scarecrow_attack.png` | 256×256 | 空心稻草人 攻擊姿勢（同一隻、同畫布、腳底同高） |
| `monster/boar.png` | 256×256 | 撞籬野豬（守燈草原・Lv20・動物・地屬性・中型・大型）特性：主動；直線衝撞擊退 |
| `monster/boar_attack.png` | 256×256 | 撞籬野豬 攻擊姿勢（同一隻、同畫布、腳底同高） |
| `monster/dust.png` | 256×256 | 沙塵影（迴聲峽谷・Lv19・無形・風屬性・小型・敏捷）特性：主動；命中降低周圍玩家命中 |
| `monster/dust_attack.png` | 256×256 | 沙塵影 攻擊姿勢（同一隻、同畫布、腳底同高） |
| `monster/lizard.png` | 256×256 | 岩縫蜥（迴聲峽谷・Lv21・動物・地屬性・小型・一般）特性：被動；躲在岩縫，靠近才出現 |
| `monster/lizard_attack.png` | 256×256 | 岩縫蜥 攻擊姿勢（同一隻、同畫布、腳底同高） |
| `monster/scorpion.png` | 256×256 | 封蠟蠍（迴聲峽谷・Lv24・昆蟲・毒屬性・小型・一般）特性：主動；攻擊附帶中毒 |
| `monster/scorpion_attack.png` | 256×256 | 封蠟蠍 攻擊姿勢（同一隻、同畫布、腳底同高） |
| `monster/cactus.png` | 256×256 | 守路仙人掌（迴聲峽谷・Lv25・植物・地屬性・中型・硬殼）特性：被動；被近戰攻擊反彈 10% 傷害 |
| `monster/cactus_attack.png` | 256×256 | 守路仙人掌 攻擊姿勢（同一隻、同畫布、腳底同高） |
| `monster/frogbat.png` | 256×256 | 谷蛙蝠（迴聲峽谷・Lv26・動物・風屬性・小型・敏捷）特性：主動；會飛越地形 |
| `monster/frogbat_attack.png` | 256×256 | 谷蛙蝠 攻擊姿勢（同一隻、同畫布、腳底同高） |
| `monster/hawk.png` | 256×256 | 斷羽鷹（迴聲峽谷・Lv29・動物・風屬性・中型・敏捷）特性：主動；俯衝攻擊後拉開距離 |
| `monster/hawk_attack.png` | 256×256 | 斷羽鷹 攻擊姿勢（同一隻、同畫布、腳底同高） |
| `monster/letter.png` | 256×256 | 未寄之信（迴聲峽谷・Lv31・不死・念屬性・小型・法術）特性：被動；被打會唸出信的內容，使附近玩家沉默 1 秒 |
| `monster/letter_attack.png` | 256×256 | 未寄之信 攻擊姿勢（同一隻、同畫布、腳底同高） |
| `monster/echoling.png` | 256×256 | 迴聲殘響（迴聲峽谷・Lv32・無形・念屬性・小型・法術）特性：主動；複製附近玩家上一招的屬性 |
| `monster/echoling_attack.png` | 256×256 | 迴聲殘響 攻擊姿勢（同一隻、同畫布、腳底同高） |
| `monster/bandit.png` | 256×256 | 劫信賊（迴聲峽谷・Lv34・人形・無屬性・中型・一般）特性：主動；會搶走玩家的金幣（打倒會掉回來） |
| `monster/bandit_attack.png` | 256×256 | 劫信賊 攻擊姿勢（同一隻、同畫布、腳底同高） |
| `monster/imp.png` | 256×256 | 黑信差（迴聲峽谷・Lv35・惡魔・暗屬性・小型・遠程）特性：主動；丟黑色信封，爆炸傷害 |
| `monster/imp_attack.png` | 256×256 | 黑信差 攻擊姿勢（同一隻、同畫布、腳底同高） |
| `monster/oilslime.png` | 256×256 | 油污團（鏽齒工坊城・Lv32・無形・毒屬性・小型・群聚）特性：被動；死亡時留下油漬，踩到減速 |
| `monster/oilslime_attack.png` | 256×256 | 油污團 攻擊姿勢（同一隻、同畫布、腳底同高） |
| `monster/rat.png` | 256×256 | 鐵皮鼠（鏽齒工坊城・Lv34・動物・無屬性・小型・敏捷）特性：主動；咬斷玩家的增益（隨機解除一個） |
| `monster/rat_attack.png` | 256×256 | 鐵皮鼠 攻擊姿勢（同一隻、同畫布、腳底同高） |
| `monster/screw.png` | 256×256 | 螺絲蜘蛛（鏽齒工坊城・Lv35・昆蟲・無屬性・小型・群聚）特性：主動；吐鐵絲網，定身 0.5 秒 |
| `monster/screw_attack.png` | 256×256 | 螺絲蜘蛛 攻擊姿勢（同一隻、同畫布、腳底同高） |
| `monster/sparkbug.png` | 256×256 | 火花蟲（鏽齒工坊城・Lv40・昆蟲・火屬性・小型・群聚）特性：主動；靠近時自爆 |
| `monster/sparkbug_attack.png` | 256×256 | 火花蟲 攻擊姿勢（同一隻、同畫布、腳底同高） |
| `monster/clockbird.png` | 256×256 | 發條鳥（鏽齒工坊城・Lv41・無形・風屬性・小型・敏捷）特性：被動；發條轉完會停 2 秒（破綻） |
| `monster/clockbird_attack.png` | 256×256 | 發條鳥 攻擊姿勢（同一隻、同畫布、腳底同高） |
| `monster/soot.png` | 256×256 | 煤灰精（鏽齒工坊城・Lv42・無形・暗屬性・小型・法術）特性：主動；噴煤灰，命中降低 |
| `monster/soot_attack.png` | 256×256 | 煤灰精 攻擊姿勢（同一隻、同畫布、腳底同高） |
| `monster/doll.png` | 256×256 | 失控人偶（鏽齒工坊城・Lv44・人形・念屬性・小型・一般）特性：主動；動作重複三次後必定暴擊 |
| `monster/doll_attack.png` | 256×256 | 失控人偶 攻擊姿勢（同一隻、同畫布、腳底同高） |
| `monster/worker.png` | 256×256 | 停擺工人（鏽齒工坊城・Lv46・人形・無屬性・中型・硬殼）特性：被動；每天重複同樣的動作，被打才醒來 |
| `monster/worker_attack.png` | 256×256 | 停擺工人 攻擊姿勢（同一隻、同畫布、腳底同高） |
| `monster/rustknight.png` | 256×256 | 鏽蝕騎士（鏽齒工坊城・Lv47・人形・地屬性・中型・一般）特性：主動；格擋正面攻擊 |
| `monster/rustknight_attack.png` | 256×256 | 鏽蝕騎士 攻擊姿勢（同一隻、同畫布、腳底同高） |
| `monster/croc.png` | 256×256 | 管道鱷（鏽齒工坊城・Lv48・動物・水屬性・大型・大型）特性：主動；從管道突然冒出 |
| `monster/croc_attack.png` | 256×256 | 管道鱷 攻擊姿勢（同一隻、同畫布、腳底同高） |
| `monster/lily.png` | 256×256 | 沉睡睡蓮（鏡湖古堡・Lv49・植物・水屬性・小型・群聚）特性：被動；香氣讓附近玩家攻速 −10% |
| `monster/lily_attack.png` | 256×256 | 沉睡睡蓮 攻擊姿勢（同一隻、同畫布、腳底同高） |
| `monster/butterfly.png` | 256×256 | 鏡蝶（鏡湖古堡・Lv51・昆蟲・念屬性・小型・敏捷）特性：主動；被打時分出一個鏡像 |
| `monster/butterfly_attack.png` | 256×256 | 鏡蝶 攻擊姿勢（同一隻、同畫布、腳底同高） |
| `monster/bat2.png` | 256×256 | 夜宴蝠（鏡湖古堡・Lv52・動物・暗屬性・小型・敏捷）特性：主動；攻擊吸血 |
| `monster/bat2_attack.png` | 256×256 | 夜宴蝠 攻擊姿勢（同一隻、同畫布、腳底同高） |
| `monster/rose.png` | 256×256 | 蝕玫瑰（鏡湖古堡・Lv54・植物・毒屬性・小型・一般）特性：被動；荊棘反彈並中毒 |
| `monster/rose_attack.png` | 256×256 | 蝕玫瑰 攻擊姿勢（同一隻、同畫布、腳底同高） |
| `monster/maid.png` | 256×256 | 等主人偶（鏡湖古堡・Lv55・人形・無屬性・中型・一般）特性：主動；一直在擦拭不存在的餐具 |
| `monster/maid_attack.png` | 256×256 | 等主人偶 攻擊姿勢（同一隻、同畫布、腳底同高） |
| `monster/snake.png` | 256×256 | 湖鱗蛇（鏡湖古堡・Lv56・動物・水屬性・中型・敏捷）特性：主動；纏繞定身 1 秒 |
| `monster/snake_attack.png` | 256×256 | 湖鱗蛇 攻擊姿勢（同一隻、同畫布、腳底同高） |
| `monster/reflect.png` | 256×256 | 倒影女（鏡湖古堡・Lv58・人形・水屬性・中型・法術）特性：主動；反射單體魔法 |
| `monster/reflect_attack.png` | 256×256 | 倒影女 攻擊姿勢（同一隻、同畫布、腳底同高） |
| `monster/dancer.png` | 256×256 | 舞會骸骨（鏡湖古堡・Lv59・不死・不死屬性・中型・一般）特性：主動；跳舞閃避，迴避很高 |
| `monster/dancer_attack.png` | 256×256 | 舞會骸骨 攻擊姿勢（同一隻、同畫布、腳底同高） |
| `monster/knight2.png` | 256×256 | 失名騎士（鏡湖古堡・Lv61・人形・暗屬性・中型・硬殼）特性：主動；盔甲上刻的名字被刮掉了 |
| `monster/knight2_attack.png` | 256×256 | 失名騎士 攻擊姿勢（同一隻、同畫布、腳底同高） |
| `monster/deer.png` | 256×256 | 霜角鹿（鏡湖古堡・Lv65・動物・水屬性・大型・大型）特性：主動；踏地冰凍周圍 |
| `monster/deer_attack.png` | 256×256 | 霜角鹿 攻擊姿勢（同一隻、同畫布、腳底同高） |
| `monster/gull.png` | 256×256 | 海鷗強盜（霧港夜市・Lv64・動物・風屬性・小型・敏捷）特性：主動；偷走玩家的料理加成 |
| `monster/gull_attack.png` | 256×256 | 海鷗強盜 攻擊姿勢（同一隻、同畫布、腳底同高） |
| `monster/mist.png` | 256×256 | 迷霧團（霧港夜市・Lv65・無形・風屬性・小型・群聚）特性：被動；讓附近玩家視野變小 |
| `monster/mist_attack.png` | 256×256 | 迷霧團 攻擊姿勢（同一隻、同畫布、腳底同高） |
| `monster/cat.png` | 256×256 | 無主貓（霧港夜市・Lv66・動物・暗屬性・小型・敏捷）特性：被動；跟著玩家走，打它會叫來其他貓 |
| `monster/cat_attack.png` | 256×256 | 無主貓 攻擊姿勢（同一隻、同畫布、腳底同高） |
| `monster/dice.png` | 256×256 | 賭命骰（霧港夜市・Lv70・無形・念屬性・小型・一般）特性：主動；每次攻擊傷害隨機 0.5～2 倍 |
| `monster/dice_attack.png` | 256×256 | 賭命骰 攻擊姿勢（同一隻、同畫布、腳底同高） |
| `monster/barrel.png` | 256×256 | 醉酒桶（霧港夜市・Lv71・無形・火屬性・中型・硬殼）特性：被動；被火屬性打中會爆炸 |
| `monster/barrel_attack.png` | 256×256 | 醉酒桶 攻擊姿勢（同一隻、同畫布、腳底同高） |
| `monster/mask.png` | 256×256 | 面具小販（霧港夜市・Lv72・人形・暗屬性・中型・法術）特性：主動；偽裝成路人，靠近才現形 |
| `monster/mask_attack.png` | 256×256 | 面具小販 攻擊姿勢（同一隻、同畫布、腳底同高） |
| `monster/octopus.png` | 256×256 | 墨霧章魚（霧港夜市・Lv76・魚貝・毒屬性・中型・遠程）特性：主動；噴墨致盲 |
| `monster/octopus_attack.png` | 256×256 | 墨霧章魚 攻擊姿勢（同一隻、同畫布、腳底同高） |
| `monster/coral.png` | 256×256 | 蝕珊瑚（霧港夜市・Lv77・魚貝・地屬性・中型・硬殼）特性：被動；不會移動，周圍的魚貝類回血 |
| `monster/coral_attack.png` | 256×256 | 蝕珊瑚 攻擊姿勢（同一隻、同畫布、腳底同高） |
| `monster/drowned.png` | 256×256 | 沉船舊客（霧港夜市・Lv78・不死・水屬性・中型・一般）特性：主動；拖人下水，減速 |
| `monster/drowned_attack.png` | 256×256 | 沉船舊客 攻擊姿勢（同一隻、同畫布、腳底同高） |
| `monster/shark.png` | 256×256 | 黑市鯊（霧港夜市・Lv80・魚貝・水屬性・大型・大型）特性：主動；聞到血會加速 |
| `monster/shark_attack.png` | 256×256 | 黑市鯊 攻擊姿勢（同一隻、同畫布、腳底同高） |
| `monster/relic.png` | 256×256 | 魂像殘骸（蝕夜神殿・Lv78・無形・念屬性・小型・群聚）特性：被動；碎掉的魂像，靠近會小聲說話 |
| `monster/relic_attack.png` | 256×256 | 魂像殘骸 攻擊姿勢（同一隻、同畫布、腳底同高） |
| `monster/priest2.png` | 256×256 | 蝕夜祭司（蝕夜神殿・Lv83・人形・暗屬性・中型・法術）特性：主動；治療同伴、詛咒玩家 |
| `monster/priest2_attack.png` | 256×256 | 蝕夜祭司 攻擊姿勢（同一隻、同畫布、腳底同高） |
| `monster/nightmare.png` | 256×256 | 夜魘（蝕夜神殿・Lv87・惡魔・暗屬性・中型・法術）特性：主動；讓玩家睡眠，睡眠中受傷加倍 |
| `monster/nightmare_attack.png` | 256×256 | 夜魘 攻擊姿勢（同一隻、同畫布、腳底同高） |
| `monster/nameless.png` | 256×256 | 失名者（蝕夜神殿・Lv88・不死・念屬性・中型・一般）特性：主動；打倒後偶爾會說出自己原本的名字 |
| `monster/nameless_attack.png` | 256×256 | 失名者 攻擊姿勢（同一隻、同畫布、腳底同高） |
| `monster/angel.png` | 256×256 | 斷翼守望者（蝕夜神殿・Lv90・天使・聖屬性・中型・遠程）特性：主動；對暗屬性玩家傷害加倍 |
| `monster/angel_attack.png` | 256×256 | 斷翼守望者 攻擊姿勢（同一隻、同畫布、腳底同高） |
| `monster/guard.png` | 256×256 | 星痕守衛（蝕夜神殿・Lv92・天使・聖屬性・大型・硬殼）特性：被動；守護祭壇，離開範圍就回去 |
| `monster/guard_attack.png` | 256×256 | 星痕守衛 攻擊姿勢（同一隻、同畫布、腳底同高） |
| `monster/gryphon.png` | 256×256 | 暗翼獅鷲（蝕夜神殿・Lv94・動物・風屬性・大型・敏捷）特性：主動；飛行，近戰攻擊命中 −30% |
| `monster/gryphon_attack.png` | 256×256 | 暗翼獅鷲 攻擊姿勢（同一隻、同畫布、腳底同高） |
| `monster/obsidian.png` | 256×256 | 黑曜守門像（蝕夜神殿・Lv96・無形・地屬性・大型・硬殼）特性：被動；魔法傷害 −30% |
| `monster/obsidian_attack.png` | 256×256 | 黑曜守門像 攻擊姿勢（同一隻、同畫布、腳底同高） |
| `monster/ashdrake.png` | 256×256 | 灰燼雛龍（蝕夜神殿・Lv97・龍・火屬性・中型・遠程）特性：主動；噴火範圍 |
| `monster/ashdrake_attack.png` | 256×256 | 灰燼雛龍 攻擊姿勢（同一隻、同畫布、腳底同高） |
| `monster/bonedrake.png` | 256×256 | 忘名骨龍（蝕夜神殿・Lv99・龍・不死屬性・大型・大型）特性：主動；死後 5 秒復活一次 |
| `monster/bonedrake_attack.png` | 256×256 | 忘名骨龍 攻擊姿勢（同一隻、同畫布、腳底同高） |

## E 素材圖示

| 檔案 | 尺寸 | 內容 |
|---|---|---|
| `icon/mat_rabbit.png` | 128×128 | 柔軟兔毛（忘歸野兔的素材） |
| `icon/mat_dandelion.png` | 128×128 | 飛絮（無名絮的素材） |
| `icon/mat_mouse.png` | 128×128 | 鼠鬚（糧倉鼠的素材） |
| `icon/mat_beetle.png` | 128×128 | 硬甲殼（舊犁甲蟲的素材） |
| `icon/mat_bee.png` | 128×128 | 蜂針（迷蜂的素材） |
| `icon/mat_mushroom.png` | 128×128 | 睡眠孢子（睡菇的素材） |
| `icon/mat_frog.png` | 128×128 | 蛙皮（啞蛙的素材） |
| `icon/mat_foxfire.png` | 128×128 | 狐尾毛（狐火的素材） |
| `icon/mat_scarecrow.png` | 128×128 | 乾稻草（空心稻草人的素材） |
| `icon/mat_boar.png` | 128×128 | 野豬牙（撞籬野豬的素材） |
| `icon/mat_dust.png` | 128×128 | 細沙（沙塵影的素材） |
| `icon/mat_lizard.png` | 128×128 | 蜥蜴鱗（岩縫蜥的素材） |
| `icon/mat_scorpion.png` | 128×128 | 蠍尾針（封蠟蠍的素材） |
| `icon/mat_cactus.png` | 128×128 | 仙人掌刺（守路仙人掌的素材） |
| `icon/mat_frogbat.png` | 128×128 | 薄膜翼（谷蛙蝠的素材） |
| `icon/mat_hawk.png` | 128×128 | 斷羽（斷羽鷹的素材） |
| `icon/mat_letter.png` | 128×128 | 泛黃信封（未寄之信的素材） |
| `icon/mat_echoling.png` | 128×128 | 殘響（迴聲殘響的素材） |
| `icon/mat_bandit.png` | 128×128 | 破布面罩（劫信賊的素材） |
| `icon/mat_imp.png` | 128×128 | 黑信封（黑信差的素材） |
| `icon/mat_oilslime.png` | 128×128 | 黑機油（油污團的素材） |
| `icon/mat_rat.png` | 128×128 | 鐵皮（鐵皮鼠的素材） |
| `icon/mat_screw.png` | 128×128 | 螺絲（螺絲蜘蛛的素材） |
| `icon/mat_sparkbug.png` | 128×128 | 火花翅（火花蟲的素材） |
| `icon/mat_clockbird.png` | 128×128 | 發條（發條鳥的素材） |
| `icon/mat_soot.png` | 128×128 | 煤灰（煤灰精的素材） |
| `icon/mat_doll.png` | 128×128 | 人偶關節（失控人偶的素材） |
| `icon/mat_worker.png` | 128×128 | 工作手套（停擺工人的素材） |
| `icon/mat_rustknight.png` | 128×128 | 鏽鐵片（鏽蝕騎士的素材） |
| `icon/mat_croc.png` | 128×128 | 鱷皮（管道鱷的素材） |
| `icon/mat_lily.png` | 128×128 | 睡蓮瓣（沉睡睡蓮的素材） |
| `icon/mat_butterfly.png` | 128×128 | 鏡鱗粉（鏡蝶的素材） |
| `icon/mat_bat2.png` | 128×128 | 夜宴蝠翼（夜宴蝠的素材） |
| `icon/mat_rose.png` | 128×128 | 黑玫瑰瓣（蝕玫瑰的素材） |
| `icon/mat_maid.png` | 128×128 | 白手套（等主人偶的素材） |
| `icon/mat_snake.png` | 128×128 | 湖鱗（湖鱗蛇的素材） |
| `icon/mat_reflect.png` | 128×128 | 湖面碎片（倒影女的素材） |
| `icon/mat_dancer.png` | 128×128 | 舞鞋（舞會骸骨的素材） |
| `icon/mat_knight2.png` | 128×128 | 刮花的頭盔（失名騎士的素材） |
| `icon/mat_deer.png` | 128×128 | 霜角（霜角鹿的素材） |
| `icon/mat_gull.png` | 128×128 | 海鷗羽（海鷗強盜的素材） |
| `icon/mat_mist.png` | 128×128 | 霧氣瓶（迷霧團的素材） |
| `icon/mat_cat.png` | 128×128 | 黑貓毛（無主貓的素材） |
| `icon/mat_dice.png` | 128×128 | 骰子（賭命骰的素材） |
| `icon/mat_barrel.png` | 128×128 | 酒桶板（醉酒桶的素材） |
| `icon/mat_mask.png` | 128×128 | 廉價面具（面具小販的素材） |
| `icon/mat_octopus.png` | 128×128 | 墨囊（墨霧章魚的素材） |
| `icon/mat_coral.png` | 128×128 | 黑珊瑚（蝕珊瑚的素材） |
| `icon/mat_drowned.png` | 128×128 | 舊船票（沉船舊客的素材） |
| `icon/mat_shark.png` | 128×128 | 鯊鰭（黑市鯊的素材） |
| `icon/mat_relic.png` | 128×128 | 魂像碎片（魂像殘骸的素材） |
| `icon/mat_priest2.png` | 128×128 | 祭司權杖（蝕夜祭司的素材） |
| `icon/mat_nightmare.png` | 128×128 | 惡夢角（夜魘的素材） |
| `icon/mat_nameless.png` | 128×128 | 殘缺名牌（失名者的素材） |
| `icon/mat_angel.png` | 128×128 | 斷翼羽毛（斷翼守望者的素材） |
| `icon/mat_guard.png` | 128×128 | 星痕護甲片（星痕守衛的素材） |
| `icon/mat_gryphon.png` | 128×128 | 暗翼羽（暗翼獅鷲的素材） |
| `icon/mat_obsidian.png` | 128×128 | 黑曜石（黑曜守門像的素材） |
| `icon/mat_ashdrake.png` | 128×128 | 龍鱗（灰燼雛龍的素材） |
| `icon/mat_bonedrake.png` | 128×128 | 龍骨（忘名骨龍的素材） |

## B 斥候

| 檔案 | 尺寸 | 內容 |
|---|---|---|
| `hero/scout_common_front.png` | 512×512 | 斥候 common（布與舊皮革，素色）front |
| `hero/scout_common_front_attack.png` | 512×512 | 斥候 common front 攻擊 |
| `hero/scout_common_front_walk.png` | 1024×512 | 斥候 common front 走路兩格 |
| `hero/scout_common_side.png` | 512×512 | 斥候 common（布與舊皮革，素色）side |
| `hero/scout_common_side_attack.png` | 512×512 | 斥候 common side 攻擊 |
| `hero/scout_common_side_walk.png` | 1024×512 | 斥候 common side 走路兩格 |
| `hero/scout_common_back.png` | 512×512 | 斥候 common（布與舊皮革，素色）back |
| `hero/scout_common_back_attack.png` | 512×512 | 斥候 common back 攻擊 |
| `hero/scout_common_back_walk.png` | 1024×512 | 斥候 common back 走路兩格 |
| `hero/scout_good_front.png` | 512×512 | 斥候 good（補強的皮甲、銅扣）front |
| `hero/scout_good_front_attack.png` | 512×512 | 斥候 good front 攻擊 |
| `hero/scout_good_front_walk.png` | 1024×512 | 斥候 good front 走路兩格 |
| `hero/scout_good_side.png` | 512×512 | 斥候 good（補強的皮甲、銅扣）side |
| `hero/scout_good_side_attack.png` | 512×512 | 斥候 good side 攻擊 |
| `hero/scout_good_side_walk.png` | 1024×512 | 斥候 good side 走路兩格 |
| `hero/scout_good_back.png` | 512×512 | 斥候 good（補強的皮甲、銅扣）back |
| `hero/scout_good_back_attack.png` | 512×512 | 斥候 good back 攻擊 |
| `hero/scout_good_back_walk.png` | 1024×512 | 斥候 good back 走路兩格 |
| `hero/scout_rare_front.png` | 512×512 | 斥候 rare（藍灰夜色斗篷、銀刃）front |
| `hero/scout_rare_front_attack.png` | 512×512 | 斥候 rare front 攻擊 |
| `hero/scout_rare_front_walk.png` | 1024×512 | 斥候 rare front 走路兩格 |
| `hero/scout_rare_side.png` | 512×512 | 斥候 rare（藍灰夜色斗篷、銀刃）side |
| `hero/scout_rare_side_attack.png` | 512×512 | 斥候 rare side 攻擊 |
| `hero/scout_rare_side_walk.png` | 1024×512 | 斥候 rare side 走路兩格 |
| `hero/scout_rare_back.png` | 512×512 | 斥候 rare（藍灰夜色斗篷、銀刃）back |
| `hero/scout_rare_back_attack.png` | 512×512 | 斥候 rare back 攻擊 |
| `hero/scout_rare_back_walk.png` | 1024×512 | 斥候 rare back 走路兩格 |
| `hero/scout_epic_front.png` | 512×512 | 斥候 epic（紫黑斗篷、刀刃有淡紫影光）front |
| `hero/scout_epic_front_attack.png` | 512×512 | 斥候 epic front 攻擊 |
| `hero/scout_epic_front_walk.png` | 1024×512 | 斥候 epic front 走路兩格 |
| `hero/scout_epic_side.png` | 512×512 | 斥候 epic（紫黑斗篷、刀刃有淡紫影光）side |
| `hero/scout_epic_side_attack.png` | 512×512 | 斥候 epic side 攻擊 |
| `hero/scout_epic_side_walk.png` | 1024×512 | 斥候 epic side 走路兩格 |
| `hero/scout_epic_back.png` | 512×512 | 斥候 epic（紫黑斗篷、刀刃有淡紫影光）back |
| `hero/scout_epic_back_attack.png` | 512×512 | 斥候 epic back 攻擊 |
| `hero/scout_epic_back_walk.png` | 1024×512 | 斥候 epic back 走路兩格 |
| `hero/scout_legend_front.png` | 512×512 | 斥候 legend（星夜斗篷內襯星點、刀刃拖著影子的光）front |
| `hero/scout_legend_front_attack.png` | 512×512 | 斥候 legend front 攻擊 |
| `hero/scout_legend_front_walk.png` | 1024×512 | 斥候 legend front 走路兩格 |
| `hero/scout_legend_side.png` | 512×512 | 斥候 legend（星夜斗篷內襯星點、刀刃拖著影子的光）side |
| `hero/scout_legend_side_attack.png` | 512×512 | 斥候 legend side 攻擊 |
| `hero/scout_legend_side_walk.png` | 1024×512 | 斥候 legend side 走路兩格 |
| `hero/scout_legend_back.png` | 512×512 | 斥候 legend（星夜斗篷內襯星點、刀刃拖著影子的光）back |
| `hero/scout_legend_back_attack.png` | 512×512 | 斥候 legend back 攻擊 |
| `hero/scout_legend_back_walk.png` | 1024×512 | 斥候 legend back 走路兩格 |
| `portrait/hero_scout.png` | 512×512 | 斥候半身像（選職業畫面、對話） |

## C 技能圖示

| 檔案 | 尺寸 | 內容 |
|---|---|---|
| `ui/skill_lampSword.png` | 128×128 | 守燈劍術（戰士）被動（不會發光的徽章感） |
| `ui/skill_steadfast.png` | 128×128 | 堅毅之身（戰士）被動（不會發光的徽章感） |
| `ui/skill_lampSlash.png` | 128×128 | 守燈斬（戰士）主動攻擊、單體近戰斬擊 |
| `ui/skill_ringSlash.png` | 128×128 | 燈環斬（戰士）主動攻擊、繞身旋轉 |
| `ui/skill_lightBlade.png` | 128×128 | 光刃（戰士）主動攻擊、向前飛出的光刃、聖屬性（白金、柔和光暈） |
| `ui/skill_vow.png` | 128×128 | 立誓（戰士）減益、挑釁 |
| `ui/skill_lampShield.png` | 128×128 | 燈盾（戰士）增益 |
| `ui/skill_wick.png` | 128×128 | 不滅燈芯（戰士）被動（不會發光的徽章感） |
| `ui/skill_vowRelease.png` | 128×128 | 誓約解放（戰士）主動攻擊、震地、聖屬性（白金、柔和光暈） |
| `ui/skill_shieldMastery.png` | 128×128 | 盾術精通（盾衛）被動（不會發光的徽章感） |
| `ui/skill_lampBash.png` | 128×128 | 燈盾擊（盾衛）主動攻擊、單體近戰斬擊 |
| `ui/skill_allLamps.png` | 128×128 | 萬燈守望（盾衛）util、挑釁 |
| `ui/skill_proxyVow.png` | 128×128 | 代誓（盾衛）增益 |
| `ui/skill_lightWall.png` | 128×128 | 光之壁壘（盾衛）pbuff |
| `ui/skill_lampAura.png` | 128×128 | 守燈光環（盾衛）被動（不會發光的徽章感） |
| `ui/skill_vowCounter.png` | 128×128 | 誓約反擊（盾衛）被動（不會發光的徽章感） |
| `ui/skill_everLight.png` | 128×128 | 長明（盾衛）增益 |
| `ui/skill_neverOut.png` | 128×128 | 永不熄滅（盾衛）增益 |
| `ui/skill_lampCharge.png` | 128×128 | 燈火衝鋒（盾衛）主動攻擊、突進 |
| `ui/skill_greatsword.png` | 128×128 | 雙手劍術（重劍士）被動（不會發光的徽章感） |
| `ui/skill_armorBreak.png` | 128×128 | 碎甲斬（重劍士）主動攻擊、單體近戰斬擊 |
| `ui/skill_chargeSlash.png` | 128×128 | 蓄光斬（重劍士）主動攻擊、單體近戰斬擊 |
| `ui/skill_thousand.png` | 128×128 | 千刃（重劍士）主動攻擊、連續拳擊 |
| `ui/skill_bladeStorm.png` | 128×128 | 光刃風暴（重劍士）主動攻擊、繞身旋轉、風屬性（淡綠、飄動的線條與羽毛） |
| `ui/skill_warSpirit.png` | 128×128 | 戰意（重劍士）被動（不會發光的徽章感） |
| `ui/skill_breakVow.png` | 128×128 | 破誓（重劍士）增益 |
| `ui/skill_ironCut.png` | 128×128 | 斬鐵（重劍士）被動（不會發光的徽章感） |
| `ui/skill_flash.png` | 128×128 | 一閃（重劍士）主動攻擊、突進 |
| `ui/skill_breakRank.png` | 128×128 | 破陣（重劍士）主動攻擊、震地 |
| `ui/skill_candlePrayer.png` | 128×128 | 燭光祈願（治療師）被動（不會發光的徽章感） |
| `ui/skill_lightCandle.png` | 128×128 | 點燭（治療師）治療、治療 |
| `ui/skill_callName.png` | 128×128 | 喚名祝禱（治療師）pbuff |
| `ui/skill_candleShadow.png` | 128×128 | 輕盈燭影（治療師）pbuff |
| `ui/skill_candleVeil.png` | 128×128 | 燭幕（治療師）pbuff |
| `ui/skill_candleArrow.png` | 128×128 | 燭焰矢（治療師）主動攻擊、單發射擊、聖屬性（白金、柔和光暈） |
| `ui/skill_dust.png` | 128×128 | 拂塵（治療師）util |
| `ui/skill_rekindle.png` | 128×128 | 重燃（治療師）util |
| `ui/skill_candleArray.png` | 128×128 | 燭陣（治療師）治療、範圍治療 |
| `ui/skill_greatCandle.png` | 128×128 | 大燭光（聖療師）治療、範圍治療 |
| `ui/skill_massRekindle.png` | 128×128 | 群燭重燃（聖療師）util |
| `ui/skill_calmCandle.png` | 128×128 | 靜心燭（聖療師）被動（不會發光的徽章感） |
| `ui/skill_lightCurtain.png` | 128×128 | 光之帷幕（聖療師）治療、護盾 |
| `ui/skill_pureCandle.png` | 128×128 | 淨燭（聖療師）util |
| `ui/skill_grace.png` | 128×128 | 恩典（聖療師）被動（不會發光的徽章感） |
| `ui/skill_guardCandle.png` | 128×128 | 守護燭火（聖療師）增益 |
| `ui/skill_nameWord.png` | 128×128 | 名之言（聖療師）被動（不會發光的徽章感） |
| `ui/skill_mercy.png` | 128×128 | 慈光（聖療師）被動（不會發光的徽章感） |
| `ui/skill_purgeFlame.png` | 128×128 | 驅邪燭焰（驅魔師）主動攻擊、單發射擊、聖屬性（白金、柔和光暈） |
| `ui/skill_flameSea.png` | 128×128 | 聖燭火海（驅魔師）主動攻擊、地面法陣、聖屬性（白金、柔和光暈） |
| `ui/skill_sealName.png` | 128×128 | 封名（驅魔師）減益 |
| `ui/skill_reveal.png` | 128×128 | 照見（驅魔師）減益 |
| `ui/skill_candleHammer.png` | 128×128 | 燭台錘術（驅魔師）被動（不會發光的徽章感） |
| `ui/skill_lightEdge.png` | 128×128 | 以光為刃（驅魔師）主動攻擊、單發射擊、聖屬性（白金、柔和光暈） |
| `ui/skill_exorcism.png` | 128×128 | 驅魔（驅魔師）被動（不會發光的徽章感） |
| `ui/skill_burnSelf.png` | 128×128 | 燃身（驅魔師）增益 |
| `ui/skill_holySeal.png` | 128×128 | 聖燭印（驅魔師）pbuff |
| `ui/skill_skyLight.png` | 128×128 | 天光（驅魔師）主動攻擊、地面法陣、聖屬性（白金、柔和光暈） |
| `ui/skill_nightSight.png` | 128×128 | 夜視（射手）被動（不會發光的徽章感） |
| `ui/skill_stringArt.png` | 128×128 | 弦術（射手）被動（不會發光的徽章感） |
| `ui/skill_twinStar.png` | 128×128 | 雙星矢（射手）主動攻擊、單發射擊 |
| `ui/skill_scatterStar.png` | 128×128 | 散星（射手）主動攻擊、扇形多發 |
| `ui/skill_starfall.png` | 128×128 | 星落（射手）主動攻擊、從天而降 |
| `ui/skill_meteorPierce.png` | 128×128 | 流星貫（射手）主動攻擊、蓄力重箭、風屬性（淡綠、飄動的線條與羽毛） |
| `ui/skill_linkStars.png` | 128×128 | 連星（射手）主動攻擊、地面法陣 |
| `ui/skill_stargaze.png` | 128×128 | 觀星（射手）增益 |
| `ui/skill_leap.png` | 128×128 | 躍步（射手）util、跳躍落地 |
| `ui/skill_starEye.png` | 128×128 | 星眼狙擊（鷹眼射手）主動攻擊、蓄力重箭 |
| `ui/skill_pierceStar.png` | 128×128 | 破甲星矢（鷹眼射手）主動攻擊、單發射擊 |
| `ui/skill_fatalStar.png` | 128×128 | 致命星位（鷹眼射手）被動（不會發光的徽章感） |
| `ui/skill_siriusEye.png` | 128×128 | 天狼之眼（鷹眼射手）被動（不會發光的徽章感） |
| `ui/skill_fixStar.png` | 128×128 | 定星（鷹眼射手）被動（不會發光的徽章感） |
| `ui/skill_pearlString.png` | 128×128 | 連珠（鷹眼射手）主動攻擊、單發射擊 |
| `ui/skill_heartStar.png` | 128×128 | 心宿（鷹眼射手）被動（不會發光的徽章感） |
| `ui/skill_burstStar.png` | 128×128 | 爆星矢（鷹眼射手）主動攻擊、火球爆炸、火屬性（橘紅、火星與熱氣） |
| `ui/skill_calm.png` | 128×128 | 冷靜（鷹眼射手）被動（不會發光的徽章感） |
| `ui/skill_finisher.png` | 128×128 | 隕星終結（鷹眼射手）主動攻擊、蓄力重箭 |
| `ui/skill_frostTrap.png` | 128×128 | 霜星陷阱（陷阱師）主動攻擊、地上陷阱、水屬性（水藍、透明水光） |
| `ui/skill_blastTrap.png` | 128×128 | 爆裂陷阱（陷阱師）主動攻擊、地上陷阱、火屬性（橘紅、火星與熱氣） |
| `ui/skill_trapMastery.png` | 128×128 | 陷阱精通（陷阱師）被動（不會發光的徽章感） |
| `ui/skill_starNet.png` | 128×128 | 星網（陷阱師）減益 |
| `ui/skill_nightLight.png` | 128×128 | 照夜（陷阱師）util |
| `ui/skill_nightHawk.png` | 128×128 | 夜鷹（陷阱師）被動（不會發光的徽章感） |
| `ui/skill_hunterSense.png` | 128×128 | 獵手本能（陷阱師）被動（不會發光的徽章感） |
| `ui/skill_starRain.png` | 128×128 | 星雨（陷阱師）主動攻擊、從天而降 |
| `ui/skill_galeStep.png` | 128×128 | 疾風步（陷阱師）增益 |
| `ui/skill_windGrace.png` | 128×128 | 風之加護（陷阱師）被動（不會發光的徽章感） |
| `ui/skill_soulLore.png` | 128×128 | 魂像學（魔法使）被動（不會發光的徽章感） |
| `ui/skill_quickCast.png` | 128×128 | 快詠（魔法使）被動（不會發光的徽章感） |
| `ui/skill_emberSeed.png` | 128×128 | 餘燼之種（魔法使）主動攻擊、火球爆炸、火屬性（橘紅、火星與熱氣） |
| `ui/skill_frostBreath.png` | 128×128 | 霜之息（魔法使）主動攻擊、以自己為中心爆開、水屬性（水藍、透明水光） |
| `ui/skill_thunderThread.png` | 128×128 | 雷絲（魔法使）主動攻擊、連鎖跳躍、風屬性（淡綠、飄動的線條與羽毛） |
| `ui/skill_rockThorn.png` | 128×128 | 岩棘（魔法使）主動攻擊、單發射擊、地屬性（土黃褐色、岩石紋理） |
| `ui/skill_soulBarrier.png` | 128×128 | 魂障（魔法使）增益 |
| `ui/skill_fourResonance.png` | 128×128 | 四象共鳴（魔法使）主動攻擊、以自己為中心爆開 |
| `ui/skill_moltenStar.png` | 128×128 | 熔星（毀滅法師）主動攻擊、地面法陣、火屬性（橘紅、火星與熱氣） |
| `ui/skill_frostStorm.png` | 128×128 | 永凍風暴（毀滅法師）主動攻擊、地面法陣、水屬性（水藍、透明水光） |
| `ui/skill_thunderNet.png` | 128×128 | 雷霆網（毀滅法師）主動攻擊、連鎖跳躍、風屬性（淡綠、飄動的線條與羽毛） |
| `ui/skill_earthCollapse.png` | 128×128 | 大地崩（毀滅法師）主動攻擊、向前飛出的光刃、地屬性（土黃褐色、岩石紋理） |
| `ui/skill_castMastery.png` | 128×128 | 詠唱精通（毀滅法師）被動（不會發光的徽章感） |
| `ui/skill_resonanceAmp.png` | 128×128 | 共鳴增幅（毀滅法師）被動（不會發光的徽章感） |
| `ui/skill_doubleCast.png` | 128×128 | 雙重詠唱（毀滅法師）被動（不會發光的徽章感） |
| `ui/skill_elemShift.png` | 128×128 | 屬性轉調（毀滅法師）被動（不會發光的徽章感） |
| `ui/skill_soulBurst.png` | 128×128 | 魂像爆發（毀滅法師）增益 |
| `ui/skill_allInOne.png` | 128×128 | 萬象歸一（毀滅法師）主動攻擊、屏障 |
| `ui/skill_elemGrant.png` | 128×128 | 屬性賦予（附魔師）pbuff |
| `ui/skill_iceSeal.png` | 128×128 | 冰封（附魔師）減益 |
| `ui/skill_elemBarrier.png` | 128×128 | 元素屏障（附魔師）pbuff |
| `ui/skill_manaShare.png` | 128×128 | 魔力共享（附魔師）util |
| `ui/skill_elemSight.png` | 128×128 | 屬性看破（附魔師）被動（不會發光的徽章感） |
| `ui/skill_resSpirit.png` | 128×128 | 共鳴精靈（附魔師）主動攻擊、單發射擊 |
| `ui/skill_earthBind.png` | 128×128 | 大地束縛（附魔師）減益 |
| `ui/skill_elemField.png` | 128×128 | 屬性場（附魔師）減益 |
| `ui/skill_iceArmor.png` | 128×128 | 冰晶護甲（附魔師）增益 |
| `ui/skill_elemHarmony.png` | 128×128 | 元素調和（附魔師）被動（不會發光的徽章感） |
| `ui/skill_dawnArt.png` | 128×128 | 晨功（拳師）被動（不會發光的徽章感） |
| `ui/skill_bellPalm.png` | 128×128 | 撞鐘掌（拳師）主動攻擊、單體近戰斬擊 |
| `ui/skill_bellFists.png` | 128×128 | 連鐘拳（拳師）主動攻擊、連續拳擊 |
| `ui/skill_bellQuake.png` | 128×128 | 震鐘（拳師）主動攻擊、前方震波、地屬性（土黃褐色、岩石紋理） |
| `ui/skill_bellRing.png` | 128×128 | 鐘鳴（拳師）被動（不會發光的徽章感） |
| `ui/skill_goldBell.png` | 128×128 | 金鐘身（拳師）被動（不會發光的徽章感） |
| `ui/skill_lightBody.png` | 128×128 | 輕身（拳師）被動（不會發光的徽章感） |
| `ui/skill_dawnStrike.png` | 128×128 | 破曉一擊（拳師）主動攻擊、突進、火屬性（橘紅、火星與熱氣） |
| `ui/skill_martialWay.png` | 128×128 | 武道（武鬥家）被動（不會發光的徽章感） |
| `ui/skill_dawnKicks.png` | 128×128 | 晨鐘連環腿（武鬥家）主動攻擊、連續拳擊 |
| `ui/skill_pendulum.png` | 128×128 | 擺鐘（武鬥家）主動攻擊、前方震波 |
| `ui/skill_bellCannon.png` | 128×128 | 洪鐘炮（武鬥家）主動攻擊、單體近戰斬擊 |
| `ui/skill_beatAmp.png` | 128×128 | 節拍強化（武鬥家）被動（不會發光的徽章感） |
| `ui/skill_stopBell.png` | 128×128 | 止鐘拳（武鬥家）主動攻擊、單體近戰斬擊 |
| `ui/skill_bellWave.png` | 128×128 | 鐘波（武鬥家）主動攻擊、單發射擊 |
| `ui/skill_burnBell.png` | 128×128 | 燃鐘（武鬥家）增益 |
| `ui/skill_bellGuard.png` | 128×128 | 金鐘罩（武鬥家）增益 |
| `ui/skill_dawnBell.png` | 128×128 | 黎明之鐘（武鬥家）主動攻擊、震地 |
| `ui/skill_bellAura.png` | 128×128 | 鐘韻光環（氣功師）被動（不會發光的徽章感） |
| `ui/skill_echoAura.png` | 128×128 | 餘韻（氣功師）被動（不會發光的徽章感） |
| `ui/skill_bellCounter.png` | 128×128 | 應鐘反擊（氣功師）主動攻擊、單體近戰斬擊 |
| `ui/skill_bellWall.png` | 128×128 | 鐘壁（氣功師）增益 |
| `ui/skill_breathe.png` | 128×128 | 調息（氣功師）治療、治療 |
| `ui/skill_clearMind.png` | 128×128 | 清心（氣功師）util |
| `ui/skill_pressPoint.png` | 128×128 | 點穴（氣功師）減益 |
| `ui/skill_stillHeart.png` | 128×128 | 靜心（氣功師）被動（不會發光的徽章感） |
| `ui/skill_flowWater.png` | 128×128 | 流水（氣功師）被動（不會發光的徽章感） |
| `ui/skill_unmovedBell.png` | 128×128 | 不動鐘（氣功師）pbuff |
| `ui/skill_shortBlade.png` | 128×128 | 短刃術（斥候）被動（不會發光的徽章感） |
| `ui/skill_twinBlade.png` | 128×128 | 雙刃（斥候）被動（不會發光的徽章感） |
| `ui/skill_shadowStab.png` | 128×128 | 影刺（斥候）主動攻擊、單體近戰斬擊 |
| `ui/skill_poisonCoat.png` | 128×128 | 淬毒（斥候）被動（不會發光的徽章感） |
| `ui/skill_nightVeil.png` | 128×128 | 夜幕（斥候）主動攻擊、隱身影子 |
| `ui/skill_hide.png` | 128×128 | 潛影（斥候）增益 |
| `ui/skill_pickpocket.png` | 128×128 | 順手（斥候）util |
| `ui/skill_seeThrough.png` | 128×128 | 看破（斥候）減益 |
| `ui/skill_nightPoison.png` | 128×128 | 夜毒（毒刃師）被動（不會發光的徽章感） |
| `ui/skill_poisonVeil.png` | 128×128 | 毒夜幕（毒刃師）主動攻擊、隱身影子 |
| `ui/skill_poisonMaster.png` | 128×128 | 毒師（毒刃師）被動（不會發光的徽章感） |
| `ui/skill_shadowStep.png` | 128×128 | 影步（毒刃師）主動攻擊、瞬移 |
| `ui/skill_shadowRaid.png` | 128×128 | 影襲（毒刃師）主動攻擊、單體近戰斬擊 |
| `ui/skill_fatalStab.png` | 128×128 | 致命影刺（毒刃師）被動（不會發光的徽章感） |
| `ui/skill_dualMastery.png` | 128×128 | 雙刃精通（毒刃師）被動（不會發光的徽章感） |
| `ui/skill_nightInstinct.png` | 128×128 | 夜之本能（毒刃師）被動（不會發光的徽章感） |
| `ui/skill_shadowClone.png` | 128×128 | 影分身（毒刃師）util |
| `ui/skill_namelessBlade.png` | 128×128 | 無名之刃（毒刃師）主動攻擊、單體近戰斬擊 |
| `ui/skill_flawMark.png` | 128×128 | 破綻標記（神偷）減益 |
| `ui/skill_disarm.png` | 128×128 | 卸力（神偷）減益 |
| `ui/skill_rustPoison.png` | 128×128 | 蝕甲毒（神偷）減益 |
| `ui/skill_entangle.png` | 128×128 | 纏影（神偷）被動（不會發光的徽章感） |
| `ui/skill_mist.png` | 128×128 | 迷霧（神偷）主動攻擊、隱身影子 |
| `ui/skill_shadowWalk.png` | 128×128 | 影中同行（神偷）增益 |
| `ui/skill_deftHand.png` | 128×128 | 妙手（神偷）被動（不會發光的徽章感） |
| `ui/skill_lockpick.png` | 128×128 | 開鎖術（神偷）被動（不會發光的徽章感） |
| `ui/skill_luckyStar.png` | 128×128 | 幸運星（神偷）被動（不會發光的徽章感） |
| `ui/skill_switcheroo.png` | 128×128 | 偷天換日（神偷）util |

## D 新道具

| 檔案 | 尺寸 | 內容 |
|---|---|---|
| `icon/nameShard.png` | 128×128 | 名字碎片：發著淡紫光、像碎掉的名牌或羊皮紙片，上面有看不清的字跡（不要真的寫字） |
| `icon/nameBox.png` | 128×128 | 封名匣：深紫色小木匣，有銀色封條與燈芯形鎖，縫隙透出光 |
| `icon/shard_gear.png` | 128×128 | 魂像碎片（gear）：對應魂像顏色的發光碎片，形狀帶一點魂像特徵 |
| `icon/shard_post.png` | 128×128 | 魂像碎片（post）：對應魂像顏色的發光碎片，形狀帶一點魂像特徵 |
| `icon/shard_magnet.png` | 128×128 | 魂像碎片（magnet）：對應魂像顏色的發光碎片，形狀帶一點魂像特徵 |
| `icon/shard_thread.png` | 128×128 | 魂像碎片（thread）：對應魂像顏色的發光碎片，形狀帶一點魂像特徵 |
| `icon/shard_bird.png` | 128×128 | 魂像碎片（bird）：對應魂像顏色的發光碎片，形狀帶一點魂像特徵 |
| `icon/shard_cat.png` | 128×128 | 魂像碎片（cat）：對應魂像顏色的發光碎片，形狀帶一點魂像特徵 |
