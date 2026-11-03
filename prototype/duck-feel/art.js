// Duck Shift 美术资产（A 风格：Goose 式扁平卡通）
// 全部程序化生成：鸭妈妈（秋沙鸭）、雏鸭、河岸与植被、水面 shader、特效池
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export function gradientMap(steps) {
  const t = new THREE.DataTexture(new Uint8Array(steps), steps.length, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true;
  return t;
}
export const GRAD_A = gradientMap([150, 205, 255]);   // 暗部抬高：柔和、通透，不要硬朗的明暗块
const decorMat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: GRAD_A });

// ---------- 岸线 ----------
// 沿河的地面坐标 u = 世界 z - 已漂距离；岸线按周期 40 起伏，JS 与水面 shader 用同一公式
const SHORE_PERIOD = 40;
export function shoreWobble(u, side) {
  const k = TAU / SHORE_PERIOD, ph = side > 0 ? 1.7 : 0;
  return 0.22 * Math.sin(k * 3 * u + ph) + 0.12 * Math.sin(k * 7 * u + ph * 2.3) + 0.06 * Math.sin(k * 13 * u + ph * 0.7);
}
const SHORE_GLSL = /* glsl */`
float shoreWob(float u, float ph) {
  float k = 6.2831853 / 40.0;
  return 0.22 * sin(k * 3.0 * u + ph) + 0.12 * sin(k * 7.0 * u + ph * 2.3) + 0.06 * sin(k * 13.0 * u + ph * 0.7);
}`;
const shoreX = (half, u, side) => half + 0.15 + shoreWobble(u, side);
// 离岸线 lx 处的地面高度：水下缓坡 → 沙滩 → 草坡
export function bankH(lx) {
  if (lx < 0) return lx * 0.3;
  const s = THREE.MathUtils.smoothstep(lx, 0.3, 0.95);
  return lx * 0.12 * (1 - s) + s * 0.32 + (lx > 1.2 ? Math.sin(lx * 1.3) * 0.05 : 0);
}

// ---------- 几何工具 ----------
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
// 带顶点色的零件，合并成一个网格（一次 draw call）
function part(geo, hex, pos = [0, 0, 0], rot = [0, 0, 0], scl = [1, 1, 1]) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();   // 统一成非索引，才能和多面体合并
  _m.compose(_p.set(...pos), _q.setFromEuler(_e.set(...rot)), _s.set(...scl));
  g.applyMatrix4(_m);
  const c = new THREE.Color(hex), n = g.attributes.position.count, arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}
function decorMesh(parts, shadow = true) {
  const m = new THREE.Mesh(mergeGeometries(parts), decorMat);
  m.castShadow = shadow; m.receiveShadow = true; m.userData.skip = true;
  return m;
}
// 一头圆一头尖的水滴形（翅膀、尾羽）
function teardropGeo(seg = 20, sharp = 0.8) {
  const g = new THREE.SphereGeometry(1, seg, Math.round(seg * 0.7));
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const z = p.getZ(i);
    if (z > 0) { const k = 1 - sharp * Math.pow(z, 1.4); p.setX(i, p.getX(i) * k); p.setY(i, p.getY(i) * k); }
  }
  g.computeVertexNormals();
  return g;
}
const TEAR = teardropGeo();

