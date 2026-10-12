/* Asterisk promo site: one Three.js world, five stations, camera driven by scroll. */
gsap.registerPlugin(ScrollTrigger);

// smooth, inertial scrolling (falls back to native scroll if the CDN is blocked)
const lenis = window.Lenis ? new Lenis({ lerp: .085, wheelMultiplier: .85, touchMultiplier: 1.4 }) : null;
if (lenis) {
  lenis.stop();
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add(time => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
}

const TEAL = 0x2de0cb, TEAL_DEEP = 0x0b4f4a, AMBER = 0xf2a93b, RED = 0xff5a4e;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const rand = (a, b) => a + Math.random() * (b - a);

/* ---------------- renderer / camera ---------------- */
const canvas = $('#gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.setClearColor(0x030a09, 1);
renderer.outputEncoding = THREE.sRGBEncoding;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x030a09, 0.016);
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 3000);

scene.add(new THREE.AmbientLight(0x88aaa5, 0.35));
const key = new THREE.DirectionalLight(0xffffff, 1.1); key.position.set(5, 8, 6); scene.add(key);

/* ---------------- canvas text helper ---------------- */
function textTexture(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.anisotropy = 4; t.encoding = THREE.sRGBEncoding;
  return t;
}

/* ---------------- stars ---------------- */
{
  const p = [];
  for (let i = 0; i < 4000; i++) {
    const v = new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize().multiplyScalar(rand(400, 1200));
    p.push(v.x, v.y, v.z - 100);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({ size: 1.3, sizeAttenuation: false, color: 0xcfe9e4, transparent: true, opacity: .75, fog: false })));
}

/* ================= STATION 0: transaction globe ================= */
const globe = new THREE.Group(); scene.add(globe);
const R = 3;
globe.add(new THREE.Mesh(new THREE.SphereGeometry(R * .985, 64, 64), new THREE.MeshBasicMaterial({ color: 0x041311 })));
{
  const pos = [], col = [];
  const n = (x, y, z) => Math.sin(x * 1.7 + Math.sin(y * 2.3)) * Math.cos(y * 1.9 + Math.sin(z * 1.3)) + Math.sin(z * 2.1 + x * .7) * .6;
  const N = 12000;
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2, r = Math.sqrt(1 - y * y), th = i * 2.39996323;
    const x = Math.cos(th) * r, z = Math.sin(th) * r;
    if (n(x * 2, y * 2, z * 2) > .12) { pos.push(x * R, y * R, z * R); const c = rand(.45, 1); col.push(c * .35, c * .95, c * .85); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  globe.add(new THREE.Points(g, new THREE.PointsMaterial({ size: .03, vertexColors: true, transparent: true, opacity: .95 })));
}
const atmo = new THREE.Mesh(new THREE.SphereGeometry(R * 1.16, 64, 64), new THREE.ShaderMaterial({
  side: THREE.BackSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  vertexShader: 'varying vec3 vN; void main(){ vN=normalize(normalMatrix*normal); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
  fragmentShader: 'varying vec3 vN; void main(){ float i=pow(.64-dot(vN,vec3(0,0,1.)),3.5); gl_FragColor=vec4(.18,.88,.8,1.)*i*.9; }'
}));
scene.add(atmo);

// money flows: arcs with a travelling pulse; some get flagged red
const onSphere = () => { const u = rand(-1, 1), t = rand(0, Math.PI * 2), s = Math.sqrt(1 - u * u); return new THREE.Vector3(s * Math.cos(t), u, s * Math.sin(t)).multiplyScalar(R); };
const flows = [];
const pulseGeo = new THREE.SphereGeometry(.035, 8, 8);
for (let i = 0; i < 34; i++) {
  const a = onSphere(), b = onSphere();
  const mid = a.clone().add(b).multiplyScalar(.5).normalize().multiplyScalar(R + a.distanceTo(b) * .32);
  const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
  const flagged = Math.random() < .18;
  const color = flagged ? RED : TEAL;
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(80)),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: flagged ? .55 : .22, blending: THREE.AdditiveBlending }));
  const pulse = new THREE.Mesh(pulseGeo, new THREE.MeshBasicMaterial({ color: flagged ? RED : 0xbffff6 }));
  globe.add(line, pulse);
  flows.push({ curve, pulse, speed: rand(.12, .35), off: Math.random() });
}
globe.rotation.z = .3;

