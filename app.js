// ====== Configuración ======
const N = 6000; // cantidad de partículas (baja a 3000 si tu PC va lento)
const canvas = document.getElementById('scene');
const ctx = canvas.getContext('2d');
const video = document.getElementById('cam');
const preview = document.getElementById('preview');
const pctx = preview.getContext('2d');
const gestoEl = document.getElementById('gesto');

function resize() { canvas.width = innerWidth; canvas.height = innerHeight; }
addEventListener('resize', resize); resize();

// ====== Generadores de formas (devuelven x,y,z,r,g,b por partícula) ======
const rnd = (a, b) => a + Math.random() * (b - a);
function puntoEsfera(r) {
  const u = Math.random() * 2 - 1, t = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u);
  return [r * s * Math.cos(t), r * u, r * s * Math.sin(t)];
}

function formaGalaxia(i) {
  const [x, y, z] = [rnd(-2.2, 2.2), rnd(-1.6, 1.6), rnd(-1.5, 1.5)];
  const b = rnd(120, 255);
  return [x, y, z, 60, 100 + b * 0.3, b];
}
function formaEsfera(i) {
  const [x, y, z] = puntoEsfera(1.1 * Math.cbrt(Math.random()) );
  return [x, y, z, 255, rnd(30, 70), rnd(70, 110)];
}
function formaPlaneta(i) {
  if (i < N * 0.55) {
    const [x, y, z] = puntoEsfera(0.9);
    return [x, y, z, 255, rnd(120, 160), 30];
  }
  const a = Math.random() * Math.PI * 2, r = rnd(1.25, 2.3);
  const x = Math.cos(a) * r, z = Math.sin(a) * r;
  const y = x * 0.25 + rnd(-0.03, 0.03); // anillo inclinado
  return [x, y, z * 0.9, 255, rnd(150, 190), rnd(40, 90)];
}
function formaBanda(i) {
  return [rnd(-2.4, 2.4), rnd(-0.12, 0.12), rnd(-0.25, 0.25), 20, rnd(190, 230), 255];
}
function formaCorazon(i) {
  const t = Math.random() * Math.PI * 2;
  const x = 16 * Math.pow(Math.sin(t), 3);
  const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
  const k = 0.12;
  return [x * k + rnd(-.03, .03), -y * k + rnd(-.03, .03), rnd(-0.15, 0.15), 255, rnd(30, 80), rnd(100, 150)];
}

// Texto "I LOVE YOU" muestreado desde un canvas oculto
function crearFormaTexto(texto) {
  const c = document.createElement('canvas'); c.width = 700; c.height = 200;
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.font = 'bold 120px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(texto, 350, 100);
  const d = g.getImageData(0, 0, 700, 200).data, pts = [];
  for (let y = 0; y < 200; y += 2) for (let x = 0; x < 700; x += 2)
    if (d[(y * 700 + x) * 4 + 3] > 128) pts.push([(x - 350) / 140, (y - 100) / 140]);
  return () => {
    const p = pts[(Math.random() * pts.length) | 0];
    return [p[0] + rnd(-.01, .01), p[1], rnd(-0.05, 0.05), 40, rnd(200, 240), 255];
  };
}
const formaTexto = crearFormaTexto('I LOVE YOU');

const FORMAS = {
  5: { nombre: '🖐️ Galaxia azul', f: formaGalaxia },
  0: { nombre: '✊ Esfera roja', f: formaEsfera },
  1: { nombre: '☝️ Planeta con anillos', f: formaPlaneta },
  2: { nombre: '✌️ Banda cian', f: formaBanda },
  3: { nombre: '🤟 I LOVE YOU', f: formaTexto },
  4: { nombre: '🖖 Corazón', f: formaCorazon },
};

// ====== Partículas ======
const P = new Float32Array(N * 3);   // posición actual
const T = new Float32Array(N * 3);   // objetivo
const C = new Float32Array(N * 3);   // color actual
const CT = new Float32Array(N * 3);  // color objetivo
for (let i = 0; i < N; i++) { P[i*3] = rnd(-3,3); P[i*3+1] = rnd(-2,2); P[i*3+2] = rnd(-3,3); C[i*3+2] = 255; }

let formaActual = -1;
function setForma(k) {
  if (k === formaActual || !FORMAS[k]) return;
  formaActual = k;
  gestoEl.textContent = FORMAS[k].nombre;
  for (let i = 0; i < N; i++) {
    const [x, y, z, r, g, b] = FORMAS[k].f(i);
    T[i*3] = x; T[i*3+1] = y; T[i*3+2] = z;
    CT[i*3] = r; CT[i*3+1] = g; CT[i*3+2] = b;
  }
}
setForma(5);