// ---------- 鸭妈妈（秋沙鸭雌鸟：灰身、锈红头、后翘冠羽、白下巴、细长红嘴） ----------
export function buildMother(duck, toon, BODY) {
  // 身体：前胸抬起接脖子，尾部收窄上翘，腹部压平；背部可站立区仍接近椭球，物理不受影响
  const bodyGeo = new THREE.SphereGeometry(1, 44, 30);
  const p = bodyGeo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (z > 0.45) { const t = (z - 0.45) / 0.55; x *= 1 - 0.45 * t * t; y = y * (1 - 0.35 * t * t) + 0.5 * t * t * t; }
    if (z < -0.35) { const t = (-z - 0.35) / 0.65; y += 0.16 * t * t * Math.max(0, (y + 1) / 2); }
    if (y < 0) y *= 0.6;
    p.setXYZ(i, x, y, z);
  }
  bodyGeo.computeVertexNormals();
  const body = new THREE.Mesh(bodyGeo, toon(0xe6e9eb));   // 浅灰白：画面里最亮、最干净的东西
  body.scale.set(BODY.rx, BODY.ry, BODY.rz); body.position.y = BODY.cy; body.castShadow = true;
  duck.add(body);
  const chest = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), toon(0xfbfaf6));   // 白色前胸
  chest.scale.set(0.52, 0.36, 0.38); chest.position.set(0, 0.28, -0.7); duck.add(chest);

  // 卡通比例：粗短脖子 + 大圆头 + 扁扁的大橙嘴 + 面无表情的小黑点眼（Goose 式的傻气）
  const neck = new THREE.Mesh(new THREE.CapsuleGeometry(0.19, 0.18, 6, 14), toon(0xd0602f));
  neck.position.set(0, 0.58, -0.86); neck.rotation.x = -0.5; neck.castShadow = true; duck.add(neck);

  const head = new THREE.Group(); head.position.set(0, 0.88, -1.02); duck.add(head);
  head.userData.base = head.position.clone();
  const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.33, 28, 20), toon(0xd0602f));
  headMesh.scale.set(0.95, 1, 1.05); headMesh.castShadow = true; head.add(headMesh);
  const crest = new THREE.Group(); crest.position.set(0, 0.2, 0.1); head.add(crest);   // 秋沙鸭的乱糟糟朋克头
  for (const [rx, rz, len, r] of [[0.6, 0, 0.34, 0.075], [0.95, 0.4, 0.3, 0.07], [0.95, -0.4, 0.3, 0.07], [1.3, 0.15, 0.38, 0.08],
    [1.3, -0.2, 0.36, 0.08], [1.65, 0.45, 0.26, 0.065], [1.65, -0.45, 0.26, 0.065], [0.3, 0.25, 0.22, 0.055]]) {
    const f = new THREE.Mesh(new THREE.ConeGeometry(r, len, 7), toon(0xb8502a));
    f.geometry.translate(0, len / 2, 0); f.rotation.set(rx, 0, rz); f.castShadow = true; crest.add(f);
  }
  const chin = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), toon(0xfbfaf6));
  chin.scale.set(0.17, 0.09, 0.15); chin.position.set(0, -0.2, -0.13); head.add(chin);
  const bill = new THREE.Mesh(new THREE.SphereGeometry(1, 22, 12), toon(0xf5913a));
  bill.scale.set(0.13, 0.05, 0.25); bill.position.set(0, -0.07, -0.44); head.add(bill);
  const jaw = new THREE.Group(); jaw.position.set(0, -0.1, -0.26); head.add(jaw);   // 下喙：嘎！时张开
  const lower = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 10), toon(0xe8782c));
  lower.scale.set(0.11, 0.035, 0.2); lower.position.set(0, 0, -0.16); jaw.add(lower);
  const eyes = [-1, 1].map(s => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 10), toon(0x1d2a33));
    eye.position.set(s * 0.215, 0.09, -0.17); head.add(eye); return eye;
  });

  const wings = [-1, 1].map(s => {
    const pivot = new THREE.Group(); pivot.position.set(s * 0.57, 0.44, 0.0); pivot.userData.side = s;
    const w = new THREE.Mesh(TEAR, toon(0xcdd2d6));
    w.scale.set(0.18, 0.21, 0.64); w.position.set(s * 0.03, 0, 0.12); w.rotation.set(0, -s * 0.1, s * 0.3); w.castShadow = true;
    const prim = new THREE.Mesh(TEAR, toon(0x9ba2a9));   // 深一点的翼尖
    prim.scale.set(0.12, 0.13, 0.36); prim.position.set(-s * 0.02, 0.05, 0.52); prim.rotation.set(0, -s * 0.18, s * 0.3);
    pivot.add(w, prim); duck.add(pivot);
    return pivot;
  });

  const tail = new THREE.Group(); tail.position.set(0, 0.42, 0.86); tail.rotation.x = -0.45; duck.add(tail);
  for (let i = 0; i < 3; i++) {   // 三片翘起来的胖尾羽
    const a = (i - 1) * 0.35;
    const f = new THREE.Mesh(TEAR, toon(0xcdd2d6));
    f.scale.set(0.08, 0.04, 0.24); f.position.set(Math.sin(a) * 0.06, 0, 0.15); f.rotation.y = a; f.castShadow = true;
    tail.add(f);
  }

  // 蹼：嘎！时伸到身后当台阶（䴙䴘就是这么干的）
  const fs = new THREE.Shape();
  fs.moveTo(0, 0); fs.lineTo(-0.13, -0.26); fs.quadraticCurveTo(-0.065, -0.21, 0, -0.3); fs.quadraticCurveTo(0.065, -0.21, 0.13, -0.26); fs.lineTo(0, 0);
  const foot = new THREE.Mesh(new THREE.ShapeGeometry(fs), toon(0xe8703a));
  foot.material.side = THREE.DoubleSide; foot.rotation.x = -Math.PI / 2; foot.position.set(0, 0.02, 0.95); foot.visible = false;
  duck.add(foot);

  return { body, head, jaw, crest, eyes, wings, tail, foot };
}