/* ================= STATION 1: screening wall ================= */
const S1 = new THREE.Vector3(0, 0, -45);
const screening = new THREE.Group(); screening.position.copy(S1); scene.add(screening);
const NAMES = [
  ['AMINA K. ODHIAMBO', '0.12'], ['BAHARI LOGISTICS LTD', '0.08'], ['JOSEPH MWANGI', '0.31'], ['NOVA TRADE FZE', '0.22'],
  ['FATUMA H. ALI', '0.05'], ['KESTREL HOLDINGS', '0.94'], ['DAVID OCHIENG', '0.17'], ['SAFIRI PAY LTD', '0.09'],
  ['GRACE W. NJERI', '0.26'], ['ORION METALS SA', '0.41'], ['PETER KAMAU', '0.03'], ['MERIDIAN AGRO', '0.11'],
];
const cards = [];
NAMES.forEach(([name, score], i) => {
  const hit = score === '0.94';
  const tex = textTexture(640, 200, (c, w, h) => {
    c.fillStyle = hit ? 'rgba(60,8,6,.9)' : 'rgba(4,22,20,.88)'; c.fillRect(0, 0, w, h);
    c.strokeStyle = hit ? '#ff5a4e' : 'rgba(45,224,203,.55)'; c.lineWidth = 3; c.strokeRect(2, 2, w - 4, h - 4);
    c.fillStyle = hit ? '#ffb1aa' : 'rgba(45,224,203,.85)'; c.font = '500 22px "IBM Plex Mono"';
    c.fillText(hit ? 'MATCH · REVIEW' : 'SCREENED · CLEAR', 28, 48);
    c.fillStyle = '#e7f5f1'; c.font = '600 40px Sora'; c.fillText(name, 28, 112);
    c.fillStyle = 'rgba(231,245,241,.55)'; c.font = '400 22px "IBM Plex Mono"';
    c.fillText(`SCORE ${score}   DOB ✓   COUNTRY ✓`, 28, 160);
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: .55, side: THREE.DoubleSide }));
  const col = i % 3, row = Math.floor(i / 3);
  m.position.set((col - 1) * 3.6, (1.5 - row) * 1.35, rand(-1.2, 1.2));
  m.userData = { hit, base: m.position.clone(), phase: rand(0, 6) };
  screening.add(m); cards.push(m);
});
const scanner = new THREE.Group(); screening.add(scanner);
scanner.add(new THREE.Mesh(new THREE.PlaneGeometry(13, .03), new THREE.MeshBasicMaterial({ color: TEAL, transparent: true, blending: THREE.AdditiveBlending })));
scanner.add(new THREE.Mesh(new THREE.PlaneGeometry(13, .9), new THREE.ShaderMaterial({
  transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  vertexShader: 'varying vec2 vU; void main(){ vU=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
  fragmentShader: 'varying vec2 vU; void main(){ float a=pow(1.-abs(vU.y-.5)*2.,3.)*.35*(1.-pow(abs(vU.x-.5)*2.,4.)); gl_FragColor=vec4(.18,.88,.8,a); }'
})));
scanner.position.z = 1.6;