// ====== Control con la mano ======
let rotY = 0, rotX = 0, zoom = 1;
let objRotY = 0, objRotX = 0, objZoom = 1;
let candidato = -1, framesCandidato = 0; // estabiliza el gesto

function contarDedos(lm) {
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  let n = 0;
  [[8, 6], [12, 10], [16, 14], [20, 18]].forEach(([tip, pip]) => {
    if (dist(lm[tip], lm[0]) > dist(lm[pip], lm[0]) * 1.1) n++;
  });
  if (dist(lm[4], lm[17]) > dist(lm[3], lm[17]) * 1.05 && dist(lm[4], lm[5]) > 0.07) n++;
  return n;
}

function onResults(res) {
  pctx.save(); pctx.clearRect(0, 0, preview.width, preview.height);
  pctx.drawImage(res.image, 0, 0, preview.width, preview.height);
  if (res.multiHandLandmarks && res.multiHandLandmarks.length) {
    const lm = res.multiHandLandmarks[0];
    if (window.drawConnectors) {
      drawConnectors(pctx, lm, HAND_CONNECTIONS, { color: '#00e5ff', lineWidth: 2 });
      drawLandmarks(pctx, lm, { color: '#ff4081', radius: 2 });
    }
    const dedos = contarDedos(lm);
    if (dedos === candidato) framesCandidato++; else { candidato = dedos; framesCandidato = 0; }
    if (framesCandidato > 4) setForma(dedos);

    // posición de la palma -> rotación ; tamaño de la mano -> zoom
    objRotY = (0.5 - lm[9].x) * 4;
    objRotX = (lm[9].y - 0.5) * 3;
    const tam = Math.hypot(lm[0].x - lm[9].x, lm[0].y - lm[9].y);
    objZoom = Math.min(2.2, Math.max(0.6, tam * 5));
  }
  pctx.restore();
}

async function iniciarCamara() {
  if (!window.Hands) { gestoEl.textContent = 'No cargó MediaPipe (revisa tu internet)'; return; }
  const hands = new Hands({ locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${f}` });
  hands.setOptions({ maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: 0.6, minTrackingConfidence: 0.5 });
  hands.onResults(onResults);
  const cam = new Camera(video, { onFrame: async () => { await hands.send({ image: video }); }, width: 640, height: 480 });
  cam.start().catch(() => gestoEl.textContent = 'Permite el acceso a la cámara');
}
iniciarCamara();

// ====== Render ======
let t0 = 0;
function loop(t) {
  const dt = Math.min(0.05, (t - t0) / 1000 || 0.016); t0 = t;
  rotY += (objRotY - rotY) * 0.08 + 0.002;   // giro lento automático
  rotX += (objRotX - rotX) * 0.08;
  zoom += (objZoom - zoom) * 0.08;

  const cy = Math.cos(rotY), sy = Math.sin(rotY), cx = Math.cos(rotX), sx = Math.sin(rotX);
  const W = canvas.width, H = canvas.height, esc = Math.min(W, H) * 0.28 * zoom;

  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = 'rgba(0,0,0,0.28)';   // estela
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'lighter';

  const vel = 4.5 * dt + 0.02;
  for (let i = 0; i < N; i++) {
    const k = i * 3;
    // mover hacia el objetivo con un poco de ruido (efecto "vivo")
    P[k]   += (T[k]   - P[k])   * vel + (Math.random() - .5) * 0.004;
    P[k+1] += (T[k+1] - P[k+1]) * vel + (Math.random() - .5) * 0.004;
    P[k+2] += (T[k+2] - P[k+2]) * vel + (Math.random() - .5) * 0.004;
    C[k]   += (CT[k]   - C[k])   * 0.06;
    C[k+1] += (CT[k+1] - C[k+1]) * 0.06;
    C[k+2] += (CT[k+2] - C[k+2]) * 0.06;

    // rotación Y y X
    let x = P[k] * cy + P[k+2] * sy, z = -P[k] * sy + P[k+2] * cy, y = P[k+1];
    const y2 = y * cx - z * sx; z = y * sx + z * cx; y = y2;

    const p = 4 / (4 + z);                  // perspectiva
    const px = W / 2 + x * esc * p, py = H / 2 + y * esc * p;
    const s = Math.max(0.6, 1.9 * p);
    ctx.fillStyle = `rgba(${C[k]|0},${C[k+1]|0},${C[k+2]|0},${Math.min(1, 0.35 + p * 0.45)})`;
    ctx.fillRect(px, py, s, s);
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
