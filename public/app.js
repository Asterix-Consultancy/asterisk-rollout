/* Lumora promo site: one Three.js world, six stations, camera driven by scroll. */
gsap.registerPlugin(ScrollTrigger);

// smooth, inertial scrolling (falls back to native scroll if the CDN is blocked)
const lenis = window.Lenis ? new Lenis({ lerp: .075, wheelMultiplier: .8, touchMultiplier: 1.3 }) : null;
if (lenis) {
  lenis.stop();
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add(time => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
}

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const rand = (a, b) => a + Math.random() * (b - a);

/* ---------------- palette (the site is dark only) ---------------- */
const PALETTES = {
  dark: {
    bg: 0x030a09, ink: '#e7f5f1', dim: 'rgba(231,245,241,.55)', faint: 'rgba(231,245,241,.25)',
    teal: '#2de0cb', tealHex: 0x2de0cb, tealDeep: 0x0b4f4a, red: '#ff5a4e', redHex: 0xff5a4e, amber: '#f2a93b', amberHex: 0xf2a93b, mid: 0x9fd88a,
    card: 'rgba(4,22,20,.88)', cardHit: 'rgba(60,8,6,.9)', hitInk: '#ffb1aa', paper: '#0a1513', paperLine: 'rgba(231,245,241,.22)',
    tickOff: 0x1c3a32, box: 0x0a1a18, floor: 0x050c0b, slab: 0x1a2a27, pulse: 0xbffff6, ambient: .35, earthAmb: .05,
  },
};
const P = PALETTES.dark;
const themed = [];              // callbacks that colour the scene; re-run once the fonts are in
const glow = (m) => { m.blending = THREE.AdditiveBlending; return m; };

/* ---------------- renderer / camera ---------------- */
const canvas = $('#gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.outputEncoding = THREE.sRGBEncoding;
const maxAniso = renderer.capabilities.getMaxAnisotropy();

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(P.bg, 0.016);
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 3000);

const ambient = new THREE.AmbientLight(0x88aaa5, P.ambient); scene.add(ambient);
const key = new THREE.DirectionalLight(0xffffff, 1.1); key.position.set(5, 8, 6); scene.add(key);

/* ---------------- canvas textures (repaintable, e.g. once the fonts load) ---------------- */
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const t = new THREE.CanvasTexture(c); t.anisotropy = 4; t.encoding = THREE.sRGBEncoding;
  t.repaint = (...args) => { const x = c.getContext('2d'); x.clearRect(0, 0, w, h); draw(x, w, h, ...args); t.needsUpdate = true; };
  t.repaint();
  themed.push(() => t.repaint());
  return t;
}

/* ---------------- textures ---------------- */
const manager = new THREE.LoadingManager();
const loader = new THREE.TextureLoader(manager);
const tex = (f) => { const t = loader.load('textures/' + f); t.anisotropy = maxAniso; return t; };
const earthDay = tex('earth-day.jpg'), earthNight = tex('earth-night.jpg'), earthWater = tex('earth-water.jpg'), earthClouds = tex('earth-clouds.jpg');
earthClouds.wrapS = THREE.RepeatWrapping;