/* ================= STATION 2: the asterisk + risk dial ================= */
const S2 = new THREE.Vector3(0, 0, -90);
const emblem = new THREE.Group(); emblem.position.copy(S2); scene.add(emblem);
const metal = new THREE.MeshStandardMaterial({ color: 0xa9c4bf, metalness: .92, roughness: .22 });
const star = new THREE.Group(); emblem.add(star);
for (let k = 0; k < 3; k++) {
  const arm = new THREE.Group(); arm.rotation.z = k * Math.PI / 3;
  arm.add(new THREE.Mesh(new THREE.CylinderGeometry(.34, .34, 4.4, 32), metal));
  [2.2, -2.2].forEach(y => { const cap = new THREE.Mesh(new THREE.SphereGeometry(.34, 32, 16), metal); cap.position.y = y; arm.add(cap); });
  star.add(arm);
}
const hub = new THREE.Mesh(new THREE.TorusGeometry(.62, .09, 16, 64), new THREE.MeshBasicMaterial({ color: TEAL }));
hub.position.z = .36; star.add(hub);
const e1 = new THREE.PointLight(TEAL, 3, 18); e1.position.set(-4, 3, 3); emblem.add(e1);
const e2 = new THREE.PointLight(0xffffff, 2, 18); e2.position.set(4, -2, 5); emblem.add(e2);
const e3 = new THREE.PointLight(AMBER, 1.6, 14); e3.position.set(0, 4, -3); emblem.add(e3);
// dial: 100 ticks
const ticks = [];
for (let i = 0; i < 100; i++) {
  const a = Math.PI / 2 - (i / 100) * Math.PI * 2;
  const t = new THREE.Mesh(new THREE.PlaneGeometry(.05, i % 10 === 0 ? .55 : .3), new THREE.MeshBasicMaterial({ color: 0x1c3a32, transparent: true }));
  t.position.set(Math.cos(a) * 4.3, Math.sin(a) * 4.3, -.4); t.rotation.z = a - Math.PI / 2;
  emblem.add(t); ticks.push(t);
}
const dial = { v: 0 };
const SCORE = 72;
const scoreTex = textTexture(512, 128, () => {});
const scoreSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: scoreTex, transparent: true, depthWrite: false }));
scoreSprite.scale.set(4, 1, 1); scoreSprite.position.set(0, -5.4, 0); emblem.add(scoreSprite);
function drawScore(v) {
  const c = scoreTex.image.getContext('2d'); c.clearRect(0, 0, 512, 128);
  c.textAlign = 'center'; c.fillStyle = v > 60 ? '#f2a93b' : '#2de0cb';
  c.font = '500 26px "IBM Plex Mono"'; c.fillText(`RISK SCORE ${String(Math.round(v)).padStart(2, '0')} / 100`, 256, 52);
  c.fillStyle = 'rgba(231,245,241,.55)'; c.font = '400 20px "IBM Plex Mono"';
  c.fillText(v > 60 ? 'HIGH · EDD · MLRO SIGN-OFF' : 'CALCULATING…', 256, 92);
  scoreTex.needsUpdate = true;
}

/* ================= STATION 3: alert grid ================= */
const S3 = new THREE.Vector3(0, -8, -142);
const grid = new THREE.Group(); grid.position.copy(S3); scene.add(grid);
const gh = new THREE.GridHelper(90, 60, TEAL, TEAL_DEEP); gh.material.transparent = true; gh.material.opacity = .35; grid.add(gh);
{
  const N = 700, box = new THREE.BoxGeometry(1, 1, 1);
  const inst = new THREE.InstancedMesh(box, new THREE.MeshStandardMaterial({ color: 0x0a1a18, metalness: .4, roughness: .7 }), N);
  const m = new THREE.Matrix4(), step = 1.5;
  for (let i = 0; i < N; i++) {
    const gx = Math.round(rand(-28, 28)), gz = Math.round(rand(-28, 28));
    if (Math.abs(gx) < 2 && Math.abs(gz) < 2) continue;
    const h = Math.pow(Math.random(), 3) * 3 + .15;
    m.compose(new THREE.Vector3(gx * step + .75, h / 2, gz * step + .75), new THREE.Quaternion(), new THREE.Vector3(1.1, h, 1.1));
    inst.setMatrixAt(i, m);
  }
  grid.add(inst);
}
const caseNode = new THREE.Mesh(new THREE.OctahedronGeometry(.9), new THREE.MeshBasicMaterial({ color: TEAL, wireframe: true }));
caseNode.position.y = 3.2; grid.add(caseNode);
const caseCore = new THREE.Mesh(new THREE.OctahedronGeometry(.45), new THREE.MeshBasicMaterial({ color: 0xbffff6 })); caseCore.position.y = 3.2; grid.add(caseCore);
const beacons = [];
const beamMat = (c) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: .0, blending: THREE.AdditiveBlending, depthWrite: false });
for (let i = 0; i < 26; i++) {
  const sev = Math.random(); const c = sev > .8 ? RED : sev > .45 ? AMBER : TEAL;
  const x = Math.round(rand(-14, 14)) * 1.5 + .75, z = Math.round(rand(-14, 14)) * 1.5 + .75;
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(.06, .22, 9, 8, 1, true), beamMat(c)); beam.position.set(x, 4.5, z);
  const pad = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), beamMat(c)); pad.rotation.x = -Math.PI / 2; pad.position.set(x, .02, z);
  const link = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x, .2, z), new THREE.Vector3(0, 3.2, 0)]),
    new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: 0, blending: THREE.AdditiveBlending }));
  grid.add(beam, pad, link);
  beacons.push({ beam, pad, link, phase: rand(0, 6), escalate: c !== TEAL });
}
const gridState = { on: 0, link: 0 };

