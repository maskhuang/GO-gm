// Duck Shift 美术资产（A 风格：Goose 式扁平卡通）
// 全部程序化生成：鸭妈妈（秋沙鸭）、雏鸭、河岸与植被、水面 shader、特效池
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

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
// 离岸线 lx 处的地面高度：水下缓坡 → 平沙滩 → 一道直上直下的草坪台阶 → 平整草坪
// （Goose 的地面是一块块切得很干净的台面，侧面看得见，像桌上的模型）
export const LAWN_X = 0.7, LAWN_H = 0.34;
export function bankH(lx) {
  if (lx < 0) return lx * 0.3;
  if (lx <= LAWN_X) return lx * 0.08;
  return THREE.MathUtils.lerp(LAWN_X * 0.08, LAWN_H, Math.min(1, (lx - LAWN_X) / 0.006));
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
// 一头圆一头尖的水滴形（翅膀）
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

// 扫掠体：沿一串点扫一圈圆，逐点给半径，两端收口。Goose 的角色是一体成型的光滑造型，不是球叠球——
// 脖子、冠羽、嘴、尾巴都用它做成一根连续的形体。flat < 1 时把截面压扁（嘴、尾巴）
function sweepGeo(n, radial = 12) {
  const geo = new THREE.BufferGeometry(), vc = n * radial + 2;
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vc * 3), 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(vc * 3), 3));
  const idx = [], s = n * radial, e = s + 1;
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < radial; j++) {
    const a = i * radial + j, b = i * radial + (j + 1) % radial;
    idx.push(a, b, a + radial, b, b + radial, a + radial);
  }
  for (let j = 0; j < radial; j++) {
    const b = (j + 1) % radial;
    idx.push(s, b, j, e, (n - 1) * radial + j, (n - 1) * radial + b);
  }
  geo.setIndex(idx);
  geo.userData.sweep = { n, radial };
  return geo;
}
const _T = new THREE.Vector3(), _N = new THREE.Vector3(), _B = new THREE.Vector3(), _w = new THREE.Vector3();
function sweepSet(geo, pts, radii, flat = 1) {
  const { n, radial } = geo.userData.sweep, pos = geo.attributes.position;
  _T.subVectors(pts[1], pts[0]).normalize();
  _N.set(1, 0, 0); if (Math.abs(_T.x) > 0.9) _N.set(0, 1, 0);
  for (let i = 0; i < n; i++) {
    _T.subVectors(pts[Math.min(n - 1, i + 1)], pts[Math.max(0, i - 1)]).normalize();
    _N.addScaledVector(_T, -_N.dot(_T)).normalize();   // 平行移动标架：截面不会沿途拧麻花
    _B.crossVectors(_T, _N);
    for (let j = 0; j < radial; j++) {
      const a = j / radial * TAU, r = radii[i];
      _w.copy(pts[i]).addScaledVector(_N, Math.cos(a) * r).addScaledVector(_B, Math.sin(a) * r * flat);
      pos.setXYZ(i * radial + j, _w.x, _w.y, _w.z);
    }
  }
  pos.setXYZ(n * radial, pts[0].x, pts[0].y, pts[0].z);
  pos.setXYZ(n * radial + 1, pts[n - 1].x, pts[n - 1].y, pts[n - 1].z);
  pos.needsUpdate = true;
  geo.computeVertexNormals(); geo.computeBoundingSphere();
  return geo;
}
// 沿二次贝塞尔扫一根：r(t) 给半径
function sweepCurve(a, b, c, rFn, { n = 10, radial = 12, flat = 1 } = {}) {
  const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(...a), new THREE.Vector3(...b), new THREE.Vector3(...c));
  const pts = [], radii = [];
  for (let i = 0; i < n; i++) { const t = i / (n - 1); pts.push(curve.getPoint(t)); radii.push(Math.max(0.002, rFn(t))); }
  return sweepSet(sweepGeo(n, radial), pts, radii, flat);
}
// 圆头尖尾：0→1 先鼓起再收成尖
const taper = (r0, r1, round = 0.25) => (t) => (t < round ? r0 * Math.sqrt(1 - ((round - t) / round) ** 2) : r0 + (r1 - r0) * ((t - round) / (1 - round)));