/* ---------------- stars ---------------- */
const stars = (() => {
  const p = [];
  for (let i = 0; i < 4000; i++) {
    const v = new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize().multiplyScalar(rand(400, 1200));
    p.push(v.x, v.y, v.z - 100);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  const s = new THREE.Points(g, new THREE.PointsMaterial({ size: 1.3, sizeAttenuation: false, color: 0xcfe9e4, transparent: true, opacity: .75, fog: false }));
  scene.add(s); return s;
})();

/* ================= STATION 1: the Earth, with money moving across it ================= */
const R = 3;
const globe = new THREE.Group(); globe.rotation.z = .41; scene.add(globe);     // axial tilt
const earth = new THREE.Group(); globe.add(earth);                              // spins
const SUN = new THREE.Vector3(-1, .35, .9).normalize();
const earthMat = new THREE.ShaderMaterial({
  uniforms: { dayMap: { value: earthDay }, nightMap: { value: earthNight }, waterMap: { value: earthWater }, cloudMap: { value: earthClouds },
    sun: { value: SUN }, amb: { value: P.earthAmb }, cloudShift: { value: 0 } },
  vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vW;
    void main(){ vUv=uv; vN=normalize(mat3(modelMatrix)*normal); vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
  fragmentShader: `uniform sampler2D dayMap, nightMap, waterMap, cloudMap; uniform vec3 sun; uniform float amb, cloudShift;
    varying vec2 vUv; varying vec3 vN; varying vec3 vW;
    void main(){
      vec3 n=normalize(vN), v=normalize(cameraPosition-vW); float nd=dot(n,sun);
      float lit=smoothstep(-.18,.28,nd);
      vec3 day=texture2D(dayMap,vUv).rgb, night=texture2D(nightMap,vUv).rgb;
      float water=texture2D(waterMap,vUv).r;
      vec3 dayCol=day*(amb+(1.-amb)*clamp(nd*1.15+.2,0.,1.));
      vec3 nightCol=night*vec3(1.,.82,.55)*1.5+day*amb*.7;
      vec3 col=mix(nightCol,dayCol,lit);
      col+=vec3(.85,.92,1.)*pow(max(dot(n,normalize(sun+v)),0.),48.)*water*.55*lit;
      float cl=texture2D(cloudMap,vUv+vec2(cloudShift,0.)).r;
      col=mix(col,vec3(1.)*(amb*.8+(1.-amb)*clamp(nd+.25,0.,1.)),cl*.8*max(lit,.08));
      float fr=pow(1.-max(dot(n,v),0.),3.);
      col+=vec3(.35,.62,1.)*fr*(.25+.6*lit);
      gl_FragColor=vec4(col,1.);
    }`,
});
const earthMesh = new THREE.Mesh(new THREE.SphereGeometry(R, 96, 96), earthMat);
earth.add(earthMesh);
const atmoMat = glow(new THREE.ShaderMaterial({
  side: THREE.BackSide, transparent: true, depthWrite: false, uniforms: { c: { value: new THREE.Color(.33, .62, 1) }, k: { value: 1 } },
  vertexShader: 'varying vec3 vN; void main(){ vN=normalize(normalMatrix*normal); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
  fragmentShader: 'uniform vec3 c; uniform float k; varying vec3 vN; void main(){ float i=pow(.66-dot(vN,vec3(0,0,1.)),4.); gl_FragColor=vec4(c,1.)*i*k; }'
}));
const atmo = new THREE.Mesh(new THREE.SphereGeometry(R * 1.18, 64, 64), atmoMat);
scene.add(atmo);

// lat/lon on the same mapping three.js uses for SphereGeometry uvs
const ll = (lat, lon, r = R) => {
  const phi = (lon + 180) / 360 * Math.PI * 2, th = (90 - lat) * Math.PI / 180;
  return new THREE.Vector3(-Math.cos(phi) * Math.sin(th), Math.cos(th), Math.sin(phi) * Math.sin(th)).multiplyScalar(r);
};
const CITIES = {
  nairobi: [-1.29, 36.82], mombasa: [-4.04, 39.67], kampala: [.35, 32.58], kigali: [-1.95, 30.06], dar: [-6.79, 39.21], addis: [9.03, 38.74],
  lagos: [6.52, 3.38], joburg: [-26.2, 28.05], cairo: [30.04, 31.24], dubai: [25.2, 55.27], mumbai: [19.08, 72.88], london: [51.51, -.13],
  frankfurt: [50.11, 8.68], newyork: [40.71, -74.0], singapore: [1.35, 103.82], shanghai: [31.23, 121.47], accra: [5.6, -.19], kinshasa: [-4.44, 15.27],
};
const ROUTES = [
  ['nairobi', 'london'], ['nairobi', 'dubai'], ['nairobi', 'mumbai'], ['nairobi', 'kampala'], ['nairobi', 'kigali'], ['nairobi', 'dar'],
  ['nairobi', 'joburg'], ['nairobi', 'lagos'], ['nairobi', 'shanghai'], ['nairobi', 'newyork'], ['mombasa', 'singapore'], ['addis', 'frankfurt'],
  ['kampala', 'kinshasa'], ['lagos', 'london'], ['accra', 'newyork'], ['dubai', 'mumbai'], ['cairo', 'frankfurt'], ['joburg', 'london'],
  ['dar', 'dubai'], ['kigali', 'joburg'], ['mombasa', 'dubai'], ['addis', 'dubai'], ['lagos', 'accra'], ['nairobi', 'addis'],
];
const FLAGGED = new Set([2, 9, 13, 20]);
const flows = [];
const pulseGeo = new THREE.SphereGeometry(.03, 8, 8);
ROUTES.forEach(([from, to], i) => {
  const a = ll(...CITIES[from], R * 1.002), b = ll(...CITIES[to], R * 1.002);
  const mid = a.clone().add(b).multiplyScalar(.5).normalize().multiplyScalar(R + a.distanceTo(b) * .28);
  const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
  const flagged = FLAGGED.has(i);
  const lineMat = glow(new THREE.LineBasicMaterial({ transparent: true, opacity: flagged ? .85 : .5 }));
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(90)), lineMat);
  const pulse = new THREE.Mesh(pulseGeo, new THREE.MeshBasicMaterial());
  earth.add(line, pulse);
  flows.push({ curve, pulse, line, flagged, speed: rand(.1, .28), off: Math.random() });
});
// city lights for the hubs
const hubDots = Object.values(CITIES).map(c => {
  const d = new THREE.Mesh(new THREE.SphereGeometry(.028, 10, 10), new THREE.MeshBasicMaterial());
  d.position.copy(ll(...c, R * 1.003)); earth.add(d); return d;
});
themed.push(() => {
  flows.forEach(f => { f.line.material.color.setHex(f.flagged ? P.redHex : P.tealHex); f.pulse.material.color.setHex(f.flagged ? P.redHex : P.pulse); });
  hubDots.forEach(d => d.material.color.setHex(P.pulse));
});
// start with East Africa facing the camera
{ const k = ll(...CITIES.nairobi); earth.rotation.y = -Math.atan2(k.x, k.z) - .35; }

