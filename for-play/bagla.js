(function () {
    "use strict";

    var K = window.Kasim;
    var COLORS = ["#ff5d7a", "#ffc23d", "#5bc0eb", "#7bd389", "#b388ff", "#ff8c42", "#f4ebe4", "#2ec4b6", "#e05780", "#a3a847", "#7f8cff", "#d4a373"];
    var SOLVED = "play-bagla-solved";

    var canvas = document.getElementById("game");
    var ctx = canvas.getContext("2d");
    var fillEl = document.getElementById("fill");
    var solvedEl = document.getElementById("best");
    var sizesEl = document.getElementById("sizes");
    var newBtn = document.getElementById("newBtn");
    var playBtn = document.getElementById("playBtn");

    var N = parseInt(K.storageGet("play-bagla-size"), 10) || 5;
    var dots;      // cell → colour index (endpoints only), -1 otherwise
    var ends;      // colour → [cellA, cellB]
    var paths;     // colour → [cells]
    var active = -1, size = 300, cell = 60, done = false;
    var solved = parseInt(K.storageGet(SOLVED), 10) || 0;
    solvedEl.textContent = solved;

    /* ---------- generator ---------- */
    function nbrs(i) {
        var x = i % N, y = Math.floor(i / N), out = [];
        if (x > 0) out.push(i - 1);
        if (x < N - 1) out.push(i + 1);
        if (y > 0) out.push(i - N);
        if (y < N - 1) out.push(i + N);
        return out;
    }

    function adjacent(a, b) {
        return nbrs(a).indexOf(b) !== -1;
    }

    /* Random Hamiltonian path via "backbite" moves on a zig-zag start. */
    function hamiltonian() {
        var path = [];
        for (var y = 0; y < N; y++) {
            for (var x = 0; x < N; x++) path.push(y * N + (y % 2 ? N - 1 - x : x));
        }
        var at = new Array(N * N);
        var reindex = function () { path.forEach(function (c, k) { at[c] = k; }); };
        reindex();
        for (var it = 0; it < N * N * 40; it++) {
            if (Math.random() < 0.5) { path.reverse(); reindex(); }
            var head = path[0];
            var opts = nbrs(head).filter(function (c) { return c !== path[1]; });
            var n = opts[Math.floor(Math.random() * opts.length)];
            var k = at[n];
            var front = path.slice(0, k).reverse();
            path = front.concat(path.slice(k));
            reindex();
        }
        return path;
    }

    function generate() {
        var path = hamiltonian();
        var total = N * N, maxLen = N + 2, segs = [], i = 0;
        while (i < total) {
            var len = 3 + Math.floor(Math.random() * (maxLen - 2));
            if (total - (i + len) < 3) len = total - i;
            segs.push(path.slice(i, i + len));
            i += len;
        }
        if (segs.length > COLORS.length) return generate();
        dots = new Array(total).fill(-1);
        ends = [];
        paths = [];
        segs.forEach(function (s, c) {
            ends.push([s[0], s[s.length - 1]]);
            dots[s[0]] = c;
            dots[s[s.length - 1]] = c;
            paths.push([]);
        });
    }

    /* ---------- rules ---------- */
    function complete(c) {
        var p = paths[c];
        return p.length > 1 && dots[p[p.length - 1]] === c && p[p.length - 1] !== p[0];
    }

    function ownerOf(i) {
        for (var c = 0; c < paths.length; c++) {
            var k = paths[c].indexOf(i);
            if (k !== -1) return {c: c, k: k};
        }
        return null;
    }

    function extend(i) {
        var p = paths[active], lastCell = p[p.length - 1];
        if (!adjacent(lastCell, i)) return false;
        var k = p.indexOf(i);
        if (k !== -1) { p.length = k + 1; return true; }       // backtrack
        if (complete(active)) return false;
        if (dots[i] !== -1 && dots[i] !== active) return false;
        var o = ownerOf(i);
        if (o && o.c !== active) paths[o.c].length = o.k;     // cut the other line
        p.push(i);
        if (complete(active)) K.tone(660 + active * 40, 0.18, "sine", 0.08);
        else K.tone(300 + p.length * 12, 0.03, "triangle", 0.025);
        return true;
    }

    function stepTowards(target) {
        var guard = 0;
        while (guard++ < N * 2) {
            var p = paths[active], lastCell = p[p.length - 1];
            if (lastCell === target) return;
            var lx = lastCell % N, ly = Math.floor(lastCell / N), tx = target % N, ty = Math.floor(target / N);
            var dx = tx - lx, dy = ty - ly, next;
            if (Math.abs(dx) >= Math.abs(dy)) next = lastCell + Math.sign(dx);
            else next = lastCell + Math.sign(dy) * N;
            if (!extend(next)) return;
        }
    }

    function coverage() {
        var covered = 0;
        paths.forEach(function (p) { covered += p.length; });
        dots.forEach(function (d, i) {
            if (d !== -1 && !paths[d].some(function (c) { return c === i; })) covered++;
        });
        return covered / (N * N);
    }

    function check() {
        var pct = Math.round(coverage() * 100);
        fillEl.textContent = pct + "%";
        var allLinked = paths.every(function (_, c) { return complete(c); });
        if (allLinked && pct === 100 && !done) win();
        else if (allLinked && pct < 100) K.toast("hepsi bağlı! şimdi boş kareleri de doldur");
    }

    function win() {
        done = true;
        solved++;
        K.storageSet(SOLVED, String(solved));
        solvedEl.textContent = solved;
        [523, 659, 784, 1047].forEach(function (f, k) {
            setTimeout(function () { K.tone(f, 0.22, "sine", 0.06); }, k * 100);
        });
        setTimeout(function () {
            K.overlay({title: "Akış tamam!", bold: N + "×" + N + " · " + paths.length + " renk", text: "Bütün renkler buluştu.", btn: "sonraki bölüm"});
        }, 500);
    }

    /* ---------- drawing ---------- */
    function resize() {
        var parent = canvas.parentElement.getBoundingClientRect();
        size = Math.floor(Math.min(parent.width, parent.height) - 20);
        cell = size / N;
        var dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.style.width = size + "px";
        canvas.style.height = size + "px";
        canvas.width = Math.round(size * dpr);
        canvas.height = Math.round(size * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        draw();
    }

    function center(i) {
        return {x: (i % N + 0.5) * cell, y: (Math.floor(i / N) + 0.5) * cell};
    }

    function draw() {
        if (!dots) return;
        ctx.clearRect(0, 0, size, size);

        // filled tint
        paths.forEach(function (p, c) {
            ctx.fillStyle = COLORS[c] + "26";
            p.forEach(function (i) {
                ctx.fillRect((i % N) * cell + 1, Math.floor(i / N) * cell + 1, cell - 2, cell - 2);
            });
        });

        // grid
        ctx.strokeStyle = "rgba(244,235,228,0.1)";
        ctx.lineWidth = 1;
        for (var k = 0; k <= N; k++) {
            ctx.beginPath();
            ctx.moveTo(k * cell, 0);
            ctx.lineTo(k * cell, size);
            ctx.moveTo(0, k * cell);
            ctx.lineTo(size, k * cell);
            ctx.stroke();
        }

        // lines
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        paths.forEach(function (p, c) {
            if (p.length < 2) return;
            ctx.strokeStyle = COLORS[c];
            ctx.lineWidth = cell * 0.32;
            ctx.beginPath();
            p.forEach(function (i, n) {
                var pt = center(i);
                if (n) ctx.lineTo(pt.x, pt.y); else ctx.moveTo(pt.x, pt.y);
            });
            ctx.stroke();
        });

        // dots
        dots.forEach(function (c, i) {
            if (c === -1) return;
            var pt = center(i);
            ctx.fillStyle = COLORS[c];
            ctx.shadowColor = COLORS[c];
            ctx.shadowBlur = complete(c) ? 14 : 0;
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, cell * 0.33, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
        });
    }

    /* ---------- input ---------- */
    function cellAt(e) {
        var r = canvas.getBoundingClientRect();
        var x = Math.floor((e.clientX - r.left) / cell), y = Math.floor((e.clientY - r.top) / cell);
        if (x < 0 || y < 0 || x >= N || y >= N) return -1;
        return y * N + x;
    }

    canvas.addEventListener("pointerdown", function (e) {
        if (done) return;
        var i = cellAt(e);
        if (i === -1) return;
        if (dots[i] !== -1) {
            active = dots[i];
            paths[active] = [i];
        } else {
            var o = ownerOf(i);
            if (!o) return;
            active = o.c;
            paths[active].length = o.k + 1;
        }
        try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
        draw();
    });

    canvas.addEventListener("pointermove", function (e) {
        if (active === -1) return;
        var i = cellAt(e);
        if (i === -1) return;
        stepTowards(i);
        draw();
    });

    function up() {
        if (active === -1) return;
        active = -1;
        draw();
        check();
    }

    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);

    function newLevel() {
        done = false;
        active = -1;
        K.hideOverlay();
        Array.prototype.forEach.call(sizesEl.children, function (b) {
            b.classList.toggle("is-active", +b.dataset.v === N);
        });
        generate();
        fillEl.textContent = "0%";
        resize();
    }

    Array.prototype.forEach.call(sizesEl.children, function (b) {
        b.addEventListener("click", function () {
            N = +b.dataset.v;
            K.storageSet("play-bagla-size", String(N));
            newLevel();
        });
    });
    newBtn.addEventListener("click", newLevel);
    playBtn.addEventListener("click", newLevel);
    window.addEventListener("resize", resize);
    newLevel();
})();