// ---------- 鸭妈妈（秋沙鸭雌鸟：灰身、锈红头、后翘冠羽、白下巴、细长红嘴） ----------
// Goose 的建模法：大块、光滑、一体成型；零件少而每件轮廓都清楚；没有羽毛细节，只有色块
export function buildMother(duck, toon, BODY) {
  // 身体：前胸抬起接脖子，尾部收窄上翘成一个尖（玩具鸭的船形），腹部压平；背部可站立区仍接近椭球，物理不受影响
  const bodyGeo = new THREE.SphereGeometry(1, 48, 32);
  const p = bodyGeo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (z > 0.4) { const t = (z - 0.4) / 0.6; x *= 1 - 0.6 * t * t; y = y * (1 - 0.5 * t * t) + 0.62 * t * t * t; }
    if (z < -0.35) { const t = (-z - 0.35) / 0.65; y += 0.18 * t * t * Math.max(0, (y + 1) / 2); }
    if (y < 0) y *= 0.55;
    p.setXYZ(i, x, y, z);
  }
  bodyGeo.computeVertexNormals();
  const body = new THREE.Mesh(bodyGeo, toon(0xe6e9eb));   // 浅灰白：画面里最亮、最干净的东西
  body.scale.set(BODY.rx, BODY.ry, BODY.rz); body.position.y = BODY.cy; body.castShadow = body.receiveShadow = true;   // 接收宝宝的投影：不描边时靠影子把宝宝「放」在背上
  duck.add(body);
  const chest = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 18), toon(0xfbfaf6));   // 白色前胸
  chest.scale.set(0.5, 0.36, 0.36); chest.position.set(0, 0.27, -0.72); chest.receiveShadow = true; duck.add(chest);

  // 头：大圆头 + 扁平的长嘴 + 面无表情的小黑点眼（Goose 式的傻气）
  const head = new THREE.Group(); head.position.set(0, 0.88, -1.02); duck.add(head);
  head.userData.base = head.position.clone();
  const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.31, 32, 22), toon(0xd0602f));
  headMesh.scale.set(0.92, 1, 1.08); headMesh.castShadow = true; head.add(headMesh);

  // 脖子：一根从身体里长出来、接到头上的光滑管子，每帧跟着头走——嘎！时整根伸长（Goose 伸脖子的那股劲）
  const NECK_N = 12, neckGeo = sweepGeo(NECK_N, 16);
  const neck = new THREE.Mesh(neckGeo, toon(0xd0602f)); neck.castShadow = true; neck.frustumCulled = false; duck.add(neck);
  const nBase = new THREE.Vector3(0, 0.36, -0.7), nCtrl = new THREE.Vector3(), nCurve = new THREE.QuadraticBezierCurve3(nBase, nCtrl, head.position);
  const nPts = Array.from({ length: NECK_N }, () => new THREE.Vector3());
  const nRad = nPts.map((_, i) => { const t = i / (NECK_N - 1); return 0.25 + (0.19 - 0.25) * t - 0.055 * Math.sin(Math.PI * t); });
  function update() {
    const h = head.position;
    nCtrl.set(h.x * 0.4, nBase.y + (h.y - nBase.y) * 0.8, nBase.z + (h.z - nBase.z) * 0.1);   // 先往上再往前：一点 S 弯
    for (let i = 0; i < NECK_N; i++) nCurve.getPoint(i / (NECK_N - 1), nPts[i]);
    sweepSet(neckGeo, nPts, nRad);
  }
  update();

  // 冠羽：三绺往后甩的乱毛，合成一个干净的剪影（秋沙鸭的朋克头）；scale/rotation 由外面驱动
  const crest = new THREE.Group(); crest.position.set(0, 0.2, 0.06); head.add(crest);
  const tuft = (dx, up, back, r) => sweepCurve([dx * 0.4, -0.06, -0.05], [dx * 0.8, up, back * 0.4], [dx * 1.6, up * 0.8, back], taper(r, 0.004, 0.3), { n: 10, radial: 10 });
  const crestMesh = new THREE.Mesh(mergeGeometries([tuft(0, 0.2, 0.42, 0.12), tuft(0.1, 0.13, 0.32, 0.09), tuft(-0.1, 0.13, 0.32, 0.09)]), toon(0xb8502a));
  crestMesh.castShadow = true; crest.add(crestMesh);

  const chin = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), toon(0xfbfaf6));
  chin.scale.set(0.17, 0.09, 0.15); chin.position.set(0, -0.19, -0.13); head.add(chin);
  // 嘴：又长又扁的一整片，尖端微微下勾（秋沙鸭的钩嘴）
  const bill = new THREE.Mesh(sweepCurve([0, -0.05, -0.18], [0, -0.06, -0.42], [0, -0.1, -0.62], taper(0.1, 0.035, 0.18), { n: 10, radial: 14, flat: 0.42 }), toon(0xf5913a));
  bill.castShadow = true; head.add(bill);
  const jaw = new THREE.Group(); jaw.position.set(0, -0.1, -0.24); head.add(jaw);   // 下喙：嘎！时张开
  const lower = new THREE.Mesh(sweepCurve([0, 0, 0], [0, -0.005, -0.18], [0, -0.015, -0.34], taper(0.075, 0.025, 0.15), { n: 8, radial: 12, flat: 0.35 }), toon(0xe8782c));
  jaw.add(lower);
  const eyes = [-1, 1].map(s => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 10), toon(0x1d2a33));
    eye.position.set(s * 0.2, 0.09, -0.16); head.add(eye); return eye;
  });

  // 翅膀：收拢贴在身侧的一整片，翼尖一块深灰；不画羽毛
  const wings = [-1, 1].map(s => {
    const pivot = new THREE.Group(); pivot.position.set(s * 0.57, 0.44, 0.0); pivot.userData.side = s;
    const w = new THREE.Mesh(TEAR, toon(0xcdd2d6));
    w.scale.set(0.17, 0.2, 0.66); w.position.set(s * 0.03, 0, 0.12); w.rotation.set(0, -s * 0.1, s * 0.3); w.castShadow = true;
    const prim = new THREE.Mesh(TEAR, toon(0x9ba2a9));
    prim.scale.set(0.11, 0.12, 0.36); prim.position.set(-s * 0.02, 0.05, 0.54); prim.rotation.set(0, -s * 0.16, s * 0.3);
    pivot.add(w, prim); duck.add(pivot);
    return pivot;
  });

  // 尾巴：一片往上翘的扁尖
  const tail = new THREE.Group(); tail.position.set(0, 0.5, 0.82); tail.rotation.x = -0.35; duck.add(tail);
  const tailMesh = new THREE.Mesh(sweepCurve([0, 0, -0.05], [0, 0.02, 0.15], [0, 0.1, 0.34], taper(0.17, 0.01, 0.2), { n: 8, radial: 12, flat: 0.35 }), toon(0xcdd2d6));
  tailMesh.castShadow = true; tail.add(tailMesh);

  // 蹼：嘎！时伸到身后当台阶（䴙䴘就是这么干的）
  const fs = new THREE.Shape();
  fs.moveTo(0, 0); fs.lineTo(-0.13, -0.26); fs.quadraticCurveTo(-0.065, -0.21, 0, -0.3); fs.quadraticCurveTo(0.065, -0.21, 0.13, -0.26); fs.lineTo(0, 0);
  const foot = new THREE.Mesh(new THREE.ShapeGeometry(fs), toon(0xe8703a));
  foot.material.side = THREE.DoubleSide; foot.rotation.x = -Math.PI / 2; foot.position.set(0, 0.02, 0.95); foot.visible = false;
  duck.add(foot);

  return { body, chest, neck, head, jaw, crest, eyes, wings, tail, foot, update };
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
  if (st.lookUp) {   // 被鹰盯上：僵住、抬头看天、眼睛瞪圆
    head.rotation.set(-0.7, 0, 0); for (const e of eyes) e.scale.set(1.3 * es, 1.3 * es, 1.3 * es);
    for (const n of nubs) n.rotation.z = n.userData.side * 0.15;
    sy *= 0.85;
  }
  if (st.cold > 0.35) {   // 冷得发抖、缩成一团、眼睛半眯
    sy *= 1 - 0.12 * st.cold;
    if (!st.panic && !st.lookUp) for (const e of eyes) e.scale.y = Math.min(e.scale.y, es * (1 - 0.5 * st.cold));
    const c = (st.cold - 0.35) / 0.65;
    inner.position.x = Math.sin(t * 70 + ph) * 0.012 * c;
    head.rotation.z += Math.sin(t * 55 + ph) * 0.08 * c;
  } else inner.position.x = 0;
  if (st.sneeze > 0) {   // 打喷嚏：先仰头吸气（眯眼），「啾」地往前一点头
    const k2 = st.sneeze;   // 0.45 → 0
    if (k2 > 0.12) { const w = (0.45 - k2) / 0.33; head.rotation.x = -0.5 * w; for (const e of eyes) e.scale.y = es * (1 - 0.8 * w); sy += 0.08 * w * k; }
    else { const w = k2 / 0.12; head.rotation.x = 0.6 * w; for (const e of eyes) e.scale.y = es * 0.1; sy -= 0.12 * w * k; }
  }
  if (st.crouch) { sy *= 0.62; head.position.y = 0.21; for (const e of eyes) e.scale.y = 0.12; }   // 缩成一团、紧闭眼睛
  const sxz = 1 / Math.sqrt(Math.max(0.4, sy));
  inner.scale.set(s0 * sxz, s0 * sy, s0 * sxz);
}

