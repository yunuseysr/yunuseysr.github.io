(function () {
    "use strict";

    var K = window.Kasim;

    /* Coordinates are 0..1 inside a square sky. Strokes are drawn in order;
       a new stroke starts by tapping its first star (no line). */
    function pentagram() {
        var pts = [];
        for (var i = 0; i < 5; i++) {
            var a = -Math.PI / 2 + i * Math.PI * 2 / 5;
            pts.push([0.5 + Math.cos(a) * 0.36, 0.53 + Math.sin(a) * 0.36]);
        }
        return pts;
    }

    function flower() {
        var pts = [];
        for (var i = 0; i < 6; i++) {
            var a = -Math.PI / 2 + i * Math.PI / 3;
            pts.push([0.5 + Math.cos(a) * 0.2, 0.36 + Math.sin(a) * 0.2]);
        }
        return pts.concat([[0.5, 0.74], [0.5, 0.92], [0.32, 0.68]]);
    }

    var SKIES = [
        {
            name: "Kalp",
            note: "Gökyüzündeki en güzel şekil. Isınma turu.",
            stars: [[0.5, 0.34], [0.34, 0.2], [0.16, 0.28], [0.18, 0.5], [0.5, 0.82], [0.82, 0.5], [0.84, 0.28], [0.66, 0.2]],
            strokes: [[0, 1, 2, 3, 4, 5, 6, 7, 0]]
        },
        {
            name: "Kassiopeia",
            note: "Kraliçe Kassiopeia, gökyüzünde bir W harfi gibi durur ve Kuzey Yıldızı'nın etrafında döner.",
            stars: [[0.1, 0.36], [0.3, 0.62], [0.48, 0.44], [0.67, 0.66], [0.88, 0.38]],
            strokes: [[0, 1, 2, 3, 4]]
        },
        {
            name: "Büyükayı",
            note: "Büyük Kepçe de denir. Kepçenin ağzındaki iki yıldızı yukarı uzatırsan Kuzey Yıldızı'nı bulursun.",
            stars: [[0.14, 0.3], [0.16, 0.54], [0.37, 0.6], [0.39, 0.38], [0.56, 0.42], [0.71, 0.48], [0.88, 0.66]],
            strokes: [[6, 5, 4, 3, 0, 1, 2, 3]]
        },
        {
            name: "Küçükayı",
            note: "Kuyruğunun ucundaki yıldız Polaris, yani Kuzey Yıldızı. Gece boyunca neredeyse hiç yer değiştirmez.",
            stars: [[0.86, 0.16], [0.72, 0.26], [0.6, 0.36], [0.46, 0.42], [0.24, 0.38], [0.2, 0.62], [0.42, 0.66]],
            strokes: [[0, 1, 2, 3, 4, 5, 6, 3]]
        },
        {
            name: "Yıldız",
            note: "Kalemi kaldırmadan tek çizgide bir yıldız.",
            stars: pentagram(),
            strokes: [[0, 2, 4, 1, 3, 0]]
        },
        {
            name: "Avcı",
            note: "Orion. Ortada yan yana duran üç yıldız Avcı'nın kemeri; kışın en kolay bulunan takımyıldızlardan biri.",
            stars: [[0.5, 0.1], [0.32, 0.24], [0.68, 0.27], [0.43, 0.5], [0.5, 0.48], [0.57, 0.46], [0.35, 0.84], [0.71, 0.8]],
            strokes: [[1, 0, 2], [1, 3, 4, 5, 2], [3, 6], [5, 7]]
        },
        {
            name: "Kuğu",
            note: "Samanyolu'nun üzerinde kanatlarını açmış süzülen bir kuğu. Kuzey Haçı da denir.",
            stars: [[0.5, 0.1], [0.5, 0.42], [0.5, 0.88], [0.24, 0.36], [0.08, 0.5], [0.76, 0.38], [0.92, 0.24]],
            strokes: [[0, 1, 2], [4, 3, 1, 5, 6]]
        },
        {
            name: "Aslan",
            note: "Başındaki yıldızlar ters bir soru işaretine benzer. En parlak yıldızı Regulus, 'küçük kral'.",
            stars: [[0.3, 0.7], [0.27, 0.5], [0.33, 0.36], [0.25, 0.24], [0.35, 0.13], [0.47, 0.18], [0.68, 0.42], [0.88, 0.6], [0.66, 0.66]],
            strokes: [[5, 4, 3, 2, 1, 0], [2, 6, 7, 8, 0]]
        },
        {
            name: "Kasımpatı",
            note: "Bu gerçek bir takımyıldız değil, ama Kasım gökyüzüne çok yakışırdı.",
            stars: flower(),
            strokes: [[0, 1, 2, 3, 4, 5, 0], [3, 6, 7], [6, 8]]
        }
    ];

    var STORE = "play-yildiz";
    var data = K.jsonGet(STORE, {stars: {}, wishes: 0});

    var canvas = document.getElementById("game");
    var ctx = canvas.getContext("2d");
    var starsEl = document.getElementById("stars");
    var wishesEl = document.getElementById("wishes");
    var label = document.getElementById("skyLabel");
    var levelsEl = document.getElementById("levels");
    var playBtn = document.getElementById("playBtn");

    var W = 0, H = 0, area = {x: 0, y: 0, s: 1};
    var dust = [];         // background stars
    var shooters = [];     // shooting stars
    var floats = [];
    var level = 0, sky, strokeI, posI, drawn, mistakes, flash, startAt, done, nextShooter = 4;
    var drag = false;

    function totalStars() {
        var t = 0;
        for (var k in data.stars) t += data.stars[k];
        return t;
    }

    function save() {
        K.jsonSet(STORE, data);
        K.storageSet("play-yildiz-total", String(totalStars()));
        starsEl.textContent = totalStars();
        wishesEl.textContent = data.wishes;
    }

    function buildChips() {
        levelsEl.textContent = "";
        SKIES.forEach(function (s, i) {
            var b = document.createElement("button");
            b.type = "button";
            b.className = "chip" + (i === level ? " is-active" : "");
            var st = data.stars[s.name] || 0;
            b.textContent = s.name + (st ? " " + "★".repeat(st) : "");
            b.addEventListener("click", function () { load(i); });
            levelsEl.appendChild(b);
        });
        var active = levelsEl.querySelector(".is-active");
        if (active && active.scrollIntoView) active.scrollIntoView({block: "nearest", inline: "center"});
    }

    function resize() {
        var r = canvas.getBoundingClientRect();
        var dpr = Math.min(window.devicePixelRatio || 1, 2);
        W = r.width;
        H = r.height;
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        var s = Math.min(W, H) * 0.86;
        area = {x: (W - s) / 2, y: (H - s) / 2 + 10, s: s};
        dust = [];
        var n = Math.round(W * H / 2600);
        for (var i = 0; i < n; i++) {
            dust.push({x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.1 + 0.2, p: Math.random() * 6, sp: 0.6 + Math.random() * 1.8});
        }
    }

    function pt(i) {
        var p = sky.stars[i];
        return {x: area.x + p[0] * area.s, y: area.y + p[1] * area.s};
    }

    function load(i) {
        level = i;
        sky = SKIES[i];
        strokeI = 0;
        posI = 0;          // index within current stroke of the next star to tap
        drawn = [];        // [a, b] pairs
        mistakes = 0;
        flash = null;
        done = false;
        startAt = 0;
        K.hideOverlay();
        label.textContent = sky.name;
        label.classList.add("show");
        buildChips();
    }

    function target() {
        if (done) return -1;
        return sky.strokes[strokeI][posI];
    }

    function hitStar(x, y) {
        var best = -1, bd = Math.max(26, area.s * 0.07);
        sky.stars.forEach(function (_, i) {
            var p = pt(i);
            var d = Math.hypot(p.x - x, p.y - y);
            if (d < bd) { bd = d; best = i; }
        });
        return best;
    }

    function advance(i) {
        if (!startAt) startAt = Date.now();
        var stroke = sky.strokes[strokeI];
        if (posI > 0) drawn.push([stroke[posI - 1], i]);
        K.tone(520 + posI * 60 + strokeI * 40, 0.25, "sine", 0.08);
        posI++;
        if (posI >= stroke.length) {
            strokeI++;
            posI = 0;
            if (strokeI >= sky.strokes.length) finish();
        }
    }

    function tryStar(i) {
        if (i === -1 || done) return;
        var t = target();
        if (i === t) {
            advance(i);
        } else if (posI > 0 && i === sky.strokes[strokeI][posI - 1]) {
            // tapping the star you're already on — ignore
        } else {
            mistakes++;
            flash = {i: i, t: 0.4};
            K.tone(180, 0.15, "triangle", 0.06);
        }
    }

    function finish() {
        done = true;
        var stars = mistakes === 0 ? 3 : mistakes <= 2 ? 2 : 1;
        var prev = data.stars[sky.name] || 0;
        if (stars > prev) data.stars[sky.name] = stars;
        save();
        [784, 988, 1175].forEach(function (f, k) {
            setTimeout(function () { K.tone(f, 0.4, "sine", 0.07); }, k * 120);
        });
        var secs = (Date.now() - startAt) / 1000;
        setTimeout(function () {
            K.overlay({
                title: sky.name + " " + "★".repeat(stars) + "☆".repeat(3 - stars),
                bold: (mistakes ? mistakes + " yanlış · " : "hatasız · ") + K.fmt(secs),
                text: sky.note,
                btn: level < SKIES.length - 1 ? "sonraki takımyıldız" : "baştan başla"
            });
            buildChips();
        }, 1100);
    }

    /* ---------- shooting stars ---------- */
    function spawnShooter() {
        var fromLeft = Math.random() < 0.5;
        var sp = 320 + Math.random() * 180;
        var ang = (Math.PI / 7) + Math.random() * 0.3;
        shooters.push({
            x: fromLeft ? -20 : W + 20,
            y: Math.random() * H * 0.45,
            vx: (fromLeft ? 1 : -1) * Math.cos(ang) * sp,
            vy: Math.sin(ang) * sp,
            life: 0
        });
    }

    function catchShooter(x, y) {
        for (var i = 0; i < shooters.length; i++) {
            var s = shooters[i];
            if (Math.hypot(s.x - x, s.y - y) < 44) {
                shooters.splice(i, 1);
                data.wishes++;
                save();
                floats.push({x: x, y: y, text: "dilek tuttun ✨", age: 0});
                [1047, 1319, 1568, 2093].forEach(function (f, k) {
                    setTimeout(function () { K.tone(f, 0.25, "sine", 0.05); }, k * 70);
                });
                return true;
            }
        }
        return false;
    }

    /* ---------- drawing ---------- */
    function glowDot(x, y, r, color, blur) {
        ctx.shadowColor = color;
        ctx.shadowBlur = blur;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    }

    function draw(time) {
        ctx.clearRect(0, 0, W, H);
        var t = time / 1000;

        // dust
        for (var i = 0; i < dust.length; i++) {
            var d = dust[i];
            ctx.globalAlpha = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(t * d.sp + d.p));
            ctx.fillStyle = "#e9e4ff";
            ctx.fillRect(d.x, d.y, d.r, d.r);
        }
        ctx.globalAlpha = 1;

        // shooting stars
        shooters.forEach(function (s) {
            var len = 0.16;
            var g = ctx.createLinearGradient(s.x, s.y, s.x - s.vx * len, s.y - s.vy * len);
            g.addColorStop(0, "rgba(255,255,255,0.95)");
            g.addColorStop(1, "rgba(255,255,255,0)");
            ctx.strokeStyle = g;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(s.x, s.y);
            ctx.lineTo(s.x - s.vx * len, s.y - s.vy * len);
            ctx.stroke();
            glowDot(s.x, s.y, 2.2, "#fff", 12);
        });

        if (!sky) return;
        var accent = getComputedStyle(document.documentElement).getPropertyValue("--flower").trim() || "#ffd27a";

        // drawn lines
        ctx.lineCap = "round";
        ctx.shadowColor = accent;
        ctx.shadowBlur = done ? 14 + Math.sin(t * 3) * 6 : 8;
        ctx.strokeStyle = accent;
        ctx.lineWidth = done ? 2.6 : 2;
        drawn.forEach(function (ln) {
            var a = pt(ln[0]), b = pt(ln[1]);
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
        });
        ctx.shadowBlur = 0;

        // rubber band from current star to pointer while dragging
        if (!done && posI > 0 && drag && pointer) {
            var cur = pt(sky.strokes[strokeI][posI - 1]);
            ctx.strokeStyle = "rgba(255,255,255,0.25)";
            ctx.setLineDash([4, 6]);
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(cur.x, cur.y);
            ctx.lineTo(pointer.x, pointer.y);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // stars
        var tg = target();
        sky.stars.forEach(function (_, i) {
            var p = pt(i);
            var tw = 0.85 + 0.15 * Math.sin(t * 2.2 + i * 1.7);
            if (i === tg) {
                var pulse = (t * 1.2) % 1;
                ctx.strokeStyle = "rgba(255,255,255," + (0.6 * (1 - pulse)) + ")";
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.arc(p.x, p.y, 8 + pulse * 18, 0, Math.PI * 2);
                ctx.stroke();
                glowDot(p.x, p.y, 5.5, "#fffbe8", 22);
            } else {
                glowDot(p.x, p.y, 3.4 * tw, "#f4efff", 10);
            }
            if (flash && flash.i === i) {
                ctx.strokeStyle = "rgba(255,93,122," + flash.t * 2 + ")";
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(p.x, p.y, 12, 0, Math.PI * 2);
                ctx.stroke();
            }
        });

        // floating texts
        ctx.font = "italic 600 20px 'Cormorant Garamond', Georgia, serif";
        ctx.textAlign = "center";
        floats.forEach(function (f) {
            ctx.globalAlpha = 1 - f.age;
            ctx.fillStyle = "#fff4c9";
            ctx.fillText(f.text, f.x, f.y - f.age * 30);
        });
        ctx.globalAlpha = 1;
    }

    var last = 0;

    function loop(time) {
        var dt = Math.min((time - last) / 1000, 0.05);
        last = time;
        nextShooter -= dt;
        if (nextShooter <= 0) {
            spawnShooter();
            nextShooter = 7 + Math.random() * 9;
        }
        for (var i = shooters.length - 1; i >= 0; i--) {
            var s = shooters[i];
            s.x += s.vx * dt;
            s.y += s.vy * dt;
            s.life += dt;
            if (s.life > 4) shooters.splice(i, 1);
        }
        for (var j = floats.length - 1; j >= 0; j--) {
            floats[j].age += dt * 0.7;
            if (floats[j].age >= 1) floats.splice(j, 1);
        }
        if (flash) {
            flash.t -= dt;
            if (flash.t <= 0) flash = null;
        }
        draw(time);
        requestAnimationFrame(loop);
    }

    /* ---------- input: tap stars, or drag from star to star ---------- */
    var pointer = null;

    function local(e) {
        var r = canvas.getBoundingClientRect();
        return {x: e.clientX - r.left, y: e.clientY - r.top};
    }

    canvas.addEventListener("pointerdown", function (e) {
        var p = local(e);
        pointer = p;
        if (catchShooter(p.x, p.y)) return;
        label.classList.remove("show");
        drag = true;
        try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
        tryStar(hitStar(p.x, p.y));
    });

    canvas.addEventListener("pointermove", function (e) {
        if (!drag) return;
        pointer = local(e);
        // while dragging, reaching the target star connects it (no penalty for passing others)
        var i = hitStar(pointer.x, pointer.y);
        if (i !== -1 && i === target() && posI > 0) advance(i);
    });

    function up() {
        drag = false;
        pointer = null;
    }

    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);

    playBtn.addEventListener("click", function () {
        load(done ? (level + 1) % SKIES.length : level);
    });

    window.addEventListener("resize", resize);
    resize();
    save();
    // start from the first sky without 3 stars
    var first = 0;
    while (first < SKIES.length - 1 && (data.stars[SKIES[first].name] || 0) === 3) first++;
    load(first);
    requestAnimationFrame(function (t) {
        last = t;
        requestAnimationFrame(loop);
    });
})();
