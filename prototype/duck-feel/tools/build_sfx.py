"""真实录音音效：从 Freesound 的 CC0 录音里切出来 → audio/sfx/*.mp3 + audio/sfx/sfx.json
原始录音不进仓库（约 9MB）：按 SOURCES 里的编号从 https://freesound.org/s/<编号>/ 下载，存成 <名字>.mp3 放进一个目录。
用法：python3 tools/build_sfx.py <原始录音目录>"""
import json, os, subprocess, sys
import numpy as np

SR = 44100
SOURCES = {   # 名字: (Freesound 编号, 作者, 标题)，全部 CC0
    'quack_b': (188376, 'calodas', 'Duck_quack_1_Sweden.wav'), 'quack_d': (188375, 'calodas', 'Duck_quack_2_Sweden.wav'),
    'peep_c': (826677, 'TheKingOfGeeks360', 'Fowl - Chicken; Baby Chick, Peep'),
    'splash_a': (398032, 'swordofkings128', 'Splash'), 'splash_b': (398039, 'swordofkings128', 'water splash 2'),
    'splash_c': (841834, 'Robo9418', 'Small Puddle Splash'), 'splashes': (390391, 'N-RAZM', 'Small_Splashes.wav'),
    'plop': (530359, 'danielpodlovics', 'Water.wav'),
    'thud': (653910, 'Krokulator', 'soft-hit.wav'), 'pillow': (872227, 'KoimeMatsuchiya', 'Soft Impact - Pillow Hit'),
    'gulp': (56271, 'Q.K.', 'Water_Gulp.wav'), 'bubbles': (840042, 'hotpin7', 'Bubbles'),
    'hiss': (740195, 'el_boss', 'Goose Hiss'), 'gull': (263786, 'steaq', 'Seagull single call'),
    'hawk': (616926, 'TRP', '210227 Red Tailed Hawk, eq isolated calls'), 'heron': (825293, 'inspire153', 'Haigur-1'),
    'flap': (389633, '_stubb', 'Wing Flap 2.wav'), 'whoosh': (449996, 'DJT4NN3R', 'whoosh_short_mid.wav'),
    'stream': (548373, 'Nox_Sound', 'Ambiance_Stream_Calm_Loop_Stereo.wav'), 'birds': (50619, 'vibe_crc', 'morning_birds_ambience.wav'),
    'rain': (595717, '_lynks', 'Soft Rain Loop'), 'rapids': (82084, 'bsumusictech', 'rapidsclose.wav'),
}
# 输出: (来源, 开始秒, 结束秒, ffmpeg 滤波)。同名加 _1 _2 … 的是同一个声音的几个变体，游戏里随机挑
CLIPS = {
    'quack_1': ('quack_b', 2.70, 3.08, 'highpass=f=250,lowpass=f=5000'), 'quack_2': ('quack_b', 3.55, 3.86, 'highpass=f=250,lowpass=f=5000'),
    'quack_3': ('quack_b', 11.94, 12.24, 'highpass=f=250,lowpass=f=5000'), 'quack_4': ('quack_d', 9.34, 9.78, 'highpass=f=250,lowpass=f=5000'),
    'peep_1': ('peep_c', 2.39, 2.53, 'highpass=f=1800'), 'peep_2': ('peep_c', 2.91, 3.06, 'highpass=f=1800'), 'peep_3': ('peep_c', 3.42, 3.59, 'highpass=f=1800'),
    'peep_4': ('peep_c', 4.03, 4.19, 'highpass=f=1800'), 'peep_5': ('peep_c', 5.02, 5.17, 'highpass=f=1800'), 'peep_6': ('peep_c', 7.44, 7.59, 'highpass=f=1800'),
    'splashbig_1': ('splash_a', 0.0, 1.33, ''), 'splash_1': ('splash_b', 0.0, 0.7, ''), 'splash_2': ('splash_c', 0.0, 0.32, ''),
    'splash_3': ('splashes', 2.50, 2.95, ''), 'splash_4': ('splashes', 8.20, 8.80, ''), 'plop_1': ('plop', 0.0, 0.25, ''),
    'thud_1': ('thud', 0.0, 0.3, 'lowpass=f=3500'), 'thud_2': ('pillow', 0.0, 0.3, 'lowpass=f=3500'),
    'gulp_1': ('gulp', 0.0, 0.25, ''), 'bubbles_1': ('bubbles', 0.0, 0.8, ''),
    'hiss_1': ('hiss', 0.0, 1.1, ''), 'gull_1': ('gull', 0.0, 0.4, ''),
    'hawk_1': ('hawk', 4.55, 5.20, 'highpass=f=1500'), 'hawk_2': ('hawk', 6.70, 7.35, 'highpass=f=1500'),
    'heron_1': ('heron', 5.05, 5.38, 'highpass=f=300'), 'heron_2': ('heron', 5.97, 6.30, 'highpass=f=300'), 'heron_3': ('heron', 7.12, 7.42, 'highpass=f=300'),
    'flap_1': ('flap', 0.0, 1.2, ''), 'whoosh_1': ('whoosh', 0.1, 0.6, ''),
}
LOOPS = {'stream': (0.3, 29.6), 'birds': (0.3, 32.0), 'rain': (0.3, 22.2), 'rapids': (0.3, 13.4)}   # 环境声：立体声，游戏里两份交叉淡入淡出地循环