// 水貂：细长的深棕身子、白下巴、短腿、长尾巴。userData.setPose(k, swim)：k = 奔跑的起伏相位；swim = 在水里（只露头和背）
export function buildMink(toon) {
  const g = new THREE.Group(), fur = toon(0x4a3326), dark = toon(0x2e1f17);
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.34, 6, 12), fur); body.rotation.x = Math.PI / 2; body.position.y = 0.11; g.add(body);
  const head = new THREE.Group(); head.position.set(0, 0.13, -0.27); g.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 10), fur); skull.scale.set(1, 0.85, 1.25); head.add(skull);
  const chin = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), toon(0xf4efe4)); chin.position.set(0, -0.035, -0.06); head.add(chin);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.014, 6, 4), dark); nose.position.set(0, 0.0, -0.09); head.add(nose);
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 4), dark); ear.position.set(s * 0.045, 0.05, 0.02); head.add(ear);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 4), toon(0x111111)); eye.position.set(s * 0.035, 0.02, -0.06); head.add(eye);
  }
  const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.22, 4, 8), dark); tail.rotation.x = Math.PI / 2 + 0.25; tail.position.set(0, 0.09, 0.33); g.add(tail);
  const legs = [];
  for (const [x, z] of [[-0.05, -0.15], [0.05, -0.15], [-0.05, 0.15], [0.05, 0.15]]) {
    const l = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.08, 5), dark); l.position.set(x, 0.04, z); g.add(l); legs.push(l);
  }
  g.userData.setPose = (k, swim) => {
    const arch = Math.sin(k);
    body.position.y = swim ? 0.02 : 0.11 + Math.abs(arch) * 0.04; body.rotation.z = 0;
    head.position.y = swim ? 0.06 : 0.13 + Math.max(0, arch) * 0.05;
    tail.position.y = swim ? 0.0 : 0.09; tail.rotation.x = Math.PI / 2 + (swim ? 0 : 0.25 + arch * 0.2);
    legs.forEach((l, i) => { l.visible = !swim; l.rotation.x = (i < 2 ? 1 : -1) * arch * 0.7; });
  };
  g.userData.head = head;
  g.setPose = g.userData.setPose;
  return g;
}

// 一根羽毛：扁扁的叶子形 + 一根羽轴；颜色由调用方改（鹰 = 棕，海鸥 = 白）
export function buildFeather(toon) {
  const g = new THREE.Group();
  const vane = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 6), toon(0x7a6450)); vane.scale.set(0.035, 0.008, 0.11); vane.material = vane.material.clone();
  const quill = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.08, 4), toon(0xf4efe4)); quill.rotation.x = Math.PI / 2; quill.position.z = 0.13;
  g.add(vane, quill); g.visible = false;
  return g;
}
// 苍鹭扑空叼上来的一嘴水草：几根绿条从嘴尖耷拉下来
export function buildWeed(toon) {
  const g = new THREE.Group(), mat = toon(0x5f9a4a);
  for (let i = 0; i < 3; i++) {
    const len = 0.16 + i * 0.05;
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.012, len, 4), mat);
    s.geometry.translate(0, -len / 2, 0); s.rotation.set(0.25 * (i - 1), 0, 0.35 * (i - 1)); g.add(s);
  }
  return g;
}

