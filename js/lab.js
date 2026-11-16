/* =========================================================================
   Project Lab — small in-browser demos that open from a project card's
   "Live demo" button. Vanilla JS, no dependencies. Copy follows <html lang>.
     slam      LiDAR + occupancy-grid mapping simulation
     biscuit   draw a biscuit → contour features → shape / type
     text      TextSmith-style live text statistics + sentiment
     pipeline  Airflow-style DAG run of the Spark e-commerce pipeline
   ========================================================================= */
(() => {
    'use strict';

    const TR = (document.documentElement.lang || '').toLowerCase().startsWith('tr');
    const t = (en, tr) => (TR ? tr : en);
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const esc = s => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    function fitCanvas(canvas, w, h) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        const ctx = canvas.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        return ctx;
    }

    /* =================================================================
       Modal shell
       ================================================================= */
    let open = null;

    function openLab(id, trigger) {
        const demo = DEMOS[id];
        if (!demo) return;
        if (open) closeLab();

        const wrap = document.createElement('div');
        wrap.className = 'lab';
        wrap.innerHTML = `
            <div class="lab__backdrop" data-close></div>
            <div class="lab__panel" role="dialog" aria-modal="true" aria-labelledby="labTitle">
                <header class="lab__head">
                    <div>
                        <span class="lab__kicker"><i class="fas fa-flask"></i> ${t('Live demo', 'Canlı demo')}</span>
                        <h3 id="labTitle">${demo.title}</h3>
                        <p>${demo.sub}</p>
                    </div>
                    <button type="button" class="lab__close" data-close aria-label="${t('Close', 'Kapat')}">
                        <i class="fas fa-times"></i>
                    </button>
                </header>
                <div class="lab__body"></div>
                <footer class="lab__note"><i class="fas fa-info-circle"></i> ${demo.note}</footer>
            </div>`;
        document.body.appendChild(wrap);
        document.body.classList.add('lab-open');

        const body = wrap.querySelector('.lab__body');
        const onKey = e => { if (e.key === 'Escape') closeLab(); };
        wrap.addEventListener('click', e => { if (e.target.closest('[data-close]')) closeLab(); });
        document.addEventListener('keydown', onKey);

        requestAnimationFrame(() => wrap.classList.add('show'));
        const cleanup = demo.mount(body) || (() => {});
        open = { wrap, cleanup, trigger, onKey };
        wrap.querySelector('.lab__close').focus({ preventScroll: true });
    }

    function closeLab() {
        if (!open) return;
        const { wrap, cleanup, trigger, onKey } = open;
        open = null;
        cleanup();
        document.removeEventListener('keydown', onKey);
        document.body.classList.remove('lab-open');
        wrap.classList.remove('show');
        setTimeout(() => wrap.remove(), 250);
        trigger?.focus({ preventScroll: true });
    }

    document.addEventListener('click', e => {
        const btn = e.target.closest('[data-demo]');
        if (btn) openLab(btn.dataset.demo, btn);
    });

    /* =================================================================
       1) LiDAR + occupancy-grid mapping
       ================================================================= */
    function mountSlam(root) {
        root.innerHTML = `
            <div class="slam">
                <figure class="slam__view">
                    <figcaption>${t('World · robot + LiDAR', 'Dünya · robot + LiDAR')}</figcaption>
                    <canvas class="slam__world"></canvas>
                </figure>
                <figure class="slam__view">
                    <figcaption>${t('Map being built', 'Oluşan harita')}</figcaption>
                    <canvas class="slam__map"></canvas>
                </figure>
            </div>
            <div class="lab__bar">
                <div class="dpad" aria-label="${t('Drive', 'Sür')}">
                    <button type="button" data-k="up" aria-label="${t('Forward', 'İleri')}"><i class="fas fa-arrow-up"></i></button>
                    <button type="button" data-k="left" aria-label="${t('Turn left', 'Sola dön')}"><i class="fas fa-arrow-left"></i></button>
                    <button type="button" data-k="down" aria-label="${t('Back', 'Geri')}"><i class="fas fa-arrow-down"></i></button>
                    <button type="button" data-k="right" aria-label="${t('Turn right', 'Sağa dön')}"><i class="fas fa-arrow-right"></i></button>
                </div>
                <button type="button" class="lab-btn is-on" data-act="auto"><i class="fas fa-robot"></i> ${t('Auto-explore', 'Otomatik keşif')}</button>
                <button type="button" class="lab-btn" data-act="reset"><i class="fas fa-undo-alt"></i> ${t('Reset map', 'Haritayı sıfırla')}</button>
                <div class="lab__stats">
                    <span>${t('explored', 'keşfedilen')} <b data-s="cov">0%</b></span>
                    <span>${t('scans', 'tarama')} <b data-s="scans">0</b></span>
                </div>
            </div>
            <p class="lab__hint">${t('Drive with the arrow keys / WASD or the pad — or let it explore on its own.',
                'Ok tuşları / WASD ya da yön tuşlarıyla sür; istersen kendi kendine keşfetsin.')}</p>`;

        const WW = 16, WH = 10, RES = 0.1, GW = WW / RES, GH = WH / RES;
        const RAYS = 180, RANGE = 6, RADIUS = 0.28;

        const segs = [];
        const wall = (x1, y1, x2, y2) => segs.push([x1, y1, x2, y2]);
        const rect = (x, y, w, h) => { wall(x, y, x + w, y); wall(x + w, y, x + w, y + h); wall(x + w, y + h, x, y + h); wall(x, y + h, x, y); };
        const poly = (cx, cy, r, n) => {
            for (let i = 0; i < n; i++) {
                const a1 = i / n * Math.PI * 2, a2 = (i + 1) / n * Math.PI * 2;
                wall(cx + Math.cos(a1) * r, cy + Math.sin(a1) * r, cx + Math.cos(a2) * r, cy + Math.sin(a2) * r);
            }
        };
        rect(0, 0, WW, WH);
        wall(6, 0, 6, 4); wall(6, 5.6, 6, 10);
        wall(10, 6, 12, 6); wall(13.6, 6, 16, 6); wall(10, 6, 10, 10);
        wall(6, 3, 8.5, 3);
        rect(1.6, 7, 1.6, 1.2); rect(8, 7.2, 1.2, 1.2); rect(12.4, 1.8, 2.2, 0.8); rect(11.2, 8, 1.6, 1);
        poly(3, 2.4, 0.5, 8); poly(8.6, 5, 0.35, 8); poly(14.3, 8.4, 0.4, 8);

        const worldC = root.querySelector('.slam__world');
        const mapC = root.querySelector('.slam__map');
        const covEl = root.querySelector('[data-s="cov"]');
        const scansEl = root.querySelector('[data-s="scans"]');
        const autoBtn = root.querySelector('[data-act="auto"]');

        let wctx, mctx, vw, vh, scale;
        const logodds = new Float32Array(GW * GH);
        const img = new ImageData(GW, GH);
        const off = document.createElement('canvas');
        off.width = GW; off.height = GH;
        const octx = off.getContext('2d');
        let robot, trail, scans, auto = true, raf = 0, last = performance.now(), hits = [];
        const keys = { up: false, down: false, left: false, right: false };

        function reset() {
            logodds.fill(0);
            robot = { x: 4.4, y: 5, a: -0.3 };
            trail = [];
            scans = 0;
        }

        function layout() {
            const r = root.querySelector('.slam').getBoundingClientRect();
            const stacked = r.width < 640;
            vw = Math.floor(stacked ? r.width : (r.width - 16) / 2);
            vh = Math.round(vw * WH / WW);
            scale = vw / WW;
            wctx = fitCanvas(worldC, vw, vh);
            mctx = fitCanvas(mapC, vw, vh);
        }

        function cast(x, y, a) {
            const dx = Math.cos(a), dy = Math.sin(a);
            let best = RANGE;
            for (const [x1, y1, x2, y2] of segs) {
                const ex = x2 - x1, ey = y2 - y1;
                const den = dx * ey - dy * ex;
                if (Math.abs(den) < 1e-9) continue;
                const tt = ((x1 - x) * ey - (y1 - y) * ex) / den;
                const u = ((x1 - x) * dy - (y1 - y) * dx) / den;
                if (tt > 0 && u >= 0 && u <= 1 && tt < best) best = tt;
            }
            return best;
        }

        function segDist(px, py, [x1, y1, x2, y2]) {
            const ex = x2 - x1, ey = y2 - y1;
            const k = clamp(((px - x1) * ex + (py - y1) * ey) / (ex * ex + ey * ey), 0, 1);
            return Math.hypot(px - (x1 + ex * k), py - (y1 + ey * k));
        }

        const free = (x, y) => segs.every(s => segDist(x, y, s) > RADIUS);

        function scan() {
            hits = [];
            for (let i = 0; i < RAYS; i++) {
                const a = robot.a + i / RAYS * Math.PI * 2;
                const d = cast(robot.x, robot.y, a);
                hits.push([a, d]);
                const dx = Math.cos(a), dy = Math.sin(a);
                for (let s = 0; s < d - RES; s += RES * 0.7) {
                    const gx = Math.floor((robot.x + dx * s) / RES), gy = Math.floor((robot.y + dy * s) / RES);
                    if (gx < 0 || gy < 0 || gx >= GW || gy >= GH) break;
                    const k = gy * GW + gx;
                    logodds[k] = Math.max(-4, logodds[k] - 0.35);
                }
                if (d < RANGE) {
                    const gx = Math.floor((robot.x + dx * d) / RES), gy = Math.floor((robot.y + dy * d) / RES);
                    if (gx >= 0 && gy >= 0 && gx < GW && gy < GH) {
                        const k = gy * GW + gx;
                        logodds[k] = Math.min(4, logodds[k] + 0.9);
                    }
                }
            }
            scans++;
        }

        function autopilot() {
            const sector = (from, to) => {
                let s = 0, n = 0;
                hits.forEach(([a, d]) => {
                    let rel = ((a - robot.a) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
                    if (rel >= from && rel <= to) { s += d; n++; }
                });
                return n ? s / n : RANGE;
            };
            const front = Math.min(sector(-0.3, 0.3), RANGE);
            if (front < 1.1) {
                return { v: 0.2, w: sector(0.3, 1.6) > sector(-1.6, -0.3) ? 2.2 : -2.2 };
            }
            robot.wander = (robot.wander || 0) * 0.97 + (Math.random() - 0.5) * 0.25;
            return { v: 1.3, w: robot.wander };
        }

        function update(dt) {
            let v = 0, w = 0;
            if (auto && hits.length) ({ v, w } = autopilot());
            if (keys.up) v = 1.6;
            if (keys.down) v = -1.0;
            if (keys.left) w = -2.4;
            if (keys.right) w = 2.4;
            robot.a += w * dt;
            const nx = robot.x + Math.cos(robot.a) * v * dt, ny = robot.y + Math.sin(robot.a) * v * dt;
            if (free(nx, ny)) { robot.x = nx; robot.y = ny; }
            else if (auto) robot.a += (Math.random() < 0.5 ? 1 : -1) * 0.6;
            const lastT = trail[trail.length - 1];
            if (!lastT || Math.hypot(lastT[0] - robot.x, lastT[1] - robot.y) > 0.15) trail.push([robot.x, robot.y]);
            if (trail.length > 600) trail.shift();
            scan();
        }

        function drawWorld() {
            const c = wctx;
            c.clearRect(0, 0, vw, vh);
            c.fillStyle = '#0b1120';
            c.fillRect(0, 0, vw, vh);
            // rays
            const rx = robot.x * scale, ry = robot.y * scale;
            c.strokeStyle = 'rgba(34,211,238,0.10)';
            c.lineWidth = 1;
            c.beginPath();
            hits.forEach(([a, d], i) => {
                if (i % 2) return;
                c.moveTo(rx, ry);
                c.lineTo(rx + Math.cos(a) * d * scale, ry + Math.sin(a) * d * scale);
            });
            c.stroke();
            // walls
            c.strokeStyle = '#64748b';
            c.lineWidth = 2;
            c.beginPath();
            segs.forEach(([x1, y1, x2, y2]) => { c.moveTo(x1 * scale, y1 * scale); c.lineTo(x2 * scale, y2 * scale); });
            c.stroke();
            // hit points
            c.fillStyle = '#22d3ee';
            hits.forEach(([a, d]) => {
                if (d >= RANGE) return;
                c.fillRect(rx + Math.cos(a) * d * scale - 1, ry + Math.sin(a) * d * scale - 1, 2, 2);
            });
            drawRobot(c);
        }

        function drawRobot(c) {
            const rx = robot.x * scale, ry = robot.y * scale, r = RADIUS * scale;
            c.fillStyle = '#a855f7';
            c.beginPath(); c.arc(rx, ry, r, 0, Math.PI * 2); c.fill();
            c.strokeStyle = '#fff';
            c.lineWidth = 2;
            c.beginPath(); c.moveTo(rx, ry); c.lineTo(rx + Math.cos(robot.a) * r * 1.6, ry + Math.sin(robot.a) * r * 1.6); c.stroke();
        }

        function drawMap() {
            const d = img.data;
            let known = 0;
            for (let k = 0; k < logodds.length; k++) {
                const lo = logodds[k], p = k * 4;
                if (lo > 0.6) { d[p] = 34; d[p + 1] = 211; d[p + 2] = 238; known++; }
                else if (lo < -0.6) { d[p] = 22; d[p + 1] = 30; d[p + 2] = 52; known++; }
                else { d[p] = 9; d[p + 1] = 12; d[p + 2] = 22; }
                d[p + 3] = 255;
            }
            octx.putImageData(img, 0, 0);
            const c = mctx;
            c.imageSmoothingEnabled = false;
            c.drawImage(off, 0, 0, vw, vh);
            // trail
            c.strokeStyle = 'rgba(168,85,247,0.7)';
            c.lineWidth = 1.5;
            c.beginPath();
            trail.forEach(([x, y], i) => (i ? c.lineTo(x * scale, y * scale) : c.moveTo(x * scale, y * scale)));
            c.stroke();
            drawRobot(c);
            // not every cell can be seen (inside obstacles, behind walls), so ~90% known reads as 100%
            covEl.textContent = Math.min(100, Math.round(known / (GW * GH) / 0.9 * 100)) + '%';
            scansEl.textContent = scans.toLocaleString(TR ? 'tr-TR' : 'en-US');
        }

        function frame(now) {
            const dt = Math.min((now - last) / 1000, 0.05);
            last = now;
            update(dt);
            drawWorld();
            drawMap();
            raf = requestAnimationFrame(frame);
        }

        const KEYMAP = { ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down', ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right' };
        const setAuto = on => { auto = on; autoBtn.classList.toggle('is-on', on); };
        const kd = e => {
            const k = KEYMAP[e.key];
            if (!k) return;
            e.preventDefault();
            keys[k] = true;
            setAuto(false);
        };
        const ku = e => { const k = KEYMAP[e.key]; if (k) keys[k] = false; };
        window.addEventListener('keydown', kd);
        window.addEventListener('keyup', ku);

        root.querySelectorAll('.dpad button').forEach(b => {
            const k = b.dataset.k;
            const on = e => { e.preventDefault(); keys[k] = true; setAuto(false); };
            const offK = () => { keys[k] = false; };
            b.addEventListener('pointerdown', on);
            ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => b.addEventListener(ev, offK));
        });
        autoBtn.addEventListener('click', () => setAuto(!auto));
        root.querySelector('[data-act="reset"]').addEventListener('click', reset);

        const ro = new ResizeObserver(() => { layout(); });
        ro.observe(root.querySelector('.slam'));

        reset();
        layout();
        raf = requestAnimationFrame(frame);

        return () => {
            cancelAnimationFrame(raf);
            ro.disconnect();
            window.removeEventListener('keydown', kd);
            window.removeEventListener('keyup', ku);
        };
    }

    /* =================================================================
       2) Biscuit classifier — contour features from a drawing
       ================================================================= */
    function mountBiscuit(root) {
        root.innerHTML = `
            <div class="bis">
                <div class="bis__pad">
                    <canvas class="bis__ink"></canvas>
                    <canvas class="bis__over"></canvas>
                    <p class="bis__empty">${t('Draw a biscuit here ✍️<br><small>or drop a photo 📷</small>', 'Buraya bir bisküvi çiz ✍️<br><small>ya da fotoğraf bırak 📷</small>')}</p>
                    <p class="bis__drop">${t('Drop the photo', 'Fotoğrafı bırak')}</p>
                </div>
                <div class="bis__side">
                    <div class="lab__group">
                        <span class="lab__label">${t('Dough', 'Hamur')}</span>
                        <div class="swatches">
                            <button type="button" class="swatch is-on" data-c="cocoa" style="--sw:#6b3e22">${t('Cocoa', 'Kakaolu')}</button>
                            <button type="button" class="swatch" data-c="milky" style="--sw:#e9d3a6">${t('Milky', 'Sütlü')}</button>
                        </div>
                    </div>
                    <div class="lab__group">
                        <span class="lab__label">${t('Shape', 'Şekil')}</span>
                        <div class="bars" data-g="shape">
                            <div class="bar"><span>${t('Round', 'Yuvarlak')}</span><i><b></b></i><em>–</em></div>
                            <div class="bar"><span>${t('Rectangular', 'Dikdörtgen')}</span><i><b></b></i><em>–</em></div>
                        </div>
                    </div>
                    <div class="lab__group">
                        <span class="lab__label">${t('Type', 'Tür')}</span>
                        <div class="bars" data-g="type">
                            <div class="bar"><span>${t('Cocoa', 'Kakaolu')}</span><i><b></b></i><em>–</em></div>
                            <div class="bar"><span>${t('Milky', 'Sütlü')}</span><i><b></b></i><em>–</em></div>
                        </div>
                    </div>
                    <dl class="feat">
                        <div><dt>${t('circularity', 'dairesellik')}</dt><dd data-f="circ">–</dd></div>
                        <div><dt>${t('rectangularity', 'dikdörtgensellik')}</dt><dd data-f="rect">–</dd></div>
                        <div><dt>${t('aspect ratio', 'en/boy oranı')}</dt><dd data-f="ar">–</dd></div>
                    </dl>
                    <div class="lab__row">
                        <button type="button" class="lab-btn" data-act="clear"><i class="fas fa-eraser"></i> ${t('Clear', 'Temizle')}</button>
                        <button type="button" class="lab-btn" data-act="sample"><i class="fas fa-random"></i> ${t('Random sample', 'Örnek çiz')}</button>
                        <label class="lab-btn"><i class="fas fa-camera"></i> ${t('Upload photo', 'Fotoğraf yükle')}<input type="file" accept="image/*" data-act="photo" hidden></label>
                    </div>
                    <p class="bis__msg" aria-live="polite"></p>
                </div>
            </div>`;

        const pad = root.querySelector('.bis__pad');
        const ink = root.querySelector('.bis__ink'), over = root.querySelector('.bis__over');
        const empty = root.querySelector('.bis__empty');
        const COL = { cocoa: '#6b3e22', milky: '#e9d3a6' };
        const msg = root.querySelector('.bis__msg');
        let size, ictx, octx, brush = 'cocoa', strokes = [], cur = null, photo = null;

        function layout() {
            size = Math.floor(Math.min(pad.getBoundingClientRect().width, 360));
            ictx = fitCanvas(ink, size, size);
            octx = fitCanvas(over, size, size);
            redraw();
        }

        function redraw() {
            ictx.clearRect(0, 0, size, size);
            if (photo) {
                const { ox, oy, w, h, N } = photo;
                ictx.drawImage(photo.img, ox / N * size, oy / N * size, w / N * size, h / N * size);
            }
            ictx.lineCap = ictx.lineJoin = 'round';
            strokes.forEach(s => {
                ictx.strokeStyle = COL[s.c];
                ictx.lineWidth = size * 0.07;
                ictx.beginPath();
                s.pts.forEach(([x, y], i) => (i ? ictx.lineTo(x * size, y * size) : ictx.moveTo(x * size, y * size)));
                if (s.pts.length === 1) ictx.lineTo(s.pts[0][0] * size + 0.1, s.pts[0][1] * size);
                ictx.stroke();
            });
            empty.hidden = strokes.length > 0 || !!photo;
            classify();
        }

        /* --- geometry --- */
        function hull(points) {
            const p = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
            const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
            const lo = [], up = [];
            for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
            for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
            return lo.slice(0, -1).concat(up.slice(0, -1));
        }

        const area = h => Math.abs(h.reduce((s, p, i) => { const q = h[(i + 1) % h.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;
        const perim = h => h.reduce((s, p, i) => { const q = h[(i + 1) % h.length]; return s + Math.hypot(q[0] - p[0], q[1] - p[1]); }, 0);

        function minRect(h) {
            let best = null;
            for (let i = 0; i < h.length; i++) {
                const p = h[i], q = h[(i + 1) % h.length];
                const ang = Math.atan2(q[1] - p[1], q[0] - p[0]);
                const c = Math.cos(-ang), s = Math.sin(-ang);
                let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
                h.forEach(([x, y]) => { const rx = x * c - y * s, ry = x * s + y * c; x0 = Math.min(x0, rx); x1 = Math.max(x1, rx); y0 = Math.min(y0, ry); y1 = Math.max(y1, ry); });
                const a = (x1 - x0) * (y1 - y0);
                if (!best || a < best.a) best = { a, ang, x0, x1, y0, y1 };
            }
            return best;
        }

        function setBars(g, a, b) {
            const bars = root.querySelectorAll(`[data-g="${g}"] .bar`);
            [a, b].forEach((v, i) => {
                bars[i].querySelector('b').style.width = v == null ? '0%' : (v * 100).toFixed(0) + '%';
                bars[i].querySelector('em').textContent = v == null ? '–' : Math.round(v * 100) + '%';
                bars[i].classList.toggle('is-top', v != null && v >= 0.5);
            });
        }

        function classify() {
            octx.clearRect(0, 0, size, size);
            let pts = [];
            let len = { cocoa: 0, milky: 0 };
            if (photo) {
                pts = photo.pts;
                len = { cocoa: photo.pCocoa, milky: 1 - photo.pCocoa };
                octx.globalAlpha = 0.18;
                octx.imageSmoothingEnabled = false;
                octx.drawImage(photo.mask, 0, 0, size, size);
                octx.globalAlpha = 1;
            }
            strokes.forEach(s => {
                s.pts.forEach((p, i) => {
                    pts.push(p);
                    if (i) len[s.c] += Math.hypot(p[0] - s.pts[i - 1][0], p[1] - s.pts[i - 1][1]);
                });
            });
            const f = k => root.querySelector(`[data-f="${k}"]`);
            if (pts.length < 8) {
                setBars('shape', null, null); setBars('type', null, null);
                ['circ', 'rect', 'ar'].forEach(k => (f(k).textContent = '–'));
                return;
            }
            const h = hull(pts);
            const A = area(h), P = perim(h);
            if (A < 0.01) {
                setBars('shape', null, null); setBars('type', null, null);
                return;
            }
            const circ = clamp(4 * Math.PI * A / (P * P), 0, 1);
            const mr = minRect(h);
            const rectness = clamp(A / mr.a, 0, 1);
            const w = mr.x1 - mr.x0, hh = mr.y1 - mr.y0;
            const ar = Math.max(w, hh) / Math.max(1e-6, Math.min(w, hh));
            // circle ≈ (circ 0.9+, rect 0.79) · square ≈ (0.79, 1) · long rectangle ≈ (0.7, 1)
            const d = (rectness - circ) + Math.max(0, ar - 1.25) * 0.15;
            const pRect = 1 / (1 + Math.exp(-(d - 0.03) * 28));
            setBars('shape', 1 - pRect, pRect);
            const tot = len.cocoa + len.milky || 1;
            const pCocoa = clamp(len.cocoa / tot, 0, 1);
            setBars('type', pCocoa, 1 - pCocoa);
            f('circ').textContent = circ.toFixed(2);
            f('rect').textContent = rectness.toFixed(2);
            f('ar').textContent = ar.toFixed(2);

            // overlay: convex hull + minimum-area rectangle (what OpenCV's contour tools would give)
            octx.setLineDash([5, 5]);
            octx.lineWidth = 1.5;
            octx.strokeStyle = 'rgba(34,211,238,0.9)';
            octx.beginPath();
            h.forEach(([x, y], i) => (i ? octx.lineTo(x * size, y * size) : octx.moveTo(x * size, y * size)));
            octx.closePath();
            octx.stroke();
            const c = Math.cos(mr.ang), s = Math.sin(mr.ang);
            const corner = (x, y) => [(x * c - y * s) * size, (x * s + y * c) * size];
            octx.strokeStyle = 'rgba(168,85,247,0.9)';
            octx.beginPath();
            [[mr.x0, mr.y0], [mr.x1, mr.y0], [mr.x1, mr.y1], [mr.x0, mr.y1]].forEach(([x, y], i) => {
                const [px, py] = corner(x, y);
                i ? octx.lineTo(px, py) : octx.moveTo(px, py);
            });
            octx.closePath();
            octx.stroke();
            octx.setLineDash([]);
        }

        /* --- photo: segment the biscuit from the background, in the browser --- */
        function analyzePhoto(img) {
            const N = 200;
            const c = document.createElement('canvas');
            c.width = c.height = N;
            const x = c.getContext('2d', { willReadFrequently: true });
            const sc = Math.min(N / img.naturalWidth, N / img.naturalHeight);
            const w = Math.round(img.naturalWidth * sc), h = Math.round(img.naturalHeight * sc);
            const ox = Math.floor((N - w) / 2), oy = Math.floor((N - h) / 2);
            x.drawImage(img, ox, oy, w, h);
            const d = x.getImageData(0, 0, N, N).data;
            const inside = (px, py) => px >= ox && px < ox + w && py >= oy && py < oy + h;

            // 1) background colour = median of the photo's border pixels
            const br = [], bg = [], bb = [];
            for (let px = ox; px < ox + w; px++) for (const py of [oy + 1, oy + h - 2]) { const k = (py * N + px) * 4; br.push(d[k]); bg.push(d[k + 1]); bb.push(d[k + 2]); }
            for (let py = oy; py < oy + h; py++) for (const px of [ox + 1, ox + w - 2]) { const k = (py * N + px) * 4; br.push(d[k]); bg.push(d[k + 1]); bb.push(d[k + 2]); }
            const med = a => a.sort((m, n) => m - n)[a.length >> 1];
            const B = [med(br), med(bg), med(bb)];

            // 2) colour distance to the background, Otsu threshold on its histogram
            const dist = new Float32Array(N * N), hist = new Array(256).fill(0);
            let total = 0;
            for (let py = oy; py < oy + h; py++) for (let px = ox; px < ox + w; px++) {
                const i = py * N + px, k = i * 4;
                const v = Math.hypot(d[k] - B[0], d[k + 1] - B[1], d[k + 2] - B[2]);
                dist[i] = v;
                hist[Math.min(255, Math.round(v / 442 * 255))]++;
                total++;
            }
            let sum = 0, sumB = 0, wB = 0, best = 0, thr = 0;
            hist.forEach((n, i) => (sum += i * n));
            for (let i = 0; i < 256; i++) {
                wB += hist[i];
                if (!wB || wB === total) continue;
                sumB += i * hist[i];
                const mB = sumB / wB, mF = (sum - sumB) / (total - wB);
                const between = wB * (total - wB) * (mB - mF) * (mB - mF);
                if (between > best) { best = between; thr = i; }
            }
            const cut = Math.max(28, thr / 255 * 442);
            let fg = new Uint8Array(N * N);
            for (let i = 0; i < N * N; i++) fg[i] = dist[i] > cut ? 1 : 0;

            // 3) morphological opening (3×3) to drop specks and crumbs
            const morph = (src, keep) => {
                const out = new Uint8Array(N * N);
                for (let py = 1; py < N - 1; py++) for (let px = 1; px < N - 1; px++) {
                    let n = 0;
                    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) n += src[(py + dy) * N + px + dx];
                    out[py * N + px] = keep(n) ? 1 : 0;
                }
                return out;
            };
            fg = morph(morph(fg, n => n === 9), n => n > 0);

            // 4) largest connected component = the biscuit
            const label = new Int32Array(N * N);
            let bestLabel = 0, bestSize = 0, next = 0;
            for (let i = 0; i < N * N; i++) {
                if (!fg[i] || label[i]) continue;
                next++;
                let size = 0;
                const stack = [i];
                label[i] = next;
                while (stack.length) {
                    const j = stack.pop(), jx = j % N, jy = (j / N) | 0;
                    size++;
                    for (const [nx, ny] of [[jx + 1, jy], [jx - 1, jy], [jx, jy + 1], [jx, jy - 1]]) {
                        const q = ny * N + nx;
                        if (nx >= 0 && ny >= 0 && nx < N && ny < N && fg[q] && !label[q]) { label[q] = next; stack.push(q); }
                    }
                }
                if (size > bestSize) { bestSize = size; bestLabel = next; }
            }
            if (!bestSize || bestSize < total * 0.015 || bestSize > total * 0.92) return null;

            // 5) contour points + mean colour of the biscuit
            const pts = [], m = [0, 0, 0];
            const maskC = document.createElement('canvas');
            maskC.width = maskC.height = N;
            const mctx2 = maskC.getContext('2d');
            const mimg = mctx2.createImageData(N, N);
            const on = (px, py) => inside(px, py) && label[py * N + px] === bestLabel;
            for (let py = 0; py < N; py++) for (let px = 0; px < N; px++) {
                if (!on(px, py)) continue;
                const k = (py * N + px) * 4;
                m[0] += d[k]; m[1] += d[k + 1]; m[2] += d[k + 2];
                mimg.data[k] = 34; mimg.data[k + 1] = 211; mimg.data[k + 2] = 238; mimg.data[k + 3] = 255;
                if (!on(px + 1, py) || !on(px - 1, py) || !on(px, py + 1) || !on(px, py - 1)) pts.push([(px + 0.5) / N, (py + 0.5) / N]);
            }
            mctx2.putImageData(mimg, 0, 0);
            const mean = m.map(v => v / bestSize);
            const L = (Math.max(...mean) + Math.min(...mean)) / 2 / 255;
            // cocoa dough is dark brown, milky dough light golden
            const pCocoa = 1 / (1 + Math.exp((L - 0.47) * 14));
            return { img, N, ox, oy, w, h, pts, pCocoa, mask: maskC, cover: bestSize / total, mean };
        }

        function loadPhoto(file) {
            if (!file || !file.type.startsWith('image/')) return;
            const url = URL.createObjectURL(file);
            const img = new Image();
            img.onload = () => {
                URL.revokeObjectURL(url);
                const res = analyzePhoto(img);
                strokes = [];
                if (!res) {
                    photo = null;
                    msg.textContent = t('Couldn’t separate a biscuit from the background — try a photo of one biscuit on a plain, contrasting surface.',
                        'Bisküvi arka plandan ayrılamadı; düz ve zıt renkli bir zemin üzerinde tek bir bisküvinin fotoğrafını dene.');
                    msg.classList.add('is-warn');
                } else {
                    photo = res;
                    const hex = '#' + res.mean.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
                    msg.innerHTML = t('Biscuit found: ', 'Bisküvi bulundu: ') + `${Math.round(res.cover * 100)}% ` +
                        t('of the photo · dough colour', 'fotoğrafın · hamur rengi') + ` <i class="bis__chip" style="background:${hex}"></i> ` +
                        `<span class="lab__muted">${t('(stays in your browser)', '(tarayıcından çıkmaz)')}</span>`;
                    msg.classList.remove('is-warn');
                }
                redraw();
            };
            img.onerror = () => { URL.revokeObjectURL(url); msg.textContent = t('That file could not be read as an image.', 'Bu dosya görsel olarak okunamadı.'); };
            img.src = url;
        }

        root.querySelector('[data-act="photo"]').addEventListener('change', e => { loadPhoto(e.target.files[0]); e.target.value = ''; });
        ['dragenter', 'dragover'].forEach(ev => pad.addEventListener(ev, e => { e.preventDefault(); pad.classList.add('is-drop'); }));
        ['dragleave', 'drop'].forEach(ev => pad.addEventListener(ev, e => { e.preventDefault(); pad.classList.remove('is-drop'); }));
        pad.addEventListener('drop', e => loadPhoto(e.dataTransfer?.files?.[0]));
        const onPaste = e => {
            const item = [...(e.clipboardData?.items || [])].find(i => i.type.startsWith('image/'));
            if (item) loadPhoto(item.getAsFile());
        };
        window.addEventListener('paste', onPaste);
        const clearPhoto = () => { photo = null; msg.textContent = ''; msg.classList.remove('is-warn'); };

        /* --- input --- */
        const local = e => {
            const r = ink.getBoundingClientRect();
            return [clamp((e.clientX - r.left) / size, 0, 1), clamp((e.clientY - r.top) / size, 0, 1)];
        };
        over.addEventListener('pointerdown', e => {
            if (photo) clearPhoto();
            cur = { c: brush, pts: [local(e)] };
            strokes.push(cur);
            try { over.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
            redraw();
        });
        over.addEventListener('pointermove', e => {
            if (!cur) return;
            const p = local(e), lp = cur.pts[cur.pts.length - 1];
            if (Math.hypot(p[0] - lp[0], p[1] - lp[1]) > 0.006) { cur.pts.push(p); redraw(); }
        });
        const end = () => { cur = null; };
        over.addEventListener('pointerup', end);
        over.addEventListener('pointercancel', end);

        root.querySelectorAll('.swatch').forEach(b => b.addEventListener('click', () => {
            brush = b.dataset.c;
            root.querySelectorAll('.swatch').forEach(x => x.classList.toggle('is-on', x === b));
        }));
        root.querySelector('[data-act="clear"]').addEventListener('click', () => { strokes = []; clearPhoto(); redraw(); });
        root.querySelector('[data-act="sample"]').addEventListener('click', () => {
            const pts = [];
            const jitter = () => (Math.random() - 0.5) * 0.012;
            if (Math.random() < 0.5) {
                const r = 0.26 + Math.random() * 0.08;
                for (let i = 0; i <= 60; i++) { const a = i / 60 * Math.PI * 2; pts.push([0.5 + Math.cos(a) * r + jitter(), 0.5 + Math.sin(a) * r + jitter()]); }
            } else {
                const w = 0.25 + Math.random() * 0.12, hgt = 0.15 + Math.random() * 0.12, rot = (Math.random() - 0.5) * 0.6;
                const corners = [[-w, -hgt], [w, -hgt], [w, hgt], [-w, hgt], [-w, -hgt]];
                for (let i = 0; i < 4; i++) {
                    for (let k = 0; k < 15; k++) {
                        const [x1, y1] = corners[i], [x2, y2] = corners[i + 1], u = k / 15;
                        const x = x1 + (x2 - x1) * u, y = y1 + (y2 - y1) * u;
                        pts.push([0.5 + x * Math.cos(rot) - y * Math.sin(rot) + jitter(), 0.5 + x * Math.sin(rot) + y * Math.cos(rot) + jitter()]);
                    }
                }
                pts.push(pts[0]);
            }
            strokes = [{ c: Math.random() < 0.5 ? 'cocoa' : 'milky', pts }];
            clearPhoto();
            redraw();
        });

        const ro = new ResizeObserver(layout);
        ro.observe(pad);
        layout();
        return () => { ro.disconnect(); window.removeEventListener('paste', onPaste); };
    }

    /* =================================================================
       3) TextSmith — live text statistics + lexicon sentiment
       ================================================================= */
    const STOP = new Set((
        'the a an and or but if of to in on at for with from by as is are was were be been being it its this that these those ' +
        'i you he she we they me him her us them my your his our their not no so do does did have has had will would can could ' +
        'there here what which who when where why how all any each more most some such than too very just also into about over ' +
        've ile da de ki bu şu o bir ve veya ama fakat için gibi kadar çok daha en mi mı mu mü ne ben sen biz siz onlar bana ' +
        'sana onu bunu şunu olan olarak ise diye her hem hiç değil var yok sonra önce şey ya yani bile göre beni seni'
    ).split(' '));

    const POS = ('good great excellent amazing love loved lovely happy wonderful best fantastic nice beautiful awesome enjoy enjoyed ' +
        'like liked perfect brilliant success successful glad helpful fast easy clean reliable impressive recommend positive win ' +
        'fun pleasant delightful superb outstanding smooth friendly ' +
        'güzel harika mükemmel iyi sevdim seviyorum sevgi mutlu muhteşem başarılı hızlı kolay temiz süper keyifli eğlenceli tavsiye ' +
        'beğendim teşekkür şahane hoş faydalı kaliteli memnun huzur sevindim güvenilir sorunsuz').split(' ');
    const NEG = ('bad terrible awful hate hated sad worst poor horrible slow broken difficult hard problem problems fail failed ' +
        'failure angry boring ugly annoying disappointing disappointed wrong bug bugs crash expensive negative lose weak useless pain ' +
        'kötü berbat rezalet nefret üzgün yavaş bozuk zor sorun problem hata pahalı sıkıcı çirkin başarısız yorucu kızgın sinir ' +
        'gereksiz eksik maalesef şikayet zordu zorlu').split(' ');
    const NEGATORS = new Set(['not', 'no', 'never', "don't", "doesn't", "isn't", "wasn't", "didn't", 'değil', 'hiç']);

    function polarity(word) {
        const w = word.toLowerCase();
        const hit = list => list.some(s => w === s || (s.length >= 4 && w.startsWith(s)));
        if (hit(POS)) return 1;
        if (hit(NEG)) return -1;
        return 0;
    }

    function mountText(root) {
        const SAMPLE = t(
            "TextSmith is a small Python tool I built for analyzing text and PDF files. It counts words and characters, " +
            "finds the most frequent terms and runs a quick sentiment analysis. The first version was slow and a bit difficult " +
            "to use, but after a few iterations it became fast, reliable and genuinely helpful. I love how simple it is now — " +
            "paste any text here and watch the numbers update live!",
            "TextSmith, metin ve PDF dosyalarını analiz etmek için geliştirdiğim küçük bir Python aracı. Kelime ve karakterleri " +
            "sayıyor, en sık geçen terimleri buluyor ve hızlı bir duygu analizi yapıyor. İlk sürümü yavaş ve kullanımı biraz zordu " +
            "ama birkaç denemeden sonra hızlı, güvenilir ve gerçekten faydalı bir araca dönüştü. Şimdiki sadeliğini çok seviyorum — " +
            "buraya istediğin metni yapıştır, sayılar anında güncellensin!");

        root.innerHTML = `
            <div class="ts">
                <div class="ts__input">
                    <textarea spellcheck="false" aria-label="${t('Text to analyze', 'Analiz edilecek metin')}"></textarea>
                    <div class="lab__row">
                        <button type="button" class="lab-btn" data-act="sample"><i class="fas fa-file-alt"></i> ${t('Sample text', 'Örnek metin')}</button>
                        <label class="lab-btn"><i class="fas fa-upload"></i> ${t('Open .txt', '.txt aç')}<input type="file" accept=".txt,text/plain" hidden></label>
                        <button type="button" class="lab-btn" data-act="clear"><i class="fas fa-eraser"></i> ${t('Clear', 'Temizle')}</button>
                    </div>
                </div>
                <div class="ts__tiles"></div>
                <div class="ts__cols">
                    <div class="lab__group">
                        <span class="lab__label">${t('Most frequent words', 'En sık kelimeler')}</span>
                        <div class="ts__top"></div>
                    </div>
                    <div class="lab__group">
                        <span class="lab__label">${t('Sentiment', 'Duygu analizi')}</span>
                        <div class="gauge"><i></i><b></b></div>
                        <p class="gauge__label"></p>
                        <div class="ts__marked"></div>
                    </div>
                </div>
            </div>`;

        const ta = root.querySelector('textarea');
        const tiles = root.querySelector('.ts__tiles');
        const top = root.querySelector('.ts__top');
        const gaugeB = root.querySelector('.gauge b');
        const gaugeLabel = root.querySelector('.gauge__label');
        const marked = root.querySelector('.ts__marked');
        const nf = n => n.toLocaleString(TR ? 'tr-TR' : 'en-US');

        function analyze() {
            const text = ta.value;
            const words = text.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) || [];
            const lower = words.map(w => w.toLocaleLowerCase(TR ? 'tr-TR' : 'en-US'));
            const sentences = text.split(/[.!?…]+/).filter(s => s.trim()).length;
            const chars = [...text].length, noSpace = [...text.replace(/\s/g, '')].length;
            const unique = new Set(lower).size;
            const avg = words.length ? lower.reduce((s, w) => s + [...w].length, 0) / words.length : 0;
            const mins = words.length / 200;

            const stat = (label, val) => `<div class="tile"><b>${val}</b><span>${label}</span></div>`;
            tiles.innerHTML =
                stat(t('words', 'kelime'), nf(words.length)) +
                stat(t('characters', 'karakter'), nf(chars)) +
                stat(t('without spaces', 'boşluksuz'), nf(noSpace)) +
                stat(t('sentences', 'cümle'), nf(sentences)) +
                stat(t('unique words', 'farklı kelime'), nf(unique)) +
                stat(t('avg. word length', 'ort. kelime uzunluğu'), avg.toFixed(1)) +
                stat(t('reading time', 'okuma süresi'), mins < 1 ? '<1 ' + t('min', 'dk') : Math.round(mins) + ' ' + t('min', 'dk'));

            const freq = {};
            lower.forEach(w => { if (!STOP.has(w) && [...w].length > 2 && !/^\d+$/.test(w)) freq[w] = (freq[w] || 0) + 1; });
            const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 8);
            const max = sorted.length ? sorted[0][1] : 1;
            top.innerHTML = sorted.length
                ? sorted.map(([w, n]) => `<div class="bar"><span>${esc(w)}</span><i><b style="width:${n / max * 100}%"></b></i><em>${n}</em></div>`).join('')
                : `<p class="lab__muted">${t('Type something…', 'Bir şeyler yaz…')}</p>`;

            let pos = 0, neg = 0;
            const pol = lower.map((w, i) => {
                let p = polarity(w);
                const prev = lower[i - 1], next = lower[i + 1];
                if (p && (NEGATORS.has(prev) || next === 'değil')) p = -p;
                if (p > 0) pos++; else if (p < 0) neg++;
                return p;
            });
            const score = pos + neg ? (pos - neg) / (pos + neg) : 0;
            gaugeB.style.left = ((score + 1) / 2 * 100) + '%';
            const label = score > 0.25 ? t('Positive', 'Olumlu') + ' 😊' : score < -0.25 ? t('Negative', 'Olumsuz') + ' 😟' : t('Neutral', 'Nötr') + ' 😐';
            gaugeLabel.innerHTML = `${label} <span class="lab__muted">· ${score.toFixed(2)} · ` +
                `<span class="pos">+${pos}</span> / <span class="neg">−${neg}</span></span>`;

            // highlighted preview (first 600 characters)
            let k = 0, html = '';
            const preview = text.slice(0, 600);
            preview.replace(/([\p{L}\p{N}][\p{L}\p{N}'’-]*)|([^\p{L}\p{N}]+)/gu, (m, w, other) => {
                if (w) {
                    const p = pol[k++];
                    html += p > 0 ? `<mark class="pos">${esc(w)}</mark>` : p < 0 ? `<mark class="neg">${esc(w)}</mark>` : esc(w);
                } else html += esc(other);
                return m;
            });
            marked.innerHTML = html + (text.length > 600 ? '…' : '');
        }

        let timer = 0;
        ta.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(analyze, 60); });
        root.querySelector('[data-act="sample"]').addEventListener('click', () => { ta.value = SAMPLE; analyze(); });
        root.querySelector('[data-act="clear"]').addEventListener('click', () => { ta.value = ''; analyze(); ta.focus(); });
        root.querySelector('input[type=file]').addEventListener('change', e => {
            const file = e.target.files[0];
            if (!file) return;
            const r = new FileReader();
            r.onload = () => { ta.value = String(r.result); analyze(); };
            r.readAsText(file);
        });
        ta.value = SAMPLE;
        analyze();
        return () => clearTimeout(timer);
    }

    /* =================================================================
       4) Spark / Airflow pipeline — simulated DAG run
       ================================================================= */
    function mountPipeline(root) {
        const TASKS = [
            { id: 'extract_orders', col: 0, row: 0, deps: [], kind: 'extract', file: 'olist_orders_dataset.csv', rows: 99441 },
            { id: 'extract_items', col: 0, row: 1, deps: [], kind: 'extract', file: 'olist_order_items_dataset.csv', rows: 112650 },
            { id: 'extract_customers', col: 0, row: 2, deps: [], kind: 'extract', file: 'olist_customers_dataset.csv', rows: 99441 },
            { id: 'extract_products', col: 0, row: 3, deps: [], kind: 'extract', file: 'olist_products_dataset.csv', rows: 32951 },
            { id: 'extract_payments', col: 0, row: 4, deps: [], kind: 'extract', file: 'olist_order_payments_dataset.csv', rows: 103886 },
            { id: 'clean_validate', col: 1, row: 2, deps: ['extract_orders', 'extract_items', 'extract_customers', 'extract_products', 'extract_payments'], kind: 'clean' },
            { id: 'join_orders', col: 2, row: 2, deps: ['clean_validate'], kind: 'join' },
            { id: 'sales_by_state', col: 3, row: 1, deps: ['join_orders'], kind: 'agg', by: 'customer_state' },
            { id: 'delivery_times', col: 3, row: 2, deps: ['join_orders'], kind: 'agg', by: 'order_purchase_month' },
            { id: 'category_revenue', col: 3, row: 3, deps: ['join_orders'], kind: 'agg', by: 'product_category_name' },
            { id: 'load_curated', col: 4, row: 2, deps: ['sales_by_state', 'delivery_times', 'category_revenue'], kind: 'load' }
        ];
        const CODE = {
            extract: t => `df = (spark.read
      .option("header", True)
      .csv("s3a://olist-raw/${t.file}"))
df.write.mode("overwrite").parquet(
    "s3a://olist-stage/${t.id.replace('extract_', '')}/")`,
            clean: () => `orders = (orders
    .dropna(subset=["order_id", "customer_id"])
    .withColumn("purchased_at",
        F.to_timestamp("order_purchase_timestamp"))
    .dropDuplicates(["order_id"]))`,
            join: () => `fact = (orders
    .join(items, "order_id")
    .join(customers, "customer_id")
    .join(F.broadcast(products), "product_id")
    .join(payments, "order_id", "left"))`,
            agg: t => `(fact.groupBy("${t.by}")
     .agg(F.sum("price").alias("revenue"),
          F.countDistinct("order_id").alias("orders"))
     .write.mode("overwrite")
     .parquet("s3a://olist-curated/${t.id}/"))`,
            load: () => `with DAG("olist_ecommerce", schedule="@daily",
         default_args={"retries": 1}) as dag:
    extract >> clean_validate >> join_orders
    join_orders >> [sales, delivery, category]
    [sales, delivery, category] >> load_curated`
        };

        root.innerHTML = `
            <div class="dag">
                <div class="dag__scroll"><svg class="dag__svg" viewBox="0 0 760 330" role="img"
                    aria-label="${t('Pipeline DAG', 'Pipeline DAG')}"></svg></div>
                <div class="lab__bar">
                    <button type="button" class="lab-btn lab-btn--primary" data-act="run"><i class="fas fa-play"></i> ${t('Trigger DAG', 'DAG\'ı çalıştır')}</button>
                    <label class="lab-check"><input type="checkbox" data-act="fail"> ${t('Inject a failure (watch the retry)', 'Hata enjekte et (yeniden denemeyi izle)')}</label>
                    <div class="lab__stats"><span>${t('status', 'durum')} <b data-s="state">idle</b></span><span>${t('elapsed', 'süre')} <b data-s="time">0.0s</b></span></div>
                </div>
                <div class="dag__cols">
                    <pre class="dag__log" aria-live="polite"></pre>
                    <div class="dag__code">
                        <span class="lab__label" data-s="codeTitle">${t('Click a task to see its code', 'Kodunu görmek için bir göreve tıkla')}</span>
                        <pre><code></code></pre>
                    </div>
                </div>
            </div>`;

        const svg = root.querySelector('svg');
        const log = root.querySelector('.dag__log');
        const stateEl = root.querySelector('[data-s="state"]');
        const timeEl = root.querySelector('[data-s="time"]');
        const runBtn = root.querySelector('[data-act="run"]');
        const failBox = root.querySelector('[data-act="fail"]');
        const codeEl = root.querySelector('.dag__code code');
        const codeTitle = root.querySelector('[data-s="codeTitle"]');
        const NS = 'http://www.w3.org/2000/svg';
        const X = c => 20 + c * 150, Y = r => 22 + r * 60, NW = 128, NH = 34;
        const byId = Object.fromEntries(TASKS.map(tk => [tk.id, tk]));
        const timers = [];
        let running = false, t0 = 0, tick = 0;

        // edges
        TASKS.forEach(tk => tk.deps.forEach(d => {
            const a = byId[d];
            const x1 = X(a.col) + NW, y1 = Y(a.row) + NH / 2, x2 = X(tk.col), y2 = Y(tk.row) + NH / 2;
            const p = document.createElementNS(NS, 'path');
            p.setAttribute('d', `M${x1},${y1} C${x1 + 30},${y1} ${x2 - 30},${y2} ${x2},${y2}`);
            p.setAttribute('class', 'dag__edge');
            p.dataset.to = tk.id;
            svg.appendChild(p);
        }));
        // nodes
        TASKS.forEach(tk => {
            const g = document.createElementNS(NS, 'g');
            g.setAttribute('class', 'dag__node');
            g.setAttribute('transform', `translate(${X(tk.col)},${Y(tk.row)})`);
            g.setAttribute('tabindex', '0');
            g.innerHTML = `<rect width="${NW}" height="${NH}" rx="8"/><circle cx="14" cy="${NH / 2}" r="4.5"/>` +
                `<text x="26" y="${NH / 2 + 4}">${tk.id}</text>`;
            const show = () => {
                svg.querySelectorAll('.dag__node').forEach(n => n.classList.remove('is-sel'));
                g.classList.add('is-sel');
                codeTitle.textContent = tk.id + (tk.kind === 'load' ? ' · DAG' : ' · PySpark');
                codeEl.textContent = CODE[tk.kind](tk);
            };
            g.addEventListener('click', show);
            g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); show(); } });
            tk.el = g;
            svg.appendChild(g);
        });

        const setState = (tk, s) => {
            tk.state = s;
            tk.el.setAttribute('data-state', s);
            svg.querySelectorAll(`.dag__edge[data-to="${tk.id}"]`).forEach(e => e.setAttribute('data-state', s));
        };
        const stamp = () => ((performance.now() - t0) / 1000).toFixed(1).padStart(5, ' ') + 's';
        const write = (lvl, msg) => {
            const line = document.createElement('span');
            line.className = 'log--' + lvl.toLowerCase();
            line.textContent = `[${stamp()}] ${lvl.padEnd(5)} ${msg}\n`;
            log.appendChild(line);
            log.scrollTop = log.scrollHeight;
        };
        const nf = n => n.toLocaleString('en-US');
        const later = (fn, ms) => timers.push(setTimeout(fn, reduceMotion ? ms / 4 : ms));

        const START = {
            extract: tk => `${tk.id}: reading s3a://olist-raw/${tk.file}`,
            clean: () => 'clean_validate: dropping nulls, casting timestamps, de-duplicating order_id',
            join: () => 'join_orders: orders ⨝ items ⨝ customers ⨝ products (broadcast) ⨝ payments',
            agg: tk => `${tk.id}: groupBy(${tk.by}).agg(sum(price), countDistinct(order_id))`,
            load: () => 'load_curated: committing curated parquet tables to s3a://olist-curated/'
        };
        const DONE = {
            extract: tk => `${tk.id}: loaded ${nf(tk.rows)} rows → stage parquet`,
            clean: () => 'clean_validate: schema checks passed ✓',
            join: () => 'join_orders: fact table written, partitioned by purchase month',
            agg: tk => `${tk.id}: written to s3a://olist-curated/${tk.id}/`,
            load: () => 'load_curated: tables published ✓'
        };

        function startTask(tk, attempt) {
            setState(tk, 'running');
            write('INFO', START[tk.kind](tk) + (attempt > 1 ? ` (attempt ${attempt})` : ''));
            const dur = (tk.kind === 'join' ? 1500 : tk.kind === 'extract' ? 500 + Math.random() * 900 : 700 + Math.random() * 600);
            later(() => {
                if (failBox.checked && tk.id === 'join_orders' && attempt === 1) {
                    setState(tk, 'retry');
                    write('ERROR', 'join_orders: ExecutorLostFailure — executor 3 exited (container lost)');
                    write('WARN', 'join_orders: marking up_for_retry, retrying in 2s (retries=1)');
                    later(() => startTask(tk, 2), 2000);
                    return;
                }
                setState(tk, 'success');
                write('INFO', DONE[tk.kind](tk));
                schedule();
            }, dur);
        }

        function schedule() {
            let pending = 0;
            TASKS.forEach(tk => {
                if (tk.state === 'success') return;
                pending++;
                if (tk.state === 'queued' && tk.deps.every(d => byId[d].state === 'success')) startTask(tk, 1);
            });
            if (!pending) finish();
        }

        function finish() {
            running = false;
            clearInterval(tick);
            write('INFO', `DagRun olist_ecommerce: success in ${((performance.now() - t0) / 1000).toFixed(1)}s`);
            stateEl.textContent = 'success';
            stateEl.dataset.state = 'success';
            runBtn.disabled = false;
        }

        runBtn.addEventListener('click', () => {
            if (running) return;
            running = true;
            runBtn.disabled = true;
            log.textContent = '';
            t0 = performance.now();
            TASKS.forEach(tk => setState(tk, 'queued'));
            stateEl.textContent = 'running';
            stateEl.dataset.state = 'running';
            write('INFO', 'Triggered DAG olist_ecommerce (manual__' + new Date().toISOString().slice(0, 19) + ')');
            tick = setInterval(() => { timeEl.textContent = ((performance.now() - t0) / 1000).toFixed(1) + 's'; }, 100);
            schedule();
        });

        TASKS.forEach(tk => setState(tk, 'none'));
        TASKS[6].el.dispatchEvent(new Event('click'));
        log.textContent = t('Press “Trigger DAG” to run the pipeline.\n', '“DAG\'ı çalıştır”a basarak pipeline\'ı başlat.\n');

        return () => { timers.forEach(clearTimeout); clearInterval(tick); };
    }

    /* =================================================================
       5) Grid Tile — the GNOME extension's tiling, on a mock desktop
       ================================================================= */
    // Same rule as the extension's impl.js: no empty row/column, few empty cells,
    // cells close to a 4:3 reading shape.
    function bestGrid(n, width, height) {
        let best = null;
        for (let cols = 1; cols <= n; cols++) {
            const rows = Math.ceil(n / cols);
            if ((rows - 1) * cols >= n) continue;
            const aspect = (width / cols) / (height / rows);
            const score = Math.abs(Math.log(aspect / (4 / 3))) + 0.5 * (cols * rows - n);
            if (!best || score < best.score) best = { cols, rows, score };
        }
        return best;
    }

    function mountGridTile(root) {
        const APPS = [
            ['Firefox', 'fab fa-firefox-browser', '#ff7139'], ['Terminal', 'fas fa-terminal', '#64748b'],
            ['Files', 'fas fa-folder', '#3b82f6'], ['VS Code', 'fas fa-code', '#22a3f0'],
            ['Telegram', 'fab fa-telegram-plane', '#2aa3e0'], ['Spotify', 'fab fa-spotify', '#1db954'],
            ['Calendar', 'fas fa-calendar', '#ef4444'], ['Notes', 'fas fa-sticky-note', '#eab308'],
            ['Calculator', 'fas fa-calculator', '#8b5cf6'], ['Settings', 'fas fa-cog', '#94a3b8'],
            ['Chat', 'fas fa-comments', '#14b8a6'], ['Mail', 'fas fa-envelope', '#f43f5e']
        ];
        root.innerHTML = `
            <div class="gt">
                <div class="gt__screen">
                    <div class="gt__bar"><span>${t('Activities', 'Etkinlikler')}</span><b class="gt__clock"></b>
                        <span class="gt__icon" title="Grid Tile"><i class="fas fa-th-large"></i></span></div>
                    <div class="gt__area"></div>
                </div>
            </div>
            <div class="lab__bar">
                <span class="lab__label gt__lbl">${t('Tile', 'Böl')}</span>
                <div class="gt__presets">${[2, 4, 6, 8, 9, 12].map(n => `<button type="button" class="lab-btn" data-n="${n}">${n}</button>`).join('')}</div>
                <button type="button" class="lab-btn" data-act="restore"><i class="fas fa-undo-alt"></i> ${t('Restore positions', 'Eski konumlara dön')}</button>
                <button type="button" class="lab-btn" data-act="portrait"><i class="fas fa-mobile-alt"></i> ${t('Portrait monitor', 'Dikey monitör')}</button>
                <label class="lab-check">${t('gap', 'boşluk')} <input type="range" min="0" max="16" value="4" data-act="gap"></label>
                <div class="lab__stats"><span>${t('grid', 'ızgara')} <b data-s="grid">–</b></span></div>
            </div>
            <p class="lab__hint">${t('Click a window to focus it — Grid Tile always takes the most recently used windows first.',
                'Bir pencereye tıklayıp öne al; Grid Tile her zaman en son kullanılan pencereleri alır.')}</p>`;

        const screen = root.querySelector('.gt__screen');
        const area = root.querySelector('.gt__area');
        const gridEl = root.querySelector('[data-s="grid"]');
        const gapIn = root.querySelector('[data-act="gap"]');
        let portrait = false, mru = [], saved = null, lastN = 0;

        const wins = APPS.slice(0, 9).map(([name, icon, color], i) => {
            const el = document.createElement('div');
            el.className = 'gt__win';
            el.style.setProperty('--c', color);
            el.innerHTML = `<div class="gt__title"><i class="${icon}"></i> ${name}<span>● ● ●</span></div><div class="gt__body"><i class="${icon}"></i></div>`;
            const w = { el, i, rect: null };
            el.addEventListener('pointerdown', () => focus(w));
            area.appendChild(el);
            return w;
        });

        const place = (w, r) => {
            w.rect = r;
            Object.assign(w.el.style, { left: r.x + '%', top: r.y + '%', width: r.w + '%', height: r.h + '%' });
        };
        const restack = () => mru.forEach((w, k) => { w.el.style.zIndex = String(100 - k); w.el.classList.toggle('is-focus', k === 0); });
        function focus(w) { mru = [w, ...mru.filter(x => x !== w)]; restack(); }

        function scatter() {
            wins.forEach(w => place(w, {
                x: 3 + Math.random() * 45, y: 4 + Math.random() * 38,
                w: 34 + Math.random() * 18, h: 38 + Math.random() * 20
            }));
            mru = K_shuffle(wins.slice());
            restack();
        }
        function K_shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

        function tile(n) {
            lastN = n;
            const rect = area.getBoundingClientRect();
            const { cols, rows } = bestGrid(n, rect.width, rect.height);
            gridEl.textContent = `${cols} × ${rows}`;
            const gapX = gapIn.value / rect.width * 100, gapY = gapIn.value / rect.height * 100;
            // n most recently used windows, laid out in opening order (stable cells)
            const pick = mru.slice(0, Math.min(n, wins.length)).sort((a, b) => a.i - b.i);
            if (!saved) saved = new Map(wins.map(w => [w, { ...w.rect }]));
            pick.forEach((w, k) => {
                const c = k % cols, r = Math.floor(k / cols);
                place(w, {
                    x: c / cols * 100 + gapX, y: r / rows * 100 + gapY,
                    w: 100 / cols - 2 * gapX, h: 100 / rows - 2 * gapY
                });
            });
            root.querySelectorAll('[data-n]').forEach(b => b.classList.toggle('is-on', +b.dataset.n === n));
        }

        root.querySelectorAll('[data-n]').forEach(b => b.addEventListener('click', () => tile(+b.dataset.n)));
        root.querySelector('[data-act="restore"]').addEventListener('click', () => {
            if (!saved) return;
            saved.forEach((r, w) => place(w, r));
            saved = null;
            lastN = 0;
            gridEl.textContent = '–';
            root.querySelectorAll('[data-n]').forEach(b => b.classList.remove('is-on'));
        });
        root.querySelector('[data-act="portrait"]').addEventListener('click', e => {
            portrait = !portrait;
            screen.classList.toggle('is-portrait', portrait);
            e.currentTarget.classList.toggle('is-on', portrait);
            if (lastN) setTimeout(() => tile(lastN), 50);
        });
        gapIn.addEventListener('input', () => { if (lastN) tile(lastN); });

        const clock = root.querySelector('.gt__clock');
        const tick = () => { clock.textContent = new Date().toLocaleTimeString(TR ? 'tr-TR' : 'en-US', { hour: '2-digit', minute: '2-digit' }); };
        tick();
        const timer = setInterval(tick, 10000);
        scatter();
        return () => clearInterval(timer);
    }

    /* =================================================================
       6) Rimtone — the VS Code extension's workspace tint, on a mock editor
       ================================================================= */
    function mountRimtone(root) {
        // Palette and colour maths copied from the extension's src/extension.ts
        const PALETTE = [
            ['Ocean Blue', '#4C9AFF'], ['Azure', '#1F6FD0'], ['Cyan', '#22B8CF'], ['Emerald', '#42B883'],
            ['Green', '#2DA44E'], ['Lime', '#8BC34A'], ['Amber', '#E3A008'], ['Orange', '#F97316'],
            ['Red', '#E5484D'], ['Rose', '#E85AAD'], ['Purple', '#945BC4'], ['Indigo', '#6366F1']
        ];
        const LIGHT_TEXT = '#E7E7E7', DARK_TEXT = '#15202B';
        const toRgb = h => { const v = parseInt(h.slice(1), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };
        const toHex = rgb => '#' + rgb.map(c => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0')).join('').toUpperCase();
        const lighten = (h, a) => toHex(toRgb(h).map(c => c + (255 - c) * a));
        const darken = (h, a) => toHex(toRgb(h).map(c => c * (1 - a)));
        const lum = h => { const [r, g, b] = toRgb(h).map(c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
        const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
        const contrastText = bg => (ratio(bg, DARK_TEXT) >= ratio(bg, LIGHT_TEXT) ? DARK_TEXT : LIGHT_TEXT);

        root.innerHTML = `
            <div class="rt">
                <div class="rt__win">
                    <div class="rt__title"><span class="rt__dots">● ● ●</span><span class="rt__cc"><i class="fas fa-search"></i> <span data-s="ws">my-project</span></span><span></span></div>
                    <div class="rt__main">
                        <div class="rt__act"><i class="fas fa-copy"></i><i class="fas fa-search"></i><i class="fas fa-code-branch"></i><i class="fas fa-bug"></i><i class="fas fa-th-large"></i></div>
                        <div class="rt__side"><b>EXPLORER</b><span>▾ src</span><span class="on">&nbsp; extension.ts</span><span>&nbsp; utils.ts</span><span>package.json</span><span>README.md</span></div>
                        <pre class="rt__code"><span class="k">export function</span> <span class="f">activate</span>(context) {
  <span class="k">const</span> color = resolveColor();
  <span class="k">const</span> fg = contrastText(color);
  <span class="c">// paint the three edges</span>
  apply(color, fg);
}</pre>
                    </div>
                    <div class="rt__status"><span class="rt__beacon">● <span data-s="ws2">my-project</span></span><span><i class="fas fa-code-branch"></i> main</span><span class="rt__r">Ln 4, Col 22 · UTF-8 · TypeScript</span></div>
                </div>
                <div class="rt__side-panel">
                    <span class="lab__label">${t('Palette', 'Palet')}</span>
                    <div class="rt__swatches">${PALETTE.map(([n, c]) => `<button type="button" class="rt__sw" style="--sw:${c}" data-c="${c}" title="${n}"></button>`).join('')}
                        <label class="rt__sw rt__sw--custom" title="${t('Custom hex', 'Özel renk')}"><i class="fas fa-eye-dropper"></i><input type="color" value="#42B883"></label></div>
                    <span class="lab__label">${t('Automatic colour from the workspace path', 'Çalışma alanı yolundan otomatik renk')}</span>
                    <input class="rt__path" type="text" value="/home/dev/my-project" spellcheck="false">
                    <div class="rt__toggles">
                        <label class="lab-check"><input type="checkbox" data-k="title" checked> ${t('title bar', 'başlık çubuğu')}</label>
                        <label class="lab-check"><input type="checkbox" data-k="act" checked> ${t('activity bar', 'etkinlik çubuğu')}</label>
                        <label class="lab-check"><input type="checkbox" data-k="status" checked> ${t('status bar', 'durum çubuğu')}</label>
                    </div>
                    <span class="lab__label">${t('Written to .vscode/settings.json', '.vscode/settings.json\'a yazılan')}</span>
                    <pre class="rt__json"></pre>
                </div>
            </div>`;

        const win = root.querySelector('.rt__win');
        const json = root.querySelector('.rt__json');
        const pathIn = root.querySelector('.rt__path');
        const picker = root.querySelector('input[type=color]');
        let color = '#42B883', auto = true;

        async function autoColor() {
            const name = pathIn.value.trim().split(/[\\/]/).filter(Boolean).pop() || 'workspace';
            root.querySelector('[data-s="ws"]').textContent = name;
            root.querySelector('[data-s="ws2"]').textContent = name;
            if (!auto) return;
            let first = 0;
            try {
                const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('file://' + pathIn.value.trim()));
                first = new Uint8Array(buf)[0];
            } catch (e) { first = [...pathIn.value].reduce((s, ch) => (s * 31 + ch.charCodeAt(0)) & 255, 7); }
            color = PALETTE[first % PALETTE.length][1];
            paint();
        }

        function paint() {
            const fg = contrastText(color);
            const on = k => root.querySelector(`[data-k="${k}"]`).checked;
            const s = win.style;
            s.setProperty('--title', on('title') ? color : '#2b2f3a');
            s.setProperty('--title-fg', on('title') ? fg : '#c5c8d0');
            s.setProperty('--cc', on('title') ? fg + '14' : 'rgba(255,255,255,.06)');
            s.setProperty('--act', on('act') ? lighten(color, 0.12) : '#252a35');
            s.setProperty('--act-fg', on('act') ? fg : '#8b93a5');
            s.setProperty('--status', on('status') ? color : '#2b2f3a');
            s.setProperty('--status-fg', on('status') ? fg : '#c5c8d0');
            root.querySelectorAll('.rt__sw[data-c]').forEach(b => b.classList.toggle('is-on', b.dataset.c === color));
            const keys = {};
            if (on('title')) Object.assign(keys, { 'titleBar.activeBackground': color, 'titleBar.activeForeground': fg, 'commandCenter.background': fg + '14' });
            if (on('act')) Object.assign(keys, { 'activityBar.background': lighten(color, 0.12), 'activityBar.foreground': fg });
            if (on('status')) Object.assign(keys, { 'statusBar.background': color, 'statusBar.foreground': fg, 'statusBar.debuggingBackground': darken(color, 0.15) });
            json.textContent = JSON.stringify({ 'workbench.colorCustomizations': keys }, null, 2);
        }

        root.querySelectorAll('.rt__sw[data-c]').forEach(b => b.addEventListener('click', () => { auto = false; color = b.dataset.c; paint(); }));
        picker.addEventListener('input', () => { auto = false; color = picker.value.toUpperCase(); paint(); });
        pathIn.addEventListener('input', () => { auto = true; autoColor(); });
        root.querySelectorAll('[data-k]').forEach(c => c.addEventListener('change', paint));
        autoColor();
        paint();
    }

    /* =================================================================
       7) Face detection + age / gender — face-api.js (TensorFlow.js), on device
       ================================================================= */
    const FACEAPI = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.13/dist/face-api.esm.js';
    const FACE_MODELS = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.13/model/';
    let faceapi = null;

    async function loadFaceApi(status) {
        if (faceapi) return faceapi;
        status(t('Loading the models (about 2 MB, only once)…', 'Modeller yükleniyor (yaklaşık 2 MB, bir kez)…'));
        const m = await import(FACEAPI);
        const api = m.nets ? m : m.default;
        await api.nets.tinyFaceDetector.loadFromUri(FACE_MODELS);
        await api.nets.ageGenderNet.loadFromUri(FACE_MODELS);
        faceapi = api;
        return api;
    }

    function mountFace(root) {
        root.innerHTML = `
            <div class="face">
                <div class="face__stage">
                    <video playsinline muted hidden></video>
                    <img alt="" hidden>
                    <canvas></canvas>
                    <p class="face__empty">${t('Start the camera or open a photo.', 'Kamerayı başlat ya da bir fotoğraf aç.')}</p>
                </div>
                <div class="face__side">
                    <div class="lab__row" style="margin-top:0">
                        <button type="button" class="lab-btn lab-btn--primary" data-act="cam"><i class="fas fa-camera"></i> ${t('Start camera', 'Kamerayı başlat')}</button>
                        <label class="lab-btn"><i class="fas fa-upload"></i> ${t('Open photo', 'Fotoğraf aç')}<input type="file" accept="image/*" hidden></label>
                    </div>
                    <p class="bis__msg" data-s="status"></p>
                    <span class="lab__label">${t('Faces', 'Yüzler')}</span>
                    <ul class="face__list" data-s="list"><li class="lab__muted">–</li></ul>
                    <p class="lab__hint">${t('Age and gender are rough model estimates, shown only to illustrate the graduation project.',
                        'Yaş ve cinsiyet kaba model tahminleridir; yalnızca bitirme projesini göstermek için gösterilir.')}</p>
                </div>
            </div>`;

        const video = root.querySelector('video'), img = root.querySelector('img'), canvas = root.querySelector('canvas');
        const stage = root.querySelector('.face__stage'), empty = root.querySelector('.face__empty');
        const statusEl = root.querySelector('[data-s="status"]'), list = root.querySelector('[data-s="list"]');
        const camBtn = root.querySelector('[data-act="cam"]');
        let stream = null, timer = 0, alive = true;
        const status = (s, warn) => { statusEl.textContent = s; statusEl.classList.toggle('is-warn', !!warn); };

        function draw(results, source, w, h) {
            const r = stage.getBoundingClientRect();
            const scale = Math.min(r.width / w, r.height / h);
            const dw = w * scale, dh = h * scale, ox = (r.width - dw) / 2, oy = (r.height - dh) / 2;
            const ctx = fitCanvas(canvas, r.width, r.height);
            ctx.clearRect(0, 0, r.width, r.height);
            ctx.lineWidth = 2;
            ctx.font = '600 13px Inter, sans-serif';
            results.forEach((f, i) => {
                const b = f.detection.box;
                const bw = b.width * scale, bh = b.height * scale, y = oy + b.y * scale;
                let x = ox + b.x * scale;
                if (source === video) x = r.width - x - bw; // the video is shown mirrored
                ctx.strokeStyle = '#22d3ee';
                ctx.strokeRect(x, y, bw, bh);
                const label = `#${i + 1} · ${Math.round(f.age)}`;
                const tw = ctx.measureText(label).width + 12;
                ctx.fillStyle = '#22d3ee';
                ctx.fillRect(x, y - 22, tw, 20);
                ctx.fillStyle = '#0a0e1a';
                ctx.fillText(label, x + 6, y - 7);
            });
            list.innerHTML = results.length ? results.map((f, i) => `<li><b>#${i + 1}</b> ${t('age', 'yaş')} ≈ ${Math.round(f.age)} · ${
                f.gender === 'male' ? t('man', 'erkek') : t('woman', 'kadın')} ${Math.round(f.genderProbability * 100)}% ·
                <span class="lab__muted">${t('confidence', 'güven')} ${Math.round(f.detection.score * 100)}%</span></li>`).join('')
                : `<li class="lab__muted">${t('No face found.', 'Yüz bulunamadı.')}</li>`;
        }

        async function detect(source, w, h) {
            const api = await loadFaceApi(status);
            const results = await api.detectAllFaces(source, new api.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.45 })).withAgeAndGender();
            if (alive) draw(results, source, w, h);
            return results;
        }

        function stopCamera() {
            clearTimeout(timer);
            stream?.getTracks().forEach(tr => tr.stop());
            stream = null;
            video.hidden = true;
            camBtn.innerHTML = `<i class="fas fa-camera"></i> ${t('Start camera', 'Kamerayı başlat')}`;
        }

        camBtn.addEventListener('click', async () => {
            if (stream) { stopCamera(); return; }
            try {
                stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' }, audio: false });
                video.srcObject = stream;
                await video.play();
                img.hidden = true; video.hidden = false; empty.hidden = true;
                camBtn.innerHTML = `<i class="fas fa-times"></i> ${t('Stop camera', 'Kamerayı durdur')}`;
                await loadFaceApi(status);
                status(t('Running on your device — no frame leaves this page.', 'Cihazında çalışıyor — hiçbir kare bu sayfadan çıkmıyor.'));
                const loop = async () => {
                    if (!stream || !alive) return;
                    try { await detect(video, video.videoWidth, video.videoHeight); } catch (e) { /* frame not ready */ }
                    timer = setTimeout(loop, reduceMotion ? 600 : 150);
                };
                loop();
            } catch (e) {
                stopCamera();
                status(t('Camera not available: ', 'Kamera kullanılamıyor: ') + (e.message || e.name), true);
            }
        });

        root.querySelector('input[type=file]').addEventListener('change', async e => {
            const file = e.target.files[0];
            e.target.value = '';
            if (!file) return;
            stopCamera();
            const url = URL.createObjectURL(file);
            img.onload = async () => {
                img.hidden = false; empty.hidden = true;
                try {
                    const res = await detect(img, img.naturalWidth, img.naturalHeight);
                    status(t(`${res.length} face(s) found — the photo stays in your browser.`, `${res.length} yüz bulundu — fotoğraf tarayıcında kalıyor.`));
                } catch (err) { status(t('Detection failed: ', 'Tespit başarısız: ') + (err.message || err), true); }
                URL.revokeObjectURL(url);
            };
            img.src = url;
        });

        return () => { alive = false; stopCamera(); };
    }

    /* =================================================================
       Registry
       ================================================================= */
    const DEMOS = {
        slam: {
            title: t('LiDAR Mapping', 'LiDAR Haritalama'),
            sub: t('A robot scans the room with a 360° LiDAR and builds an occupancy-grid map in real time.',
                'Robot odayı 360° LiDAR ile tarıyor ve doluluk haritasını gerçek zamanlı oluşturuyor.'),
            note: t('Simplified simulation: mapping uses the robot’s true pose. Hector SLAM additionally estimates that pose by matching each scan to the map.',
                'Sadeleştirilmiş simülasyon: haritalama robotun gerçek konumunu kullanıyor. Hector SLAM bu konumu ayrıca her taramayı haritayla eşleştirerek tahmin eder.'),
            mount: mountSlam
        },
        biscuit: {
            title: t('Biscuit Classifier', 'Bisküvi Sınıflandırıcı'),
            sub: t('Draw a biscuit or drop a photo — its contour is measured and classified by shape and type.',
                'Bir bisküvi çiz ya da fotoğrafını bırak; konturu ölçülüp şekline ve türüne göre sınıflandırılsın.'),
            note: t('In-browser demo using OpenCV-style steps: photos are segmented (background colour + Otsu threshold + largest region), then classified from contour features (convex hull, min-area rectangle) and dough colour. Nothing is uploaded. The original project uses a CNN trained on real biscuit photos.',
                'Tarayıcıda çalışan, OpenCV tarzı adımlarla yapılmış bir demo: fotoğraf bölütlenir (arka plan rengi + Otsu eşiği + en büyük bölge), ardından kontur özelliklerine (dışbükey zarf, en küçük alanlı dikdörtgen) ve hamur rengine göre sınıflandırılır. Hiçbir şey yüklenmez. Asıl proje gerçek bisküvi fotoğraflarıyla eğitilmiş bir CNN kullanıyor.'),
            mount: mountBiscuit
        },
        text: {
            title: 'TextSmith',
            sub: t('Paste any text: statistics, top words and sentiment update as you type.',
                'İstediğin metni yapıştır: istatistikler, sık kelimeler ve duygu analizi yazdıkça güncellenir.'),
            note: t('JavaScript port of the idea for the browser, with a small English/Turkish sentiment lexicon. The original is a Python tool that also reads PDFs.',
                'Fikrin tarayıcı için JavaScript sürümü; küçük bir Türkçe/İngilizce duygu sözlüğü kullanıyor. Asıl araç Python ile yazıldı ve PDF de okuyabiliyor.'),
            mount: mountText
        },
        pipeline: {
            title: t('E-Commerce Data Pipeline', 'E-Ticaret Veri Hattı'),
            sub: t('Trigger an Airflow-style run of the Spark pipeline over the Olist dataset. Click any task to see its code.',
                'Olist veri seti üzerindeki Spark hattını Airflow tarzında çalıştır. Kodunu görmek için herhangi bir göreve tıkla.'),
            note: t('Simulated, illustrative run in the browser — no cluster involved. Row counts are the public Olist dataset’s file sizes.',
                'Tarayıcıda simüle edilen, temsili bir çalıştırma; arkada bir küme yok. Satır sayıları herkese açık Olist veri setinin dosya boyutlarıdır.'),
            mount: mountPipeline
        },
        gridtile: {
            title: 'Grid Tile',
            sub: t('Pick a number and the windows snap into an even grid — then put them back.',
                'Bir sayı seç, pencereler eşit bir ızgaraya otursun; sonra eski yerlerine dönsün.'),
            note: t('Uses the same grid-picking rule as the extension (impl.js); the desktop and windows are a mock-up.',
                'Eklentideki (impl.js) ızgara seçme kuralının aynısını kullanıyor; masaüstü ve pencereler temsili.'),
            mount: mountGridTile
        },
        face: {
            title: t('Face Detection + Age & Gender', 'Yüz Tespiti + Yaş & Cinsiyet'),
            sub: t('Point your camera or open a photo: faces are found and age and gender are estimated, live.',
                'Kamerayı aç ya da bir fotoğraf seç: yüzler bulunur, yaş ve cinsiyet canlı olarak tahmin edilir.'),
            note: t('Runs face-api.js (TensorFlow.js) entirely in your browser — camera frames and photos are never uploaded. The original graduation project ran face recognition and age/gender models on a ROS robot.',
                'face-api.js (TensorFlow.js) tamamen tarayıcında çalışır; kamera görüntüleri ve fotoğraflar hiçbir yere yüklenmez. Asıl bitirme projesi yüz tanıma ve yaş/cinsiyet modellerini bir ROS robotu üzerinde çalıştırıyordu.'),
            mount: mountFace
        },
        rimtone: {
            title: 'Rimtone',
            sub: t('Give every VS Code workspace its own colour on the title, activity and status bars.',
                'Her VS Code çalışma alanına başlık, etkinlik ve durum çubuklarında kendi rengini ver.'),
            note: t('Palette, contrast and automatic-colour logic are copied from the extension; the editor is a mock-up.',
                'Palet, kontrast ve otomatik renk mantığı eklentinin kendisinden alındı; editör temsili.'),
            mount: mountRimtone
        }
    };

    // Deep link: ?demo=<id> opens that demo (used by the notes and the tools page)
    const wanted = new URLSearchParams(location.search).get('demo');
    if (wanted && DEMOS[wanted]) openLab(wanted, document.querySelector(`[data-demo="${wanted}"]`));
})();