// ---------- 雏鸭：干净的亮黄毛球 + 大头 + 呆毛；用呆毛和眼睛区分性格 ----------
const HAIR = {   // [绕x, 绕z, 长度]：从头顶冒出来的呆毛
  curious: [[0.15, 0, 0.12], [0.35, 0.35, 0.1], [0.35, -0.35, 0.1]],   // 好奇鬼：三根长呆毛
  sleepy: [[1.2, 0.2, 0.11]],                                         // 瞌睡虫：一根软塌塌往后倒
  chubby: [[0.2, 0.2, 0.06], [0.2, -0.2, 0.06]],                       // 小胖墩：两根短短的
  twin: [[0.3, 0.5, 0.1]],                                             // 双胞胎：一根歪向一边（A/B 镜像）
};
export function makeDuckling(toon, color, scale, kind = 'curious', variant = 0) {
  const g = new THREE.Group();
  const inner = new THREE.Group(); g.add(inner);
  const deep = new THREE.Color(color).lerp(new THREE.Color(0xf0a020), 0.4).getHex();   // 翅芽/呆毛：同色系深一点，不用棕色
  const bodyGeo = new THREE.SphereGeometry(0.13, 22, 16);
  const p = bodyGeo.attributes.position;
  for (let i = 0; i < p.count; i++) {   // 小屁股微微上翘
    const z = p.getZ(i) / 0.13;
    if (z > 0.4) { const t = (z - 0.4) / 0.6; p.setY(i, p.getY(i) * (1 - 0.15 * t) + 0.025 * t * t); }
  }
  bodyGeo.computeVertexNormals();
  const body = new THREE.Mesh(bodyGeo, toon(color)); body.castShadow = true;
  if (kind === 'chubby') body.scale.set(1.12, 0.95, 1.1); else body.scale.set(1, 0.88, 1.06);
  body.position.y = 0.11;
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.07, 6), toon(deep));
  tail.position.set(0, 0.16, 0.15); tail.rotation.x = 1.1;
  inner.add(body, tail);

  const head = new THREE.Group(); head.position.set(0, 0.27, -0.09); head.scale.setScalar(1.2); inner.add(head);   // 大头 = 可爱
  const hm = new THREE.Mesh(new THREE.SphereGeometry(0.1, 20, 16), toon(color)); hm.castShadow = true; head.add(hm);
  const hair = new THREE.Group(); hair.position.set(0, 0.09, 0.005); head.add(hair);
  const mirror = kind === 'twin' && variant % 2 ? -1 : 1;
  for (const [rx, rz, len] of HAIR[kind] || HAIR.curious) {
    const h = new THREE.Mesh(new THREE.ConeGeometry(0.014, len, 5), toon(deep));
    h.geometry.translate(0, len / 2, 0); h.rotation.set(rx, 0, rz * mirror); hair.add(h);
  }
  const bill = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 8), toon(0xf5913a));
  bill.scale.set(0.046, 0.016, 0.05); bill.position.set(0, -0.01, -0.1); head.add(bill);
  const jaw = new THREE.Group(); jaw.position.set(0, -0.024, -0.07); head.add(jaw);   // 下喙：叽的时候张开
  const lower = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 6), toon(0xe8782c));
  lower.scale.set(0.038, 0.011, 0.04); lower.position.set(0, 0, -0.03); jaw.add(lower);
  const eyes = [-1, 1].map(s => {
    const e = new THREE.Group(); e.position.set(s * 0.06, 0.025, -0.075); head.add(e);
    e.add(new THREE.Mesh(new THREE.SphereGeometry(0.021, 12, 10), toon(0x1d2a33)));
    const hl = new THREE.Mesh(new THREE.SphereGeometry(0.0075, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    hl.position.set(s * 0.006, 0.009, -0.016); e.add(hl);
    return e;
  });
  const nubs = [-1, 1].map(s => {
    const n = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), toon(deep));
    n.scale.set(0.026, 0.042, 0.065); n.position.set(s * 0.118, 0.13, 0.02); n.rotation.z = s * 0.3; n.userData.side = s;
    inner.add(n); return n;
  });
  const feet = [-1, 1].map(s => {
    const f = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), toon(0xf5913a));
    f.scale.set(0.04, 0.012, 0.05); f.position.set(s * 0.055, 0.006, -0.035); inner.add(f); return f;
  });
  inner.userData = { head, hair, jaw, eyes, nubs, feet, kind, s0: scale };
  inner.scale.setScalar(scale);
  return g;
}

// 雏鸭动作：Q 弹走路、叽叽张嘴、慌了瞪眼乱扑、落地压扁、睡觉低头、游水划动
export function animateDuckling(inner, t, st) {
  const { head, hair, jaw, eyes, nubs, feet, kind, s0 } = inner.userData;
  const ph = st.seed * 7;
  const k = st.amt ?? 1;                  // 夸张度 0~1：头身比、眼睛、呆毛、动作幅度一起缩放
  const m = 0.3 + 0.7 * k;               // 动作幅度
  head.rotation.set(0, 0, 0); head.position.y = 0.27;
  head.scale.setScalar(1 + 0.2 * k);
  hair.scale.setScalar(0.35 + 0.65 * k);
  if (st.sleeping) { head.rotation.x = 0.5; head.position.y = 0.25 + Math.sin(t * 2 + ph) * 0.006; }
  else if (st.moving) { head.rotation.x = Math.sin(t * 18 + ph) * 0.12 * m; head.rotation.y = Math.sin(t * 2.3 + ph) * 0.3 * m; }
  else {
    const amp = (kind === 'curious' ? 0.9 : 0.5) * m;   // 好奇鬼东张西望
    head.rotation.y = Math.sin(t * (kind === 'curious' ? 1.7 : 0.9) + ph) * amp * Math.sin(t * 0.37 + ph);
    head.rotation.z = Math.sin(t * 0.8 + ph) * 0.15 * k;   // 歪头
  }
  hair.rotation.z = Math.sin(t * 9 + ph) * (st.panic ? 0.45 : st.moving ? 0.2 : 0.08) * m;
  hair.rotation.x = st.panic ? -0.3 : 0;
  jaw.rotation.x = -0.7 * (st.peep || 0);
  const blink = ((t + ph) % 4.3) < 0.1;
  let ey = kind === 'sleepy' ? 1 - 0.55 * k : 1, es = 0.82 + 0.18 * k;   // 瞌睡虫半眯着（夸张度越高越眯）
  if (st.panic) { ey = 1; es *= 1 + 0.35 * k; }    // 慌了：O_O
  if (st.sleeping) ey = 0.1; else if (blink && !st.panic) ey = 0.12;
  for (const e of eyes) { e.scale.set(es, es * ey, es); e.children[1].visible = k > 0.35; }   // 低夸张度时去掉眼睛高光
  for (const n of nubs) {
    const s = n.userData.side;
    let a = 0.3;
    if (st.panic) a = 0.4 + Math.abs(Math.sin(t * 38 + s)) * 1.1;
    else if (st.swimming) a = 0.3 + Math.abs(Math.sin(t * 10 + ph)) * 0.4;
    n.rotation.z = s * a;
  }
  feet.forEach((f, i) => {
    const kick = st.moving ? Math.max(0, Math.sin(t * 18 + ph + i * Math.PI)) : st.swimming ? Math.max(0, Math.sin(t * 12 + ph + i * Math.PI)) * 0.6 : 0;
    f.position.y = 0.006 + kick * 0.025;
  });
  // 挤压拉伸：走路一弹一弹，落地压扁
  let sy = 1 + ((st.moving ? Math.sin(t * 18 + ph) * 0.07 : Math.sin(t * 2.5 + ph) * 0.02) - (st.land || 0) * 0.35) * k;
  if (st.stretch) sy += st.stretch * 0.25 * k;
  if (st.crouch) { sy *= 0.62; head.position.y = 0.21; for (const e of eyes) e.scale.y = 0.12; }   // 缩成一团、紧闭眼睛
  const sxz = 1 / Math.sqrt(Math.max(0.4, sy));
  inner.scale.set(s0 * sxz, s0 * sy, s0 * sxz);
}