/* ================= STATION 2: document check ================= */
const SD = new THREE.Vector3(0, 0, -45);
const docs = new THREE.Group(); docs.position.copy(SD); scene.add(docs);
const doc = { v: 0, q: -1 };
const CARD_W = 1024, CARD_H = 646;
// fields: [label, value, x, y, w] in card pixels
const FIELDS = [
  ['SURNAME', 'WANJIRU', 380, 190, 300], ['GIVEN NAMES', 'AMINA GRACE', 380, 270, 380], ['DATE OF BIRTH', '14.03.1991', 380, 350, 260],
  ['DOCUMENT NO.', 'A3481 2297', 680, 350, 280], ['DATE OF EXPIRY', '02.11.2031', 380, 430, 260], ['SEX', 'F', 680, 430, 120],
];
function drawCard(c, w, h) {
  const r = 34;
  c.fillStyle = P.paper; c.beginPath(); c.roundRect(0, 0, w, h, r); c.fill();
  // guilloche security pattern
  c.save(); c.beginPath(); c.roundRect(0, 0, w, h, r); c.clip();
  c.strokeStyle = P.paperLine; c.lineWidth = 1;
  for (let k = 0; k < 26; k++) { c.beginPath(); for (let x = 0; x <= w; x += 8) { const y = 120 + k * 22 + Math.sin(x / 70 + k * .6) * 18; x ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke(); }
  const g = c.createLinearGradient(0, 0, w, 0); g.addColorStop(0, P.teal); g.addColorStop(1, P.amber);
  c.fillStyle = g; c.fillRect(0, 0, w, 96);
  c.restore();
  c.fillStyle = '#ffffff'; c.font = '600 34px Sora'; c.fillText('IDENTITY CARD', 44, 60);
  c.font = '500 20px "IBM Plex Mono"'; c.textAlign = 'right'; c.fillText('SPECIMEN', w - 44, 58); c.textAlign = 'left';
  // portrait
  c.fillStyle = P.faint; c.beginPath(); c.roundRect(44, 140, 290, 360, 14); c.fill();
  c.fillStyle = P.dim; c.beginPath(); c.arc(189, 268, 70, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.ellipse(189, 470, 120, 110, 0, Math.PI, 0); c.fill();
  FIELDS.forEach(([l, v, x, y]) => {
    c.fillStyle = P.dim; c.font = '500 17px "IBM Plex Mono"'; c.fillText(l, x, y - 28);
    c.fillStyle = P.ink; c.font = '600 32px Sora'; c.fillText(v, x, y + 8);
  });
  // machine readable zone
  c.fillStyle = P.ink; c.font = '500 27px "IBM Plex Mono"';
  c.fillText('IDKEN<A34812297<<<<<<<<<<<<<<<', 44, 558);
  c.fillText('9103146F3111026<<<<<<<<<<<<<6', 44, 596);
  c.fillText('WANJIRU<<AMINA<GRACE<<<<<<<<<', 44, 634 - 4);
}
// OCR / verification overlay drawn on top of the card as the check runs
function drawScan(c, w, h, v = doc.v) {
  const bracket = (x, y, bw, bh, col, s = 14) => {
    c.strokeStyle = col; c.lineWidth = 4; c.beginPath();
    c.moveTo(x, y + s); c.lineTo(x, y); c.lineTo(x + s, y); c.moveTo(x + bw - s, y); c.lineTo(x + bw, y); c.lineTo(x + bw, y + s);
    c.moveTo(x + bw, y + bh - s); c.lineTo(x + bw, y + bh); c.lineTo(x + bw - s, y + bh); c.moveTo(x + s, y + bh); c.lineTo(x, y + bh); c.lineTo(x, y + bh - s); c.stroke();
  };
  const tick = (x, y, col) => { c.strokeStyle = col; c.lineWidth = 4; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 7, y + 7); c.lineTo(x + 19, y - 7); c.stroke(); };
  FIELDS.forEach(([, , x, y, fw], i) => {
    const t0 = .06 + i * .08;
    if (v < t0) return;
    const a = Math.min(1, (v - t0) / .06);
    c.globalAlpha = a;
    c.fillStyle = P.teal + '22'; c.fillRect(x - 10, y - 52, fw, 72);
    bracket(x - 10, y - 52, fw, 72, P.teal);
    if (v > t0 + .08) tick(x + fw - 38, y - 30, P.teal);
    c.globalAlpha = 1;
  });
  if (v > .55) { // face landmarks
    const a = Math.min(1, (v - .55) / .08); c.globalAlpha = a;
    bracket(84, 180, 210, 250, P.amber, 22);
    c.fillStyle = P.amber;
    [[160, 255], [218, 255], [189, 290], [168, 318], [210, 318], [189, 230], [140, 280], [238, 280]].forEach(([x, y]) => { c.beginPath(); c.arc(x, y, 4, 0, 7); c.fill(); });
    c.font = '600 19px "IBM Plex Mono"'; c.fillText('FACE MATCH 98.4%', 96, 168);
    c.globalAlpha = 1;
  }
  if (v > .7) { // MRZ checksum
    c.globalAlpha = Math.min(1, (v - .7) / .08);
    bracket(34, 526, w - 68, 116, P.teal);
    c.globalAlpha = 1;
  }
}
const CHECKS = [['Data extracted', .2], ['Security features', .4], ['Face match 98.4%', .62], ['Not expired', .74], ['MRZ checksum valid', .82], ['Proof of address', .9]];
function drawChecklist(c, w, h, v = doc.v) {
  c.fillStyle = P.card; c.beginPath(); c.roundRect(0, 0, w, h, 26); c.fill();
  c.strokeStyle = P.faint; c.lineWidth = 2; c.stroke();
  c.fillStyle = P.teal; c.font = '500 22px "IBM Plex Mono"'; c.fillText('KYC CHECK · CUS-20418', 40, 62);
  CHECKS.forEach(([label, t], i) => {
    const y = 130 + i * 62, done = v >= t;
    c.globalAlpha = done ? 1 : .35;
    c.strokeStyle = done ? P.teal : P.dim; c.lineWidth = 3; c.beginPath(); c.arc(56, y - 9, 15, 0, 7); c.stroke();
    if (done) { c.beginPath(); c.moveTo(48, y - 9); c.lineTo(54, y - 2); c.lineTo(65, y - 16); c.stroke(); }
    c.fillStyle = P.ink; c.font = '500 26px Sora'; c.fillText(label, 92, y);
    c.globalAlpha = 1;
  });
  if (v > .96) {
    c.save(); c.translate(w / 2, h - 66); c.rotate(-.05);
    c.strokeStyle = P.teal; c.lineWidth = 5; c.strokeRect(-190, -40, 380, 72);
    c.fillStyle = P.teal; c.font = '700 40px Sora'; c.textAlign = 'center'; c.fillText('VERIFIED', 0, 12);
    c.restore();
  }
}
function drawBill(c, w, h) {
  c.fillStyle = P.paper; c.fillRect(0, 0, w, h);
  c.fillStyle = P.teal; c.fillRect(0, 0, w, 14);
  c.fillStyle = P.ink; c.font = '600 30px Sora'; c.fillText('UTILITY STATEMENT', 40, 80);
  c.fillStyle = P.dim; c.font = '400 20px "IBM Plex Mono"'; c.fillText('PROOF OF ADDRESS · SEP 2026', 40, 118);
  c.fillStyle = P.ink; c.font = '500 22px "IBM Plex Mono"';
  ['AMINA G. WANJIRU', 'HSE 14, RIVERSIDE DRIVE', 'NAIROBI'].forEach((l, i) => c.fillText(l, 40, 190 + i * 34));
  c.fillStyle = P.paperLine;
  for (let i = 0; i < 12; i++) c.fillRect(40, 330 + i * 34, 140 + ((i * 97) % 260), 10);
  c.fillRect(40, 760, w - 80, 2);
  c.fillStyle = P.ink; c.font = '600 24px Sora'; c.fillText('KES 3,480.00', w - 230, 810);
}
const cardTex = canvasTex(CARD_W, CARD_H, drawCard);
const scanTex = canvasTex(CARD_W, CARD_H, drawScan);
const checkTex = canvasTex(620, 560, drawChecklist);
const billTex = canvasTex(640, 860, drawBill);
const idCard = new THREE.Group(); docs.add(idCard);
{
  const edge = new THREE.MeshStandardMaterial({ color: 0xcfd8d5, metalness: .3, roughness: .5 });
  edge.color.setHex(0x2a3a37);
  const face = new THREE.MeshStandardMaterial({ map: cardTex, roughness: .4, metalness: .1, emissive: 0xffffff, emissiveMap: cardTex, emissiveIntensity: .35, transparent: true });
  const body = new THREE.Mesh(new THREE.BoxGeometry(3.4, 3.4 * CARD_H / CARD_W, .035), [edge, edge, edge, edge, face, edge]);
  // the box corners are square; hide them behind the rounded texture by keeping the edge thin
  idCard.add(body);
  const overlay = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4 * CARD_H / CARD_W), new THREE.MeshBasicMaterial({ map: scanTex, transparent: true, depthWrite: false }));
  overlay.position.z = .02; idCard.add(overlay);
}
const docBeamMat = glow(new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, uniforms: { c: { value: new THREE.Color(P.tealHex) }, k: { value: 0 } },
  vertexShader: 'varying vec2 vU; void main(){ vU=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
  fragmentShader: 'uniform vec3 c; uniform float k; varying vec2 vU; void main(){ float a=pow(1.-abs(vU.x-.5)*2.,3.)*.55*(1.-pow(abs(vU.y-.5)*2.,6.)); gl_FragColor=vec4(c,a*k); }'
}));
const docBeam = new THREE.Mesh(new THREE.PlaneGeometry(.5, 2.6), docBeamMat); docBeam.position.z = .06; idCard.add(docBeam);
const docLine = new THREE.Mesh(new THREE.PlaneGeometry(.012, 2.5), glow(new THREE.MeshBasicMaterial({ transparent: true }))); docLine.position.z = .07; idCard.add(docLine);
themed.push(() => { docBeamMat.uniforms.c.value.setHex(P.tealHex); docLine.material.color.setHex(P.tealHex); });
const bill = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 2.1 * 860 / 640), new THREE.MeshBasicMaterial({ map: billTex, transparent: true, side: THREE.DoubleSide }));
bill.position.set(-1.25, .75, -1.3); bill.rotation.set(0, .42, .06); docs.add(bill);
const checklist = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 2.3 * 560 / 620), new THREE.MeshBasicMaterial({ map: checkTex, transparent: true, depthWrite: false }));
checklist.position.set(1.95, 1.2, .7); checklist.rotation.y = -.28; checklist.scale.setScalar(.85); docs.add(checklist);
idCard.position.set(-.2, -.35, 0);
idCard.rotation.set(.12, .28, -.04);
const fitDocs = () => docs.scale.setScalar(innerWidth < innerHeight ? .78 : 1); fitDocs();