// ---------- 河岸与植被 ----------
// Goose 的道具：几何体块大、边缘圆润、表面光滑、每件只有 1~2 个颜色；宁可少而胖，不要一根根细碎的线
const GREENS = [0x7fa860, 0x8db36a, 0x739c57];
const FLOWER = [0xffffff, 0xf3d36b, 0xf2a7bf, 0xc9b3e8];
const BALL = new THREE.SphereGeometry(1, 18, 12);
// 芦苇丛：几片宽宽的扁叶子往外散开 + 一两根香蒲
function buildReeds() {
  const parts = [], n = 5 + Math.floor(Math.random() * 3), col = pick(GREENS);
  for (let i = 0; i < n; i++) {
    const h = rand(1.0, 1.8), a = i / n * TAU + rand(-0.3, 0.3);
    const g = new THREE.ConeGeometry(0.11, h, 8); g.translate(0, h / 2, 0);
    parts.push(part(g, col, [Math.cos(a) * 0.1, -0.08, Math.sin(a) * 0.1], [Math.sin(a) * 0.28, a, -Math.cos(a) * 0.28], [1, 1, 0.38]));
  }
  for (let i = 0; i < 1 + (Math.random() < 0.5); i++) {
    const h = rand(1.5, 2.0), x = rand(-0.1, 0.1);
    const st = new THREE.CylinderGeometry(0.02, 0.02, h, 6); st.translate(0, h / 2, 0);
    parts.push(part(st, 0x6f9455, [x, -0.08, x]));
    parts.push(part(new THREE.CapsuleGeometry(0.07, 0.22, 4, 10), 0x9a6b48, [x, h - 0.1, x]));
  }
  return decorMesh(parts);
}
// 石头：光滑的扁鹅卵石，一大一小
function buildRock() {
  const parts = [], r = rand(0.2, 0.4);
  parts.push(part(BALL, 0xb3b8b6, [0, 0, 0], [0, rand(0, TAU), 0], [r, r * 0.5, r * 0.8]));
  if (Math.random() < 0.6) parts.push(part(BALL, 0xa3a9a7, [r * 0.95, -0.02, rand(-0.2, 0.2)], [0, rand(0, TAU), 0], [r * 0.5, r * 0.3, r * 0.42]));
  const m = decorMesh(parts);
  const foam = new THREE.Mesh(new THREE.RingGeometry(r * 1.05, r * 1.3, 24), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, depthWrite: false }));
  foam.rotation.x = -Math.PI / 2; foam.position.y = 0.06; foam.scale.set(1.15, 0.9, 1); m.add(foam);
  m.userData.foam2 = foam;
  return m;
}
function buildLily() {
  const parts = [], n = 3 + Math.floor(Math.random() * 3);
  for (let i = 0; i < n; i++) {
    const r = rand(0.15, 0.27), x = rand(-0.4, 0.4), z = rand(-0.4, 0.4);
    parts.push(part(new THREE.CylinderGeometry(r, r, 0.02, 20, 1, false, 0.3, TAU - 0.6), pick([0x7fb365, 0x8abd6e, 0x74a85c]), [x, 0.012 + i * 0.002, z], [0, rand(0, TAU), 0]));   // 有厚度的小圆片
    if (i === 0 && Math.random() < 0.6) {   // 睡莲花：一个胖胖的花苞
      parts.push(part(BALL, pick([0xfff6fa, 0xf7bfd3]), [x, 0.07, z], [0, 0, 0], [0.07, 0.06, 0.07]));
      parts.push(part(BALL, 0xf3d36b, [x, 0.12, z], [0, 0, 0], [0.025, 0.02, 0.025]));
    }
  }
  return decorMesh(parts, false);
}
// 花坛：一个绿色小土包上顶着几颗彩色的圆球（Goose 的花都是这样一团一团的）
function buildFlowers() {
  const parts = [], col = pick(FLOWER), r = rand(0.3, 0.45);
  parts.push(part(BALL, pick(GREENS), [0, 0, 0], [0, 0, 0], [r, r * 0.55, r * 0.9]));
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * TAU + rand(-0.3, 0.3), d = rand(0.3, 0.75) * r;
    parts.push(part(BALL, col, [Math.cos(a) * d, r * 0.45 + rand(0, 0.04), Math.sin(a) * d * 0.9], [0, 0, 0], [0.06, 0.055, 0.06]));
  }
  return decorMesh(parts, false);
}
// 树：直直的树干 + 一两团光滑的大圆冠；三成是细高的杨树
function buildTree() {
  const parts = [], h = rand(1.4, 2.0), poplar = Math.random() < 0.3;
  const trunk = new THREE.CylinderGeometry(0.18, 0.26, h, 10); trunk.translate(0, h / 2, 0);
  parts.push(part(trunk, 0x8f6a4c));
  if (poplar) {
    const r = rand(0.9, 1.15);
    parts.push(part(BALL, pick(GREENS), [0, h + r * 1.5, 0], [0, 0, 0], [r, r * 2.1, r]));
  } else {
    const r = rand(1.6, 2.1);
    parts.push(part(BALL, pick(GREENS), [0, h + r * 0.75, 0], [0, 0, 0], [r, r * 0.85, r]));
    if (Math.random() < 0.6) { const r2 = r * rand(0.5, 0.65), a = rand(0, TAU); parts.push(part(BALL, pick(GREENS), [Math.cos(a) * r * 0.75, h + r * 0.45, Math.sin(a) * r * 0.75], [0, 0, 0], [r2, r2 * 0.85, r2])); }
  }
  return decorMesh(parts);
}
// 树篱：圆角长方块，顺着河岸摆（Goose 里最有辨识度的道具之一）
function buildHedge() {
  const L = rand(2.2, 3.6), H = rand(0.9, 1.15), D = rand(0.8, 1.0);
  return decorMesh([part(new RoundedBoxGeometry(D, H, L, 4, 0.3), pick([0x6f9a55, 0x7aa35d]), [0, H / 2, 0])]);
}
function buildBush() {
  const parts = [], n = 1 + Math.floor(Math.random() * 2), berry = Math.random() < 0.35;
  for (let i = 0; i < n; i++) {
    const r = rand(0.55, 0.8), x = i * r * 1.1, z = rand(-0.15, 0.15);
    parts.push(part(BALL, pick(GREENS), [x, r * 0.75, z], [0, 0, 0], [r, r * 0.85, r]));
    if (berry) for (let k = 0; k < 3; k++) { const a = rand(0, TAU); parts.push(part(BALL, 0xd9534f, [x + Math.cos(a) * r * 0.7, r * rand(1.0, 1.4), z + Math.sin(a) * r * 0.7], [0, 0, 0], [0.07, 0.07, 0.07])); }
  }
  return decorMesh(parts);
}