// ---------- 河岸与植被 ----------
const GREENS = [0x6fae4f, 0x86c45e, 0x5d9a45, 0x79b955];
const FLOWER = [0xffffff, 0xffe066, 0xff9ec4, 0xc7a6ff];
function buildReeds() {
  const parts = [];
  const n = 6 + Math.floor(Math.random() * 5);
  for (let i = 0; i < n; i++) {
    const h = rand(0.6, 1.3), x = rand(-0.25, 0.25), z = rand(-0.25, 0.25);
    const g = new THREE.ConeGeometry(0.035, h, 4); g.translate(0, h / 2, 0);
    parts.push(part(g, pick(GREENS), [x, -0.1, z], [rand(-0.2, 0.2), rand(0, TAU), rand(-0.25, 0.25)]));
    if (i < 2) {   // 香蒲
      const c = new THREE.CapsuleGeometry(0.045, 0.16, 3, 8);
      parts.push(part(c, 0x8a5a35, [x, h - 0.05, z]));
    }
  }
  return decorMesh(parts);
}
function buildRock() {
  const parts = [], r = rand(0.18, 0.4);
  parts.push(part(new THREE.DodecahedronGeometry(r, 0), 0xaab3b8, [0, 0, 0], [rand(0, 1), rand(0, TAU), 0], [1, 0.55, 0.85]));
  if (Math.random() < 0.6) parts.push(part(new THREE.DodecahedronGeometry(r * 0.55, 0), 0x96a0a6, [r * 0.9, -0.02, rand(-0.2, 0.2)], [0, rand(0, TAU), 0], [1, 0.6, 0.9]));
  const m = decorMesh(parts);
  const foam = new THREE.Mesh(new THREE.RingGeometry(r * 1.05, r * 1.3, 24), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, depthWrite: false }));
  foam.rotation.x = -Math.PI / 2; foam.position.y = 0.06; foam.scale.set(1.15, 0.9, 1); m.add(foam);
  m.userData.foam2 = foam;
  return m;
}
function buildLily() {
  const parts = [], n = 3 + Math.floor(Math.random() * 3);
  for (let i = 0; i < n; i++) {
    const r = rand(0.14, 0.26), x = rand(-0.4, 0.4), z = rand(-0.4, 0.4);
    parts.push(part(new THREE.CircleGeometry(r, 16, 0.3, TAU - 0.6), pick([0x6cbf5b, 0x7fcc66, 0x5fae52]), [x, 0.012 + i * 0.002, z], [-Math.PI / 2, 0, rand(0, TAU)]));
    if (i === 0 && Math.random() < 0.6) {   // 睡莲花
      const col = pick([0xfff6fa, 0xffb3d1]);
      for (let k = 0; k < 7; k++) {
        const a = k / 7 * TAU, pg = new THREE.ConeGeometry(0.035, 0.12, 4); pg.translate(0, 0.06, 0);
        parts.push(part(pg, col, [x + Math.cos(a) * 0.02, 0.03, z + Math.sin(a) * 0.02], [Math.cos(a) * 0.9, 0, -Math.sin(a) * 0.9]));
      }
      parts.push(part(new THREE.SphereGeometry(0.03, 8, 6), 0xffd24f, [x, 0.05, z]));
    }
  }
  return decorMesh(parts, false);
}
function buildGrass() {
  const parts = [];
  for (let i = 0; i < 6; i++) {
    const h = rand(0.15, 0.32), g = new THREE.ConeGeometry(0.03, h, 3); g.translate(0, h / 2, 0);
    parts.push(part(g, pick([0x9ad776, 0x86c766, 0x7dbd5c]), [rand(-0.1, 0.1), 0, rand(-0.1, 0.1)], [rand(-0.4, 0.4), 0, rand(-0.4, 0.4)]));
  }
  return decorMesh(parts, false);
}
function buildFlowers() {
  const parts = [], col = pick(FLOWER), n = 3 + Math.floor(Math.random() * 3);
  for (let i = 0; i < n; i++) {
    const x = rand(-0.2, 0.2), z = rand(-0.2, 0.2), h = rand(0.15, 0.28);
    const stem = new THREE.CylinderGeometry(0.008, 0.008, h, 4); stem.translate(0, h / 2, 0);
    parts.push(part(stem, 0x6fae4f, [x, 0, z]));
    for (let k = 0; k < 5; k++) {
      const a = k / 5 * TAU;
      parts.push(part(new THREE.SphereGeometry(0.028, 6, 4), col, [x + Math.cos(a) * 0.03, h, z + Math.sin(a) * 0.03], [0, 0, 0], [1, 0.4, 1]));
    }
    parts.push(part(new THREE.SphereGeometry(0.018, 6, 4), col === 0xffe066 ? 0xf08a24 : 0xffd24f, [x, h + 0.01, z]));
  }
  return decorMesh(parts, false);
}
function buildTree() {
  const parts = [], h = rand(0.7, 1.1);
  const trunk = new THREE.CylinderGeometry(0.09, 0.14, h, 7); trunk.translate(0, h / 2, 0);
  parts.push(part(trunk, 0x9a6b48));
  const blobs = 2 + Math.floor(Math.random() * 2);
  for (let i = 0; i < blobs; i++) {
    const r = rand(0.55, 0.9);
    parts.push(part(new THREE.IcosahedronGeometry(r, 1), pick([0x5fb565, 0x6cc070, 0x52a65a]),
      [rand(-0.4, 0.4), h + r * 0.6 + i * 0.25, rand(-0.4, 0.4)], [rand(0, 1), rand(0, 1), 0], [1, 0.82, 1]));
  }
  return decorMesh(parts);
}
function buildBush() {
  const parts = [], n = 2 + Math.floor(Math.random() * 2), berry = Math.random() < 0.4;
  for (let i = 0; i < n; i++) {
    const r = rand(0.25, 0.42), x = rand(-0.3, 0.3), z = rand(-0.3, 0.3);
    parts.push(part(new THREE.IcosahedronGeometry(r, 1), pick([0x5fae5a, 0x72bd63, 0x66b45c]), [x, r * 0.7, z], [rand(0, 1), rand(0, 1), 0], [1, 0.8, 1]));
    if (berry) for (let k = 0; k < 4; k++) parts.push(part(new THREE.SphereGeometry(0.04, 6, 4), 0xe2484b, [x + rand(-r, r) * 0.7, r * rand(0.9, 1.3), z + rand(-r, r) * 0.7]));
  }
  return decorMesh(parts);
}

