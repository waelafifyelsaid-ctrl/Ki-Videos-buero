// Rendert eine 3D-Seite (Three.js) Bild für Bild mit Headless-Chromium.
//   node render3d.js bild  <seite.html relativ zum Repo> <t> <out.png>
//   node render3d.js video <seite.html> <dauer_s> <worker> <ausgabe_ordner>
// Die Seite muss window.bereit = true setzen und window.renderFrame(t) anbieten.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path'), { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const TYP = { '.js': 'text/javascript', '.html': 'text/html', '.json': 'application/json', '.png': 'image/png', '.css': 'text/css' };

function server() {
  return new Promise(res => {
    const s = http.createServer((q, r) => {
      let p = decodeURIComponent(q.url.split('?')[0]);
      if (p.startsWith('/three/')) p = '/tools/node_modules/three/' + p.slice(7);
      const f = path.join(ROOT, p);
      if (!f.startsWith(ROOT)) { r.writeHead(403); r.end(); return; }
      fs.readFile(f, (e, d) => {
        if (e) { r.writeHead(404); r.end(); return; }
        r.writeHead(200, { 'Content-Type': TYP[path.extname(f)] || 'application/octet-stream' }); r.end(d);
      });
    });
    s.listen(0, () => res(s));
  });
}

async function seiteOeffnen(port, seite) {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  p.on('pageerror', e => { console.error('SEITENFEHLER', e.message); process.exitCode = 1; });
  p.on('console', m => { if (m.type() === 'error') console.error('KONSOLE', m.text()); });
  await p.goto(`http://localhost:${port}/${seite}`);
  await p.waitForFunction('window.bereit === true', null, { timeout: 120000 });
  return { b, p };
}

async function bild(seite, t, out) {
  const s = await server();
  const { b, p } = await seiteOeffnen(s.address().port, seite);
  await p.evaluate(async t => { await window.renderFrame(t); }, t);
  await p.screenshot({ path: out });
  await b.close(); s.close();
}

async function worker(port, seite, a, e, datei) {
  const { b, p } = await seiteOeffnen(port, seite);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', '30', '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', datei], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let i = a; i < e; i++) {
    await p.evaluate(async t => { await window.renderFrame(t); }, i / 30);
    const jpg = await p.screenshot({ type: 'jpeg', quality: 92 });
    if (!ff.stdin.write(jpg)) await new Promise(r => ff.stdin.once('drain', r));
    if ((i - a) % 60 === 0) console.log(`  ${path.basename(datei)}: ${i - a}/${e - a}`);
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  await b.close();
}

async function video(seite, dauer, n, ordner) {
  const s = await server();
  const port = s.address().port;
  const frames = Math.round(dauer * 30);
  fs.mkdirSync(ordner, { recursive: true });
  const jobs = [], teile = [];
  for (let k = 0; k < n; k++) {
    const a = Math.floor(frames * k / n), e = Math.floor(frames * (k + 1) / n);
    const datei = path.join(ordner, `teil${k}.mp4`); teile.push(datei);
    jobs.push(worker(port, seite, a, e, datei));
  }
  await Promise.all(jobs);
  fs.writeFileSync(path.join(ordner, 'liste.txt'), teile.map(t => `file '${path.basename(t)}'`).join('\n'));
  s.close();
}

async function bilder(seite, zeiten, ordner) {
  const s = await server();
  const { b, p } = await seiteOeffnen(s.address().port, seite);
  fs.mkdirSync(ordner, { recursive: true });
  for (const t of zeiten) {
    await p.evaluate(async t => { await window.renderFrame(t); }, t);
    await p.screenshot({ path: path.join(ordner, `t_${t.toFixed(2)}.png`) });
  }
  await b.close(); s.close();
}

const [cmd, ...a] = process.argv.slice(2);
if (cmd === 'bild') bild(a[0], parseFloat(a[1]), a[2]);
else if (cmd === 'bilder') bilder(a[0], a[1].split(',').map(Number), a[2]);
else if (cmd === 'video') video(a[0], parseFloat(a[1]), parseInt(a[2]), a[3]);
else console.log('bild | video');