const DECOR = [
  // 类型, 每岸数量, 离岸线距离范围, 底部高度, 摇摆, align = 顺着河岸摆
  { make: buildReeds, n: 14, off: [-0.25, 0.35], sway: 0.05 },
  { make: buildRock, n: 6, off: [-0.55, 0.1], y: -0.06 },
  { make: buildLily, n: 7, off: [-1.7, -0.6], float: true },
  // 镜头视角窄，草坪只露出岸边一条：大件要贴着台阶摆才进得了画面
  // 比例按真实世界：秋沙鸭约 60cm 长，芦苇比她高一倍，树篱齐人腰，树要大得多——Goose 的鹅在世界里显得小，傻气就是这么来的
  { make: buildFlowers, n: 8, off: [0.95, 1.6] },
  { make: buildHedge, n: 5, off: [1.25, 1.45], align: true },
  { make: buildTree, n: 6, off: [1.9, 2.7] },
  { make: buildBush, n: 7, off: [1.2, 2.0] },
];
const SPAN = 84, NEAR = 14;   // 装饰在 z ∈ [NEAR - SPAN, NEAR] 内循环

export function createShore(scene, half) {
  // 河岸：每侧 3 块 40 长的地块循环滚动（岸线周期也是 40，所以无缝）
  const LX = [-0.7, -0.35, -0.12, 0, 0.1, 0.2, 0.3, 0.45, 0.6, 0.69, 0.7, 0.706, 0.72, 0.85, 1.1, 1.5, 2.0, 2.6, 3.4, 4.4, 5.8, 7.6, 10];
  const NZ = 100;
  // Goose 式：明亮、干净的大色块
  // 颜色收一点饱和度（Goose 是灰调的鼠尾草绿 + 奶油沙色），黄色的宝宝才是画面里最跳的东西
  const sand = new THREE.Color(0xece0bb), wet = new THREE.Color(0xd2c8a2), g1 = new THREE.Color(0xa5c47f), g2 = new THREE.Color(0xb0cc8b), wall = new THREE.Color(0x7f9f5e);
  const tiles = [];
  for (const side of [-1, 1]) {
    const pos = [], col = [], idx = [], c = new THREE.Color();
    for (let j = 0; j <= NZ; j++) {
      const lz = -SHORE_PERIOD / 2 + SHORE_PERIOD * j / NZ;
      for (let i = 0; i < LX.length; i++) {
        const lx = LX[i];
        pos.push(side * (shoreX(half, lz, side) + lx), bankH(lx), lz);   // 草坪是平的：Goose 的地面干干净净
        if (lx < 0.05) c.copy(wet).lerp(sand, THREE.MathUtils.smoothstep(lx, -0.3, 0.05));
        else if (lx < 0.695) c.copy(sand);
        else if (lx < 0.71) c.copy(wall);                                 // 台阶侧面：深一档的绿
        else c.copy(g1).lerp(g2, 0.5 + 0.5 * Math.sin(lz * 0.5 + lx * 0.8) * Math.sin(lz * 0.21 + lx * 0.3));   // 大块、慢变化的色斑
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
    it.m.rotation.y = it.def.align ? rand(-0.08, 0.08) : rand(0, TAU);
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
        // 两个方向都要绕回来：新的一天 dist 归零时，装饰不能还留在上一天的远处（否则河岸会光秃秃一大段）
        if (z > NEAR || z < NEAR - SPAN) { place(it, it.u - SPAN * Math.floor((z - (NEAR - SPAN)) / SPAN)); z = it.u + dist; }
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
    uRapA: { value: 0 }, uRapB: { value: 0 }, uRapOn: { value: 0 },   // 急流区（地面坐标 uRapA < u < uRapB），uRapA 处是落差线
    uDeep: { value: new THREE.Color(0x5aaebb) }, uShallow: { value: new THREE.Color(0xa6dbd0) },
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
uniform float uTime, uDist, uHalf, uFocusAmt, uRapA, uRapB, uRapOn;
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
  col = mix(col, uFoam, rip * mix(0.16, 0.12, uFocusAmt) * smoothstep(0.2, 0.8, d));
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
  if (uRapOn > 0.5) {
    // 急流：水色发白、顺流的白色条纹、一排排驻波
    float inR = smoothstep(uRapA - 0.3, uRapA + 1.5, u) * (1.0 - smoothstep(uRapB - 2.0, uRapB + 0.5, u));
    float zf = vWPos.z - uDist * 1.8;
    float streak = smoothstep(0.68, 0.85, vnoise(vec2(vWPos.x * 6.0, zf * 0.5)));   // 细长的顺流白线
    float chev = smoothstep(0.93, 1.0, sin(zf * 4.0 + abs(vWPos.x) * 2.5)) * smoothstep(0.4, 0.7, vnoise(vec2(vWPos.x * 1.5, u * 0.8)));
    col = mix(col, mix(col, vec3(0.8, 0.97, 0.96), 0.15), inR);
    col = mix(col, uFoam, inR * max(streak * 0.55, chev * 0.5) * smoothstep(0.15, 0.6, d));
    // 落差线：一条抖动的白线，线下游一片翻腾的水花，线上游的水面略暗（坎沿）
    float dl = abs(u - uRapA) + (vnoise(vec2(vWPos.x * 4.0, uTime * 2.0)) - 0.5) * 0.12;
    float dropLine = 1.0 - smoothstep(0.08, 0.24, dl);
    float spray = step(uRapA, u) * (1.0 - smoothstep(0.0, 1.0, u - uRapA)) * smoothstep(0.45, 0.7, vnoise(vec2(vWPos.x * 5.0, (vWPos.z - uDist * 2.5) * 3.0 + uTime * 4.0)));
    col *= 1.0 - 0.18 * step(u, uRapA) * (1.0 - smoothstep(0.0, 0.7, uRapA - u));
    col = mix(col, uFoam, max(dropLine, spray * 0.85) * smoothstep(0.0, 0.3, d));
  }
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

// 苍鹭：站在岸边浅水里一动不动，脖子一缩一弹叼走靠近的雏鸭（灰蓝身子、黑眉羽、黄色匕首嘴）
// userData.setNeck(len, pitch)：len = 脖子长度倍数（缩 0.55 / 平时 1 / 出击 ~2），pitch = 前倾角（0 竖直，正 = 往前探）
export function buildHeron(toon) {
  const g = new THREE.Group();
  const grey = toon(0x9fb1c2), dark = toon(0x55657a), white = toon(0xf4f1ea), yellow = toon(0xf2b632), black = toon(0x1d2430);
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.015, 0.62, 5), toon(0xc9a24a));
    leg.position.set(s * 0.06, 0.25, 0.02); g.add(leg);
  }
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), grey); body.scale.set(0.17, 0.17, 0.32);
  body.position.set(0, 0.62, 0.04); body.rotation.x = -0.35; g.add(body);
  const wing = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), dark); wing.scale.set(0.18, 0.12, 0.28);
  wing.position.set(0, 0.68, 0.1); wing.rotation.x = -0.4; g.add(wing);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.2, 6), dark); tail.rotation.x = Math.PI / 2 + 0.5; tail.position.set(0, 0.56, 0.36); g.add(tail);
  const neck = new THREE.Group(); neck.position.set(0, 0.74, -0.14); g.add(neck);
  const neckM = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.055, 1, 8), white); neck.add(neckM);
  const head = new THREE.Group(); neck.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), white); skull.scale.set(1, 0.9, 1.15); head.add(skull);
  const brow = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.025, 0.05), black); brow.position.set(0, 0.04, 0.0); head.add(brow);
  const plume = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.22, 5), black); plume.rotation.x = -Math.PI / 2 - 0.35; plume.position.set(0, 0.03, 0.15); head.add(plume);
  const bill = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.3, 6), yellow); bill.rotation.x = -Math.PI / 2; bill.position.set(0, -0.01, -0.21); head.add(bill);
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 6), black); eye.position.set(s * 0.06, 0.015, -0.035); head.add(eye);
  }
  const L0 = 0.36;
  g.userData.setNeck = (len, pitch) => {
    const L = L0 * len;
    neck.rotation.x = -pitch;
    neckM.scale.y = L; neckM.position.y = L / 2;
    head.position.y = L; head.rotation.x = pitch * 0.85 - 0.1;   // 头保持接近水平：盯着猎物
  };
  g.userData.setNeck(1, 0.15);
  g.userData.head = head;
  return g;
}