/* ================= STATION 3: screening wall ================= */
const S1 = new THREE.Vector3(0, 0, -90);
const screening = new THREE.Group(); screening.position.copy(S1); scene.add(screening);
const NAMES = [
  ['AMINA K. ODHIAMBO', '0.12'], ['BAHARI LOGISTICS LTD', '0.08'], ['JOSEPH MWANGI', '0.31'], ['NOVA TRADE FZE', '0.22'],
  ['FATUMA H. ALI', '0.05'], ['KESTREL HOLDINGS', '0.94'], ['DAVID OCHIENG', '0.17'], ['SAFIRI PAY LTD', '0.09'],
  ['GRACE W. NJERI', '0.26'], ['ORION METALS SA', '0.41'], ['PETER KAMAU', '0.03'], ['MERIDIAN AGRO', '0.11'],
];
const cards = [];
NAMES.forEach(([name, score], i) => {
  const hit = score === '0.94';
  const t = canvasTex(640, 200, (c, w, h) => {
    c.fillStyle = hit ? P.cardHit : P.card; c.fillRect(0, 0, w, h);
    c.strokeStyle = hit ? P.red : P.teal; c.lineWidth = 3; c.strokeRect(2, 2, w - 4, h - 4);
    c.fillStyle = hit ? P.hitInk : P.teal; c.font = '500 22px "IBM Plex Mono"';
    c.fillText(hit ? 'MATCH · REVIEW' : 'SCREENED · CLEAR', 28, 48);
    c.fillStyle = P.ink; c.font = '600 40px Sora'; c.fillText(name, 28, 112);
    c.fillStyle = P.dim; c.font = '400 22px "IBM Plex Mono"';
    c.fillText(`SCORE ${score}   DOB ✓   COUNTRY ✓`, 28, 160);
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1), new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: .55, side: THREE.DoubleSide }));
  const col = i % 3, row = Math.floor(i / 3);
  m.position.set((col - 1) * 3.6, (1.5 - row) * 1.35, rand(-1.2, 1.2));
  m.userData = { hit, base: m.position.clone(), phase: rand(0, 6) };
  screening.add(m); cards.push(m);
});
const scanner = new THREE.Group(); screening.add(scanner);
const scanLine = new THREE.Mesh(new THREE.PlaneGeometry(13, .03), glow(new THREE.MeshBasicMaterial({ transparent: true })));
const scanGlowMat = glow(new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, uniforms: { c: { value: new THREE.Color() } },
  vertexShader: 'varying vec2 vU; void main(){ vU=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
  fragmentShader: 'uniform vec3 c; varying vec2 vU; void main(){ float a=pow(1.-abs(vU.y-.5)*2.,3.)*.35*(1.-pow(abs(vU.x-.5)*2.,4.)); gl_FragColor=vec4(c,a); }'
}));
scanner.add(scanLine, new THREE.Mesh(new THREE.PlaneGeometry(13, .9), scanGlowMat));
scanner.position.z = 1.6;
themed.push(() => { scanLine.material.color.setHex(P.tealHex); scanGlowMat.uniforms.c.value.setHex(P.tealHex); });

/* ================= STATION 4: the Lumora lens + risk dial ================= */
const S2 = new THREE.Vector3(0, 0, -135);
const emblem = new THREE.Group(); emblem.position.copy(S2); scene.add(emblem);
const metal = new THREE.MeshStandardMaterial({ color: 0xa9c4bf, metalness: .92, roughness: .22 });
// three gimbal rings around a glowing core: the lens that brings risk into the light
const lens = new THREE.Group(); emblem.add(lens);
const rings = [2.3, 1.85, 1.4].map((r, k) => {
  const ring = new THREE.Mesh(new THREE.TorusGeometry(r, .13, 24, 96), metal);
  ring.rotation.set(k === 1 ? Math.PI / 2 : 0, k === 2 ? Math.PI / 2 : 0, 0);
  lens.add(ring); return ring;
});
const coreMat = new THREE.MeshStandardMaterial({ roughness: .25, metalness: .1, emissiveIntensity: 1.1 });
const core = new THREE.Mesh(new THREE.SphereGeometry(.62, 48, 32), coreMat); lens.add(core);
const hub = new THREE.Mesh(new THREE.TorusGeometry(.95, .045, 16, 96), new THREE.MeshBasicMaterial()); lens.add(hub);
const e1 = new THREE.PointLight(0x2de0cb, 3, 18); e1.position.set(-4, 3, 3); emblem.add(e1);
const e2 = new THREE.PointLight(0xffffff, 2, 18); e2.position.set(4, -2, 5); emblem.add(e2);
const e3 = new THREE.PointLight(0xf2a93b, 1.6, 14); e3.position.set(0, 4, -3); emblem.add(e3);
const ticks = [];
for (let i = 0; i < 100; i++) {
  const a = Math.PI / 2 - (i / 100) * Math.PI * 2;
  const t = new THREE.Mesh(new THREE.PlaneGeometry(.05, i % 10 === 0 ? .55 : .3), new THREE.MeshBasicMaterial({ transparent: true }));
  t.position.set(Math.cos(a) * 4.3, Math.sin(a) * 4.3, -.4); t.rotation.z = a - Math.PI / 2;
  emblem.add(t); ticks.push(t);
}
const dial = { v: 0 };
const SCORE = 72;
const scoreTex = canvasTex(512, 128, (c, w, h) => {
  const v = dial.v;
  c.textAlign = 'center'; c.fillStyle = v > 60 ? P.amber : P.teal;
  c.font = '500 26px "IBM Plex Mono"'; c.fillText(`RISK SCORE ${String(Math.round(v)).padStart(2, '0')} / 100`, 256, 52);
  c.fillStyle = P.dim; c.font = '400 20px "IBM Plex Mono"';
  c.fillText(v > 60 ? 'HIGH · EDD · MLRO SIGN-OFF' : 'CALCULATING…', 256, 92);
});
const scoreSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: scoreTex, transparent: true, depthWrite: false }));
scoreSprite.scale.set(4, 1, 1); scoreSprite.position.set(0, -5.4, 0); emblem.add(scoreSprite);
let dialFilled = -1;
themed.push(() => { hub.material.color.setHex(P.tealHex); coreMat.color.setHex(P.tealHex); coreMat.emissive.setHex(P.tealHex); dialFilled = -1; });

