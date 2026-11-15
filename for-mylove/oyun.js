(function () {
    "use strict";

    var ROUND = 60; // seconds

    /* Same palette as script.js — the game uses today's flower colour. */
    var PALETTE = {
        "altın sarısı": [45, 95, 56],
        "bal turuncusu": [28, 92, 55],
        "bordo": [345, 68, 40],
        "pembe": [330, 78, 68],
        "lavanta": [268, 58, 70],
        "mor": [285, 60, 50],
        "kar beyazı": [45, 35, 90],
        "mercan": [10, 85, 62],
        "kırmızı": [355, 78, 50],
        "şeftali": [22, 90, 74],
        "eflatun": [300, 52, 62],
        "limon yeşili": [75, 60, 60]
    };

    function storageGet(key) {
        try { return window.localStorage.getItem(key); } catch (e) { return null; }
    }

    function storageSet(key, val) {
        try { window.localStorage.setItem(key, val); } catch (e) { /* ignore */ }
    }

    function clamp(v, lo, hi) {
        return Math.max(lo, Math.min(hi, v));
    }

    function hsl(h, s, l, a) {
        return "hsl(" + h + " " + clamp(s, 0, 100) + "% " + clamp(l, 0, 100) + "%" +
            (a !== undefined ? " / " + a : "") + ")";
    }

    var base = PALETTE[storageGet("kasimpati-last")] || PALETTE["altın sarısı"];
    var H0 = base[0], S0 = base[1], L0 = base[2];
    var root = document.documentElement;
    root.style.setProperty("--flower", hsl(H0, S0, clamp(L0, 55, 80)));
    root.style.setProperty("--flower-soft", hsl(H0, S0, L0, 0.22));

    var LEAF_COLORS = ["#8e5a2a", "#6f3a1c", "#9a6b32", "#5e3a20"];

    /* ---------- DOM ---------- */
    var canvas = document.getElementById("game");
    var ctx = canvas.getContext("2d");
    var scoreEl = document.getElementById("score");
    var timeEl = document.getElementById("time");
    var bestEl = document.getElementById("best");
    var comboEl = document.getElementById("combo");
    var overlay = document.getElementById("overlay");
    var ovTitle = document.getElementById("ovTitle");
    var ovText = document.getElementById("ovText");
    var playBtn = document.getElementById("playBtn");
    var legend = overlay.querySelector(".legend");

    var best = parseInt(storageGet("kasimpati-best"), 10) || 0;
    bestEl.textContent = best;

    /* ---------- state ---------- */
    var W = 0, H = 0;
    var state = "ready"; // ready | playing | over
    var items = [], sparks = [], floats = [];
    var score = 0, combo = 0, timeLeft = ROUND, spawnTimer = 0;
    var basket = {x: 0, y: 0, w: 76, target: 0};
    var keys = {left: false, right: false};
    var last = 0;

    function resize() {
        var r = canvas.getBoundingClientRect();
        var dpr = Math.min(window.devicePixelRatio || 1, 2);
        W = r.width;
        H = r.height;
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        basket.w = clamp(W * 0.2, 64, 96);
        basket.y = H - 34;
        if (!basket.x) basket.x = basket.target = W / 2;
        basket.x = basket.target = clamp(basket.x, basket.w / 2, W - basket.w / 2);
    }

    /* ---------- spawning ---------- */
    function spawn() {
        var r = Math.random();
        var type = r < 0.08 ? "heart" : r < 0.3 ? "leaf" : "petal";
        var progress = 1 - timeLeft / ROUND; // 0 → 1 over the round
        items.push({
            type: type,
            x: 20 + Math.random() * (W - 40),
            y: -20,
            vy: (70 + progress * 90) * (0.8 + Math.random() * 0.5) * (type === "heart" ? 1.15 : 1),
            phase: Math.random() * Math.PI * 2,
            sway: 18 + Math.random() * 30,
            rot: Math.random() * Math.PI * 2,
            vr: (Math.random() - 0.5) * 3,
            size: type === "leaf" ? 9 + Math.random() * 4 : type === "heart" ? 11 : 7 + Math.random() * 3,
            tone: Math.random() * 16 - 8,
            color: LEAF_COLORS[Math.floor(Math.random() * LEAF_COLORS.length)],
            t: 0
        });
    }

    /* ---------- catching ---------- */
    function burst(x, y, color, n) {
        for (var i = 0; i < n; i++) {
            var a = Math.random() * Math.PI * 2;
            var sp = 40 + Math.random() * 110;
            sparks.push({x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, life: 0.6 + Math.random() * 0.4, age: 0, color: color});
        }
    }

    function floatText(x, y, text, color) {
        floats.push({x: x, y: y, text: text, color: color, age: 0});
    }

    function catchItem(it) {
        if (it.type === "leaf") {
            if (combo >= 5) floatText(it.x, basket.y - 24, "seri bitti", "#c9b8ad");
            combo = 0;
            burst(it.x, basket.y - 6, it.color, 6);
        } else {
            combo++;
            var gain = it.type === "heart" ? 5 : 1;
            gain += Math.floor(combo / 10); // gentle streak bonus
            score += gain;
            var c = it.type === "heart" ? "#ff5d7a" : hsl(H0, S0, L0 + 10);
            floatText(it.x, basket.y - 24, "+" + gain, c);
            burst(it.x, basket.y - 6, c, it.type === "heart" ? 16 : 9);
        }
        scoreEl.textContent = score;
        updateCombo();
    }

    function updateCombo() {
        if (combo >= 5) {
            comboEl.textContent = combo + " seri" + (combo >= 10 ? " · +" + Math.floor(combo / 10) + " bonus" : "");
            comboEl.classList.add("show");
        } else {
            comboEl.classList.remove("show");
        }
    }

    /* ---------- drawing ---------- */
    function drawPetal(it) {
        var s = it.size;
        ctx.save();
        ctx.translate(it.x, it.y);
        ctx.rotate(it.rot);
        var g = ctx.createLinearGradient(0, s * 1.6, 0, -s * 1.6);
        g.addColorStop(0, hsl(H0, S0, L0 - 20 + it.tone));
        g.addColorStop(0.6, hsl(H0, S0, L0 + it.tone));
        g.addColorStop(1, hsl(H0, S0 - 8, L0 + 16 + it.tone));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(0, s * 1.6);
        ctx.bezierCurveTo(-s * 0.9, s * 0.6, -s, -s * 1.1, 0, -s * 1.6);
        ctx.bezierCurveTo(s, -s * 1.1, s * 0.9, s * 0.6, 0, s * 1.6);
        ctx.fill();
        ctx.strokeStyle = hsl(H0, S0 - 10, L0 + 24, 0.4);
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.moveTo(0, s * 1.2);
        ctx.lineTo(0, -s * 1.2);
        ctx.stroke();
        ctx.restore();
    }

    function drawLeaf(it) {
        var s = it.size;
        ctx.save();
        ctx.translate(it.x, it.y);
        ctx.rotate(it.rot);
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = it.color;
        ctx.beginPath();
        ctx.moveTo(-s, s);
        ctx.quadraticCurveTo(-s, -s, s, -s);
        ctx.quadraticCurveTo(s, s, -s, s);
        ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,0.25)";
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(-s, s);
        ctx.lineTo(s * 0.8, -s * 0.8);
        ctx.stroke();
        ctx.restore();
    }

    function heartPath(s) {
        ctx.beginPath();
        ctx.moveTo(0, s * 0.9);
        ctx.bezierCurveTo(-s * 1.4, 0, -s * 0.9, -s * 1.1, 0, -s * 0.35);
        ctx.bezierCurveTo(s * 0.9, -s * 1.1, s * 1.4, 0, 0, s * 0.9);
    }

    function drawHeart(it) {
        var pulse = 1 + Math.sin(it.t * 6) * 0.08;
        ctx.save();
        ctx.translate(it.x, it.y);
        ctx.rotate(Math.sin(it.t * 2) * 0.25);
        ctx.scale(pulse, pulse);
        ctx.shadowColor = "rgba(255, 93, 122, 0.7)";
        ctx.shadowBlur = 14;
        ctx.fillStyle = "#ff5d7a";
        heartPath(it.size);
        ctx.fill();
        ctx.restore();
    }

    function drawBasket() {
        var x = basket.x, y = basket.y, w = basket.w;
        ctx.save();
        // glow
        var glow = ctx.createRadialGradient(x, y, 4, x, y, w * 0.9);
        glow.addColorStop(0, hsl(H0, S0, L0, 0.22));
        glow.addColorStop(1, "transparent");
        ctx.fillStyle = glow;
        ctx.fillRect(x - w, y - w, w * 2, w * 2);
        // bowl
        var g = ctx.createLinearGradient(0, y - 10, 0, y + 18);
        g.addColorStop(0, "#c9a27a");
        g.addColorStop(1, "#6b4426");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(x - w / 2, y - 8);
        ctx.quadraticCurveTo(x - w / 2 + 4, y + 18, x, y + 18);
        ctx.quadraticCurveTo(x + w / 2 - 4, y + 18, x + w / 2, y - 8);
        ctx.closePath();
        ctx.fill();
        // weave lines
        ctx.strokeStyle = "rgba(60, 35, 18, 0.45)";
        ctx.lineWidth = 1;
        for (var i = 1; i < 3; i++) {
            ctx.beginPath();
            ctx.moveTo(x - w / 2 + i * 3, y - 8 + i * 8);
            ctx.lineTo(x + w / 2 - i * 3, y - 8 + i * 8);
            ctx.stroke();
        }
        // rim
        ctx.fillStyle = "#e0bf95";
        ctx.beginPath();
        ctx.ellipse(x, y - 8, w / 2, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        // collected petals peeking out
        var shown = Math.min(score, 7);
        for (var p = 0; p < shown; p++) {
            var px = x - w * 0.3 + (p / 6) * w * 0.6;
            ctx.fillStyle = hsl(H0, S0, L0 + (p % 2 ? 8 : -6));
            ctx.beginPath();
            ctx.ellipse(px, y - 11, 3, 6, (p - 3) * 0.25, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }

    function draw() {
        ctx.clearRect(0, 0, W, H);

        for (var i = 0; i < items.length; i++) {
            var it = items[i];
            if (it.type === "petal") drawPetal(it);
            else if (it.type === "leaf") drawLeaf(it);
            else drawHeart(it);
        }

        drawBasket();

        for (var j = 0; j < sparks.length; j++) {
            var sp = sparks[j];
            ctx.globalAlpha = 1 - sp.age / sp.life;
            ctx.fillStyle = sp.color;
            ctx.beginPath();
            ctx.arc(sp.x, sp.y, 2, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        ctx.font = "italic 600 20px 'Cormorant Garamond', Georgia, serif";
        ctx.textAlign = "center";
        for (var k = 0; k < floats.length; k++) {
            var f = floats[k];
            ctx.globalAlpha = 1 - f.age;
            ctx.fillStyle = f.color;
            ctx.fillText(f.text, f.x, f.y - f.age * 40);
        }
        ctx.globalAlpha = 1;
    }

    /* ---------- update ---------- */
    function update(dt) {
        if (state === "playing") {
            timeLeft -= dt;
            if (timeLeft <= 0) {
                timeLeft = 0;
                endGame();
            }
            timeEl.textContent = Math.ceil(timeLeft);

            spawnTimer -= dt;
            if (spawnTimer <= 0) {
                spawn();
                var progress = 1 - timeLeft / ROUND;
                spawnTimer = (0.75 - progress * 0.4) * (0.6 + Math.random() * 0.8);
            }
        } else if (state === "ready" && Math.random() < dt * 1.2) {
            spawn(); // gentle drift behind the start screen
        }

        // basket: keyboard + smooth follow
        var kSpeed = W * 1.3;
        if (keys.left) basket.target -= kSpeed * dt;
        if (keys.right) basket.target += kSpeed * dt;
        basket.target = clamp(basket.target, basket.w / 2, W - basket.w / 2);
        basket.x += (basket.target - basket.x) * Math.min(1, dt * 16);

        for (var i = items.length - 1; i >= 0; i--) {
            var it = items[i];
            it.t += dt;
            it.y += it.vy * dt;
            it.x += Math.cos(it.t * 1.6 + it.phase) * it.sway * dt;
            it.rot += it.vr * dt;

            if (state === "playing" &&
                it.y > basket.y - 14 && it.y < basket.y + 10 &&
                Math.abs(it.x - basket.x) < basket.w / 2 + 4) {
                catchItem(it);
                items.splice(i, 1);
                continue;
            }
            if (it.y > H + 30) {
                items.splice(i, 1);
            }
        }

        for (var j = sparks.length - 1; j >= 0; j--) {
            var sp = sparks[j];
            sp.age += dt;
            sp.vy += 220 * dt;
            sp.x += sp.vx * dt;
            sp.y += sp.vy * dt;
            if (sp.age >= sp.life) sparks.splice(j, 1);
        }

        for (var k = floats.length - 1; k >= 0; k--) {
            floats[k].age += dt * 1.1;
            if (floats[k].age >= 1) floats.splice(k, 1);
        }
    }

    function loop(now) {
        var dt = Math.min((now - last) / 1000, 0.05); // clamp after tab switches
        last = now;
        update(dt);
        draw();
        requestAnimationFrame(loop);
    }

    /* ---------- round flow ---------- */
    function startGame() {
        items = [];
        sparks = [];
        floats = [];
        score = 0;
        combo = 0;
        timeLeft = ROUND;
        spawnTimer = 0.3;
        scoreEl.textContent = "0";
        timeEl.textContent = ROUND;
        updateCombo();
        overlay.classList.add("hidden");
        state = "playing";
    }

    var MESSAGES = [
        [0, "Yaprakların çoğu rüzgâra kaçtı ama olsun, en güzel çiçek zaten yanımda."],
        [20, "Avucunda küçük bir demet birikti. Tatlı bir başlangıç!"],
        [45, "Bu kadar yaprakla koca bir buket olur. Harikasın!"],
        [80, "Neredeyse bütün kasımpatıyı topladın. Elin çok hızlı!"],
        [120, "İnanılmaz! Bütün Kasım'ı avuçlarına topladın."]
    ];

    function endGame() {
        state = "over";
        combo = 0;
        updateCombo();

        var isBest = score > best;
        if (isBest) {
            best = score;
            storageSet("kasimpati-best", String(best));
            bestEl.textContent = best;
        }

        var msg = MESSAGES[0][1];
        MESSAGES.forEach(function (m) { if (score >= m[0]) msg = m[1]; });

        ovTitle.textContent = isBest && score > 0 ? "Yeni rekor! ❦" : score + " yaprak";
        ovText.innerHTML = "";
        if (isBest && score > 0) {
            var b = document.createElement("b");
            b.textContent = score + " yaprak";
            ovText.appendChild(b);
            ovText.appendChild(document.createElement("br"));
        }
        ovText.appendChild(document.createTextNode(msg));
        legend.style.display = "none";
        playBtn.textContent = "bir daha";
        overlay.classList.remove("hidden");
        setTimeout(function () { playBtn.focus(); }, 50);
    }

    /* ---------- input ---------- */
    function pointerToX(e) {
        var r = canvas.getBoundingClientRect();
        basket.target = e.clientX - r.left;
    }

    canvas.addEventListener("pointermove", pointerToX);
    canvas.addEventListener("pointerdown", function (e) {
        pointerToX(e);
        if (canvas.setPointerCapture) canvas.setPointerCapture(e.pointerId);
    });

    window.addEventListener("keydown", function (e) {
        if (e.key === "ArrowLeft" || e.key === "a") { keys.left = true; e.preventDefault(); }
        if (e.key === "ArrowRight" || e.key === "d") { keys.right = true; e.preventDefault(); }
        if ((e.key === " " || e.key === "Enter") && state !== "playing" && document.activeElement !== playBtn) {
            e.preventDefault();
            startGame();
        }
    });

    window.addEventListener("keyup", function (e) {
        if (e.key === "ArrowLeft" || e.key === "a") keys.left = false;
        if (e.key === "ArrowRight" || e.key === "d") keys.right = false;
    });

    playBtn.addEventListener("click", startGame);
    window.addEventListener("resize", resize);

    resize();
    requestAnimationFrame(function (now) {
        last = now;
        requestAnimationFrame(loop);
    });
})();
