"""德彪西《儿童园地》MIDI（CC0）→ audio/score.json
每个音标上声部：m = 旋律（每组同时起奏的最高音）、b = 低音（最低音）、i = 内声部。
游戏按紧张度决定弹哪些声部：平静只弹旋律，紧张时全部弹——同一段音乐变厚、变响，不换曲子（Goose 的做法）。
乐句：在演奏的自然换气处切开（起奏间隔大、同时响着的音少），每句 7~16 秒。
用法：python3 tools/build_score.py"""
import json, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from midi2json import parse

PIECES = [   # 文件, 名字, 每拍秒数（MIDI 记的是 120 拍/分）
    ('cc3', "Serenade for the Doll"),
    ('cc5', "The Little Shepherd"),
    ('cc2', "Jimbo's Lullaby"),
    ('cc4', "The Snow Is Dancing"),
]

def build(fn):
    notes = [[n[0] * 0.5, n[1] * 0.5, n[2], n[3]] for n in parse(f'audio/midi/{fn}.mid')['notes']]   # 拍 → 秒
    t0 = notes[0][0]
    for n in notes: n[0] -= t0
    # 声部
    out, i = [], 0
    while i < len(notes):
        j = i
        while j < len(notes) and notes[j][0] - notes[i][0] < 0.04: j += 1
        grp = sorted(notes[i:j], key=lambda n: n[2])
        for k, n in enumerate(grp):
            stem = 'm' if k == len(grp) - 1 and n[2] >= 58 else 'b' if k == 0 and (n[2] < 52 or (len(grp) > 1 and n[2] < 57)) else 'i'
            out.append([round(n[0], 3), round(max(0.05, n[1]), 3), n[2], n[3], stem])
        i = j
    out.sort()
    # 乐句切点
    onsets = sorted({n[0] for n in out})
    def score(t, gap):
        sounding = sum(1 for n in out if n[0] < t - 0.01 and n[0] + n[1] > t + 0.05)
        return gap / (1 + sounding)
    cands = [(onsets[k], score(onsets[k], onsets[k] - onsets[k - 1])) for k in range(1, len(onsets)) if onsets[k] - onsets[k - 1] >= 0.25]
    end = max(n[0] + n[1] for n in out)
    cuts, s = [0.0], 0.0
    while end - s > 16:
        win = [c for c in cands if s + 7 <= c[0] <= s + 16]
        nxt = max(win, key=lambda c: c[1])[0] if win else min(onsets, key=lambda t: abs(t - (s + 12)))
        if end - nxt < 5: break
        cuts.append(nxt); s = nxt
    return out, cuts, round(end, 3)

score = []
for fn, name in PIECES:
    notes, cuts, end = build(fn)
    score.append({'name': name, 'end': end, 'phrases': cuts, 'notes': notes})
    st = {k: sum(1 for n in notes if n[4] == k) for k in 'mbi'}
    print(f'{name}: {len(notes)} notes {end:.0f}s, {len(cuts)} phrases (len {[round(b - a, 1) for a, b in zip(cuts, cuts[1:] + [end])]}), stems {st}')
json.dump({'source': "Claude Debussy, Children's Corner (1908, public domain). MIDI: Michael Bednarek, Wikimedia Commons, CC0.", 'pieces': score},
          open('audio/score.json', 'w'), separators=(',', ':'))
print('wrote audio/score.json', os.path.getsize('audio/score.json'), 'bytes')