const DECOR = [
  // 类型, 每岸数量, 离岸线距离范围, 底部高度, 摇摆
  { make: buildReeds, n: 18, off: [-0.25, 0.3], sway: 0.06 },
  { make: buildRock, n: 7, off: [-0.55, 0.1], y: -0.06 },
  { make: buildLily, n: 8, off: [-1.7, -0.6], float: true },
  { make: buildGrass, n: 18, off: [0.5, 2.8], sway: 0.08 },   // 碎细节少一点，留出大色块
  { make: buildFlowers, n: 18, off: [0.5, 2.5], sway: 0.05 },
  { make: buildTree, n: 8, off: [1.0, 2.8] },
  { make: buildBush, n: 9, off: [0.6, 2.3] },
];
const SPAN = 84, NEAR = 14;   // 装饰在 z ∈ [NEAR - SPAN, NEAR] 内循环

export function createShore(scene, half) {
  // 河岸：每侧 3 块 40 长的地块循环滚动（岸线周期也是 40，所以无缝）
  const LX = [-0.7, -0.35, -0.12, 0, 0.1, 0.2, 0.3, 0.42, 0.55, 0.7, 0.85, 1.0, 1.25, 1.6, 2.0, 2.6, 3.4, 4.4, 5.8, 7.6, 10];
  const NZ = 100;
  // Goose 式：明亮、干净的大色块
  const sand = new THREE.Color(0xeee3b8), wet = new THREE.Color(0xd3c89e), g1 = new THREE.Color(0x9ad47c), g2 = new THREE.Color(0xa8db8a), lip = new THREE.Color(0x8cc86d);
  const tiles = [];
  for (const side of [-1, 1]) {
    const pos = [], col = [], idx = [], c = new THREE.Color();
    for (let j = 0; j <= NZ; j++) {
      const lz = -SHORE_PERIOD / 2 + SHORE_PERIOD * j / NZ;
      for (let i = 0; i < LX.length; i++) {
        const lx = LX[i];
        const bump = lx > 1.2 ? 0.04 * Math.sin(lz * 1.7 + lx * 2.1) * Math.sin(lz * 0.6 - lx) : 0;
        pos.push(side * (shoreX(half, lz, side) + lx), bankH(lx) + bump, lz);
        if (lx < 0.05) c.copy(wet).lerp(sand, THREE.MathUtils.smoothstep(lx, -0.3, 0.05));
        else if (lx < 0.45) c.copy(sand);
        else if (lx < 0.75) c.copy(sand).lerp(lip, (lx - 0.45) / 0.3);
        else c.copy(g1).lerp(g2, 0.5 + 0.5 * Math.sin(lz * 0.9 + lx * 1.3) * Math.sin(lz * 0.37 + lx * 0.4));
        col.push(c.r, c.g, c.b);
      }
    }
    const W = LX.length;
    for (let j = 0; j < NZ; j++) for (let i = 0; i < W - 1; i++) {
      const a = j * W + i, b = a + 1, cc = a + W, d = cc + 1;
      if (side > 0) idx.push(a, cc, b, b, cc, d); else idx.push(a, b, cc, b, d, cc);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setIndex(idx); geo.computeVertexNormals();
    for (let k = 0; k < 3; k++) {
      const m = new THREE.Mesh(geo, decorMat); m.receiveShadow = true; m.userData.skip = true;
      scene.add(m); tiles.push(m);
    }
  }

  const items = [];
  function place(it, u) {
    it.u = u; it.off = rand(...it.def.off);
    const lx = it.off;
    it.m.position.x = it.side * (shoreX(half, u, it.side) + lx);
    it.m.position.y = it.def.float ? 0 : (it.def.y ?? 0) + Math.max(bankH(lx), -0.15);
    it.m.rotation.y = rand(0, TAU);
    it.m.scale.setScalar(rand(0.85, 1.2));
  }
  for (const def of DECOR) for (const side of [-1, 1]) for (let i = 0; i < def.n; i++) {
    const it = { def, side, m: def.make(), phase: rand(0, TAU) };
    place(it, NEAR - SPAN * (i + Math.random()) / def.n);
    scene.add(it.m); items.push(it);
  }

  // 水面上漂的落叶
  const leaves = [];
  for (let i = 0; i < 12; i++) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(1, 10), new THREE.MeshToonMaterial({ color: pick([0xe0a040, 0x9ccf5a, 0xd9773a, 0xb6d96a]), gradientMap: GRAD_A }));
    m.userData.skip = true; m.rotation.x = -Math.PI / 2; m.scale.set(0.05, 0.11, 1);
    m.position.set(rand(-half + 0.3, half - 0.3), 0.015, rand(-40, 10));
    m.userData.spin = rand(-0.6, 0.6);
    scene.add(m); leaves.push(m);
  }

  return {
    update(dist, t, dt, flow) {
      const n0 = Math.ceil((-60 - dist) / SHORE_PERIOD);
      for (let k = 0; k < 3; k++) {
        tiles[k].position.z = tiles[k + 3].position.z = (n0 + k) * SHORE_PERIOD + dist;
      }
      for (const it of items) {
        let z = it.u + dist;
        if (z > NEAR) { place(it, it.u - SPAN); z = it.u + dist; }
        it.m.position.z = z;
        if (it.def.sway) it.m.rotation.z = Math.sin(t * 1.4 + it.phase) * it.def.sway;
        if (it.def.float) { it.m.position.y = Math.sin(t * 1.2 + it.phase) * 0.006; it.m.rotation.y += dt * 0.05; }
        if (it.m.userData.foam2) it.m.userData.foam2.material.opacity = 0.55 + 0.2 * Math.sin(t * 3 + it.phase);
      }
      for (const l of leaves) {
        l.position.z += flow * 1.12 * dt; l.rotation.z += l.userData.spin * dt;
        l.position.x += Math.sin(t * 0.7 + l.userData.spin * 9) * 0.05 * dt;
        if (l.position.z > 10) { l.position.z = rand(-45, -30); l.position.x = rand(-half + 0.3, half - 0.3); }
      }
    },
  };
}