/* ================= STATION 5: alert grid ================= */
const S3 = new THREE.Vector3(0, -8, -187);
const grid = new THREE.Group(); grid.position.copy(S3); scene.add(grid);
let gh;
themed.push(() => {
  if (gh) { grid.remove(gh); gh.geometry.dispose(); gh.material.dispose(); }
  gh = new THREE.GridHelper(90, 60, P.tealHex, P.tealDeep); gh.material.transparent = true; gh.material.opacity = .35; grid.add(gh);
});
const boxMat = new THREE.MeshStandardMaterial({ metalness: .4, roughness: .7 });
themed.push(() => boxMat.color.setHex(P.box));
{
  const N = 700, box = new THREE.BoxGeometry(1, 1, 1);
  const inst = new THREE.InstancedMesh(box, boxMat, N);
  const m = new THREE.Matrix4(), step = 1.5;
  for (let i = 0; i < N; i++) {
    const gx = Math.round(rand(-28, 28)), gz = Math.round(rand(-28, 28));
    if (Math.abs(gx) < 2 && Math.abs(gz) < 2) { m.makeScale(0, 0, 0); inst.setMatrixAt(i, m); continue; }
    const h = Math.pow(Math.random(), 3) * 3 + .15;
    m.compose(new THREE.Vector3(gx * step + .75, h / 2, gz * step + .75), new THREE.Quaternion(), new THREE.Vector3(1.1, h, 1.1));
    inst.setMatrixAt(i, m);
  }
  grid.add(inst);
}
const caseNode = new THREE.Mesh(new THREE.OctahedronGeometry(.9), new THREE.MeshBasicMaterial({ wireframe: true }));
caseNode.position.y = 3.2; grid.add(caseNode);
const caseCore = new THREE.Mesh(new THREE.OctahedronGeometry(.45), new THREE.MeshBasicMaterial()); caseCore.position.y = 3.2; grid.add(caseCore);
themed.push(() => { caseNode.material.color.setHex(P.tealHex); caseCore.material.color.setHex(P.pulse); });
const beacons = [];
const beamMat = () => glow(new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
for (let i = 0; i < 26; i++) {
  const sev = Math.random(), level = sev > .8 ? 'red' : sev > .45 ? 'amber' : 'teal';
  const x = Math.round(rand(-14, 14)) * 1.5 + .75, z = Math.round(rand(-14, 14)) * 1.5 + .75;
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(.06, .22, 9, 8, 1, true), beamMat()); beam.position.set(x, 4.5, z);
  const pad = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), beamMat()); pad.rotation.x = -Math.PI / 2; pad.position.set(x, .02, z);
  const link = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x, .2, z), new THREE.Vector3(0, 3.2, 0)]),
    glow(new THREE.LineBasicMaterial({ transparent: true, opacity: 0 })));
  grid.add(beam, pad, link);
  beacons.push({ beam, pad, link, level, phase: rand(0, 6), escalate: level !== 'teal' });
}
themed.push(() => beacons.forEach(b => {
  const c = b.level === 'red' ? P.redHex : b.level === 'amber' ? P.amberHex : P.tealHex;
  [b.beam, b.pad, b.link].forEach(o => o.material.color.setHex(c));
}));
const gridState = { link: 0 };

/* ================= STATION 6: filing room ================= */
const S4 = new THREE.Vector3(0, 0, -245);
const room = new THREE.Group(); room.position.copy(S4); scene.add(room);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ metalness: .7, roughness: .38 }));
floor.rotation.x = -Math.PI / 2; floor.position.y = -2.2; room.add(floor);
const spot = new THREE.SpotLight(0xdffcf6, 0, 30, .42, .6, 1.2); spot.position.set(0, 9, 0); spot.target.position.set(0, -2.2, 0);
room.add(spot, spot.target);
const coneMat = glow(new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, side: THREE.DoubleSide,
  uniforms: { k: { value: 0 }, c: { value: new THREE.Color(.86, 1, .96) } },
  vertexShader: 'varying vec2 vU; varying vec3 vN; void main(){ vU=uv; vN=normalize(normalMatrix*normal); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
  fragmentShader: 'uniform float k; uniform vec3 c; varying vec2 vU; varying vec3 vN; void main(){ float edge=1.-abs(dot(vN,vec3(0,0,1.))); float a=pow(vU.y,1.6)*.22*(.35+edge*.65); gl_FragColor=vec4(c,a*k); }'
}));
const cone = new THREE.Mesh(new THREE.ConeGeometry(4.2, 11, 64, 1, true), coneMat);
cone.position.y = 3.3; room.add(cone);
const sarTex = canvasTex(512, 900, (c, w, h) => {
  c.fillStyle = P.paper; c.fillRect(0, 0, w, h);
  c.strokeStyle = P.teal; c.lineWidth = 3; c.strokeRect(14, 14, w - 28, h - 28);
  c.fillStyle = P.teal; c.font = '500 24px "IBM Plex Mono"'; c.fillText('SUSPICIOUS ACTIVITY REPORT', 44, 84);
  c.fillStyle = P.ink; c.font = '600 46px Sora'; c.fillText('SAR-2026-0147', 44, 150);
  c.fillStyle = P.paperLine;
  for (let i = 0; i < 14; i++) c.fillRect(44, 200 + i * 30, 220 + ((i * 131) % 200), 10);
  const rows = [['ANALYST', 'COMPLETED'], ['MLRO', 'APPROVED'], ['FIU REF', 'FIU/26/03918']];
  c.font = '400 22px "IBM Plex Mono"';
  rows.forEach(([a, b], i) => { const y = 680 + i * 52; c.fillStyle = P.dim; c.fillText(a, 44, y); c.fillStyle = P.ink; c.fillText(b, 230, y); });
  c.strokeStyle = P.teal; c.lineWidth = 5; c.beginPath(); c.arc(420, 120, 34, 0, Math.PI * 2); c.stroke();
  c.beginPath(); c.moveTo(403, 121); c.lineTo(416, 135); c.lineTo(440, 106); c.stroke();
});
const slabMat = new THREE.MeshStandardMaterial({ metalness: .8, roughness: .35 });
const slabFace = new THREE.MeshStandardMaterial({ map: sarTex, emissive: 0xffffff, emissiveMap: sarTex, emissiveIntensity: .55, roughness: .5 });
const slab = new THREE.Mesh(new THREE.BoxGeometry(2, 3.5, .18), [slabMat, slabMat, slabMat, slabMat, slabFace, slabMat]);
slab.position.y = -.4; room.add(slab);
const dust = (() => {
  const p = []; for (let i = 0; i < 500; i++) { const r = Math.sqrt(Math.random()) * 3.2, a = rand(0, 6.28); p.push(Math.cos(a) * r, rand(-2, 8), Math.sin(a) * r); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ size: .03, transparent: true, opacity: 0, depthWrite: false }));
  room.add(pts); return pts;
})();
const strips = [];
for (let s = -1; s <= 1; s += 2) for (let i = 0; i < 7; i++) {
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(.06, 3.4), new THREE.MeshBasicMaterial({ transparent: true, opacity: .35 }));
  strip.position.set(s * 7, -.5, -2 - i * 4); room.add(strip); strips.push(strip);
}
themed.push(() => {
  floor.material.color.setHex(P.floor); slabMat.color.setHex(P.slab);
  coneMat.uniforms.c.value.setHex(0xdbfff5);
  dust.material.color.setHex(0xdffcf6);
  strips.forEach(s => s.material.color.setHex(P.tealHex));
});

