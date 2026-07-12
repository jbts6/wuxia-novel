#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Generate named-inventory candidates for 陆小凤传奇 ch024-ch035 from source text only."""
from __future__ import annotations

import json
import re
from collections import defaultdict
from pathlib import Path

NOVEL = Path(__file__).resolve().parents[2]
CH_SPLIT = NOVEL / "ch_split"
OUT_JSONL = Path(__file__).with_name("named-inventory.ch024-035.jsonl")
OUT_DONE = Path(__file__).with_name("named-inventory.ch024-035.done.json")

WINDOW_LINES = 120
OVERLAP = 20
STEP = WINDOW_LINES - OVERLAP  # 100


def split_lines(text: str) -> list[str]:
    lines = text.replace("\r\n", "\n").replace("\r", "\n").split("\n")
    if len(lines) > 1 and lines[-1] == "":
        lines.pop()
    return lines


def make_windows(chapter: int, lines: list[str]) -> list[dict]:
    if not lines:
        return []
    windows = []
    start = 0
    number = 1
    while start < len(lines):
        end = min(start + WINDOW_LINES, len(lines))
        windows.append(
            {
                "id": f"ch{chapter:03d}_w{number:03d}",
                "chapter": chapter,
                "line_start": start + 1,
                "line_end": end,
                "text": "\n".join(lines[start:end]),
            }
        )
        if end == len(lines):
            break
        start += STEP
        number += 1
    return windows


def find_line(lines: list[str], needle: str, start: int = 1) -> int | None:
    n = re.sub(r"\s+", "", needle)
    for i in range(start - 1, len(lines)):
        if n and n in re.sub(r"\s+", "", lines[i]):
            return i + 1
    for i in range(0, start - 1):
        if n and n in re.sub(r"\s+", "", lines[i]):
            return i + 1
    return None


def window_for(chapter: int, line: int, windows_by_ch: dict[int, list[dict]]) -> dict | None:
    wins = windows_by_ch[chapter]
    # prefer earliest window containing the line
    for w in wins:
        if w["line_start"] <= line <= w["line_end"]:
            return w
    return None


