// 野外笔记本：标题 / 结算 / 暂停都画成一页纸，摆在镜头前的 3D 场景里（会被描边，和游戏画面是一个东西，不是网页卡片）
// 教学图标：手绘风格的「鼠标」「Shift 键」小图标，在需要的时刻出现在鸭妈妈旁边，做到了就消失
import * as THREE from 'three';

const W = 2048, H = 1400;
const INK = '#2b3a4a', RED = '#d2493a', PAPER = '#fbf4e2';
// 字体（随项目自带，SIL OFL 许可，见 fonts/OFL-*.txt）：Caveat = 手写标题，Patrick Hand = 手写正文，Fredoka = 圆润的键帽字
const HEAD = '"Caveat", "Patrick Hand", cursive', HAND = '"Patrick Hand", "Comic Sans MS", cursive', KEY = '"Fredoka", system-ui, sans-serif';
const FONTS = [['Caveat', 'fonts/caveat-700-latin.woff2', '700'], ['Patrick Hand', 'fonts/patrickhand-latin.woff2', '400'], ['Fredoka', 'fonts/fredoka-600-latin.woff2', '600']];
export const fontsReady = Promise.all(FONTS.map(([fam, url, weight]) =>
  new FontFace(fam, `url(${new URL(url, import.meta.url)})`, { weight }).load().then(f => document.fonts.add(f)))).catch(e => console.warn('font load failed', e));
const TAU = Math.PI * 2;

