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
// a specimen identity card in the EU format (ID-1 size, TD1 machine-readable zone on the back), for the fictional state of Utopia
const ID = { surname: 'WANJIRU', given: 'AMINA GRACE', sex: 'F', nat: 'UTO', dob: '910314', exp: '311102', no: 'UT4812297' };
const fmtDate = d => `${d.slice(4)} ${d.slice(2, 4)} ${+d.slice(0, 2) > 40 ? 19 : 20}${d.slice(0, 2)}`;
// fields: [label, value, x, y, w] in card pixels (y is the value baseline)
const FIELDS = [
  ['SURNAME / NOM', ID.surname, 322, 216, 320], ['GIVEN NAMES / PRÉNOMS', ID.given, 322, 292, 400],
  ['SEX / SEXE', ID.sex, 322, 368, 120], ['NATIONALITY', ID.nat, 462, 368, 160], ['DATE OF BIRTH', fmtDate(ID.dob), 652, 368, 230],
  ['DOCUMENT NO.', ID.no, 322, 444, 250], ['DATE OF EXPIRY', fmtDate(ID.exp), 600, 444, 230],
];
// ICAO 9303 check digits, so the MRZ on the back is internally valid
const mrzVal = ch => /\d/.test(ch) ? +ch : ch === '<' ? 0 : ch.charCodeAt(0) - 55;
const chk = s => String([...s].reduce((a, ch, i) => a + mrzVal(ch) * [7, 3, 1][i % 3], 0) % 10);
const pad = (s, n) => (s + '<'.repeat(n)).slice(0, n);
const MRZ = (() => {
  const l1 = pad('ID' + 'UTO' + ID.no + chk(ID.no), 30);
  const opt = '<'.repeat(11);
  const mid = ID.dob + chk(ID.dob) + ID.sex + ID.exp + chk(ID.exp) + ID.nat + opt;
  const comp = l1.slice(5) + mid.slice(0, 7) + mid.slice(8, 15) + mid.slice(18, 29);
  return [l1, mid + chk(comp), pad(ID.surname + '<<' + ID.given.replace(/ /g, '<'), 30)];
})();
const INK = '#14213d', INK_DIM = 'rgba(20,33,61,.62)';
function cardBase(c, w, h, hues) {
  const r = 34;
  c.save(); c.beginPath(); c.roundRect(0, 0, w, h, r); c.clip();
  const g = c.createLinearGradient(0, 0, w, h);
  hues.forEach((col, i) => g.addColorStop(i / (hues.length - 1), col));
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  // guilloche: interleaved sine bands plus a rosette, the fine-line printing on real cards
  c.lineWidth = 1;
  for (let k = 0; k < 46; k++) {
    c.strokeStyle = k % 2 ? 'rgba(40,80,150,.13)' : 'rgba(170,60,120,.10)';
    c.beginPath();
    for (let x = 0; x <= w; x += 6) { const y = -20 + k * 15 + Math.sin(x / 46 + k * .45) * 11 + Math.sin(x / 13) * 2; x ? c.lineTo(x, y) : c.moveTo(x, y); }
    c.stroke();
  }
  c.strokeStyle = 'rgba(30,90,140,.09)';
  for (let k = 0; k < 36; k++) {
    c.beginPath();
    for (let a = 0; a <= 6.3; a += .03) { const rr = 70 + 60 * Math.sin(a * 6 + k * .17); const x = w * .8 + Math.cos(a + k * .09) * rr * 1.5, y = h * .6 + Math.sin(a + k * .09) * rr; a ? c.lineTo(x, y) : c.moveTo(x, y); }
    c.stroke();
  }
  c.restore();
}
function star(c, x, y, r) {
  c.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * .4 : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  c.closePath(); c.fill();
}
function euFlag(c, x, y, w, h, code) {
  c.fillStyle = '#003399'; c.beginPath(); c.roundRect(x, y, w, h, 6); c.fill();
  c.fillStyle = '#ffcc00';
  for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; star(c, x + w / 2 + Math.cos(a) * h * .34, y + h / 2 + Math.sin(a) * h * .34, h * .055); }
  c.fillStyle = '#ffffff'; c.font = `700 ${h * .3}px Sora`; c.textAlign = 'center'; c.fillText(code, x + w / 2, y + h / 2 + h * .11); c.textAlign = 'left';
}
function portrait(c, x, y, w, h, alpha = 1) {
  c.save(); c.globalAlpha = alpha;
  c.beginPath(); c.roundRect(x, y, w, h, 10); c.clip();
  const bg = c.createLinearGradient(x, y, x, y + h); bg.addColorStop(0, '#dfe5ea'); bg.addColorStop(1, '#c4ccd4');
  c.fillStyle = bg; c.fillRect(x, y, w, h);
  const cx = x + w / 2, s = w / 250;
  // shoulders and top
  c.fillStyle = '#3b4250'; c.beginPath(); c.ellipse(cx, y + h + 10 * s, 128 * s, 110 * s, 0, Math.PI, 0); c.fill();
  c.fillStyle = '#e8eaee'; c.beginPath(); c.moveTo(cx - 30 * s, y + h - 92 * s); c.lineTo(cx, y + h - 50 * s); c.lineTo(cx + 30 * s, y + h - 92 * s); c.fill();
  // neck and face
  const skin = c.createLinearGradient(cx - 60 * s, 0, cx + 60 * s, 0); skin.addColorStop(0, '#6e4a36'); skin.addColorStop(.5, '#8a5d42'); skin.addColorStop(1, '#5f3f2d');
  c.fillStyle = skin;
  c.fillRect(cx - 24 * s, y + 175 * s, 48 * s, 70 * s);
  c.beginPath(); c.ellipse(cx, y + 140 * s, 54 * s, 70 * s, 0, 0, Math.PI * 2); c.fill();
  // hair
  c.fillStyle = '#1b1514'; c.beginPath(); c.ellipse(cx, y + 104 * s, 66 * s, 52 * s, 0, Math.PI * .95, Math.PI * 2.05); c.fill();
  c.beginPath(); c.ellipse(cx, y + 92 * s, 60 * s, 34 * s, 0, 0, Math.PI * 2); c.fill();
  // features, kept soft so it reads as a photo at card size
  c.fillStyle = 'rgba(25,15,12,.75)';
  [[-20, 134], [20, 134]].forEach(([dx, dy]) => { c.beginPath(); c.ellipse(cx + dx * s, y + dy * s, 7 * s, 3.6 * s, 0, 0, 7); c.fill(); });
  c.strokeStyle = 'rgba(25,15,12,.5)'; c.lineWidth = 2.4 * s;
  c.beginPath(); c.moveTo(cx - 30 * s, y + 121 * s); c.quadraticCurveTo(cx - 20 * s, y + 116 * s, cx - 10 * s, y + 121 * s); c.moveTo(cx + 10 * s, y + 121 * s); c.quadraticCurveTo(cx + 20 * s, y + 116 * s, cx + 30 * s, y + 121 * s); c.stroke();
  c.beginPath(); c.moveTo(cx, y + 140 * s); c.lineTo(cx - 5 * s, y + 162 * s); c.lineTo(cx + 4 * s, y + 164 * s); c.stroke();
  c.strokeStyle = 'rgba(70,25,25,.7)'; c.lineWidth = 3.4 * s; c.beginPath(); c.moveTo(cx - 15 * s, y + 182 * s); c.quadraticCurveTo(cx, y + 188 * s, cx + 15 * s, y + 182 * s); c.stroke();
  c.restore();
}
function drawCard(c, w, h) {
  cardBase(c, w, h, ['#d7e4f1', '#eef0f6', '#f1dde6', '#dcefe5']);
  euFlag(c, 40, 30, 132, 88, 'UT');
  c.fillStyle = INK; c.font = '700 27px Sora'; c.fillText('REPUBLIC OF UTOPIA', 196, 64);
  c.fillStyle = INK_DIM; c.font = '500 19px Sora'; c.fillText('IDENTITY CARD  ·  CARTE D’IDENTITÉ', 196, 98);
  // specimen marking so the card can never pass for a real document
  c.save(); c.translate(w - 130, 74); c.rotate(-.08);
  c.strokeStyle = '#c0392b'; c.lineWidth = 3; c.strokeRect(-88, -26, 176, 44);
  c.fillStyle = '#c0392b'; c.font = '700 24px "IBM Plex Mono"'; c.textAlign = 'center'; c.fillText('SPECIMEN', 0, 6); c.restore();
  portrait(c, 40, 150, 250, 320);
  FIELDS.forEach(([l, v, x, y]) => {
    c.fillStyle = INK_DIM; c.font = '500 15px "IBM Plex Mono"'; c.fillText(l, x, y - 34);
    c.fillStyle = INK; c.font = '600 30px Sora'; c.fillText(v, x, y);
  });
  // signature
  c.fillStyle = INK_DIM; c.font = '500 15px "IBM Plex Mono"'; c.fillText('SIGNATURE', 40, 512);
  c.strokeStyle = '#1d2a6b'; c.lineWidth = 3; c.beginPath(); c.moveTo(48, 580);
  for (let i = 0; i <= 40; i++) { const x = 48 + i * 6; c.lineTo(x, 566 - Math.sin(i * .8) * 16 * (1 - i / 50) - Math.cos(i * .33) * 6); }
  c.stroke();
  // ghost image and card access number
  portrait(c, 870, 410, 112, 144, .35);
  c.fillStyle = INK_DIM; c.font = '500 15px "IBM Plex Mono"'; c.fillText('CAN', 322, 520);
  c.fillStyle = INK; c.font = '600 26px "IBM Plex Mono"'; c.fillText('482917', 322, 554);
  c.fillStyle = 'rgba(20,33,61,.08)'; c.font = '800 220px Sora'; c.fillText('UT', 560, 620);
}
function drawCardBack(c, w, h) {
  cardBase(c, w, h, ['#e9e3f2', '#dfeaf3', '#e6f1e2', '#f2e6dc']);
  // contact chip
  const cg = c.createLinearGradient(56, 60, 176, 150); cg.addColorStop(0, '#f2d27a'); cg.addColorStop(.5, '#c99a32'); cg.addColorStop(1, '#f0cf6c');
  c.fillStyle = cg; c.beginPath(); c.roundRect(56, 60, 120, 92, 16); c.fill();
  c.strokeStyle = 'rgba(90,60,10,.55)'; c.lineWidth = 2;
  c.beginPath(); c.moveTo(56, 92); c.lineTo(96, 92); c.lineTo(96, 120); c.lineTo(56, 120); c.moveTo(176, 92); c.lineTo(136, 92); c.lineTo(136, 120); c.lineTo(176, 120); c.moveTo(116, 60); c.lineTo(116, 92); c.moveTo(116, 120); c.lineTo(116, 152); c.stroke();
  const rows = [['ADDRESS / ADRESSE', 'HSE 14, RIVERSIDE DRIVE, NAIROBI'], ['DATE OF ISSUE', '03 11 2021'], ['AUTHORITY', 'MINISTRY OF INTERIOR'], ['HEIGHT', '168 CM']];
  rows.forEach(([l, v], i) => {
    const x = i ? 232 + (i - 1) * 0 : 232, y = 70 + i * 66;
    c.fillStyle = INK_DIM; c.font = '500 15px "IBM Plex Mono"'; c.fillText(l, x, y);
    c.fillStyle = INK; c.font = '600 25px Sora'; c.fillText(v, x, y + 32);
  });
  // MRZ band
  c.fillStyle = 'rgba(255,255,255,.72)'; c.fillRect(0, 404, w, h - 404);
  c.fillStyle = '#111'; c.font = '500 46px "IBM Plex Mono"';
  MRZ.forEach((l, i) => c.fillText(l, 44, 476 + i * 56));
}
const OV = '#0b8f80', OVA = '#d0661a';
function bracket(c, x, y, bw, bh, col, s = 14) {
  c.strokeStyle = col; c.lineWidth = 4; c.beginPath();
  c.moveTo(x, y + s); c.lineTo(x, y); c.lineTo(x + s, y); c.moveTo(x + bw - s, y); c.lineTo(x + bw, y); c.lineTo(x + bw, y + s);
  c.moveTo(x + bw, y + bh - s); c.lineTo(x + bw, y + bh); c.lineTo(x + bw - s, y + bh); c.moveTo(x + s, y + bh); c.lineTo(x, y + bh); c.lineTo(x, y + bh - s); c.stroke();
}
const tick = (c, x, y, col) => { c.strokeStyle = col; c.lineWidth = 4; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 7, y + 7); c.lineTo(x + 19, y - 7); c.stroke(); };
// OCR / verification overlay drawn on top of the card front as the check runs
function drawScan(c, w, h, v = doc.v) {
  FIELDS.forEach(([, , x, y, fw], i) => {
    const t0 = .05 + i * .06;
    if (v < t0) return;
    c.globalAlpha = Math.min(1, (v - t0) / .05);
    c.fillStyle = OV + '1f'; c.fillRect(x - 10, y - 58, fw, 72);
    bracket(c, x - 10, y - 58, fw, 72, OV);
    if (v > t0 + .07) tick(c, x + fw - 36, y - 30, OV);
    c.globalAlpha = 1;
  });
  if (v > .48) { // face landmarks
    c.globalAlpha = Math.min(1, (v - .48) / .07);
    bracket(c, 76, 196, 178, 214, OVA, 22);
    c.fillStyle = OVA;
    [[145, 284], [185, 284], [165, 312], [152, 332], [178, 332], [165, 252], [118, 296], [212, 296]].forEach(([x, y]) => { c.beginPath(); c.arc(x, y, 4, 0, 7); c.fill(); });
    c.font = '600 19px "IBM Plex Mono"'; c.fillText('FACE MATCH 98.4%', 62, 186);
    c.globalAlpha = 1;
  }
}
// on the back: the machine-readable zone is read and its check digits verified
function drawScanBack(c, w, h, v = doc.v) {
  if (v < .72) return;
  c.globalAlpha = Math.min(1, (v - .72) / .06);
  c.fillStyle = OV + '1a'; c.fillRect(30, 418, w - 60, 196);
  bracket(c, 30, 418, w - 60, 196, OV);
  c.fillStyle = OV; c.font = '600 19px "IBM Plex Mono"'; c.fillText('MRZ · CHECK DIGITS VALID', 44, 404);
  if (v > .8) tick(c, w - 76, 400, OV);
  c.globalAlpha = 1;
}
const CHECKS = [['Data extracted', .4], ['Security features', .46], ['Face match 98.4%', .56], ['Not expired', .62], ['MRZ checksum valid', .82], ['Proof of address', .94]];
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
const cardBackTex = canvasTex(CARD_W, CARD_H, drawCardBack);
const scanTex = canvasTex(CARD_W, CARD_H, drawScan);
const scanBackTex = canvasTex(CARD_W, CARD_H, drawScanBack);
const checkTex = canvasTex(620, 560, drawChecklist);
const billTex = canvasTex(640, 860, drawBill);
// the card: rounded polycarbonate body, printed faces with a holographic layer that shifts with the viewing angle
const idCard = new THREE.Group(); docs.add(idCard);
const cardFlip = new THREE.Group(); idCard.add(cardFlip);
const CW = 3.4, CH = CW * CARD_H / CARD_W, CD = .03;
const holoMats = [];
{
  const r = CW * 34 / CARD_W, s = new THREE.Shape();
  s.moveTo(-CW / 2 + r, -CH / 2); s.lineTo(CW / 2 - r, -CH / 2); s.quadraticCurveTo(CW / 2, -CH / 2, CW / 2, -CH / 2 + r);
  s.lineTo(CW / 2, CH / 2 - r); s.quadraticCurveTo(CW / 2, CH / 2, CW / 2 - r, CH / 2); s.lineTo(-CW / 2 + r, CH / 2);
  s.quadraticCurveTo(-CW / 2, CH / 2, -CW / 2, CH / 2 - r); s.lineTo(-CW / 2, -CH / 2 + r); s.quadraticCurveTo(-CW / 2, -CH / 2, -CW / 2 + r, -CH / 2);
  const edgeGeo = new THREE.ExtrudeGeometry(s, { depth: CD, bevelEnabled: false, curveSegments: 10 });
  edgeGeo.translate(0, 0, -CD / 2);
  const edge = new THREE.Mesh(edgeGeo, [new THREE.MeshBasicMaterial({ visible: false }), new THREE.MeshStandardMaterial({ color: 0xd9dee4, roughness: .35, metalness: .1 })]);
  cardFlip.add(edge);
  const faceGeo = new THREE.ShapeGeometry(s, 10), pos = faceGeo.attributes.position, uv = faceGeo.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / CW + .5, pos.getY(i) / CH + .5);
  const face = (map, back) => {
    const m = new THREE.ShaderMaterial({
      uniforms: { map: { value: map }, t: { value: 0 }, seed: { value: back ? 3.1 : 0 } },
      vertexShader: `varying vec2 vU; varying vec3 vN, vV;
        void main(){ vU=uv; vec4 w=modelMatrix*vec4(position,1.); vN=normalize(mat3(modelMatrix)*normal); vV=normalize(cameraPosition-w.xyz); gl_Position=projectionMatrix*viewMatrix*w; }`,
      fragmentShader: `uniform sampler2D map; uniform float t, seed; varying vec2 vU; varying vec3 vN, vV;
        void main(){
          vec4 base=texture2D(map,vU);
          vec3 N=normalize(vN), V=normalize(vV), L=normalize(vec3(.5,.7,1.));
          float lit=.82+.28*max(dot(N,L),0.);
          float facing=clamp(dot(N,V),0.,1.);
          // holographic foil: rings around the ghost image and a diagonal wave, colour shifting with the angle
          vec2 q=vU*vec2(1.585,1.);
          float ring=smoothstep(.55,1.,sin(length(q-vec2(1.45,.26))*70.))*smoothstep(.55,.1,length(q-vec2(1.45,.26)));
          float wave=smoothstep(.75,1.,sin((q.x+q.y*.6)*24.+sin(q.y*9.+seed)*1.5))*.45;
          float hue=fract(q.x*.6+q.y*.4+(1.-facing)*2.4+t*.04+seed);
          vec3 rainbow=.5+.5*cos(6.2832*(hue+vec3(0.,.33,.67)));
          float sheen=(ring+wave)*(.18+.9*pow(1.-facing,1.3));
          float spec=pow(max(dot(reflect(-L,N),V),0.),60.)*.35;
          gl_FragColor=vec4(base.rgb*lit+rainbow*sheen*.24+spec,base.a);
        }`,
      transparent: true,
    });
    holoMats.push(m);
    const mesh = new THREE.Mesh(faceGeo, m);
    if (back) { mesh.rotation.y = Math.PI; mesh.position.z = -CD / 2 - .001; } else mesh.position.z = CD / 2 + .001;
    return mesh;
  };
  cardFlip.add(face(cardTex, false), face(cardBackTex, true));
  const overlay = new THREE.Mesh(new THREE.PlaneGeometry(CW, CH), new THREE.MeshBasicMaterial({ map: scanTex, transparent: true, depthWrite: false }));
  overlay.position.z = CD / 2 + .01; cardFlip.add(overlay);
  const overlayBack = new THREE.Mesh(new THREE.PlaneGeometry(CW, CH), new THREE.MeshBasicMaterial({ map: scanBackTex, transparent: true, depthWrite: false }));
  overlayBack.rotation.y = Math.PI; overlayBack.position.z = -CD / 2 - .01; cardFlip.add(overlayBack);
}
// the check turns the card over to read the back, then returns it face up
const flipAt = v => { const k = x => Math.min(1, Math.max(0, x)), e = x => x * x * (3 - 2 * x); return e(k((v - .6) / .1)) - e(k((v - .88) / .08)); };
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
checklist.position.set(2.05, 1.55, .7); checklist.rotation.y = -.28; checklist.scale.setScalar(.85); docs.add(checklist);
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