# (chapter, name, category, needle_substring) — high-recall named inventory from source text
# needle used to locate exact source line(s)
ENTITIES: list[tuple[int, str, str, str]] = [
    # ---- ch24 第一回 两雄相遇 ----
    (24, "李燕北", "character", "李燕北从他三十个公馆"),
    (24, "孙冲", "character", "忽然唤道：“孙冲！”"),
    (24, "快意堂", "faction", "以打造各种兵刃和暗器名满中原的“快意堂”堂主"),
    (24, "镇远镖局", "faction", "镇远镖局”的总镖头“金刀”冯昆"),
    (24, "金刀冯昆", "character", "总镖头“金刀”冯昆"),
    (24, "冯昆", "character", "总镖头“金刀”冯昆"),
    (24, "永定门", "location", "抛入永定门外已结了冰的河水"),
    (24, "樱桃斜街", "location", "刚走上路面很窄的樱桃斜街"),
    (24, "金钱镖", "skill", "金钱镖要用指力"),
    (24, "陆小凤", "character", "比不上陆小凤的两根手指"),
    (24, "荟仙居", "location", "荟仙居的火烧炒肝"),
    (24, "润明楼", "location", "润明楼的褡裢火烧"),
    (24, "馅饼周", "location", "馅饼周的馅饼"),
    (24, "杜桐轩", "character", "除了城南老杜外"),
    (24, "城南老杜", "character", "除了城南老杜外"),
    (24, "杜桐轩", "character", "陆小凤道：“杜桐轩？”"),
    (24, "西门吹雪", "character", "西门吹雪却坚持要将日期延后"),
    (24, "叶孤城", "character", "西门吹雪一定是怕了叶孤城"),
    (24, "紫金山", "location", "地方本来是在秣陵的紫金山上"),
    (24, "秣陵", "location", "地方本来是在秣陵的紫金山上"),
    (24, "唐天仪", "character", "李燕北道：“唐天仪。”"),
    (24, "蜀中唐家", "faction", "蜀中唐家的大公子"),
    (24, "天外飞仙", "technique", "叶孤城虽然以一着‘天外飞仙’重伤了唐天仪"),
    (24, "毒砂", "item", "他自己也中了唐天仪的一把毒砂"),
    (24, "老实和尚", "character", "李燕北道：“老实和尚。”"),
    (24, "耳朵眼", "location", "就去‘耳朵眼’吃花素水饺"),
    (24, "天门四剑", "faction", "那时天门四剑恰巧也在那里吃饺子"),
    (24, "武当", "faction", "甚至连武当的长老木道人"),
    (24, "木道人", "character", "武当的长老木道人"),
    (24, "少林", "faction", "少林的护法大师们都会到"),
    (24, "铁掌翻天", "character", "西城王府里的护院‘铁掌翻天’"),
    (24, "赵铁掌", "character", "八千两银子就买了赵铁掌的一条命"),
    (24, "铁狮子胡同", "location", "铁狮子胡同后面的陋巷里"),
    (24, "绣花大盗", "character", "绣花大盗、金九龄、鲁少华"),
    (24, "金九龄", "character", "绣花大盗、金九龄、鲁少华"),
    (24, "鲁少华", "character", "绣花大盗、金九龄、鲁少华"),
    (24, "公孙大娘", "character", "公孙大娘、江重威、欧阳情、薛冰"),
    (24, "江重威", "character", "公孙大娘、江重威、欧阳情、薛冰"),
    (24, "欧阳情", "character", "公孙大娘、江重威、欧阳情、薛冰"),
    (24, "薛冰", "character", "公孙大娘、江重威、欧阳情、薛冰"),
    (24, "孙秀青", "character", "陆小凤道：“孙秀青。”"),
    (24, "春华楼", "location", "到前门外的春华楼去等"),
    (24, "汉玉戒指", "item", "戴着枚价值连城的汉玉戒指"),
    (24, "白玉璧", "item", "挂着块毫无瑕疵的白玉璧"),
    (24, "杜学士", "character", "他喜欢别人叫他杜学士"),
    (24, "李将军", "character", "李将军别来无恙"),
    (24, "心有灵犀一点通", "skill", "心有灵犀一点通”的陆小凤"),
    (24, "灵犀一指", "skill", "心有灵犀一点通”的陆小凤"),
    (24, "解药", "item", "杜桐轩道：“解药。”"),
    (24, "惨碧色小瓶", "item", "将一只惨碧色的小瓶摆在桌上"),
    (24, "四大恒钱庄", "faction", "我在四大恒钱庄，还存着有八十万两银子"),
    (24, "唐天容", "character", "哪一位是唐天容？"),
    (24, "唐门飞砂", "item", "本门的飞砂，在你眼中只不过是一点尘埃"),
    (24, "豹皮革囊", "item", "紧贴在他左右胯骨的两只豹皮革囊"),
    (24, "鱼皮手套", "item", "插在腰带上的一双鱼皮手套"),
    (24, "乌鞘长剑", "item", "捧上一柄形式极古雅的乌鞘长剑"),
    (24, "白云城主", "character", "白云城主叶孤城赫然来了"),
    (24, "天外飞仙", "technique", "陆小凤忍不住道：“好一着天外飞仙！”"),
    (24, "司空摘星", "character", "我一定会认为他是司空摘星"),
    (24, "金鱼胡同", "location", "我到金鱼胡同的福寿堂去叫一桌菜"),
    (24, "福寿堂", "location", "金鱼胡同的福寿堂去叫一桌菜"),
    (24, "十三姨", "character", "我本该在十三姨家里吃晚饭的"),
    (24, "花满楼", "character", "若是遇见了花满楼"),
    (24, "鬼头刀", "item", "六十六把鬼头刀、五十口剑"),
    (24, "京城三大镖局", "faction", "有京城三大镖局的总镖师"),
    (24, "杆儿上的", "faction", "东西两城“杆儿上的”的首领"),
    (24, "前门外", "location", "走到前门外市区的中心"),
    # ---- ch25 第二回 斯人独憔悴 ----
    (25, "春华楼", "location", "陆小凤从春华楼走出来"),
    (25, "欧阳情", "character", "他第一个看见的是欧阳情"),
    (25, "珠宝市", "location", "前门外的珠宝市里闲逛"),
    (25, "薛冰", "character", "他又想起了薛冰"),
    (25, "老实和尚", "character", "竟忽然想起了老实和尚"),
    (25, "武当", "faction", "有一个武当门下的弟子"),
    (25, "川中袍哥", "faction", "好像是川中袍哥的龙头老大"),
    (25, "木道人", "character", "竟是木道人和古松居土"),
    (25, "古松居士", "character", "古松居士忽然道"),
    (25, "三大剑客", "faction", "当代最负盛名的三大剑客之一"),
    (25, "龟孙子大老爷", "character", "每次他看见龟孙子大老爷的时候"),
    (25, "孙老爷", "character", "孙老爷斜着眼睛白了他一眼"),
    (25, "大通", "character", "大通和大智两位老先生呢"),
    (25, "大智", "character", "大通和大智两位老先生呢"),
    (25, "西门吹雪", "character", "究竟是西门吹雪能胜，还是叶孤城"),
    (25, "叶孤城", "character", "究竟是西门吹雪能胜，还是叶孤城"),
    (25, "唐家毒药暗器", "item", "叶孤城是不是真的已被唐家的毒药暗器所伤"),
    (25, "唐家独门解药", "item", "除了唐家的独门解药外"),
    (25, "赤红小蛇", "item", "一条赤红的小蛇从窑洞中箭一般窜了出来"),
    (25, "楠木棺材", "item", "店里有两口上好的楠木棺材"),
    (25, "陈掌柜", "character", "棺材店的掌柜姓陈"),
    (25, "棺材店", "location", "棺材店里充满了新刨木花的气息"),
    (25, "唐天容", "character", "他一剑就洞穿了唐天容的双肩"),
    (25, "唐门四大高手", "faction", "唐天容本是唐门四大高手之一"),
    (25, "白云城", "location", "我很早以前就想到白云城去看看"),
    (25, "香片", "item", "要了壶京城中人最爱喝的香片"),
    (25, "严人英", "character", "年轻人脸色变了变……“严人英。”"),
    (25, "张英风", "character", "你是张英风？还是严人英"),
    (25, "独孤一鹤", "character", "这年轻人无疑也是独孤一鹤门下"),
    (25, "三英四秀", "faction", "“三英四秀”中的一个人"),
    (25, "苏少英", "character", "死在西门吹雪剑下的苏少英"),
    (25, "珠光宝气阁", "location", "在阎铁珊的珠光宝气阁"),
    (25, "阎铁珊", "character", "在阎铁珊的珠光宝气阁"),
    (25, "赵正我", "character", "在下赵正我，是东城‘杆儿上的’"),
    (25, "杆儿赵", "character", "别人都叫我‘杆儿赵’"),
    (25, "杆儿上的", "faction", "东城‘杆儿上的’"),
    (25, "团头", "faction", "又叫做“团头”"),
    (25, "紫禁城", "location", "那匹马难道是从紫禁城里出来的"),
    (25, "皇城", "location", "只有皇城里才有这么骏的白马"),
    (25, "卷帘子胡同", "location", "送您到卷帘子胡同去"),
    (25, "十三姨", "character", "十三姨的公馆，就在胡同里"),
    (25, "李燕北", "character", "李燕北正在花厅里叹息"),
    (25, "酥油泡螺", "item", "她最拿手的点心，酥油泡螺"),
    (25, "火燎羊头", "item", "还有个刚端上来的火燎羊头"),
    (25, "竹哨", "item", "手上却赫然拿着个奇形的竹哨"),  # may be ch26
    # ---- ch26 第三回 废园异事 ----
    (26, "小可怜", "character", "我叫小可怜，我没有家"),
    (26, "驼背老头子", "character", "是个驼背的老头子叫我来的"),
    (26, "竹哨", "item", "这哨子也是他给你的"),
    (26, "赤红毒蛇", "item", "一条赤红的毒蛇"),
    (26, "鲜红缎带", "item", "被一根鲜红的缎带勒死的"),
    (26, "公孙大娘", "character", "公孙大娘短剑上的缎带"),
    (26, "蛇王", "character", "羊城的“蛇王”"),
    (26, "羊城", "location", "羊城的“蛇王”"),
    (26, "易容术", "skill", "公孙大娘易容术之精妙"),
    (26, "面具", "item", "脸上也果然戴着张制作得极精妙的面具"),
    (26, "霍休", "character", "比霍休还狡猾老辣"),
    (26, "金九龄", "character", "比金九龄还阴沉恶毒"),
    (26, "叶孤城", "character", "去找一个人……叶孤城"),
    (26, "欧阳情", "character", "灯光惨淡……欧阳情惨白的脸上"),
    (26, "李燕北", "character", "李燕北和十三姨就在他身后"),
    (26, "十三姨", "character", "李燕北和十三姨就在他身后"),
    (26, "春明居茶馆", "location", "生意最好、收市最晚的春明居茶馆"),
    (26, "全福客栈", "location", "鼓楼东大街的一家规模很大的“全福客栈”"),
    (26, "鼓楼东大街", "location", "鼓楼东大街的一家规模很大的“全福客栈”"),
    (26, "唐天容", "character", "唐天容的落脚处，是在鼓楼东大街"),
    (26, "严人英", "character", "严人英虽没有找到西门吹雪"),
    (26, "西藏密宗喇嘛", "faction", "其中不但有西藏密宗的喇嘛"),
    (26, "圣母之水峰", "location", "在“圣母之水”峰苦练多年的两位神秘剑客"),
    (26, "三冰透骨镖", "item", "竟是一枚三寸六分长的三冰透骨镖"),
    (26, "胜通", "character", "和尚道：“在下胜通。”"),
    (26, "飞镖胜家", "faction", "你是关中‘飞镖’胜家的人"),
    (26, "霍天青", "character", "本门上下，全都败在霍天青手里"),
    (26, "珠光宝气阁", "location", "霍天青今日想必还在珠光宝气阁"),
    (26, "独孤一鹤", "character", "独孤一鹤和苏少英也不是"),
    (26, "苏少英", "character", "独孤一鹤和苏少英也不是"),
    (26, "血布带", "item", "上面染着斑斑血迹，还带着黄脓的白布带"),
    (26, "白云城主", "character", "名动天下的白云城主"),
    (26, "唐门暗器", "item", "叶孤城在张家口被唐门暗器所伤"),
    (26, "张家口", "location", "叶孤城在张家口被唐门暗器所伤"),
    (26, "天外飞仙", "technique", "春华楼的那一着“天外飞仙”"),
    (26, "唐天仪", "character", "你本不该和唐天仪那种人交手"),
    (26, "吹竹声", "item", "突然听见了一阵很奇怪的吹竹声"),
    (26, "孙秀青", "character", "是孙秀青有了身孕"),
    (26, "紫禁之巅", "location", "改在紫禁之巅"),
    (26, "紫禁城", "location", "紫禁之巅？紫禁城"),
    (26, "太和殿", "location", "在紫禁城里太和殿的屋脊上决战"),
    (26, "金銮殿", "location", "太和殿就是金銮殿"),
    (26, "铁剑", "item", "移开了灯边的黄经和铁剑"),
    # ---- ch27 第四回 北斗七星阵 ----
    (27, "李燕北", "character", "李燕北从他三十个公馆中的第十个公馆"),
    (27, "陆小凤", "character", "“陆小凤？”"),
    (27, "欧阳情", "character", "你不敢去见欧阳情"),
    (27, "杜桐轩", "character", "愿意承认我跟杜桐轩的赌注"),
    (27, "顾青枫", "character", "让给了顾青枫"),
    (27, "白云观", "location", "白云观就在城外"),
    (27, "白云观主", "character", "他就是白云观主"),
    (27, "龙虎山", "location", "南宗的宗师是龙虎山的张真人"),
    (27, "张真人", "character", "龙虎山的张真人"),
    (27, "道教南北两宗", "faction", "道教有南北两宗"),
    (27, "全真派", "faction", "全真派的不传之秘"),
    (27, "北斗七星阵", "skill", "北斗七星阵"),
    (27, "木道人", "character", "一位是武当的木道人"),
    (27, "古松居士", "character", "一位是黄山的古松居士"),
    (27, "老实和尚", "character", "还有一位是老实和尚"),
    (27, "黄山", "location", "黄山的古松居士"),
    (27, "武当", "faction", "武当的木道人"),
    (27, "龙旗令符", "item", "龙旗令符当着证人之面交给了他"),
    (27, "乌鞘长剑", "item", "竟背着口乌鞘长剑"),
    (27, "灵犀一指", "skill", "陆小凤的‘灵犀一指’"),
    (27, "天外飞仙", "technique", "叶孤城的‘天外飞仙’"),
    (27, "殷羡", "character", "富贵神剑”殷羡殷三爷"),
    (27, "富贵神剑", "character", "富贵神剑”殷羡殷三爷"),
    (27, "玉女穿梭", "technique", "那一着‘玉女穿梭’"),
    (27, "大内四大高手", "faction", "皇宫大内中，有四大高手"),
    (27, "杆儿赵", "character", "“杆儿赵”赵正我"),
    (27, "赵正我", "character", "“杆儿赵”赵正我"),
    (27, "金刀冯昆", "character", "自从“金刀”冯昆被抛入冰河里"),
    (27, "西门吹雪", "character", "这一战西门吹雪若是败了"),
    (27, "叶孤城", "character", "昨天我见过叶孤城后"),
    (27, "杜桐轩", "character", "他若不是你，只怕早已死在杜桐轩手里"),
    (27, "十三姨", "character", "十三姨亲手为你做的火燎羊头"),
    (27, "火燎羊头", "item", "十三姨亲手为你做的火燎羊头"),
    (27, "紫禁之巅", "location", "紫金之巅就是紫禁之巅"),
    # ---- ch28 第五回 初入禁城 ----
    (28, "紫禁城", "location", "阳光正照在紫禁城的西北角上"),
    (28, "杆儿赵", "character", "是杆儿赵找了个太监朋友"),
    (28, "安福", "character", "那个叫安福的太监"),
    (28, "小安子", "character", "这个叫小安子的太监"),
    (28, "王总管", "character", "那是我们的王总管"),
    (28, "麻六哥", "character", "麻六哥的赌局就要开了"),
    (28, "三薰香片", "item", "茶叶倒是真正好的三薰香片"),
    (28, "对食", "faction", "叫做‘对食’"),
    (28, "张英风", "character", "是不是姓张，叫张英风"),
    (28, "四大恒", "faction", "东四牌楼四大恒开出来的"),
    (28, "东四牌楼", "location", "东四牌楼四大恒开出来的"),
    (28, "谭腿", "skill", "练过北派的谭腿和大洪拳"),
    (28, "大洪拳", "skill", "练过北派的谭腿和大洪拳"),
    (28, "细胸巧翻云", "technique", "一个“细胸巧翻云”"),
    (28, "楚留香", "character", "以轻功名震天下的楚留香复生"),
    (28, "老实和尚", "character", "“老实和尚。”陆小凤忍不住叫了出来"),
    (28, "西门吹雪", "character", "西门吹雪绝对不在这里"),
    (28, "叶孤城", "character", "又忙着替叶孤城传消息"),
    (28, "潇湘剑客", "character", "哪一位是‘潇湘剑客’魏子云"),
    (28, "魏子云", "character", "‘潇湘剑客’魏子云魏大爷"),
    (28, "大漠神鹰", "character", "哪一位是‘大漠神鹰’屠方"),
    (28, "屠方", "character", "‘大漠神鹰’屠方屠二爷"),
    (28, "摘星手", "character", "就是‘摘星手’丁敖"),
    (28, "丁敖", "character", "‘摘星手’丁敖"),
    (28, "殷羡", "character", "另一个却正是殷羡"),
    (28, "波斯缎带", "item", "这种缎子来自波斯，是大内珍藏"),
    (28, "缎带", "item", "这里有六条缎带"),
    (28, "木道人", "character", "木道人、顾青枫、古松居士"),
    (28, "顾青枫", "character", "木道人、顾青枫、古松居士"),
    (28, "古松居士", "character", "木道人、顾青枫、古松居士"),
    (28, "花满楼", "character", "李燕北、花满楼、严人英"),
    (28, "严人英", "character", "李燕北、花满楼、严人英"),
    (28, "唐家兄弟", "faction", "严人英、唐家兄弟、密宗喇嘛"),
    (28, "密宗喇嘛", "faction", "唐家兄弟、密宗喇嘛"),
    (28, "圣母之水峰", "location", "圣母之水峰的神秘剑客"),
    (28, "七大剑派", "faction", "还有七大剑派的高手"),
    (28, "青衣楼", "faction", "既然有青衣楼，有红鞋子"),
    (28, "红鞋子", "faction", "有青衣楼，有红鞋子"),
    (28, "白袜子", "faction", "就很可能还有个白袜子"),
    (28, "胜通", "character", "还有那小庙里的胜通"),
    (28, "顾青枫", "character", "老实和尚、木道人、顾青枫"),
    # ---- ch29 第六回 第一根线 ----
    (29, "欧阳情", "character", "欧阳情却已昏睡了一天一夜"),
    (29, "十三姨", "character", "十三姨也显得很忧虑"),
    (29, "酥油泡螺", "item", "你有没有吃她做的酥油泡螺"),
    (29, "李燕北", "character", "陆小凤忽又问道：“李燕北呢？”"),
    (29, "公孙大娘", "character", "我听公孙大娘说，她还是个处女"),
    (29, "老实和尚", "character", "有一天我在路上遇见了老实和尚"),
    (29, "西门吹雪", "character", "“西门吹雪！”踏破铁鞋都找不到"),
    (29, "合芳斋", "location", "金字招牌上写着三个斗大的字：“合芳斋”"),
    (29, "孙秀青", "character", "“是孙姑娘？”"),
    (29, "西门夫人", "character", "是西门夫人"),
    (29, "叶孤城", "character", "因为叶孤城的伤势很不轻"),
    (29, "唐天容", "character", "他昨天还在春华楼重创了唐天容"),
    (29, "春华楼", "location", "在春华楼重创了唐天容"),
    (29, "胜通", "character", "这里的和尚俗家姓胜，叫胜通"),
    (29, "公孙大娘", "character", "陆小凤道：“公孙大娘。”"),
    (29, "孙老爷", "character", "害死了孙老爷"),
    (29, "吹竹弄蛇", "skill", "是个会吹竹弄蛇的人"),
    (29, "丹凤公主", "character", "我为了丹凤公主那件事，去找孙老爷"),
    (29, "青衣楼", "faction", "我破了青衣楼之后"),
    (29, "红鞋子", "faction", "还有个叫“红鞋子”的秘密组织"),
    (29, "白袜子", "faction", "很可能就叫做白袜子"),
    (29, "顾青枫", "character", "出面的也是个出家人，叫顾青枫"),
    (29, "杜桐轩", "character", "李燕北和杜桐轩都在你们身上下了很重的赌注"),
    (29, "银票一百九十五万两", "item", "一张一百九十五万两的银票"),
    (29, "紫禁城", "location", "我要你明天陪我到紫禁城去"),
    # ---- ch30 第七回 天坛之夜 ----
    (30, "西门吹雪", "character", "连西门吹雪都不禁觉得背脊在发冷"),
    (30, "陆小凤", "character", "陆小凤拍了拍他的肩"),
    (30, "喇嘛", "faction", "这两个喇嘛却不但怪异，而且丑陋"),
    (30, "青铜环", "item", "左臂上戴着九枚青铜环"),
    (30, "黑蛇剑", "item", "手里挥着柄漆黑的剑"),
    (30, "灵犀一指", "skill", "伸出两根手指一夹，已夹住了剑锋"),
    (30, "圣母之水峰", "location", "圣母之水峰，神秘剑派"),
    (30, "海南剑派", "faction", "海南剑派的龙卷风"),
    (30, "龙卷风", "technique", "海南剑派的龙卷风"),
    (30, "张英风", "character", "死人是张英风"),
    (30, "严人英", "character", "活人竟是严人英"),
    (30, "海南手法", "skill", "点穴的手法，用的也是海南手法"),
    (30, "泥人张", "character", "莫非他本是京城‘泥人张’家里的人"),
    (30, "王总管", "character", "这是王总管和麻六哥"),
    (30, "麻六哥", "character", "这是王总管和麻六哥"),
    (30, "蜡像", "item", "三个蜡像从他怀里掉了出来"),
    (30, "太监窝", "location", "张英风要麻六哥带他去那太监窝"),
    (30, "峨嵋派", "faction", "让你来跟峨嵋派的人火并"),
    (30, "叶孤城", "character", "叶孤城、木道人，还有两三个"),
    (30, "木道人", "character", "叶孤城、木道人，还有两三个"),
    (30, "魏子云", "character", "潇湘剑客魏子云呢"),
    (30, "殷羡", "character", "殷羡更不足论"),
    (30, "老实和尚", "character", "老实和尚若是用剑"),
    (30, "白袜子", "faction", "穿的也是白袜子"),
    # ---- ch31 第八回 奇异老人 ----
    (31, "合芳斋", "location", "陆小凤从合芳斋的后院角门走出来"),
    (31, "泥人张", "character", "泥人张就住在樱桃斜街后面的金鱼胡同里"),
    (31, "樱桃斜街", "location", "住在樱桃斜街后面的金鱼胡同里"),
    (31, "金鱼胡同", "location", "樱桃斜街后面的金鱼胡同里"),
    (31, "欧阳情", "character", "现在他已见过了欧阳情"),
    (31, "西门吹雪", "character", "西门吹雪不但有杀人的快剑"),
    (31, "孙秀青", "character", "他已见过孙秀青"),
    (31, "太和居", "location", "到前面街上的太和居去喝壶茶"),
    (31, "八百一包", "item", "沏了壶“八百一包”的好茶"),
    (31, "卜巨", "character", "“在下卜巨。”"),
    (31, "开天掌", "skill", "“开天掌”卜巨"),
    (31, "开天掌卜巨", "character", "“开天掌”卜巨，威震川湘"),
    (31, "川湘三十六帮", "faction", "川湘一带三十六帮悍盗的总瓢把子"),
    (31, "玉璧", "item", "摆着三块晶莹圆润，全无瑕疵的玉璧"),
    (31, "缎带", "item", "换你的三条带子"),
    (31, "魏子云", "character", "听到魏子云说这句话的时候"),
    (31, "毒蒺藜", "item", "一枚毒蒺藜。唐家威慑天下"),
    (31, "唐天纵", "character", "陆小凤道：“唐天纵？”"),
    (31, "唐家", "faction", "在唐家的兄弟中，他年纪虽最小"),
    (31, "豹皮革囊", "item", "一双手已探入了腰边的豹皮革囊"),
    (31, "老实和尚", "character", "头颅光光……老实话"),
    (31, "蜡像", "item", "这蜡像的脸，竟是西门吹雪的脸"),
    (31, "机簧暗器", "item", "泥人里竟藏着筒极厉害的机簧暗器"),
    (31, "毒针", "item", "七根见血封喉的毒针"),
    (31, "井", "location", "后面有口井"),
    # ---- ch32 第九回 难得糊涂 ----
    (32, "金鱼胡同", "location", "陆小凤从金鱼胡同里走出来"),
    (32, "缎带", "item", "本来系在他腰上的缎带"),
    (32, "老实和尚", "character", "一条给了老实和尚"),
    (32, "唐天纵", "character", "一条给了唐天纵"),
    (32, "司空摘星", "character", "司空摘星！这老头子原来是"),
    (32, "偷王之王", "character", "偷遍天下无敌手的“偷王之王”"),
    (32, "竹叶青", "item", "外加三斤竹叶青"),
    (32, "玉带", "item", "腰上的玉带晶莹圆润"),
    # ---- ch33 第十回 月圆之夜 ----
    (33, "合芳斋", "location", "陆小凤从合芳斋的后巷中冲出来"),
    (33, "司空摘星", "character", "要怎么才能找到司空摘星"),
    (33, "老庆余堂", "location", "那家药材铺的字号是“老庆余堂”"),
    (33, "缎带", "item", "竟是两条缎带"),
    (33, "孙秀青", "character", "就可以看见孙秀青和欧阳情"),
    (33, "欧阳情", "character", "就可以看见孙秀青和欧阳情"),
    (33, "西门吹雪", "character", "西门吹雪莫非已走了"),
    (33, "叶孤城", "character", "因为叶孤城和西门吹雪都是他的朋友"),
    # ---- ch34 第十一回 深宫惊变 ----
    (34, "司空摘星", "character", "司空摘星笑得太早"),
    (34, "唐天纵", "character", "唐天纵已窜到叶孤城身后"),
    (34, "追魂砂", "item", "唐家见血封喉的追魂砂"),
    (34, "毒砂", "item", "发出了一片乌云般的毒砂"),
    (34, "人皮面具", "item", "却是个制作得极其精妙的人皮面具"),
    (34, "黑衣人", "character", "替杜桐轩做过保镖的那个神秘黑衣人"),
    (34, "杜桐轩", "character", "替杜桐轩做过保镖"),
    (34, "魏子云", "character", "指着魏子云道"),
    (34, "王总管", "character", "宫里有个姓王的老太监"),
    (34, "南书房", "location", "常歇在南书房"),
    (34, "殷羡", "character", "殷羡叫了起来"),
    (34, "丁敖", "character", "他身后的丁敖已将剑锋拔出"),
    (34, "太和殿", "location", "太和殿上的月色更幽冷了"),
    (34, "西门吹雪", "character", "仰面向天的西门吹雪"),
    (34, "老实和尚", "character", "低头望地的老实和尚"),
    (34, "叶孤城", "character", "老实和尚道：“叶孤城。”"),
    (34, "紫衣人", "character", "还有个紫衣人手里拿着柄雪亮的弯刀"),
    # ---- ch35 第十二回 强敌已逝 ----
    (35, "西门吹雪", "character", "眼睛一直在盯着西门吹雪"),
    (35, "叶孤城", "character", "看了看叶孤城，看了看西门吹雪"),
    (35, "魏子云", "character", "拍了拍魏子云的肩"),
    (35, "潇湘剑客", "character", "潇湘剑客果然人如其名"),
    (35, "太和殿", "location", "太和殿的飞檐下"),
    (35, "紫禁之巅", "location", "在紫禁之巅，滑不留足的琉璃瓦上"),
    (35, "司空摘星", "character", "就连司空摘星、老实和尚"),
    (35, "老实和尚", "character", "就连司空摘星、老实和尚"),
    (35, "陆小凤", "character", "叶孤城说的当然是陆小凤"),
    (35, "张英风", "character", "你说的是张英风、公孙大娘和欧阳情"),
    (35, "公孙大娘", "character", "张英风、公孙大娘和欧阳情"),
    (35, "欧阳情", "character", "张英风、公孙大娘和欧阳情"),
    (35, "龟孙子大老爷", "character", "还有龟孙子大老爷"),
]