// 海鸥：白身灰翅、黑翼尖、黄嘴带红点；从侧面低飞掠过水面
export function buildGull(toon) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), toon(0xfafaf7)); body.scale.set(0.15, 0.13, 0.4);
  const headM = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), toon(0xfafaf7)); headM.position.set(0, 0.06, -0.4);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.14, 6), toon(0xf2c23a)); beak.rotation.x = -Math.PI / 2; beak.position.set(0, 0.04, -0.56);
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.014, 6, 6), toon(0xe8483b)); dot.position.set(0, 0.02, -0.58);
  const ws = new THREE.Shape([[0, 0.12], [0.6, 0.1], [1.15, 0.0], [1.0, -0.08], [0.55, -0.14], [0, -0.14]].map(([x, y]) => new THREE.Vector2(x, y)));
  const tip = new THREE.Shape([[0.85, 0.05], [1.15, 0.0], [1.0, -0.08], [0.8, -0.1]].map(([x, y]) => new THREE.Vector2(x, y)));
  const wGeo = new THREE.ShapeGeometry(ws), tGeo = new THREE.ShapeGeometry(tip);
  const wings = [-1, 1].map(s => {
    const pivot = new THREE.Group(); pivot.position.x = s * 0.1;
    for (const [geo, col, y] of [[wGeo, 0xb9c3cc, 0], [tGeo, 0x1d2430, 0.004]]) {
      const w = new THREE.Mesh(geo, toon(col)); w.material.side = THREE.DoubleSide;
      w.rotation.x = -Math.PI / 2; w.position.y = y; w.scale.x = s; pivot.add(w);
    }
    pivot.userData.side = s; g.add(pivot); return pivot;
  });
  g.add(body, headM, beak, dot);
  g.userData.wings = wings;
  g.scale.setScalar(0.55);
  return g;
}