/* ================= STATION 5: alerts over a night city ================= */
const S3 = new THREE.Vector3(0, -8, -187);
const grid = new THREE.Group(); grid.position.copy(S3); scene.add(grid);
// city blocks: 3-unit cells, every 5th row and column is a street; tall downtown around DT, low-rise further out
const CELL = 3, DT = new THREE.Vector2(2, -24);
const lots = [];
for (let i = -15; i <= 15; i++) for (let j = -22; j <= 2; j++) {
  if (i % 5 === 0 || j % 5 === 0) continue;
  const x = i * CELL, z = j * CELL, d2 = (x - DT.x) ** 2 + (z - DT.y) ** 2;
  const tall = Math.exp(-d2 / 520);
  const h = 1.2 + Math.random() * 2.2 + Math.pow(Math.random(), 1.4) * 22 * tall + (Math.random() < .05 ? rand(4, 9) : 0);
  lots.push({ x: x + rand(-.25, .25), z: z + rand(-.25, .25), w: rand(2, 2.6), d: rand(2, 2.6), h });
}
// procedural facades: windows come from world position, so any building size gets evenly spaced floors
const cityMat = new THREE.ShaderMaterial({
  uniforms: { fogC: { value: new THREE.Color(P.bg) }, fogD: { value: scene.fog.density }, rim: { value: new THREE.Color(P.tealHex) } },
  vertexShader: `varying vec3 vW; varying vec3 vN; varying float vSeed; varying float vH;
    void main(){ mat4 m=modelMatrix*instanceMatrix; vec4 w=m*vec4(position,1.); vW=w.xyz; vN=normalize(mat3(m)*normal);
      vSeed=instanceMatrix[3].x*12.9898+instanceMatrix[3].z*78.233; vH=position.y+.5; gl_Position=projectionMatrix*viewMatrix*w; }`,
  fragmentShader: `uniform vec3 fogC, rim; uniform float fogD; varying vec3 vW; varying vec3 vN; varying float vSeed; varying float vH;
    float hsh(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
    void main(){
      float d=length(vW-cameraPosition);
      vec3 col=vec3(.018,.04,.045)*(.7+.5*max(dot(vN,normalize(vec3(-.4,.7,.5))),0.));
      if(vN.y>.5){ col=vec3(.03,.06,.062); }
      else {
        float u=abs(vN.x)>.5?vW.z:vW.x; vec2 g=vec2(u*2.4,vW.y*2.8); vec2 c=floor(g), f=fract(g);
        float win=step(.2,f.x)*step(f.x,.78)*step(.25,f.y)*step(f.y,.72);
        float r=hsh(c+vSeed), lit=step(.66,r);
        vec3 wc=mix(vec3(1.,.76,.42),vec3(.72,.95,1.),step(.86,r))*(.45+.55*hsh(c*1.7+vSeed));
        vec3 w=mix(vec3(.03,.075,.085),wc,lit);
        float far=smoothstep(55.,110.,d);
        col+=mix(win*w, w*.32, far);
        col+=rim*smoothstep(.975,1.,vH)*.9;
      }
      col=mix(col,fogC,1.-exp(-fogD*fogD*d*d));
      gl_FragColor=vec4(col,1.);
    }`,
});
{
  const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), cityMat, lots.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion();
  lots.forEach((l, i) => { m.compose(new THREE.Vector3(l.x, l.h / 2, l.z), q, new THREE.Vector3(l.w, l.h, l.d)); inst.setMatrixAt(i, m); });
  grid.add(inst);
}
const ground = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), new THREE.MeshBasicMaterial({ color: 0x020807 }));
ground.rotation.x = -Math.PI / 2; ground.position.set(0, -.01, -30); grid.add(ground);
// street lights along every street, and traffic moving on them
const streetsX = [], streetsZ = [];
for (let i = -15; i <= 15; i++) if (i % 5 === 0) streetsX.push(i * CELL);
for (let j = -22; j <= 2; j++) if (j % 5 === 0) streetsZ.push(j * CELL);
{
  const seg = [];
  streetsX.forEach(x => seg.push(x, .03, -70, x, .03, 8));
  streetsZ.forEach(z => seg.push(-47, .03, z, 47, .03, z));
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(seg, 3));
  grid.add(new THREE.LineSegments(g, glow(new THREE.LineBasicMaterial({ color: P.tealHex, transparent: true, opacity: .28 }))));
}
const cars = [];
for (let i = 0; i < 260; i++) {
  const alongZ = Math.random() < .5;
  const lane = alongZ ? streetsX[(Math.random() * streetsX.length) | 0] : streetsZ[(Math.random() * streetsZ.length) | 0];
  const dir = Math.random() < .5 ? 1 : -1;
  cars.push({ alongZ, lane: lane + dir * .35, dir, t: Math.random(), speed: rand(.025, .06), warm: dir > 0 });
}
const carPos = new Float32Array(cars.length * 3), carCol = new Float32Array(cars.length * 3);
cars.forEach((c, i) => { const col = c.warm ? [1, .62, .3] : [.9, .97, 1]; carCol.set(col, i * 3); });
const carGeo = new THREE.BufferGeometry();
carGeo.setAttribute('position', new THREE.BufferAttribute(carPos, 3)); carGeo.setAttribute('color', new THREE.BufferAttribute(carCol, 3));
grid.add(new THREE.Points(carGeo, glow(new THREE.PointsMaterial({ size: .16, vertexColors: true, transparent: true, opacity: .95, depthWrite: false }))));
function moveCars(dt) {
  cars.forEach((c, i) => {
    c.t = (c.t + c.speed * dt * c.dir + 1) % 1;
    const a = c.alongZ ? -70 + c.t * 78 : -47 + c.t * 94;
    if (c.alongZ) carPos.set([c.lane, .12, a], i * 3); else carPos.set([a, .12, c.lane], i * 3);
  });
  carGeo.attributes.position.needsUpdate = true;
}
// the case: one node floating above downtown that escalated alerts link into
const CASE_AT = new THREE.Vector3(DT.x, 22, DT.y);
const caseNode = new THREE.Mesh(new THREE.OctahedronGeometry(1.5), new THREE.MeshBasicMaterial({ wireframe: true }));
caseNode.position.copy(CASE_AT); grid.add(caseNode);
const caseCore = new THREE.Mesh(new THREE.OctahedronGeometry(.75), new THREE.MeshBasicMaterial()); caseCore.position.copy(CASE_AT); grid.add(caseCore);
themed.push(() => { caseNode.material.color.setHex(P.tealHex); caseCore.material.color.setHex(P.pulse); });
// alerts: beams of light rising from rooftops, coloured by severity
const beacons = [];
const beamMat = () => glow(new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
const roofs = lots.filter(l => l.h > 3.5 && Math.hypot(l.x - DT.x, l.z - DT.y) < 34).sort(() => Math.random() - .5).slice(0, 24);
roofs.forEach(l => {
  const sev = Math.random(), level = sev > .78 ? 'red' : sev > .42 ? 'amber' : 'teal';
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(.05, .2, 7, 8, 1, true), beamMat()); beam.position.set(l.x, l.h + 3.5, l.z);
  const pad = new THREE.Mesh(new THREE.PlaneGeometry(l.w * .9, l.d * .9), beamMat()); pad.rotation.x = -Math.PI / 2; pad.position.set(l.x, l.h + .03, l.z);
  const link = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(l.x, l.h + .1, l.z), CASE_AT]),
    glow(new THREE.LineBasicMaterial({ transparent: true, opacity: 0 })));
  grid.add(beam, pad, link);
  beacons.push({ beam, pad, link, level, phase: rand(0, 6), escalate: level !== 'teal' });
});
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
  { pos: [-4, 10, -156], look: [2, .5, -205], shift: [-3, 0] }, // 05 alerts over the city
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
  if (ch === 1) gsap.fromTo(doc, { v: 0 }, { v: 1, duration: 5.2, ease: 'none', overwrite: true });
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
    if (q !== doc.q) { doc.q = q; scanTex.repaint(); scanBackTex.repaint(); checkTex.repaint(); }
    const flip = flipAt(doc.v);
    cardFlip.rotation.y = flip * Math.PI;
    holoMats.forEach(m => { m.uniforms.t.value = t; });
    const running = doc.v > 0 && doc.v < .92 && (flip < .02 || flip > .98);
    docBeamMat.uniforms.k.value += ((running ? 1 : 0) - docBeamMat.uniforms.k.value) * Math.min(1, dt * 5);
    docBeam.position.x = docLine.position.x = Math.sin(t * 1.6) * 1.55;
    docLine.material.opacity = docBeamMat.uniforms.k.value;
    idCard.position.y = -.35 + Math.sin(t * .7) * .05; idCard.rotation.y = .28 + Math.sin(t * .4) * .06;
    checklist.position.y = 1.55 + Math.sin(t * .6 + 1) * .05;
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
  if (grid.visible) moveCars(dt);
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
  if (entered) { setChapter(scrollY > journeyEnd() ? -1 : chapterFor(p)); heroFollow(p); }

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