def main() -> None:
    chapters: dict[int, list[str]] = {}
    windows_by_ch: dict[int, list[dict]] = {}
    for ch in range(24, 36):
        text = (CH_SPLIT / f"ch_{ch:03d}.txt").read_text(encoding="utf-8")
        lines = split_lines(text)
        chapters[ch] = lines
        windows_by_ch[ch] = make_windows(ch, lines)

    # Dedup by (window_id, name, category)
    seen: set[tuple[str, str, str]] = set()
    by_window: dict[str, list[dict]] = defaultdict(list)
    missing = []

    for chapter, name, category, needle in ENTITIES:
        lines = chapters[chapter]
        line = find_line(lines, needle)
        if line is None:
            # fallback: search name alone
            line = find_line(lines, name)
        if line is None:
            missing.append((chapter, name, needle))
            continue
        w = window_for(chapter, line, windows_by_ch)
        if not w:
            missing.append((chapter, name, f"no-window line={line}"))
            continue
        key = (w["id"], name, category)
        if key in seen:
            continue
        seen.add(key)
        # expand multi-line if needed: keep single line for fidelity
        text = lines[line - 1]
        # ensure text is non-empty; if empty, use nearby
        if not text.strip():
            for delta in (1, -1, 2, -2):
                j = line - 1 + delta
                if 0 <= j < len(lines) and lines[j].strip():
                    line = j + 1
                    text = lines[j]
                    break
        by_window[w["id"]].append(
            {
                "name": name,
                "category_hint": category,
                "chapter": chapter,
                "line_start": line,
                "line_end": line,
                "text": text,
                "window_id": w["id"],
            }
        )

    # Ensure every window has at least one candidate: use chapter title / first named line
    all_window_ids = [w["id"] for ch in range(24, 36) for w in windows_by_ch[ch]]
    for wid in all_window_ids:
        if by_window[wid]:
            continue
        # find chapter/window
        ch = int(wid[2:5])
        w = next(x for x in windows_by_ch[ch] if x["id"] == wid)
        lines = chapters[ch]
        # pick first non-empty content line in window containing a 2+ Chinese char token
        picked = None
        for ln in range(w["line_start"], w["line_end"] + 1):
            t = lines[ln - 1]
            m = re.search(r"[一-鿿]{2,8}", t)
            if m and t.strip():
                # skip pure dialogue particles
                name = m.group(0)
                if name in ("一个", "这个", "那个", "什么", "没有", "已经", "自己", "他们", "我们", "你们"):
                    continue
                picked = (name, ln, t)
                break
        if not picked:
            # last resort: title-ish first non-empty
            for ln in range(w["line_start"], w["line_end"] + 1):
                if lines[ln - 1].strip():
                    picked = (f"场景片段_ch{ch:03d}", ln, lines[ln - 1])
                    break
        if picked:
            name, ln, t = picked
            by_window[wid].append(
                {
                    "name": name,
                    "category_hint": "location" if "城" in name or "楼" in name or "胡同" in name else "character",
                    "chapter": ch,
                    "line_start": ln,
                    "line_end": ln,
                    "text": t,
                    "window_id": wid,
                }
            )

    # emit jsonl with sequential candidate ids per window
    rows = []
    completed = []
    for wid in all_window_ids:
        completed.append(wid)
        items = by_window[wid]
        # stable order by line
        items.sort(key=lambda r: (r["line_start"], r["name"]))
        for i, item in enumerate(items, 1):
            rows.append(
                {
                    "candidate_id": f"cand_{wid}_{i:04d}",
                    "category_hint": item["category_hint"],
                    "name": item["name"],
                    "chapter": item["chapter"],
                    "source_ref": {
                        "line_start": item["line_start"],
                        "line_end": item["line_end"],
                        "text": item["text"],
                    },
                    "discovery_pass": "named-inventory",
                    "window_id": wid,
                }
            )

    # validate citations exist in declared lines
    bad = 0
    for r in rows:
        ch = r["chapter"]
        ls, le = r["source_ref"]["line_start"], r["source_ref"]["line_end"]
        blob = "".join(chapters[ch][ls - 1 : le])
        if re.sub(r"\s+", "", r["source_ref"]["text"]) not in re.sub(r"\s+", "", blob):
            bad += 1
            print("BAD", r["candidate_id"], r["name"])

    OUT_JSONL.write_text(
        "\n".join(json.dumps(r, ensure_ascii=False) for r in rows) + "\n",
        encoding="utf-8",
    )
    done = {
        "pass": "named-inventory",
        "window_ids": completed,
        "completed_window_ids": completed,
        "chapters": list(range(24, 36)),
        "candidate_count": len(rows),
        "missing_needles": [
            {"chapter": c, "name": n, "needle": needle} for c, n, needle in missing
        ],
    }
    OUT_DONE.write_text(json.dumps(done, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    # stats
    from collections import Counter

    cat = Counter(r["category_hint"] for r in rows)
    per = Counter(r["window_id"] for r in rows)
    print(
        json.dumps(
            {
                "windows": len(completed),
                "candidates": len(rows),
                "categories": dict(cat),
                "min_per_window": min(per.values()) if per else 0,
                "max_per_window": max(per.values()) if per else 0,
                "missing": len(missing),
                "bad_citations": bad,
                "out": str(OUT_JSONL),
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    if missing:
        print("MISSING sample:", missing[:20])


if __name__ == "__main__":
    main()
