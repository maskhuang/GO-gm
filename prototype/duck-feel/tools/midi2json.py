"""把 MIDI 转成游戏用的乐谱 JSON：音符按拍记时（拍 = 四分音符），附带速度表和拍号。
用法：python3 tools/midi2json.py audio/midi/cc3.mid [--dump]"""
import json, struct, sys

def read_var(b, i):
    v = 0
    while True:
        c = b[i]; i += 1; v = (v << 7) | (c & 0x7F)
        if not c & 0x80: return v, i

def parse(path):
    b = open(path, 'rb').read()
    assert b[:4] == b'MThd'
    fmt, ntrk, div = struct.unpack('>HHH', b[8:14])
    i, notes, tempos, sigs = 14, [], [], []
    for _ in range(ntrk):
        assert b[i:i + 4] == b'MTrk'
        ln = struct.unpack('>I', b[i + 4:i + 8])[0]; i += 8; end = i + ln
        t, run, on, pedal, held = 0, 0, {}, False, []   # held = 松了键但被延音踏板托着的音
        def end_note(t0, v0, k, ch, t1): notes.append([round(t0 / div, 4), round((t1 - t0) / div, 4), k, v0, ch])
        while i < end:
            d, i = read_var(b, i); t += d
            st = b[i]
            if st == 0xFF:
                typ = b[i + 1]; ml, j = read_var(b, i + 2); data = b[j:j + ml]; i = j + ml
                if typ == 0x51: tempos.append((t / div, 60e6 / int.from_bytes(data, 'big')))
                elif typ == 0x58: sigs.append((t / div, data[0], 2 ** data[1]))
                continue
            if st in (0xF0, 0xF7):
                ml, j = read_var(b, i + 1); i = j + ml; continue
            if st & 0x80: run = st; i += 1
            kind, ch = run & 0xF0, run & 0x0F
            if kind in (0x80, 0x90):
                k, v = b[i], b[i + 1]; i += 2
                if kind == 0x90 and v > 0:
                    for h in [h for h in held if h[2] == k and h[3] == ch]: held.remove(h); end_note(h[0], h[1], k, ch, t)   # 同一个键重弹：踏板托着的旧音停掉
                    on.setdefault((ch, k), []).append((t, v))
                elif on.get((ch, k)):
                    t0, v0 = on[(ch, k)].pop(0)
                    if pedal: held.append((t0, v0, k, ch))
                    else: end_note(t0, v0, k, ch, t)
            elif kind == 0xB0:
                k, v = b[i], b[i + 1]; i += 2
                if k == 64:   # 延音踏板：松开时把托着的音一起停掉
                    pedal = v >= 64
                    if not pedal:
                        for h in held: end_note(h[0], h[1], h[2], h[3], t)
                        held = []
            elif kind in (0xC0, 0xD0): i += 1
            else: i += 2
        i = end
    notes.sort()
    return {'tempos': tempos, 'sigs': sigs, 'notes': notes}

if __name__ == '__main__':
    s = parse(sys.argv[1])
    if '--dump' in sys.argv:
        n = s['notes']; chs = sorted({x[4] for x in n})
        print(sys.argv[1], 'notes', len(n), 'channels', chs, 'beats', n[-1][0] + n[-1][1])
        print(' tempos', [(round(a, 2), round(b, 1)) for a, b in s['tempos']][:12], '...' if len(s['tempos']) > 12 else '')
        print(' sigs', s['sigs'])
        for c in chs:
            ks = [x[2] for x in n if x[4] == c]; print(' ch', c, 'count', len(ks), 'range', min(ks), max(ks))
    else:
        json.dump(s, sys.stdout, separators=(',', ':'))