/* ================= STATION 4: filing room ================= */
const S4 = new THREE.Vector3(0, 0, -200);
const room = new THREE.Group(); room.position.copy(S4); scene.add(room);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ color: 0x050c0b, metalness: .7, roughness: .38 }));
floor.rotation.x = -Math.PI / 2; floor.position.y = -2.2; room.add(floor);
const spot = new THREE.SpotLight(0xdffcf6, 0, 30, .42, .6, 1.2); spot.position.set(0, 9, 0); spot.target.position.set(0, -2.2, 0);
room.add(spot, spot.target);
const cone = new THREE.Mesh(new THREE.ConeGeometry(4.2, 11, 64, 1, true), new THREE.ShaderMaterial({
  transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  uniforms: { k: { value: 0 } },
  vertexShader: 'varying vec2 vU; varying vec3 vN; void main(){ vU=uv; vN=normalize(normalMatrix*normal); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
  fragmentShader: 'uniform float k; varying vec2 vU; varying vec3 vN; void main(){ float edge=1.-abs(dot(vN,vec3(0,0,1.))); float a=(1.-vU.y)*.0+vU.y*.0; a=pow(vU.y,1.6)*.22*(.35+edge*.65); gl_FragColor=vec4(.86,1.,.96,a*k); }'
}));
cone.position.y = 3.3; room.add(cone);
const sarTex = textTexture(512, 900, (c, w, h) => {
  c.fillStyle = '#0a1513'; c.fillRect(0, 0, w, h);
  c.strokeStyle = 'rgba(45,224,203,.6)'; c.lineWidth = 3; c.strokeRect(14, 14, w - 28, h - 28);
  c.fillStyle = '#2de0cb'; c.font = '500 24px "IBM Plex Mono"'; c.fillText('SUSPICIOUS ACTIVITY REPORT', 44, 84);
  c.fillStyle = '#e7f5f1'; c.font = '600 46px Sora'; c.fillText('SAR-2026-0147', 44, 150);
  c.fillStyle = 'rgba(231,245,241,.25)';
  for (let i = 0; i < 14; i++) c.fillRect(44, 200 + i * 30, rand(220, 420), 10);
  const rows = [['ANALYST', 'COMPLETED'], ['MLRO', 'APPROVED'], ['FIU REF', 'FIU/26/03918']];
  c.font = '400 22px "IBM Plex Mono"';
  rows.forEach(([a, b], i) => { const y = 680 + i * 52; c.fillStyle = 'rgba(231,245,241,.55)'; c.fillText(a, 44, y); c.fillStyle = '#e7f5f1'; c.fillText(b, 230, y); });
  c.strokeStyle = '#2de0cb'; c.lineWidth = 5; c.beginPath(); c.arc(420, 120, 34, 0, Math.PI * 2); c.stroke();
  c.beginPath(); c.moveTo(403, 121); c.lineTo(416, 135); c.lineTo(440, 106); c.stroke();
});
const slabMat = new THREE.MeshStandardMaterial({ color: 0x1a2a27, metalness: .8, roughness: .35 });
const slab = new THREE.Mesh(new THREE.BoxGeometry(2, 3.5, .18), [slabMat, slabMat, slabMat, slabMat,
  new THREE.MeshStandardMaterial({ map: sarTex, emissive: 0xffffff, emissiveMap: sarTex, emissiveIntensity: .55, roughness: .5 }), slabMat]);