// 雨：一团斜着落的短线，跟着镜头走；k = 雨量 0..1
export function createRain(scene, n = 700) {
  const pos = new Float32Array(n * 6), drops = [];
  for (let i = 0; i < n; i++) drops.push({ x: rand(-7, 7), y: rand(0, 9), z: rand(-11, 6), v: rand(11, 15) });
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.LineBasicMaterial({ color: 0xe8f2fa, transparent: true, opacity: 0, depthWrite: false });
  const lines = new THREE.LineSegments(geo, mat); lines.frustumCulled = false; lines.renderOrder = 8; lines.visible = false;
  scene.add(lines);
  return {
    update(dt, k, cx, cz) {
      lines.visible = k > 0.01; mat.opacity = 0.5 * k;
      if (!lines.visible) return;
      lines.position.set(cx, 0, cz);
      const shown = Math.floor(n * k);
      for (let i = 0; i < n; i++) {
        const d = drops[i];
        d.y -= d.v * dt; d.x -= d.v * 0.12 * dt;
        if (d.y < 0) { d.y += 9; d.x = rand(-7, 7); d.z = rand(-11, 6); }
        const o = i * 6, on = i < shown ? 1 : 0;
        pos[o] = d.x; pos[o + 1] = d.y * on; pos[o + 2] = d.z;
        pos[o + 3] = d.x + 0.05; pos[o + 4] = (d.y + 0.38) * on; pos[o + 5] = d.z;
      }
      geo.attributes.position.needsUpdate = true;
    },
  };
}

// 被丢弃的钓线：一团乱线 + 红白浮漂。返回 { group, trail }；trail 是从鸭妈妈脚上拖到线团的那根线（缠上后才显示）
export function buildTangle(toon) {
  const g = new THREE.Group();
  const bob = new THREE.Group();
  const top = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8, 0, TAU, 0, Math.PI / 2), toon(0xe8483b));
  const bot = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8, 0, TAU, Math.PI / 2, Math.PI / 2), toon(0xfafaf7));
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.14, 5), toon(0xe8483b)); stick.position.y = 0.12;
  bob.add(top, bot, stick); bob.position.y = 0.03; g.add(bob);
  const lineMat = new THREE.LineBasicMaterial({ color: 0xe9f1f6 });
  for (let k = 0; k < 3; k++) {   // 几圈乱缠的线
    const pts = [];
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; pts.push(new THREE.Vector3(Math.cos(a) * rand(0.15, 0.45), 0.03, Math.sin(a) * rand(0.15, 0.45))); }
    const c = new THREE.CatmullRomCurve3(pts, true);
    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(c.getPoints(60)), lineMat));
  }
  const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3 * 12), 3));
  const trail = new THREE.Line(tg, lineMat); trail.frustumCulled = false; trail.visible = false;
  g.userData.bob = bob;
  return { group: g, trail };
}

// 别家的鸭妈妈（绿头鸭母鸭）：麻褐色、橙嘴带黑斑、翅上一块蓝紫色翼镜
// userData.pose(rear, wing)：rear = 立起来伸脖子 0..1，wing = 张翅 0..1
export function buildHen(toon) {
  const g = new THREE.Group();
  const brown = toon(0xa27b52), dark = toon(0x6e5034), cream = toon(0xd8bf98);
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 14), brown); body.scale.set(0.42, 0.28, 0.62); body.position.y = 0.16; g.add(body);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.3, 8), dark); tail.rotation.x = Math.PI / 2 + 0.4; tail.position.set(0, 0.24, 0.62); g.add(tail);
  const wings = [-1, 1].map(s => {
    const pv = new THREE.Group(); pv.position.set(s * 0.3, 0.3, 0.05); g.add(pv);
    const w = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), dark); w.scale.set(0.14, 0.09, 0.42); w.position.set(s * 0.06, 0, 0.05); pv.add(w);
    const spec = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.03, 0.16), toon(0x4a5fd0)); spec.position.set(s * 0.15, 0.03, 0.12); pv.add(spec);
    for (const dz of [-0.09, 0.09]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.032, 0.02), toon(0xfafaf7)); b.position.set(s * 0.15, 0.03, 0.12 + dz); pv.add(b); }
    pv.userData.side = s; return pv;
  });
  const neck = new THREE.Group(); neck.position.set(0, 0.3, -0.42); g.add(neck);
  const neckM = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.26, 10), brown); neckM.position.y = 0.1; neck.add(neckM);
  const head = new THREE.Group(); head.position.y = 0.27; neck.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 12), cream); skull.scale.set(1, 0.95, 1.1); head.add(skull);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.152, 14, 12, 0, Math.PI * 2, 0, 1.0), dark); cap.position.y = 0.01; head.add(cap);
  const bill = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.05, 0.2), toon(0xe8873a)); bill.position.set(0, -0.03, -0.2); head.add(bill);
  const spot = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.052, 0.07), toon(0x2a2018)); spot.position.set(0, -0.028, -0.22); head.add(spot);
  for (const s of [-1, 1]) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.025, 0.18), dark); stripe.position.set(s * 0.14, 0.03, -0.01); head.add(stripe);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), toon(0x1d2430)); eye.position.set(s * 0.13, 0.035, -0.06); head.add(eye);
  }
  g.userData.pose = (rear, wing) => {
    neck.rotation.x = 0.35 - rear * 0.75;   // 平时脖子前探，立起来时往后仰、挺胸
    neck.position.y = 0.3 + rear * 0.12; neckM.scale.y = 1 + rear * 0.6; head.position.y = 0.27 + rear * 0.12;
    head.rotation.x = -0.3 + rear * 0.6;
    body.rotation.x = -rear * 0.35;
    for (const w of wings) w.rotation.z = w.userData.side * (0.05 + wing * 1.1);
  };
  g.userData.pose(0, 0);
  g.scale.setScalar(0.85);
  return g;
}