def decode(path, ch, af=''):
    cmd = ['ffmpeg', '-hide_banner', '-loglevel', 'error', '-i', path] + (['-af', af] if af else []) + ['-f', 'f32le', '-ac', str(ch), '-ar', str(SR), '-']
    return np.frombuffer(subprocess.run(cmd, capture_output=True, check=True).stdout, dtype=np.float32).reshape(-1, ch).copy()

def encode(x, path, kbps):
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-f', 'f32le', '-ac', str(x.shape[1]), '-ar', str(SR), '-i', '-',
                    '-b:a', f'{kbps}k', path], input=np.clip(x, -1, 1).astype(np.float32).tobytes(), check=True)

def fade(x, fin=0.004, fout=0.03):
    n = len(x); a, b = min(n // 2, int(fin * SR)), min(n // 2, int(fout * SR))
    x[:a] *= np.linspace(0, 1, a)[:, None]; x[n - b:] *= np.linspace(1, 0, b)[:, None] ** 2
    return x

if __name__ == '__main__':
    src, out = sys.argv[1], 'audio/sfx'
    os.makedirs(out, exist_ok=True)
    manifest = {'clips': {}, 'loops': list(LOOPS)}
    for name, (s, t0, t1, af) in CLIPS.items():
        x = decode(f'{src}/{s}.mp3', 1, af)[int(t0 * SR):int(t1 * SR)]
        x = fade(x) * (10 ** (-1 / 20) / max(1e-6, np.abs(x).max()))   # 峰值 -1 dB；游戏里各自再定音量
        encode(x, f'{out}/{name}.mp3', 96)
        base = name.rsplit('_', 1)[0]; manifest['clips'].setdefault(base, []).append(name)
    for name, (t0, t1) in LOOPS.items():
        x = decode(f'{src}/{name}.mp3', 2)[int(t0 * SR):int(t1 * SR)]
        x = fade(x, 0.05, 0.05) * (10 ** (-20 / 20) / np.sqrt(np.mean(x ** 2)))   # 均方根 -20 dB
        encode(x, f'{out}/loop_{name}.mp3', 96)
    manifest['credits'] = {k: f'"{v[2]}" by {v[1]} — https://freesound.org/s/{v[0]}/ (CC0)' for k, v in SOURCES.items()}
    json.dump(manifest, open(f'{out}/sfx.json', 'w'), indent=1, ensure_ascii=False)
    print('clips', sum(len(v) for v in manifest['clips'].values()), 'loops', len(LOOPS))