slab.position.y = -.4; room.add(slab);
const dust = (() => {
  const p = []; for (let i = 0; i < 500; i++) { const r = Math.sqrt(Math.random()) * 3.2, a = rand(0, 6.28); p.push(Math.cos(a) * r, rand(-2, 8), Math.sin(a) * r); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ size: .03, color: 0xdffcf6, transparent: true, opacity: 0, depthWrite: false }));
  room.add(pts); return pts;
})();
// rows of soft light strips receding into the dark
for (let s = -1; s <= 1; s += 2) for (let i = 0; i < 7; i++) {
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(.06, 3.4), new THREE.MeshBasicMaterial({ color: TEAL, transparent: true, opacity: .35 }));
  strip.position.set(s * 7, -.5, -2 - i * 4); room.add(strip);
}

/* ---------------- cloud layer between globe and screening ---------------- */
{
  const tex = textTexture(128, 128, (c) => { const g = c.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(230,255,250,.55)'); g.addColorStop(1, 'rgba(230,255,250,0)'); c.fillStyle = g; c.fillRect(0, 0, 128, 128); });
  for (let i = 0; i < 70; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: rand(.15, .45), depthWrite: false }));
    s.position.set(rand(-9, 9), rand(-5, 5), rand(-26, 16) - 6); s.position.z = rand(-28, -14);
    s.scale.setScalar(rand(5, 12)); scene.add(s);
  }
}

/* ---------------- camera path ---------------- */
const K = [
  { pos: [0, 0, 13], look: [0, 0, 0] },            // hero
  { pos: [3.6, 1.7, 5.3], look: [0, .3, 0] },      // 01 monitoring
  { pos: [0, 0, -34], look: [0, 0, -45] },         // 02 screening
  { pos: [0, 0, -79], look: [0, 0, -90] },         // 03 risk
  { pos: [0, 9, -122], look: [0, -7, -142] },      // 04 alerts grid
  { pos: [0, .3, -189], look: [0, -.2, -200] },    // 05 filing room
  { pos: [0, 5.5, -184], look: [0, 7.5, -200] },     // final: tilt up into the light
].map(k => ({ pos: new THREE.Vector3(...k.pos), look: new THREE.Vector3(...k.look) }));
const state = { p: 0, target: 0 };
// scroll progress (0..1) -> station index, with a short hold at each station
const MOVE = 1, HOLD = .35, SPAN = (K.length - 1) * (MOVE + HOLD) - HOLD;
function stationFromScroll(u) {
  const x = Math.min(Math.max(u, 0), 1) * SPAN, seg = Math.floor(x / (MOVE + HOLD));
  return Math.min(seg + Math.min((x - seg * (MOVE + HOLD)) / MOVE, 1), K.length - 1);
}
const fit = () => (innerWidth < innerHeight ? 1.55 : 1);
const smoother = (x) => x * x * x * (x * (x * 6 - 15) + 10);
const _pos = new THREE.Vector3(), _look = new THREE.Vector3();
function placeCamera(p) {
  const i = Math.min(Math.floor(p), K.length - 2), f = smoother(Math.min(Math.max(p - i, 0), 1));
  _look.lerpVectors(K[i].look, K[i + 1].look, f);
  _pos.lerpVectors(K[i].pos, K[i + 1].pos, f).sub(_look).multiplyScalar(fit()).add(_look);
  // portrait: lift the subject above the text panel at the bottom
  // (eased back out on the final screen, where the camera looks up into the light instead)
  if (fit() > 1) { const lift = Math.min(p, 1) * 2.4 * (1 - Math.min(Math.max(p - 5, 0), 1)); _look.y -= lift; _pos.y -= lift; }
}

const mouse = { x: 0, y: 0, sx: 0, sy: 0 };
addEventListener('pointermove', e => { mouse.x = e.clientX / innerWidth - .5; mouse.y = e.clientY / innerHeight - .5; });