// 中日文按字换行，英文单词尽量不拆
function wrap(g, text, maxW) {
  const out = [];
  for (const para of String(text).split('\n')) {
    let line = '';
    const tokens = para.match(/[A-Za-z0-9'’.,!?%:()_-]+|\s+|./gu) || [];   // 括号、下划线跟着单词走，不单独落在行尾
    for (const tk of tokens) {
      if (g.measureText(line + tk).width > maxW && line) { out.push(line.trimEnd()); line = tk.trimStart(); }
      else line += tk;
    }
    out.push(line);
  }
  return out;
}
function textBlock(g, text, x, y, maxW, size, lh = 1.45, color = INK, align = 'left') {
  g.font = `${size}px ${HAND}`; g.fillStyle = color; g.textAlign = align; g.textBaseline = 'top';
  const lines = wrap(g, text, maxW);
  lines.forEach((l, i) => g.fillText(l, x, y + i * size * lh));
  return y + lines.length * size * lh;
}
// 抖一点的手绘线
function wobblyLine(g, x0, y0, x1, y1, amp = 2) {
  g.beginPath(); g.moveTo(x0, y0);
  const n = Math.max(2, Math.floor(Math.hypot(x1 - x0, y1 - y0) / 40));
  for (let i = 1; i <= n; i++) { const k = i / n; g.lineTo(x0 + (x1 - x0) * k + (Math.random() - 0.5) * amp, y0 + (y1 - y0) * k + (Math.random() - 0.5) * amp); }
  g.stroke();
}
function tape(g, x, y, w, rot) {
  g.save(); g.translate(x, y); g.rotate(rot);
  g.fillStyle = 'rgba(232, 214, 150, 0.85)'; g.fillRect(-w / 2, -22, w, 44);
  g.strokeStyle = 'rgba(160, 140, 80, .35)'; g.lineWidth = 2; g.strokeRect(-w / 2, -22, w, 44);
  g.restore();
}
// 小鸭涂鸦：kind = 'home'（黄，开心）/ 'lost'（虚线空心）/ 'adopt'（麻黄色）
function duckDoodle(g, x, y, s, kind = 'home') {
  g.save(); g.translate(x, y); g.scale(s, s);
  g.lineWidth = 6; g.strokeStyle = INK; g.lineJoin = 'round';
  if (kind === 'lost') { g.setLineDash([10, 9]); g.strokeStyle = 'rgba(43,58,74,.45)'; }
  const fill = kind === 'home' ? '#ffd84d' : kind === 'adopt' ? '#d9b45a' : 'rgba(0,0,0,0)';
  g.fillStyle = fill;
  g.beginPath(); g.ellipse(0, 18, 44, 32, 0, 0, TAU); g.fill(); g.stroke();          // 身子
  g.beginPath(); g.arc(26, -22, 26, 0, TAU); g.fill(); g.stroke();                    // 头
  g.setLineDash([]);
  if (kind !== 'lost') {
    g.fillStyle = '#f08a2a'; g.beginPath(); g.moveTo(48, -24); g.lineTo(72, -18); g.lineTo(48, -10); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = INK; g.beginPath(); g.arc(32, -28, 5, 0, TAU); g.fill();
  }
  g.restore();
}
function star(g, x, y, r, filled) {
  g.save(); g.translate(x, y); g.beginPath();
  for (let i = 0; i < 10; i++) { const rr = i % 2 ? r * 0.45 : r, a = i / 10 * TAU - Math.PI / 2; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  g.closePath(); g.lineWidth = 7; g.strokeStyle = INK; g.fillStyle = filled ? '#ffd24f' : 'rgba(0,0,0,0)'; g.fill(); g.stroke(); g.restore();
}
// 贴在笔记本上的知识卡
function noteCard(g, x, y, w, h, [ic, title, text], isNew, rot) {
  g.save(); g.translate(x + w / 2, y + h / 2); g.rotate(rot); g.translate(-w / 2, -h / 2);
  g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(8, 10, w, h);
  g.fillStyle = '#fffdf6'; g.fillRect(0, 0, w, h);
  g.strokeStyle = INK; g.lineWidth = 4; g.strokeRect(0, 0, w, h);
  g.font = `52px ${HAND}`; g.textBaseline = 'top'; g.textAlign = 'left'; g.fillStyle = INK;
  g.fillText(ic, 26, 22);
  g.font = `700 58px ${HEAD}`; g.fillText(title, 96, 20);
  if (isNew) {
    const tw = g.measureText(title).width;
    g.save(); g.translate(96 + tw + 48, 46); g.rotate(-0.15);
    g.strokeStyle = RED; g.lineWidth = 5; g.beginPath(); g.arc(0, 0, 30, 0, TAU); g.stroke();
    g.fillStyle = RED; g.font = `700 30px ${HEAD}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('new!', 0, 2);
    g.restore();
  }
  textBlock(g, text, 28, 100, w - 56, 38, 1.34);
  g.restore();
  tape(g, x + w / 2, y + 4, 150, rot * 2 + (Math.random() - 0.5) * 0.2);
}

// spec: { title, sub, stars, ducks: [{kind}], lines: [string], notes: [[ic,title,text], isNew][], count, next: {title, text}, footer }
function drawPage(g, spec) {
  g.clearRect(0, 0, W, H);
  // 纸
  g.fillStyle = PAPER; g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(80,140,190,.16)'; g.lineWidth = 2;
  for (let y = 120; y < H; y += 64) wobblyLine(g, 0, y, W, y, 1);
  g.strokeStyle = 'rgba(210,73,58,.35)'; g.lineWidth = 3; wobblyLine(g, 150, 0, 150, H, 1.5);
  for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(120,90,40,${Math.random() * 0.04})`; g.fillRect(Math.random() * W, Math.random() * H, 3, 3); }   // 纸纹
  tape(g, 260, 30, 260, -0.06); tape(g, W - 260, 30, 260, 0.07);

  const L = 220, R = W - 140, CW = R - L;
  let y = 110;
  g.textAlign = 'left';
  if (spec.big) {   // 标题页
    g.font = `700 270px ${HEAD}`; g.fillStyle = INK; g.textBaseline = 'top'; g.textAlign = 'center';
    g.fillText(spec.big, W / 2, 170);
    if (spec.sub) { g.font = `700 92px ${HEAD}`; g.fillStyle = RED; g.fillText(spec.sub, W / 2, 470); }
    duckDoodle(g, W / 2 - 220, 760, 2.2, 'home'); duckDoodle(g, W / 2 + 40, 800, 1.5, 'home'); duckDoodle(g, W / 2 + 230, 820, 1.2, 'home');
    g.strokeStyle = 'rgba(70,140,170,.6)'; g.lineWidth = 6;
    for (let i = 0; i < 3; i++) wobblyLine(g, W / 2 - 520 + i * 60, 940 + i * 26, W / 2 + 520 - i * 60, 940 + i * 26, 6);
    if (spec.lines) { let yy = 1030; for (const l of spec.lines) yy = textBlock(g, l, W / 2, yy, CW - 200, 50, 1.4, INK, 'center') + 6; }
  } else {
    g.font = `700 120px ${HEAD}`; g.fillStyle = INK; g.textBaseline = 'top';
    g.fillText(spec.title, L, y - 14);
    if (spec.stars != null) for (let i = 0; i < 3; i++) star(g, R - 330 + i * 120, y + 50, 46, i < spec.stars);
    y += 140;
    if (spec.ducks?.length) {
      const s = Math.min(1, 900 / (spec.ducks.length * 170));
      spec.ducks.forEach((d, i) => duckDoodle(g, L + 60 + i * 170 * s, y + 60, s, d.kind));
      y += 160;
    }
    for (const l of spec.lines || []) y = textBlock(g, l, L, y, CW, 50, 1.4) + (spec.gap ?? 4);
    y += 20;
    if (spec.notes?.length) {
      const n = spec.notes.length, gap = 60, w = (CW - gap * (n - 1)) / n;
      g.font = `38px ${HAND}`;
      const h = Math.max(240, 132 + Math.max(...spec.notes.map(([nt]) => wrap(g, nt[2], w - 56).length)) * 38 * 1.34);   // 卡片高度跟着字数走
      spec.notes.forEach(([note, isNew], i) => noteCard(g, L + i * (w + gap), y, w, h, note, isNew, (i % 2 ? 1 : -1) * 0.018));
      y += h + 30;
      if (spec.count) { g.font = `38px ${HAND}`; g.fillStyle = 'rgba(43,58,74,.6)'; g.textAlign = 'right'; g.fillText(spec.count, R, y - 10); g.textAlign = 'left'; y += 40; }
    }
    if (spec.next) {
      g.strokeStyle = 'rgba(43,58,74,.4)'; g.lineWidth = 3; wobblyLine(g, L, y, R, y, 3); y += 26;
      g.font = `700 72px ${HEAD}`; g.fillStyle = RED; g.fillText(spec.next.title, L, y - 8); y += 80;
      y = textBlock(g, spec.next.text, L, y, CW, 46, 1.4);
    }
  }
  const used = spec.compact ? Math.min(H, Math.max(620, y + 150)) : H;   // 小纸条：只用上面一截
  if (spec.footer) { g.font = `46px ${HAND}`; g.fillStyle = 'rgba(43,58,74,.7)'; g.textAlign = 'right'; g.textBaseline = 'bottom'; g.fillText(spec.footer, R, used - 50); }
  if (spec.compact) { g.strokeStyle = INK; g.lineWidth = 6; g.strokeRect(3, 3, W - 6, used - 6); }
  return used;
}

export function createNotebook(scene, camera) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const mat = new THREE.MeshBasicMaterial({ map: tex, fog: false, toneMapped: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(W / H, 1), mat);
  mesh.renderOrder = 50; mesh.visible = false; mesh.userData.skip = true; mesh.frustumCulled = false;
  scene.add(mesh);
  const st = { t: 0, showing: false, out: 0, rot: 0, spec: null };
  const paint = () => { const used = drawPage(g, st.spec); st.frac = used / H; tex.repeat.set(1, st.frac); tex.offset.set(0, 1 - st.frac); tex.needsUpdate = true; };
  fontsReady.then(() => { if (st.spec) paint(); });   // 字体到了重画一遍
  const fwd = new THREE.Vector3(), q = new THREE.Quaternion(), qz = new THREE.Quaternion(), zAxis = new THREE.Vector3(0, 0, 1);
  return {
    get visible() { return st.showing; },
    show(spec) {
      st.spec = spec; paint();
      st.showing = true; st.t = 0; st.out = 0; st.scale = spec.scale || 1; st.rot = (Math.random() - 0.5) * 0.06; mesh.visible = true;
    },
    refresh(spec) { if (st.showing) { st.spec = spec; paint(); } },   // 同一页里改了数字：原地重画，不重新滑进来
    hide() { if (st.showing) { st.showing = false; st.out = 0.001; } },
    update(dt) {
      if (!mesh.visible) return;
      st.t += dt;
      if (!st.showing) { st.out += dt; if (st.out > 0.35) { mesh.visible = false; return; } }
      // 摆在镜头前：竖直方向占画面 ~82%，窄屏时按宽度缩
      const D = 1.4, vh = 2 * D * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), vw = vh * camera.aspect;
      const s = Math.min(vh * 0.84, vw * 0.94 / (W / H));
      // 进场：从下面滑上来、晃一下落定；退场：往下滑走
      const kin = Math.min(1, st.t / 0.45), back = 1 + 2.2 * Math.pow(kin - 1, 3) + 1.2 * Math.pow(kin - 1, 2);
      const yOff = st.showing ? (1 - back) * -vh : -Math.pow(st.out / 0.35, 2) * vh;
      camera.getWorldDirection(fwd);
      mesh.position.copy(camera.position).addScaledVector(fwd, D);
      mesh.quaternion.copy(camera.quaternion).multiply(qz.setFromAxisAngle(zAxis, st.rot + (st.showing ? (1 - kin) * 0.25 : st.out)));
      mesh.translateY(yOff);
      mesh.scale.set(s * st.scale, s * st.scale * st.frac, 1);
    },
  };
}

// ---------- 教学图标 ----------
// kind: 'mouse'（左右摆）/ 'mouseL' / 'mouseR'（往一边推）/ 'shift'（按一下）/ 'hold'（按住，外圈会填满）
export function createGlyph(scene) {
  const c = document.createElement('canvas'); c.width = 384; c.height = 256;
  const g = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true, fog: false }));
  sp.renderOrder = 40; sp.visible = false; sp.scale.set(1.6, 1.07, 1); scene.add(sp);
  let kind = null, t = 0, prog = 0, pop = 0;
  const NAVY = '#12324a';
  function arrow(x, y, dir) {
    g.beginPath(); g.moveTo(x, y - 26); g.lineTo(x + dir * 40, y); g.lineTo(x, y + 26); g.closePath();
    g.lineWidth = 12; g.strokeStyle = NAVY; g.stroke(); g.fillStyle = '#fff'; g.fill();
  }
  function draw() {
    g.clearRect(0, 0, 384, 256);
    g.lineJoin = 'round'; g.lineCap = 'round';
    if (kind.startsWith('mouse')) {
      const sway = kind === 'mouse' ? Math.sin(t * 3) * 0.35 : (kind === 'mouseL' ? -1 : 1) * (0.2 + 0.2 * Math.abs(Math.sin(t * 4)));
      g.save(); g.translate(192, 132); g.rotate(sway);
      g.beginPath(); g.ellipse(0, 0, 54, 78, 0, 0, TAU);
      g.lineWidth = 14; g.strokeStyle = NAVY; g.stroke(); g.fillStyle = '#fff'; g.fill();
      g.lineWidth = 8; g.beginPath(); g.moveTo(-54, -14); g.lineTo(54, -14); g.moveTo(0, -78); g.lineTo(0, -14); g.stroke();
      g.restore();
      if (kind !== 'mouseR') arrow(84, 132, -1);
      if (kind !== 'mouseL') arrow(300, 132, 1);
    } else {
      const press = kind === 'shift' ? Math.max(0, Math.sin(t * 5)) : 1;
      const kw = 230, kh = 120, x = 192 - kw / 2, y = 70 + press * 8;
      g.fillStyle = NAVY; roundRect(g, x, 78 + 14, kw, kh, 26); g.fill();                     // 键帽的侧面
      g.fillStyle = '#fff'; g.lineWidth = 12; g.strokeStyle = NAVY; roundRect(g, x, y, kw, kh, 26); g.fill(); g.stroke();
      g.fillStyle = NAVY; g.font = `600 58px ${KEY}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('Shift', 192, y + kh / 2 + 2);
      if (kind === 'shift') {   // 声波：和「嘎！」一样的弧线
        g.lineWidth = 9; g.strokeStyle = NAVY;
        for (let i = 0; i < 2; i++) { const r = 34 + i * 22; g.beginPath(); g.arc(192 + kw / 2 - 4, y + 20, r, -0.9, -0.2); g.stroke(); g.beginPath(); g.arc(192 - kw / 2 + 4, y + 20, r, Math.PI + 0.2, Math.PI + 0.9); g.stroke(); }
      } else {   // 按住：外圈一点点填满
        g.lineWidth = 26; g.strokeStyle = NAVY; g.beginPath(); g.arc(192, y + kh / 2, 112, 0, TAU); g.stroke();
        g.lineWidth = 14; g.strokeStyle = '#fff'; g.beginPath(); g.arc(192, y + kh / 2, 112, 0, TAU); g.stroke();
        g.strokeStyle = '#f2a33a'; g.beginPath(); g.arc(192, y + kh / 2, 112, -Math.PI / 2, -Math.PI / 2 + TAU * prog); g.stroke();
      }
    }
    tex.needsUpdate = true;
  }
  return {
    get kind() { return kind; },
    show(k) { if (kind !== k) { kind = k; t = 0; pop = 0; } sp.visible = true; },
    hide() { kind = null; sp.visible = false; },
    progress(p) { prog = p; },
    update(dt, pos) {
      if (!kind) return;
      t += dt; pop = Math.min(1, pop + dt * 5);
      draw();
      const s = pop < 1 ? 1 + Math.sin(pop * Math.PI) * 0.25 : 1;
      sp.position.copy(pos); sp.position.y += Math.sin(t * 2.5) * 0.06;
      sp.scale.set(1.6 * s * pop, 1.07 * s * pop, 1);
    },
  };
}
function roundRect(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