/* the hero stays in the page: scrolling back to the globe brings INITIATE SCAN back, and pressing it runs the journey again */
let heroOn = true, gliding = false;
function glideTo(k) {
  const top = scrollForStation(k) * journeyEnd();
  gliding = true;
  if (lenis) lenis.scrollTo(top, { duration: 2.6, onComplete: () => { gliding = false; } });
  else { scrollTo({ top, behavior: 'smooth' }); setTimeout(() => { gliding = false; }, 2600); }
}
function setHero(on) {
  if (on === heroOn) return;
  heroOn = on;
  gsap.killTweensOf('#hero > *');
  if (on) {
    gsap.set('#hero', { autoAlpha: 1 });
    gsap.fromTo('#hero > *', { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, stagger: .1, duration: .9, ease: 'power3.out' });
    gsap.to('#rail', { opacity: 0, duration: .5, overwrite: true });
  } else {
    gsap.to('#hero > *', { autoAlpha: 0, y: -18, stagger: .05, duration: .45, ease: 'power2.in', onComplete: () => { if (!heroOn) gsap.set('#hero', { autoAlpha: 0 }); } });
    gsap.to('#rail', { opacity: 1, duration: 1, overwrite: true });
  }
}
// called every frame once the journey has started: show the hero near the globe, hide it as soon as the camera leaves
function heroFollow(p) {
  if (gliding || regOpen) return;
  if (!heroOn && p < .12 && scrollY < 40) setHero(true);
  else if (heroOn && p > .3) setHero(false);
}

$('#start').onclick = () => {
  if (!ac) startAudio();
  blip();
  setHero(false);
  if (entered) { glideTo(1); return; }
  gliding = true;
  gsap.delayedCall(.55, () => {
    document.body.classList.add('live');
    scrollTo(0, 0);
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
    setTimeout(() => glideTo(1), 50);
  });
};