/* ---------------- chapter panels + scramble ---------------- */
const GLYPHS = '!<>-_\\/[]{}=+*^?#%&ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
function scramble(el, dur = 1100) {
  if (!el._orig) {
    el._nodes = []; const walk = n => n.childNodes.forEach(c => c.nodeType === 3 ? el._nodes.push(c) : walk(c)); walk(el);
    el._orig = el._nodes.map(n => n.textContent);
  }
  cancelAnimationFrame(el._raf);
  const t0 = performance.now(), total = el._orig.join('').length;
  const step = now => {
    const pr = Math.min((now - t0) / dur, 1); let seen = 0;
    el._nodes.forEach((node, k) => {
      const src = el._orig[k];
      node.textContent = [...src].map((ch, j) => {
        const pos = (seen + j) / total;
        if (ch === ' ' || pos < pr * 1.15 - .15) return ch;
        return pos < pr + .25 ? GLYPHS[(Math.random() * GLYPHS.length) | 0] : (pr < .02 ? ' ' : GLYPHS[(Math.random() * GLYPHS.length) | 0]);
      }).join('');
      seen += src.length;
    });
    if (pr < 1) el._raf = requestAnimationFrame(step); else el._nodes.forEach((n, k) => n.textContent = el._orig[k]);
  };
  el._raf = requestAnimationFrame(step);
}
const panels = $$('.panel'), railBars = $$('#rail i');
let active = -1;
function setChapter(ch) {
  if (ch === active) return;
  // fast scrolling can skip chapters: hide every panel that isn't the new one, cancelling pending fade-ins
  panels.forEach((pl, i) => {
    if (i === ch) return;
    gsap.killTweensOf(pl);
    if (+getComputedStyle(pl).opacity > 0) gsap.to(pl, { autoAlpha: 0, y: -12, filter: 'blur(6px)', duration: .35, ease: 'power2.in' });
  });
  active = ch;
  railBars.forEach((b, i) => b.classList.toggle('on', i === ch));
  gsap.to('#counter', { autoAlpha: ch >= 0 ? 1 : 0, duration: .4 });
  if (ch < 0) return;
  $('#cnum').textContent = String(ch + 1).padStart(2, '0');
  const p = panels[ch];
  gsap.fromTo(p, { autoAlpha: 0, y: 20, filter: 'blur(8px)' }, { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: .9, delay: .1, ease: 'expo.out' });
  $$('[data-scramble]', p).forEach((el, i) => setTimeout(() => scramble(el, i ? 1300 : 900), 150 + i * 220));
  blip();
  if (ch === 2) gsap.fromTo(dial, { v: 0 }, { v: SCORE, duration: 2.2, ease: 'power2.out' });
  if (ch === 3) gsap.fromTo(gridState, { link: 0 }, { link: 1, duration: 2.4, delay: .4, ease: 'power2.inOut' });
}

/* ---------------- audio (all synthesized) ---------------- */
let ac, master, soundOn = false;
function startAudio() {
  ac = new (window.AudioContext || window.webkitAudioContext)();
  master = ac.createGain(); master.gain.value = 0; master.connect(ac.destination);
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520; lp.Q.value = .7; lp.connect(master);
  [41.2, 61.7, 82.4, 123.5, 185].forEach((f, i) => {
    const o = ac.createOscillator(); o.type = i % 2 ? 'sine' : 'triangle'; o.frequency.value = f; o.detune.value = rand(-8, 8);
    const g = ac.createGain(); g.gain.value = .16 / (i + 1);
    const l = ac.createOscillator(); l.frequency.value = rand(.03, .12); const lg = ac.createGain(); lg.gain.value = .07 / (i + 1);
    l.connect(lg).connect(g.gain); o.connect(g).connect(lp); o.start(); l.start();
  });
  soundOn = true; $('#audio').classList.add('on');
  master.gain.linearRampToValueAtTime(.55, ac.currentTime + 5);
}
function blip() {
  if (!ac || !soundOn) return;
  const o = ac.createOscillator(), g = ac.createGain(); o.type = 'sine';
  o.frequency.setValueAtTime(1320, ac.currentTime); o.frequency.exponentialRampToValueAtTime(660, ac.currentTime + .18);
  g.gain.setValueAtTime(.0001, ac.currentTime); g.gain.exponentialRampToValueAtTime(.05, ac.currentTime + .01); g.gain.exponentialRampToValueAtTime(.0001, ac.currentTime + .35);
  o.connect(g).connect(ac.destination); o.start(); o.stop(ac.currentTime + .4);
}
let lastWhoosh = 0;
function whoosh() {
  if (!ac || !soundOn || performance.now() - lastWhoosh < 1500) return; lastWhoosh = performance.now();
  const len = ac.sampleRate * 1.6, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * i / len);
  const s = ac.createBufferSource(); s.buffer = buf;
  const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = .8;
  f.frequency.setValueAtTime(300, ac.currentTime); f.frequency.exponentialRampToValueAtTime(2400, ac.currentTime + .8); f.frequency.exponentialRampToValueAtTime(200, ac.currentTime + 1.6);
  const g = ac.createGain(); g.gain.value = .18; s.connect(f).connect(g).connect(ac.destination); s.start();
}
$('#audio').onclick = () => {
  if (!ac) { startAudio(); return; }
  soundOn = !soundOn; $('#audio').classList.toggle('on', soundOn);
  master.gain.cancelScheduledValues(ac.currentTime);
  master.gain.linearRampToValueAtTime(soundOn ? .55 : 0, ac.currentTime + .8);
};

