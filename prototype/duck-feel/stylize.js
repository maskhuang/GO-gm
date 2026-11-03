// 全屏后期风格化：描边卡通 / 颜料画 / 孔版印刷（Riso）
// 用法：const st = createStylize(renderer, scene, camera); 每帧 st.render(mode, time)；窗口变化 st.setSize(w, h)
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export const POST_MODES = { none: 0, cel: 1, paint: 2, riso: 3 };

const StylizeShader = {
  uniforms: {
    tDiffuse: { value: null }, tDepth: { value: null }, res: { value: new THREE.Vector2(1, 1) },
    mode: { value: 0 }, time: { value: 0 }, cameraNear: { value: 0.1 }, cameraFar: { value: 100 }, px: { value: 1 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse, tDepth;
    uniform vec2 res;
    uniform float mode, time, cameraNear, cameraFar, px;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float vnoise(vec2 p) {
      vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
    }
    float linDepth(vec2 uv) {
      float z = (1.0 - texture2D(tDepth, uv).r) * 2.0 - 1.0;   // 深度预渲染里存的是 1 - z
      return (2.0 * cameraNear * cameraFar) / (cameraFar + cameraNear - z * (cameraFar - cameraNear));
    }
    float lum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
    // 轮廓：线性深度的拉普拉斯（只认物体边缘，水面波纹不会被描）
    float depthEdge(vec2 uv, float w) {
      vec2 o = w * px / res;
      float d = linDepth(uv);
      float s = linDepth(uv - vec2(o.x, 0.0)) + linDepth(uv + vec2(o.x, 0.0)) + linDepth(uv - vec2(0.0, o.y)) + linDepth(uv + vec2(0.0, o.y));
      return smoothstep(0.008, 0.03, abs(s - 4.0 * d) / d);
    }
    // 颜料画：简化 Kuwahara（四个象限取方差最小的均值）
    vec3 kuwahara(vec2 uv) {
      vec2 o = px / res;
      vec3 m[4]; vec3 s[4];
      for (int k = 0; k < 4; k++) { m[k] = vec3(0.0); s[k] = vec3(0.0); }
      for (int j = 0; j <= 3; j++) for (int i = 0; i <= 3; i++) {
        vec3 c;
        c = texture2D(tDiffuse, uv + vec2(-float(i), -float(j)) * o * 2.6).rgb; m[0] += c; s[0] += c * c;
        c = texture2D(tDiffuse, uv + vec2(float(i), -float(j)) * o * 2.6).rgb; m[1] += c; s[1] += c * c;
        c = texture2D(tDiffuse, uv + vec2(-float(i), float(j)) * o * 2.6).rgb; m[2] += c; s[2] += c * c;
        c = texture2D(tDiffuse, uv + vec2(float(i), float(j)) * o * 2.6).rgb; m[3] += c; s[3] += c * c;
      }
      vec3 best = vec3(0.0); float bv = 1e9;
      for (int k = 0; k < 4; k++) {
        vec3 mu = m[k] / 16.0; vec3 v = abs(s[k] / 16.0 - mu * mu);
        float vs = v.r + v.g + v.b;
        if (vs < bv) { bv = vs; best = mu; }
      }
      return best;
    }
    void main() {
      vec2 uv = vUv;
      vec3 c = texture2D(tDiffuse, uv).rgb;
      vec2 frag = uv * res / px;
      if (mode < 0.5) { gl_FragColor = vec4(c, 1.0); return; }

      if (mode < 1.5) {
        // 描边卡通：饱和度略提，深色同色系轮廓
        float l = lum(c); c = mix(vec3(l), c, 1.2);
        c = floor(c * 6.0 + 0.5) / 6.0 * 0.35 + c * 0.65;   // 色块更硬一点
        float e = max(depthEdge(uv, 2.6), depthEdge(uv, 1.3));
        c = mix(c, c * 0.2 + vec3(0.03, 0.03, 0.07), e);
      } else if (mode < 2.5) {
        // 颜料画：笔触色块 + 抖动的描边 + 纸纹
        vec2 wob = (vec2(vnoise(frag * 0.05 + time * 0.2), vnoise(frag * 0.05 + 7.0)) - 0.5) * 2.5 * px / res;
        c = kuwahara(uv + wob);
        float e = depthEdge(uv + wob, 3.0) * (0.55 + 0.45 * vnoise(frag * 0.08));
        c = mix(c, c * 0.35, e);
        float l = lum(c); c = mix(vec3(l), c, 0.85) * 1.03;                 // 水粉略灰、略亮
        float paper = 0.88 + 0.12 * vnoise(frag * 0.35) + 0.06 * (vnoise(frag * 2.5) - 0.5);
        c *= paper;
        c = mix(c, c * vec3(1.0, 0.97, 0.9), 0.5);                           // 纸色偏暖
      } else {
        // 孔版印刷：色阶减少 + 暗部网点 + 套色错位 + 纸色
        vec3 cs = c;
        cs.r = texture2D(tDiffuse, uv + vec2(1.6, -1.0) * px / res).r;   // 红版错位
        vec3 q = floor(cs * 4.0 + 0.5) / 4.0;
        float l = lum(cs);
        // 旋转网格上的网点，越暗点越大
        mat2 rot = mat2(0.866, -0.5, 0.5, 0.866);
        vec2 g = rot * frag / 5.0;
        float dist = length(fract(g) - 0.5);
        float dotR = sqrt(clamp(1.0 - l * 1.25, 0.0, 1.0)) * 0.62;
        float ink = 1.0 - smoothstep(dotR - 0.06, dotR + 0.06, dist);
        vec3 inkC = q * 0.55;
        c = mix(q, inkC, ink * 0.7);
        float e = depthEdge(uv, 1.3);
        c = mix(c, vec3(0.13, 0.14, 0.22), e * 0.8);
        vec3 paper = vec3(0.98, 0.95, 0.88) * (0.95 + 0.05 * hash(floor(frag * 0.7)));
        c = mix(c, c * paper, 0.6) + (1.0 - max(max(c.r, c.g), c.b)) * 0.02;
      }
      gl_FragColor = vec4(c, 1.0);
    }`,
};

export function createStylize(renderer, scene, camera) {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType });
  // 深度单独预渲染一遍到普通纹理（比直接采样 DepthTexture 稳妥）
  const depthRT = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType });
  const depthMat = new THREE.MeshDepthMaterial();
  const black = new THREE.Color(0), hidden = [];
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  const pass = new ShaderPass(StylizeShader);
  composer.addPass(pass);
  composer.addPass(new OutputPass());
  const setSize = (w, h) => {
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.setSize(w, h);
    const s = renderer.getDrawingBufferSize(new THREE.Vector2());
    depthRT.setSize(s.x, s.y);
    pass.uniforms.res.value.set(s.x, s.y);
  };
  setSize(innerWidth, innerHeight);
  return {
    composer, pass,
    setSize,
    render(mode, time) {
      if (!mode) { renderer.render(scene, camera); return; }   // 原样：直接渲染，不走后期
      const u = pass.uniforms;
      u.mode.value = mode; u.time.value = time; u.px.value = renderer.getPixelRatio();
      u.cameraNear.value = camera.near; u.cameraFar.value = camera.far;
      // 深度预渲染：背景清成 0（= 无穷远），阴影图沿用主渲染的
      const bg = scene.background, auto = renderer.shadowMap.autoUpdate, cc = renderer.getClearColor(new THREE.Color()), ca = renderer.getClearAlpha();
      // 透明物体和贴图精灵（水圈、声波、星星、阴影投影…）不进深度，否则会被描出一圈方框
      hidden.length = 0;
      scene.traverseVisible(o => { if (o.isSprite || o.isLine || o.isPoints || (o.isMesh && (Array.isArray(o.material) ? false : o.material.transparent))) hidden.push(o); });
      for (const o of hidden) o.visible = false;
      scene.background = null; scene.overrideMaterial = depthMat; renderer.shadowMap.autoUpdate = false;
      renderer.setClearColor(black, 1); renderer.setRenderTarget(depthRT); renderer.clear(); renderer.render(scene, camera);
      scene.background = bg; scene.overrideMaterial = null; renderer.shadowMap.autoUpdate = auto; renderer.setClearColor(cc, ca); renderer.setRenderTarget(null);
      for (const o of hidden) o.visible = true;
      u.tDepth.value = depthRT.texture;
      composer.render();
    },
  };
}