/* ---------------- cloud layer between the Earth and the document check ---------------- */
const puffs = [];
{
  const t = canvasTex(128, 128, (c) => { const g = c.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(240,255,252,.6)'); g.addColorStop(1, 'rgba(240,255,252,0)'); c.fillStyle = g; c.fillRect(0, 0, 128, 128); });
  for (let i = 0; i < 70; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, opacity: rand(.15, .45), depthWrite: false }));
    s.position.set(rand(-9, 9), rand(-5, 5), rand(-28, -14));
    s.scale.setScalar(rand(5, 12)); scene.add(s); puffs.push(s);
  }
}

/* ---------------- scene colours ---------------- */
renderer.setClearColor(P.bg, 1);
themed.forEach(f => f());

/* ---------------- camera path ---------------- */
const K = [
  { pos: [0, 0, 13], look: [0, 0, 0] },              // hero
  { pos: [3.6, 1.7, 5.3], look: [0, .3, 0] },        // 01 monitoring: the Earth
  { pos: [-.2, .4, -37], look: [0, .1, -45], shift: [2.8, .45] }, // 02 document check
  { pos: [0, 0, -79], look: [0, 0, -90] },           // 03 screening
  { pos: [0, 0, -122], look: [0, 0, -135], shift: [4.6, 0] },     // 04 risk
  { pos: [0, 9, -167], look: [0, -7, -187] },        // 05 alerts grid
  { pos: [0, .3, -234], look: [0, -.2, -245], shift: [2.2, 0] },  // 06 filing room
  { pos: [0, 5.5, -229], look: [0, 7.5, -245] },     // final: tilt up into the light
].map(k => ({ pos: new THREE.Vector3(...k.pos), look: new THREE.Vector3(...k.look), shift: k.shift || [0, 0] }));
const LAST = K.length - 1, CHAPTERS = LAST - 1;
const state = { p: 0, target: 0 };
// scroll progress (0..1) -> station index, with a hold at each station so the text has time to read
const MOVE = 1, HOLD = .45, SPAN = LAST * (MOVE + HOLD) - HOLD;
function stationFromScroll(u) {
  const x = Math.min(Math.max(u, 0), 1) * SPAN, seg = Math.floor(x / (MOVE + HOLD));
  return Math.min(seg + Math.min((x - seg * (MOVE + HOLD)) / MOVE, 1), LAST);
}
// the journey ends when the closing section is 40% into view, so it never shows up under chapter 06
const finalEl = $('#final');
const journeyEnd = () => finalEl.offsetTop - innerHeight * .6;
const scrollForStation = (k) => ((k - 1) * (MOVE + HOLD) + MOVE + HOLD / 2) / SPAN;
const fit = () => (innerWidth < innerHeight ? 1.55 : 1);
const smoother = (x) => x * x * x * (x * (x * 6 - 15) + 10);
const _pos = new THREE.Vector3(), _look = new THREE.Vector3();
function placeCamera(p) {
  const i = Math.min(Math.floor(p), K.length - 2), f = smoother(Math.min(Math.max(p - i, 0), 1));
  _look.lerpVectors(K[i].look, K[i + 1].look, f);
  _pos.lerpVectors(K[i].pos, K[i + 1].pos, f).sub(_look).multiplyScalar(fit()).add(_look);
  // shift sideways so the subject sits beside the text panel (on phones the panel is below, so barely)
  const side = fit() > 1 ? 1 : 0, sx = K[i].shift[side] + (K[i + 1].shift[side] - K[i].shift[side]) * f;
  _look.x += sx; _pos.x += sx;
  // portrait: lift the subject above the text panel at the bottom
  // (eased back out on the final screen, where the camera looks up into the light instead)
  if (fit() > 1) { const lift = Math.min(p, 1) * 2.4 * (1 - Math.min(Math.max(p - CHAPTERS, 0), 1)); _look.y -= lift; _pos.y -= lift; }
}

const mouse = { x: 0, y: 0, sx: 0, sy: 0 };
addEventListener('pointermove', e => { mouse.x = e.clientX / innerWidth - .5; mouse.y = e.clientY / innerHeight - .5; });