/* ---------------- render loop ---------------- */
const clock = new THREE.Clock();
const flashEl = $('#flash');
const _tmpV = new THREE.Vector3();
let entered = false;
let dialFilled = -1;
function frame() {
  const dt = Math.min(clock.getDelta(), .05), t = clock.elapsedTime;
  if (entered) {
    const max = document.documentElement.scrollHeight - innerHeight;
    state.target = stationFromScroll(max > 0 ? scrollY / max : 0);
  }
  // critically damped follow: no jumps, no overshoot, same feel at 30 or 144 fps
  state.p += (state.target - state.p) * (1 - Math.exp(-dt * 3.4));
  const p = state.p;

  placeCamera(p);
  const md = 1 - Math.exp(-dt * 2.5); mouse.sx += (mouse.x - mouse.sx) * md; mouse.sy += (mouse.y - mouse.sy) * md;
  camera.position.copy(_pos).add(_tmpV.set(mouse.sx * 1.1, -mouse.sy * .7, 0));
  camera.lookAt(_look);

  // only draw stations near the camera so later scenes don't show through
  const band = (a, b) => p > a && p < b;
  globe.visible = atmo.visible = band(-1, 2.1);
  screening.visible = band(1.2, 3);
  emblem.visible = band(2.2, 4);
  grid.visible = band(3.1, 5.2);
  room.visible = band(4.2, 9);

  // globe
  globe.rotation.y += dt * .07;
  flows.forEach(f => { f.pulse.position.copy(f.curve.getPoint((t * f.speed + f.off) % 1)); });

  // screening: scanner sweep + card glow
  const sy = Math.sin(t * .9) * 2.6;
  scanner.position.y = sy;
  cards.forEach(c => {
    const near = Math.max(0, 1 - Math.abs(c.position.y - sy) / .9);
    c.material.opacity = .4 + near * .6 + (c.userData.hit ? .25 + Math.sin(t * 6) * .1 : 0);
    c.position.y = c.userData.base.y + Math.sin(t * .6 + c.userData.phase) * .08;
    c.rotation.y = Math.sin(t * .4 + c.userData.phase) * .12;
  });

  // asterisk + dial
  star.rotation.z = t * .18; star.rotation.y = Math.sin(t * .5) * .35; star.rotation.x = Math.cos(t * .4) * .15;
  const filled = Math.round(dial.v);
  if (filled !== dialFilled) { dialFilled = filled; ticks.forEach((tk, i) => tk.material.color.setHex(i < filled ? (i < 40 ? TEAL : i < 65 ? 0x9fd88a : AMBER) : 0x1c3a32)); }
  if (Math.abs(dial.v - (dial._last ?? -1)) > .4) { drawScore(dial.v); dial._last = dial.v; }

  // grid beacons
  const gridOn = Math.max(0, 1 - Math.abs(p - 4) * 1.4);
  beacons.forEach(b => {
    const pulse = .5 + .5 * Math.sin(t * 2.2 + b.phase);
    b.beam.material.opacity = gridOn * (.18 + pulse * .35);
    b.pad.material.opacity = gridOn * (.25 + pulse * .45);
    b.link.material.opacity = b.escalate ? gridOn * gridState.link * .8 : 0;
  });
  scoreSprite.visible = fit() === 1; // on phones the panel text sits where the label would be
  caseNode.rotation.y = t * .8; caseNode.rotation.x = t * .3;
  caseNode.scale.setScalar(.6 + gridState.link * .6); caseCore.scale.setScalar(.6 + gridState.link * .6 + Math.sin(t * 4) * .05);

  // room light comes up as we arrive
  const roomOn = Math.max(0, Math.min(1, (p - 4.4) / .6));
  spot.intensity = roomOn * 4; cone.material.uniforms.k.value = roomOn; dust.material.opacity = roomOn * .7;
  dust.rotation.y = t * .03; dust.visible = roomOn > 0;
  slab.rotation.y = Math.sin(t * .3) * .12;

  // cloud flash between the globe and the screening wall, and a lighter one diving onto the grid
  const fl = Math.exp(-Math.pow((p - 1.5) / .14, 2)) * .8 + Math.exp(-Math.pow((p - 3.55) / .1, 2)) * .35;
  flashEl.style.opacity = fl.toFixed(3);
  if (fl > .45) whoosh();

  // chapters: active when the camera is parked near a station
  if (entered) {
    const r = Math.round(p), near = Math.abs(p - r) < .3;
    setChapter(near && r >= 1 && r <= 5 ? r - 1 : -1);
  }

  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

/* ---------------- boot: loader -> hero -> enter ---------------- */
globe.scale.setScalar(.001); atmo.scale.setScalar(.001);
camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
const prog = { v: 0 };
const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();
gsap.to(prog, {
  v: 92, duration: 1.1, ease: 'power1.out', onUpdate: () => { $('#pct').textContent = Math.round(prog.v) + '%'; }
});
fontsReady.then(() => {
  drawScore(0);
  frame();
  gsap.timeline({ delay: 1 })
    .to(prog, { v: 100, duration: .4, onUpdate: () => { $('#pct').textContent = Math.round(prog.v) + '%'; } })
    .to('#loader', { autoAlpha: 0, duration: .8, onComplete: () => $('#loader').remove() })
    .to([globe.scale, atmo.scale], { x: 1, y: 1, z: 1, duration: 2.6, ease: 'expo.out' }, '-=.5')
    .to('header', { opacity: 1, duration: 1 }, '<')
    .add(() => {
      gsap.fromTo('#hero > *:not(.phones), .phones', { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, stagger: .14, duration: 1.1, ease: 'power3.out' });
      $$('#hero [data-scramble]').forEach((el, i) => setTimeout(() => scramble(el, i ? 1400 : 1000), i * 260));
    }, '-=2.2');
});

$('#start').onclick = () => {
  if (!ac) startAudio();
  blip();
  gsap.timeline()
    .to('#hero > *', { autoAlpha: 0, y: -18, stagger: .05, duration: .5, ease: 'power2.in' })
    .add(() => {
      $('#hero').remove();
      document.body.classList.add('live');
      scrollTo(0, 0);
      gsap.to('#rail', { opacity: 1, duration: 1 });
      // scroll drives the camera through the stations
      lenis?.start();
      ScrollTrigger.refresh();
      entered = true;
      // final stats count up
      ScrollTrigger.create({
        trigger: '#final', start: 'top 60%', once: true, onEnter: () => {
          scramble($('#final h2'), 1200);
          $$('[data-count]').forEach(el => {
            const o = { v: 0 }, n = +el.dataset.count;
            gsap.to(o, { v: n, duration: 1.8, ease: 'power2.out', onUpdate: () => el.textContent = (el.dataset.prefix || '') + Math.round(o.v) + (el.dataset.suffix || '') });
          });
        }
      });
      // nudge into chapter 01 so the journey starts on its own
      setTimeout(() => lenis ? lenis.scrollTo(innerHeight * .9, { duration: 2.4 }) : scrollTo({ top: innerHeight * .9, behavior: 'smooth' }), 50);
    });
};