// ---------- 水面 shader：深浅渐变 + 波纹 + 岸边泡沫与涌浪线 + 闪光 ----------
function rippleMask() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = '#fff'; g.lineCap = 'round';
  for (let i = 0; i < 11; i++) {
    const x = Math.random() * 256, y = Math.random() * 256, w = 18 + Math.random() * 34;
    g.lineWidth = 3 + Math.random() * 3;
    for (const dx of [0, -256, 256]) for (const dy of [0, -256, 256]) {   // 贴图边缘无缝
      g.beginPath(); g.moveTo(x + dx, y + dy); g.bezierCurveTo(x + dx + w * 0.3, y + dy - 6, x + dx + w * 0.7, y + dy + 6, x + dx + w, y + dy); g.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
export function createWater(half) {
  const uniforms = {
    uTime: { value: 0 }, uDist: { value: 0 }, uHalf: { value: half }, uRipple: { value: rippleMask() },
    uFocus: { value: new THREE.Vector2() }, uFocusAmt: { value: 1 },
    uDeep: { value: new THREE.Color(0x4ab3ca) }, uShallow: { value: new THREE.Color(0xa3e6da) },
    uFoam: { value: new THREE.Color(0xffffff) },
  };
  const material = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: GRAD_A });
  material.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', /* glsl */`#include <common>
varying vec3 vWPos;
uniform float uTime, uDist, uHalf, uFocusAmt;
uniform vec2 uFocus;
uniform sampler2D uRipple;
uniform vec3 uDeep, uShallow, uFoam;
float hash21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1, 0)), u.x), mix(hash21(i + vec2(0, 1)), hash21(i + vec2(1, 1)), u.x), u.y);
}
${SHORE_GLSL}`)
      .replace('#include <map_fragment>', /* glsl */`{
  float u = vWPos.z - uDist;
  float sR = uHalf + 0.15 + shoreWob(u, 1.7);
  float sL = uHalf + 0.15 + shoreWob(u, 0.0);
  float d = vWPos.x > 0.0 ? sR - vWPos.x : sL + vWPos.x;          // 到岸线的距离
  vec3 col = mix(uShallow, uDeep, smoothstep(0.0, 2.4, d));
  float uw = vWPos.z - uDist * 1.1;                                // 水比岸走得快一点
  col *= 0.94 + 0.12 * vnoise(vec2(vWPos.x * 0.9, uw * 0.25));
  float rip = texture2D(uRipple, vec2(vWPos.x / 3.2, uw / 5.0)).r;
  float fd = distance(vWPos.xz, uFocus);                          // 离鸭妈妈的距离
  col = mix(col, uFoam, rip * mix(0.26, 0.18, uFocusAmt) * smoothstep(0.2, 0.8, d));
  float fn = vnoise(vec2(u * 2.2, uTime * 0.7));
  float foam = 1.0 - smoothstep(0.05, 0.11 + fn * 0.1, d);       // 贴岸的白沫
  float w = fract(uTime * 0.3 + vnoise(vec2(u * 0.15, 0.0)) * 0.6);
  float lineD = 0.16 + w * 0.5;                                   // 一圈圈往外推的涌浪线
  float line = (1.0 - smoothstep(0.0, 0.035, abs(d - lineD))) * (1.0 - w) * smoothstep(0.35, 0.6, vnoise(vec2(u * 0.9, 3.0)));
  col = mix(col, uFoam, clamp(max(foam, line * 0.85), 0.0, 1.0) * mix(1.0, 0.6, uFocusAmt));
  vec2 sc = vec2(vWPos.x * 2.5, uw * 2.5);
  float h = hash21(floor(sc));
  float tw = 0.5 + 0.5 * sin(uTime * 2.5 + h * 60.0);
  float sp = step(0.97, h) * smoothstep(0.75, 1.0, tw) * (1.0 - smoothstep(0.04, 0.1, length(fract(sc) - 0.5)));
  sp *= mix(1.0, smoothstep(4.0, 1.2, fd), uFocusAmt);            // 聚焦时闪点只留在鸭子附近
  col = mix(col, uFoam, sp * smoothstep(0.3, 1.0, d));            // 阳光闪点
  col = mix(col, col * mix(0.72, 1.0, smoothstep(6.0, 1.6, fd)), uFocusAmt);   // 离鸭子越远越暗（不提亮鸭子周围：那会降低鸭和水的对比）
  diffuseColor.rgb = col;
}`);
  };
  material.customProgramCacheKey = () => 'duckWaterA';
  return { material, uniforms };
}

// ---------- 漂流木 / 皮划艇 / 老鹰 ----------
export function buildLog(toon) {
  const g = new THREE.Group();
  const bark = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.19, 1.3, 10), toon(0x8a5d3b));
  bark.rotation.z = Math.PI / 2; bark.castShadow = true; g.add(bark);
  for (const s of [-1, 1]) {
    const cap = new THREE.Mesh(new THREE.CircleGeometry(s > 0 ? 0.165 : 0.185, 16), toon(0xe2c08f));
    cap.position.x = s * 0.652; cap.rotation.y = s * Math.PI / 2; g.add(cap);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.07, 0.09, 16), toon(0xb58a5c));
    ring.position.x = s * 0.655; ring.rotation.y = s * Math.PI / 2; g.add(ring);
  }
  const stub = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.055, 0.28, 6), toon(0x7a5032));
  stub.position.set(0.25, 0.17, 0); stub.rotation.z = -0.6; g.add(stub);
  const moss = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 6), toon(0x7fb04f));
  moss.scale.set(0.28, 0.06, 0.15); moss.position.set(-0.2, 0.165, 0.02); g.add(moss);
  return g;
}

export function buildKayak(toon) {
  const g = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 10), toon(0xf06b4f)); hull.scale.set(0.38, 0.17, 1.9); hull.castShadow = true;
  const stripe = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 10), toon(0xffffff)); stripe.scale.set(0.385, 0.06, 1.7); stripe.position.y = 0.06;
  const cockpit = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 8), toon(0x2b3a44)); cockpit.scale.set(0.22, 0.06, 0.36); cockpit.position.y = 0.14;
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.18, 4, 10), toon(0x3d7fc4)); torso.position.y = 0.36; torso.castShadow = true;
  const headM = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 10), toon(0xf0c9a0)); headM.position.y = 0.62;
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 8, 0, TAU, 0, 1.4), toon(0xffd24f)); helmet.position.y = 0.63;
  const paddle = new THREE.Group(); paddle.position.y = 0.46;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 1.7, 6), toon(0x3a3a3a)); shaft.rotation.z = Math.PI / 2;
  paddle.add(shaft);
  for (const s of [-1, 1]) {
    const blade = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 6), toon(0xffd24f));
    blade.scale.set(0.05, 0.015, 0.12); blade.position.x = s * 0.85; blade.rotation.x = s * 0.6; paddle.add(blade);
  }
  g.add(hull, stripe, cockpit, torso, headM, helmet, paddle);
  return { group: g, paddle };
}

// 鹰的投影：展翅剪影（翼尖分叉的初级飞羽）
const HAWK_HALF = [[0, 0.62], [0.08, 0.5], [0.12, 0.25], [0.5, 0.2], [1.0, 0.12], [1.25, 0.02], [1.15, -0.06], [1.08, -0.01], [1.02, -0.1],
  [0.93, -0.05], [0.88, -0.16], [0.6, -0.2], [0.15, -0.22], [0.1, -0.35], [0.2, -0.62], [0, -0.58]];
export function hawkShadowGeo() {
  const pts = HAWK_HALF.map(([x, y]) => new THREE.Vector2(x, y));
  for (let i = HAWK_HALF.length - 2; i > 0; i--) pts.push(new THREE.Vector2(-HAWK_HALF[i][0], HAWK_HALF[i][1]));
  return new THREE.ShapeGeometry(new THREE.Shape(pts));
}
export function buildHawk(toon) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), toon(0x6d5a48)); body.scale.set(0.2, 0.15, 0.5);
  const headM = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), toon(0xe8dfcf)); headM.position.set(0, 0.04, -0.5);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.1, 6), toon(0xf2c23a)); beak.rotation.x = -Math.PI / 2; beak.position.set(0, 0.02, -0.64);
  const ws = new THREE.Shape([[0, 0.15], [0.5, 0.18], [1.0, 0.1], [1.25, 0.0], [1.15, -0.08], [1.05, -0.02], [1.0, -0.12], [0.9, -0.06], [0.85, -0.18], [0.6, -0.22], [0.2, -0.25], [0, -0.2]]
    .map(([x, y]) => new THREE.Vector2(x, y)));
  const wGeo = new THREE.ShapeGeometry(ws);
  const wings = [-1, 1].map(s => {
    const pivot = new THREE.Group(); pivot.position.x = s * 0.12;
    const w = new THREE.Mesh(wGeo, toon(0x7a6450)); w.material.side = THREE.DoubleSide;
    w.rotation.x = -Math.PI / 2; w.scale.x = s; pivot.add(w); pivot.userData.side = s;
    g.add(pivot); return pivot;
  });
  const tailS = new THREE.Shape([[0, 0], [0.12, -0.3], [-0.12, -0.3]].map(([x, y]) => new THREE.Vector2(x, y)));
  const tailM = new THREE.Mesh(new THREE.ShapeGeometry(tailS), toon(0x8a7258)); tailM.material.side = THREE.DoubleSide;
  tailM.rotation.x = -Math.PI / 2; tailM.position.z = 0.4;
  g.add(body, headM, beak, tailM);
  g.userData.wings = wings;
  g.scale.setScalar(0.6);   // 离镜头近，缩小免得挡视线；主要靠地上的剪影预警
  return g;
}

// ---------- 特效：水圈 / 尾迹 / 嘎！气泡 / 星星 ----------
function popTexture(kind) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 160;
  const g = c.getContext('2d');
  if (kind === 'quack') {
    g.fillStyle = '#fff'; g.strokeStyle = '#12324a'; g.lineWidth = 8;
    g.beginPath(); g.roundRect(14, 14, 228, 104, 44); g.moveTo(70, 114); g.lineTo(52, 150); g.lineTo(110, 116); g.fill(); g.stroke();
    g.fillStyle = '#fff'; g.fillRect(64, 104, 50, 16);
    g.fillStyle = '#e0533a'; g.font = 'bold 76px system-ui, "PingFang SC", sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('嘎！', 128, 68);
  } else {
    g.translate(128, 80); g.fillStyle = '#ffd24f'; g.strokeStyle = '#fff'; g.lineWidth = 6;
    g.beginPath();
    for (let i = 0; i < 10; i++) { const r = i % 2 ? 26 : 62, a = i / 10 * TAU - Math.PI / 2; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    g.closePath(); g.stroke(); g.fill();
  }
  return new THREE.CanvasTexture(c);
}
export function createFX(scene) {
  const ringGeo = new THREE.RingGeometry(0.9, 1, 40);
  const rings = [];
  for (let i = 0; i < 110; i++) {
    const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.visible = false; m.renderOrder = 2; scene.add(m);
    rings.push({ m, life: 0 });
  }
  const tex = { quack: popTexture('quack'), star: popTexture('star') };
  const sprites = [];
  for (let i = 0; i < 24; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex.star, depthTest: false, transparent: true }));
    s.visible = false; s.renderOrder = 12; scene.add(s);
    sprites.push({ s, life: 0, v: new THREE.Vector3() });
  }
  return {
    // 水面上扩散的圈：drift = 跟水流走的比例，vx = 横向漂移
    ring(x, z, o = {}) {
      const r = rings.find(r => r.life <= 0); if (!r) return;
      Object.assign(r, { life: o.life ?? 1, max: o.life ?? 1, r0: o.r0 ?? 0.1, r1: o.r1 ?? 0.6, o0: o.opacity ?? 0.6, vx: o.vx ?? 0, drift: o.drift ?? 1.1, sz: o.sz ?? 1 });
      r.m.material.color.set(o.color ?? 0xffffff);
      r.m.position.set(x, o.y ?? 0.03, z); r.m.visible = true;
    },
    quackPop(pos) {
      const p = sprites.find(p => p.life <= 0); if (!p) return;
      p.s.material.map = tex.quack; p.s.material.rotation = 0; p.kind = 'quack'; p.life = p.max = 0.75;
      p.s.position.copy(pos); p.v.set(0, 0.8, 0); p.s.visible = true;
    },
    sparkle(pos, n = 6) {
      for (let i = 0; i < n; i++) {
        const p = sprites.find(p => p.life <= 0); if (!p) return;
        p.s.material.map = tex.star; p.kind = 'star'; p.life = p.max = rand(0.5, 0.8);
        p.s.position.copy(pos); const a = rand(0, TAU);
        p.v.set(Math.cos(a) * rand(0.6, 1.4), rand(1.2, 2.2), Math.sin(a) * rand(0.6, 1.4)); p.s.visible = true;
      }
    },
    update(dt, flow) {
      for (const r of rings) {
        if (r.life <= 0) continue;
        r.life -= dt;
        const k = 1 - Math.max(0, r.life) / r.max, e = 1 - (1 - k) * (1 - k);
        const s = r.r0 + (r.r1 - r.r0) * e;
        r.m.scale.set(s, s * r.sz, 1);
        r.m.material.opacity = r.o0 * (1 - k);
        r.m.position.z += flow * r.drift * dt; r.m.position.x += r.vx * dt;
        if (r.life <= 0) r.m.visible = false;
      }
      for (const p of sprites) {
        if (p.life <= 0) continue;
        p.life -= dt;
        const k = 1 - Math.max(0, p.life) / p.max;
        if (p.kind === 'quack') {
          const sc = k < 0.2 ? k / 0.2 * 1.25 : 1.25 - Math.min(0.25, (k - 0.2) * 1.5);
          p.s.scale.set(0.9 * sc, 0.56 * sc, 1); p.s.material.opacity = k > 0.7 ? (1 - k) / 0.3 : 1;
          p.s.position.addScaledVector(p.v, dt);
        } else {
          p.v.y -= 5 * dt; p.s.position.addScaledVector(p.v, dt);
          const sc = 0.22 * (1 - k * 0.6); p.s.scale.set(sc, sc, 1); p.s.material.opacity = 1 - k * k;
          p.s.material.rotation += dt * 4;
        }
        if (p.life <= 0) p.s.visible = false;
      }
    },
  };
}

// 鸭妈妈身下的柔和接触阴影：把她「压」在水面上，也给视线一个落点
export function contactShadow() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 8, 64, 64, 64);
  gr.addColorStop(0, 'rgba(10,50,60,0.55)'); gr.addColorStop(0.6, 'rgba(10,50,60,0.25)'); gr.addColorStop(1, 'rgba(10,50,60,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.scale.set(2.3, 3.0, 1); m.renderOrder = 1;
  return m;
}
