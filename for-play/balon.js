(function () {
    "use strict";

    var K = window.Kasim;
    var ROUND = 30, BEST = "play-balon-best";

    var canvas = document.getElementById("game");
    var ctx = canvas.getContext("2d");
    var scoreEl = document.getElementById("score");
    var timeEl = document.getElementById("time");
    var bestEl = document.getElementById("best");
    var playBtn = document.getElementById("playBtn");

    var W = 0, H = 0, state = "ready", score = 0, timeLeft = ROUND, spawnT = 0, last = 0;
    var balloons = [], bits = [], floats = [];
    bestEl.textContent = parseInt(K.storageGet(BEST), 10) || 0;

    function resize() {
        var r = canvas.getBoundingClientRect();
        var dpr = Math.min(window.devicePixelRatio || 1, 2);
        W = r.width;
        H = r.height;
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function spawn() {
        var gold = Math.random() < 0.07;
        var c = gold ? {h: 45, s: 95, l: 55} : K.PALETTE[Math.floor(Math.random() * K.PALETTE.length)];
        var r = gold ? 22 : 20 + Math.random() * 12;
        var progress = 1 - timeLeft / ROUND;
        balloons.push({
            x: r + Math.random() * (W - r * 2),
            y: H + r * 2,
            r: r,
            vy: (60 + progress * 80) * (0.8 + Math.random() * 0.5) * (gold ? 1.35 : 1),
            phase: Math.random() * 6,
            c: c,
            gold: gold,
            t: 0
        });
    }

    function pop(b, i) {
        balloons.splice(i, 1);
        var gain = b.gold ? 5 : 1;
        score += gain;
        scoreEl.textContent = score;
        K.tone(b.gold ? 988 : 500 + Math.random() * 300, 0.09, "triangle", 0.09);
        for (var k = 0; k < (b.gold ? 18 : 10); k++) {
            var a = Math.random() * Math.PI * 2, sp = 60 + Math.random() * 140;
            bits.push({x: b.x, y: b.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, age: 0,
                color: K.hsl(b.c.h, b.c.s, b.c.l + 10), rot: Math.random() * 6});
        }
        floats.push({x: b.x, y: b.y, text: "+" + gain, age: 0, gold: b.gold});
    }

    function drawBalloon(b) {
        var sway = Math.sin(b.t * 1.4 + b.phase) * 6;
        var x = b.x + sway, y = b.y, r = b.r;
        // string
        ctx.strokeStyle = "rgba(244,235,228,0.35)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, y + r * 1.15);
        ctx.bezierCurveTo(x - 6, y + r * 1.6, x + 6, y + r * 2, x - sway * 0.5, y + r * 2.6);
        ctx.stroke();
        // body
        var g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r * 1.2);
        g.addColorStop(0, K.hsl(b.c.h, b.c.s, b.c.l + 22));
        g.addColorStop(0.6, K.hsl(b.c.h, b.c.s, b.c.l));
        g.addColorStop(1, K.hsl(b.c.h, b.c.s, b.c.l - 20));
        ctx.fillStyle = g;
        if (b.gold) {
            ctx.shadowColor = "rgba(255,210,90,0.8)";
            ctx.shadowBlur = 18;
        }
        ctx.beginPath();
        ctx.ellipse(x, y, r * 0.92, r * 1.1, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        // knot
        ctx.fillStyle = K.hsl(b.c.h, b.c.s, b.c.l - 15);
        ctx.beginPath();
        ctx.moveTo(x, y + r * 1.08);
        ctx.lineTo(x - 4, y + r * 1.25);
        ctx.lineTo(x + 4, y + r * 1.25);
        ctx.fill();
        // shine
        ctx.fillStyle = "rgba(255,255,255,0.35)";
        ctx.beginPath();
        ctx.ellipse(x - r * 0.38, y - r * 0.45, r * 0.16, r * 0.28, -0.5, 0, Math.PI * 2);
        ctx.fill();
        if (b.gold) {
            ctx.fillStyle = "rgba(255,255,255,0.9)";
            ctx.font = "bold " + Math.round(r * 0.8) + "px Georgia, serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("★", x, y + 1);
            ctx.textBaseline = "alphabetic";
        }
        b.drawX = x;
    }

    function loop(now) {
        var dt = Math.min((now - last) / 1000, 0.05);
        last = now;

        if (state === "playing") {
            timeLeft -= dt;
            timeEl.textContent = Math.max(0, Math.ceil(timeLeft));
            if (timeLeft <= 0) end();
            spawnT -= dt;
            if (spawnT <= 0) {
                spawn();
                spawnT = (0.62 - (1 - timeLeft / ROUND) * 0.32) * (0.6 + Math.random() * 0.8);
            }
        } else if (Math.random() < dt * 0.8) {
            spawn();
        }

        for (var i = balloons.length - 1; i >= 0; i--) {
            var b = balloons[i];
            b.t += dt;
            b.y -= b.vy * dt;
            if (b.y < -b.r * 3) balloons.splice(i, 1);
        }
        for (var j = bits.length - 1; j >= 0; j--) {
            var p = bits[j];
            p.age += dt;
            p.vy += 300 * dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.rot += dt * 8;
            if (p.age > 0.8) bits.splice(j, 1);
        }
        for (var k = floats.length - 1; k >= 0; k--) {
            floats[k].age += dt * 1.2;
            if (floats[k].age >= 1) floats.splice(k, 1);
        }

        ctx.clearRect(0, 0, W, H);
        balloons.forEach(drawBalloon);
        bits.forEach(function (p) {
            ctx.globalAlpha = 1 - p.age / 0.8;
            ctx.fillStyle = p.color;
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot);
            ctx.fillRect(-3, -1.5, 6, 3);
            ctx.restore();
        });
        ctx.globalAlpha = 1;
        ctx.font = "italic 600 22px 'Cormorant Garamond', Georgia, serif";
        ctx.textAlign = "center";
        floats.forEach(function (f) {
            ctx.globalAlpha = 1 - f.age;
            ctx.fillStyle = f.gold ? "#ffd65a" : "#f4ebe4";
            ctx.fillText(f.text, f.x, f.y - f.age * 40);
        });
        ctx.globalAlpha = 1;

        requestAnimationFrame(loop);
    }

    canvas.addEventListener("pointerdown", function (e) {
        if (state !== "playing") return;
        var r = canvas.getBoundingClientRect();
        var x = e.clientX - r.left, y = e.clientY - r.top;
        // topmost (last drawn) first, generous hit area for fingers
        for (var i = balloons.length - 1; i >= 0; i--) {
            var b = balloons[i];
            var bx = b.drawX || b.x;
            if (Math.hypot((x - bx) / 0.92, (y - b.y) / 1.1) < b.r + 10) {
                pop(b, i);
                return;
            }
        }
    });

    function start() {
        balloons = [];
        bits = [];
        floats = [];
        score = 0;
        timeLeft = ROUND;
        spawnT = 0.2;
        scoreEl.textContent = "0";
        K.hideOverlay();
        state = "playing";
    }

    function end() {
        state = "over";
        var b = K.best(BEST, score);
        bestEl.textContent = b.best;
        K.overlay({
            title: b.isBest && score > 0 ? "Yeni rekor!" : score + " balon",
            bold: b.isBest && score > 0 ? score + " balon" : "",
            text: score < 15 ? "Balonlar biraz kaçtı, bir daha?" :
                score < 35 ? "Güzel! Ortalık konfeti oldu." :
                    score < 60 ? "Çok hızlısın!" : "Balon ustası! 🎈",
            btn: "bir daha"
        });
    }

    playBtn.addEventListener("click", start);
    window.addEventListener("resize", resize);
    resize();
    requestAnimationFrame(function (t) {
        last = t;
        requestAnimationFrame(loop);
    });
})();