/* ---------------- text effects ---------------- */
const GLYPHS = '!<>-_\\/[]{}=+*^?#%&ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
// one-off decode effect, used for the hero and the closing line only
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
        return GLYPHS[(Math.random() * GLYPHS.length) | 0];
      }).join('');
      seen += src.length;
    });
    if (pr < 1) el._raf = requestAnimationFrame(step); else el._nodes.forEach((n, k) => n.textContent = el._orig[k]);
  };
  el._raf = requestAnimationFrame(step);
}
// chapter headings: wrap each word so it can rise out of its own mask; text is never rewritten
function splitWords(el) {
  const walk = n => [...n.childNodes].forEach(c => {
    if (c.nodeType !== 3) return walk(c);
    const frag = document.createDocumentFragment();
    c.textContent.split(/(\s+)/).forEach(part => {
      if (!part) return;
      if (/^\s+$/.test(part)) { frag.append(' '); return; }
      const w = document.createElement('span'); w.className = 'w';
      const i = document.createElement('i'); i.textContent = part; w.append(i); frag.append(w);
    });
    c.replaceWith(frag);
  });
  walk(el);
}

const panels = $$('.panel'), railBars = $$('#rail i');
panels.forEach(pl => { splitWords($('h2', pl)); pl._tl = null; });
let active = -1;
function hidePanel(pl) {
  pl._tl?.kill();
  if (getComputedStyle(pl).visibility === 'hidden') return false;
  pl._tl = gsap.to(pl, { autoAlpha: 0, y: -14, duration: .3, ease: 'power2.in' });
  return true;
}
function showPanel(pl, delay) {
  pl._tl?.kill();
  const words = $$('.w > i', pl), tag = $('.tag', pl), body = $('p', pl), chips = $$('.chips span', pl);
  pl._tl = gsap.timeline({ delay })
    .set(pl, { autoAlpha: 1, y: 0 })
    .fromTo(tag, { autoAlpha: 0, x: -12 }, { autoAlpha: 1, x: 0, duration: .5, ease: 'power3.out' })
    .fromTo(words, { yPercent: 115 }, { yPercent: 0, duration: .85, stagger: .05, ease: 'expo.out' }, '<.05')
    .fromTo(body, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: .7, ease: 'power3.out' }, '-=.55');
  if (chips.length) pl._tl.fromTo(chips, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: .45, stagger: .035, ease: 'power2.out' }, '-=.45');
}
function setChapter(ch) {
  if (ch === active) return;
  // hide whatever is showing first, then bring the new chapter in once it has cleared, so two never overlap
  let busy = false;
  panels.forEach((pl, i) => { if (i !== ch && hidePanel(pl)) busy = true; });
  active = ch;
  railBars.forEach((b, i) => b.classList.toggle('on', i === ch));
  gsap.to('#counter', { autoAlpha: ch >= 0 ? 1 : 0, duration: .4, overwrite: true });
  if (ch < 0) return;
  $('#cnum').textContent = String(ch + 1).padStart(2, '0');
  showPanel(panels[ch], busy ? .28 : .05);
  blip();
  if (ch === 1) gsap.fromTo(doc, { v: 0 }, { v: 1, duration: 3.6, ease: 'none', overwrite: true });
  if (ch === 3) gsap.fromTo(dial, { v: 0 }, { v: SCORE, duration: 2.2, ease: 'power2.out', overwrite: true });
  if (ch === 4) gsap.fromTo(gridState, { link: 0 }, { link: 1, duration: 2.4, delay: .4, ease: 'power2.inOut', overwrite: true });
}
// which chapter should show: enter close to a station, leave a little further out (no flicker at the edge)
function chapterFor(p) {
  if (active >= 0 && Math.abs(p - (active + 1)) < .4) return active;
  const r = Math.round(p);
  return Math.abs(p - r) < .24 && r >= 1 && r <= CHAPTERS ? r - 1 : -1;
}

/* ---------------- gentle snap: when scrolling stops near a station, settle onto it ---------------- */
let snapTimer = 0, snapping = false;
function maybeSnap() {
  if (!entered || !lenis || regOpen) return;
  const max = journeyEnd(); if (max <= 0) return;
  const target = stationFromScroll(scrollY / max), k = Math.round(target);
  if (k < 1 || k > CHAPTERS || Math.abs(target - k) < .015 || Math.abs(target - k) > .4) return;
  snapping = true;
  lenis.scrollTo(scrollForStation(k) * max, { duration: 1.1, easing: t => 1 - Math.pow(1 - t, 3), onComplete: () => { snapping = false; } });
}
if (lenis) lenis.on('scroll', () => { if (snapping) return; clearTimeout(snapTimer); snapTimer = setTimeout(maybeSnap, 260); });
addEventListener('wheel', () => { if (snapping) { snapping = false; } }, { passive: true });
addEventListener('touchstart', () => { snapping = false; }, { passive: true });

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