// 蜉蝣羽化：水面上一团上下飞舞的小白点；update(t, x, z, r, k)
export function createHatch(scene, n = 90) {
  const pos = new Float32Array(n * 3), seeds = [];
  for (let i = 0; i < n; i++) seeds.push([rand(0, TAU), rand(0.2, 1), rand(0.1, 1.1), rand(1, 3), rand(0, TAU)]);
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color: 0xfff4c8, size: 0.07, transparent: true, opacity: 0, depthWrite: false });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; pts.visible = false; pts.renderOrder = 7; scene.add(pts);
  return {
    update(t, x, z, r, k) {
      pts.visible = k > 0.01; mat.opacity = 0.95 * k;
      if (!pts.visible) return;
      for (let i = 0; i < n; i++) {
        const [a, rr, h, sp, ph] = seeds[i], aa = a + t * sp * 0.4;
        pos[i * 3] = x + Math.cos(aa) * rr * r; pos[i * 3 + 2] = z + Math.sin(aa) * rr * r * 0.8;
        pos[i * 3 + 1] = 0.08 + h * (0.5 + 0.5 * Math.sin(t * sp + ph));   // 蜉蝣的婚飞：一上一下
      }
      geo.attributes.position.needsUpdate = true;
    },
  };
}

// ---------- 特效：水圈 / 尾迹 / 嘎！气泡 / 星星 ----------
function popTexture(kind) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 160;
  const g = c.getContext('2d');
  if (kind === 'quack') {   // 声波弧线（不用文字）：左右各三道，白线描深边，和描边卡通一致
    g.lineCap = 'round';
    for (const [lw, col] of [[16, '#12324a'], [8, '#ffffff']]) {
      g.lineWidth = lw; g.strokeStyle = col;
      for (let i = 0; i < 3; i++) {
        const r = 26 + i * 22;
        g.beginPath(); g.arc(128, 84, r, -0.55, 0.55); g.stroke();
        g.beginPath(); g.arc(128, 84, r, Math.PI - 0.55, Math.PI + 0.55); g.stroke();
      }
    }
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
export const buildRiverRock = () => buildRock();

// 终点：长满芦苇的小岛 + 鸟窝 + 写着「家」的木牌，周围一片睡莲
// 返回 { group, nestY, lily }；小岛中心在 group 原点，宝宝到家后站在窝的周围
export function buildHome(half) {
  const g = new THREE.Group();
  const parts = [];
  parts.push(part(new THREE.SphereGeometry(1.5, 28, 12), 0xe9d9a6, [0, -0.15, 0], [0, 0, 0], [1, 0.22, 1]));   // 沙边
  parts.push(part(new THREE.SphereGeometry(1.3, 28, 12), 0x9ad47c, [0, -0.06, 0], [0, 0, 0], [1, 0.26, 1]));   // 草顶
  parts.push(part(new THREE.TorusGeometry(0.36, 0.1, 8, 20), 0xa77a4e, [0, 0.27, 0.05], [Math.PI / 2, 0, 0]));   // 鸟窝
  parts.push(part(new THREE.CircleGeometry(0.3, 16), 0xf3ede0, [0, 0.26, 0.05], [-Math.PI / 2, 0, 0]));          // 窝里的绒毛
  for (let i = 0; i < 10; i++) {   // 窝边翘出来的小树枝
    const a = i / 10 * TAU, tw = new THREE.CylinderGeometry(0.012, 0.012, 0.22, 4);
    parts.push(part(tw, 0x8a5d3b, [Math.cos(a) * 0.4, 0.3, 0.05 + Math.sin(a) * 0.4], [rand(-0.6, 0.6), a, Math.PI / 2 + rand(-0.4, 0.4)]));
  }
  const post = new THREE.CylinderGeometry(0.04, 0.05, 0.9, 6); post.translate(0, 0.45, 0);
  parts.push(part(post, 0x8a5d3b, [0.75, 0.15, -0.55], [0, 0, 0.08]));
  const isle = decorMesh(parts); g.add(isle);
  // 木牌（正面朝镜头方向 +z）
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#c99561'; ctx.fillRect(0, 0, 256, 128);
  ctx.strokeStyle = '#8a5d3b'; ctx.lineWidth = 10; ctx.strokeRect(5, 5, 246, 118);
  ctx.fillStyle = '#5a3a20'; ctx.font = 'bold 84px "PingFang SC", system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('家', 128, 68);
  const board = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.32, 0.04), [
    ...Array(4).fill(new THREE.MeshToonMaterial({ color: 0xc99561, gradientMap: GRAD_A })),
    new THREE.MeshToonMaterial({ map: new THREE.CanvasTexture(c), gradientMap: GRAD_A }),
    new THREE.MeshToonMaterial({ color: 0xc99561, gradientMap: GRAD_A })]);
  board.position.set(0.78, 1.02, -0.5); board.rotation.set(-0.35, -0.2, 0.08); board.castShadow = true; board.userData.skip = true;
  g.add(board);
  for (const [x, z] of [[-0.9, -0.6], [-0.3, -1.05], [0.4, -1.1], [-1.1, 0.1], [1.1, 0.2]]) {   // 小岛后半圈的芦苇
    const r = buildReeds(); r.position.set(x, 0.05, z); r.scale.setScalar(rand(1, 1.4)); g.add(r);
  }
  const lily = [];
  for (let i = 0; i < 12; i++) {   // 周围的睡莲
    const l = buildLily(); const a = rand(0, TAU), rr = rand(1.8, half - 0.4);
    l.position.set(Math.cos(a) * rr, 0, Math.sin(a) * rr * 1.6 + 1.5); l.rotation.y = rand(0, TAU); g.add(l); lily.push(l);
  }
  g.traverse(o => { if (o.isMesh) o.userData.skip = true; });
  return { group: g, nestY: 0.26, lily };
}   // 急流里的礁石（带泡沫圈）

export function contactShadow() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 8, 64, 64, 64);
  gr.addColorStop(0, 'rgba(10,50,60,0.55)'); gr.addColorStop(0.6, 'rgba(10,50,60,0.25)'); gr.addColorStop(1, 'rgba(10,50,60,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.scale.set(2.3, 3.0, 1); m.renderOrder = 1;
  return m;
}