/* ---------------- registration -> email (or WhatsApp) ---------------- */
const ACCESS_EMAIL = 'hello@asterisk.co.ke';
const WHATSAPP = '254754193490';
const reg = $('#reg'), form = $('#reg form');
let regOpen = false;
function openReg(interest) {
  if (interest) form.elements.interest.value = interest;
  regOpen = true; lenis?.stop();
  gsap.set(reg, { visibility: 'visible' });
  gsap.to('#reg .scrim', { opacity: 1, duration: .35 });
  gsap.to(form, { opacity: 1, y: 0, duration: .5, ease: 'power3.out' });
  setTimeout(() => form.elements.name.focus(), 120);
}
function closeReg() {
  if (!regOpen) return;
  regOpen = false; if (entered) lenis?.start();
  gsap.to('#reg .scrim', { opacity: 0, duration: .3 });
  gsap.to(form, { opacity: 0, y: 16, duration: .3, ease: 'power2.in', onComplete: () => gsap.set(reg, { visibility: 'hidden' }) });
}
$$('[data-register]').forEach(b => b.addEventListener('click', () => openReg(b.dataset.register)));
$$('[data-close]', reg).forEach(b => b.addEventListener('click', closeReg));
addEventListener('keydown', e => { if (e.key === 'Escape') closeReg(); });
// build the request from the form, or null (with the browser's hints shown) if something required is missing
function requestText() {
  if (!form.checkValidity()) { form.reportValidity(); return null; }
  const f = Object.fromEntries(new FormData(form));
  const want = form.elements.interest.selectedOptions[0].textContent.toLowerCase();
  const lines = [`Hello, I'd like ${want} for Lumora.`, '', `Name: ${f.name}`, `Organisation: ${f.org}`];
  if (f.role) lines.push(`Role: ${f.role}`);
  lines.push(`Institution type: ${f.type}`, `Email: ${f.email}`, `Phone: ${f.phone}`);
  if (f.msg.trim()) lines.push('', f.msg.trim());
  return { text: lines.join('\n'), org: f.org };
}
// access requests go by email; WhatsApp stays as a second option
form.addEventListener('submit', e => {
  e.preventDefault();
  const r = requestText(); if (!r) return;
  location.href = `mailto:${ACCESS_EMAIL}?subject=${encodeURIComponent(`Lumora access request: ${r.org}`)}&body=${encodeURIComponent(r.text)}`;
  closeReg();
});
$('#wa').addEventListener('click', () => {
  const r = requestText(); if (!r) return;
  const url = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(r.text)}`;
  const win = window.open(url, '_blank');
  if (win) win.opener = null; else location.href = url; // popup blocked: continue in this tab
  closeReg();
});

/* ---------------- render loop ---------------- */
const clock = new THREE.Clock();
const flashEl = $('#flash');
const _tmpV = new THREE.Vector3();
let entered = false;
function frame() {
  const dt = Math.min(clock.getDelta(), .05), t = clock.elapsedTime;
  if (entered) {
    const max = journeyEnd();
    state.target = stationFromScroll(max > 0 ? scrollY / max : 0);
  }
  // critically damped follow: no jumps, no overshoot, same feel at 30 or 144 fps
  state.p += (state.target - state.p) * (1 - Math.exp(-dt * 3));
  const p = state.p;

  placeCamera(p);
  const md = 1 - Math.exp(-dt * 2.5); mouse.sx += (mouse.x - mouse.sx) * md; mouse.sy += (mouse.y - mouse.sy) * md;
  camera.position.copy(_pos).add(_tmpV.set(mouse.sx * 1.1, -mouse.sy * .7, 0));
  camera.lookAt(_look);

  // only draw stations near the camera so later scenes don't show through
  const band = (a, b) => p > a && p < b;
  globe.visible = atmo.visible = band(-1, 2.1);
  docs.visible = band(1.2, 3);
  screening.visible = band(2.2, 4);
  emblem.visible = band(3.2, 5);
  grid.visible = band(4.1, 6.2);
  room.visible = band(5.2, 9);

  // earth
  earth.rotation.y += dt * .05;
  earthMat.uniforms.cloudShift.value = t * .0025;
  flows.forEach(f => { f.pulse.position.copy(f.curve.getPoint((t * f.speed + f.off) % 1)); });

  // document check: beam sweeps while the check runs, overlay and checklist repaint as it progresses
  if (docs.visible) {
    const q = Math.round(doc.v * 60);
    if (q !== doc.q) { doc.q = q; scanTex.repaint(); checkTex.repaint(); }
    const running = doc.v > 0 && doc.v < .92;
    docBeamMat.uniforms.k.value += ((running ? 1 : 0) - docBeamMat.uniforms.k.value) * Math.min(1, dt * 5);
    docBeam.position.x = docLine.position.x = Math.sin(t * 1.6) * 1.55;
    docLine.material.opacity = docBeamMat.uniforms.k.value;
    idCard.position.y = -.35 + Math.sin(t * .7) * .05; idCard.rotation.y = .28 + Math.sin(t * .4) * .06;
    checklist.position.y = 1.2 + Math.sin(t * .6 + 1) * .05;
    bill.rotation.y = .42 + Math.sin(t * .35 + 2) * .04;
  }

  // screening: scanner sweep + card glow
  const sy = Math.sin(t * .9) * 2.6;
  scanner.position.y = sy;
  cards.forEach(c => {
    const near = Math.max(0, 1 - Math.abs(c.position.y - sy) / .9);
    c.material.opacity = .45 + near * .55 + (c.userData.hit ? .25 + Math.sin(t * 6) * .1 : 0);
    c.position.y = c.userData.base.y + Math.sin(t * .6 + c.userData.phase) * .08;
    c.rotation.y = Math.sin(t * .4 + c.userData.phase) * .12;
  });

  // lens + dial: each ring turns on its own axis, the whole lens drifts
  rings[0].rotation.x = t * .5; rings[1].rotation.y = t * .7; rings[2].rotation.x = Math.PI / 2 + t * .9;
  lens.rotation.y = Math.sin(t * .4) * .4; lens.rotation.x = Math.cos(t * .3) * .2;
  core.scale.setScalar(1 + Math.sin(t * 2.4) * .04); hub.rotation.y = t * 1.2;
  const filled = Math.round(dial.v);
  if (filled !== dialFilled) { dialFilled = filled; ticks.forEach((tk, i) => tk.material.color.setHex(i < filled ? (i < 40 ? P.tealHex : i < 65 ? P.mid : P.amberHex) : P.tickOff)); }
  if (Math.abs(dial.v - (dial._last ?? -1)) > .4) { scoreTex.repaint(); dial._last = dial.v; }

  // grid beacons
  const gridOn = Math.max(0, 1 - Math.abs(p - 5) * 1.4);
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
  const roomOn = Math.max(0, Math.min(1, (p - 5.4) / .6));
  spot.intensity = roomOn * 4; coneMat.uniforms.k.value = roomOn; dust.material.opacity = roomOn * .7;
  dust.rotation.y = t * .03; dust.visible = roomOn > 0;
  slab.rotation.y = Math.sin(t * .3) * .12;

  // cloud flash between the Earth and the document check, and a lighter one diving onto the grid
  const fl = Math.exp(-Math.pow((p - 1.5) / .16, 2)) * .8 + Math.exp(-Math.pow((p - 4.55) / .12, 2)) * .3;
  flashEl.style.opacity = fl.toFixed(3);
  if (fl > .45) whoosh();

  // once the closing section is on screen no chapter text should linger, even if the camera is still catching up
  if (entered) setChapter(scrollY > journeyEnd() ? -1 : chapterFor(p));

  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  fitDocs();
});

/* ---------------- boot: loader -> hero -> enter ---------------- */
globe.scale.setScalar(.001); atmo.scale.setScalar(.001);
camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
const prog = { v: 0 };
const showPct = () => { $('#pct').textContent = Math.round(prog.v) + '%'; };
manager.onProgress = (_, done, total) => gsap.to(prog, { v: 10 + 80 * done / total, duration: .4, onUpdate: showPct, overwrite: true });
const texturesReady = new Promise(res => { manager.onLoad = res; manager.onError = res; });
const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();
Promise.all([fontsReady, texturesReady]).then(() => {
  themed.forEach(f => f()); // repaint canvas text now that the fonts are in
  frame();
  gsap.timeline({ delay: .3 })
    .to(prog, { v: 100, duration: .4, onUpdate: showPct, overwrite: true })
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
      if (!regOpen) lenis?.start();
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
      // glide into chapter 01 so the journey starts on its own
      const max = journeyEnd();
      setTimeout(() => lenis ? lenis.scrollTo(scrollForStation(1) * max, { duration: 2.6 }) : scrollTo({ top: scrollForStation(1) * max, behavior: 'smooth' }), 50);
    });
};
