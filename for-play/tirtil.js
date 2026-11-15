(function () {
    "use strict";

    var K = window.Kasim;
    var hsl = K.hsl, C = K.color;
    var COLS = 16, ROWS = 16;
    var BEST_KEY = "play-tirtil-best";

    var canvas = document.getElementById("game");
    var ctx = canvas.getContext("2d");
    var scoreEl = document.getElementById("score");
    var bestEl = document.getElementById("best");
    var overlay = document.getElementById("overlay");
    var ovTitle = document.getElementById("ovTitle");
    var ovText = document.getElementById("ovText");
    var playBtn = document.getElementById("playBtn");

    var best = parseInt(K.storageGet(BEST_KEY), 10) || 0;
    bestEl.textContent = best;

    var cell = 20, size = 320;
    var snake, dir, queue, food, score, state = "ready", acc = 0, step = 0.16, last = 0, pulse = 0;

    function resize() {
        var parent = canvas.parentElement.getBoundingClientRect();
        var avail = Math.min(parent.width, parent.height) - 24;
        cell = Math.max(12, Math.floor(avail / COLS));
        size = cell * COLS;
        var dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.style.width = size + "px";
        canvas.style.height = size + "px";
        canvas.width = size * dpr;
        canvas.height = size * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        draw();
    }

    function reset() {
        var mid = Math.floor(ROWS / 2);
        snake = [{x: 5, y: mid}, {x: 4, y: mid}, {x: 3, y: mid}];
        dir = {x: 1, y: 0};
        queue = [];
        score = 0;
        step = 0.16;
        scoreEl.textContent = "0";
        placeFood();
    }

    function placeFood() {
        var free = [];
        for (var y = 0; y < ROWS; y++) {
            for (var x = 0; x < COLS; x++) {
                if (!snake.some(function (s) { return s.x === x && s.y === y; })) free.push({x: x, y: y});
            }
        }
        food = free[Math.floor(Math.random() * free.length)];
        food.rot = Math.random() * Math.PI;
    }

    function turn(dx, dy) {
        var lastDir = queue.length ? queue[queue.length - 1] : dir;
        if (lastDir.x === -dx && lastDir.y === -dy) return; // no reversing
        if (lastDir.x === dx && lastDir.y === dy) return;
        if (queue.length < 3) queue.push({x: dx, y: dy});
    }

    function tick() {
        if (queue.length) dir = queue.shift();
        var head = {
            x: (snake[0].x + dir.x + COLS) % COLS,
            y: (snake[0].y + dir.y + ROWS) % ROWS
        };
        var eats = head.x === food.x && head.y === food.y;
        var body = eats ? snake : snake.slice(0, -1);
        if (body.some(function (s) { return s.x === head.x && s.y === head.y; })) {
            return gameOver();
        }
        snake.unshift(head);
        if (eats) {
            score++;
            scoreEl.textContent = score;
            step = Math.max(0.075, step - 0.004);
            pulse = 1;
            K.tone(600 + Math.min(score, 30) * 15, 0.08, "sine", 0.07);
            placeFood();
        } else {
            snake.pop();
        }
    }

    function gameOver() {
        state = "over";
        K.tone(140, 0.4, "sawtooth", 0.05);
        var isBest = score > best;
        if (isBest) {
            best = score;
            K.storageSet(BEST_KEY, String(best));
            bestEl.textContent = best;
        }
        ovTitle.textContent = isBest && score > 0 ? "Yeni rekor!" : score + " yaprak";
        ovText.innerHTML = "";
        if (isBest && score > 0) {
            var b = document.createElement("b");
            b.textContent = score + " yaprak";
            ovText.appendChild(b);
            ovText.appendChild(document.createElement("br"));
        }
        ovText.appendChild(document.createTextNode(
            score < 5 ? "Tırtıl daha yeni uyanmış, bir daha deneyelim." :
                score < 15 ? "Güzel bir atıştırmalık oldu!" :
                    score < 30 ? "Tırtıl iyice doydu, kelebek olmaya az kaldı." :
                        "Artık o bir kelebek! 🦋"));
        playBtn.textContent = "bir daha";
        overlay.classList.remove("hidden");
        setTimeout(function () { playBtn.focus(); }, 50);
    }

    function start() {
        reset();
        overlay.classList.add("hidden");
        acc = 0;
        state = "playing";
    }

    /* ---------- drawing ---------- */
    function roundRect(x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    }

    function draw() {
        if (!snake) return;
        ctx.clearRect(0, 0, size, size);

        // soft checkerboard
        for (var y = 0; y < ROWS; y++) {
            for (var x = 0; x < COLS; x++) {
                if ((x + y) % 2) {
                    ctx.fillStyle = "rgba(255,255,255,0.025)";
                    ctx.fillRect(x * cell, y * cell, cell, cell);
                }
            }
        }

        // food: a little green leaf
        var fx = food.x * cell + cell / 2, fy = food.y * cell + cell / 2, s = cell * 0.38 * (1 + pulse * 0.25);
        ctx.save();
        ctx.translate(fx, fy);
        ctx.rotate(food.rot);
        ctx.fillStyle = "#6fb35e";
        ctx.shadowColor = "rgba(111,179,94,0.6)";
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.moveTo(-s, s);
        ctx.quadraticCurveTo(-s, -s, s, -s);
        ctx.quadraticCurveTo(s, s, -s, s);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = "rgba(20,60,20,0.5)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-s, s);
        ctx.lineTo(s * 0.7, -s * 0.7);
        ctx.stroke();
        ctx.restore();

        // body, tail → head
        for (var i = snake.length - 1; i >= 0; i--) {
            var seg = snake[i];
            var t = i / Math.max(1, snake.length - 1);
            var pad = i === 0 ? 1 : 2 + t * 2;
            ctx.fillStyle = hsl(C.h, C.s, C.l + 8 - t * 22);
            roundRect(seg.x * cell + pad, seg.y * cell + pad, cell - pad * 2, cell - pad * 2, cell * 0.4);
            ctx.fill();
        }

        // eyes
        var h = snake[0];
        var cx = h.x * cell + cell / 2, cy = h.y * cell + cell / 2;
        var px = -dir.y, py = dir.x;
        [-1, 1].forEach(function (side) {
            var ex = cx + dir.x * cell * 0.15 + px * side * cell * 0.2;
            var ey = cy + dir.y * cell * 0.15 + py * side * cell * 0.2;
            ctx.fillStyle = "#fff";
            ctx.beginPath();
            ctx.arc(ex, ey, cell * 0.13, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "#1a1216";
            ctx.beginPath();
            ctx.arc(ex + dir.x * cell * 0.04, ey + dir.y * cell * 0.04, cell * 0.065, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    function loop(now) {
        var dt = Math.min((now - last) / 1000, 0.1);
        last = now;
        if (state === "playing") {
            acc += dt;
            while (acc >= step && state === "playing") {
                acc -= step;
                tick();
            }
        }
        pulse = Math.max(0, pulse - dt * 4);
        draw();
        requestAnimationFrame(loop);
    }

    /* ---------- input ---------- */
    var DIRS = {
        ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
        w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0]
    };

    window.addEventListener("keydown", function (e) {
        var d = DIRS[e.key] || DIRS[e.key.toLowerCase()];
        if (d) {
            e.preventDefault();
            if (state === "playing") turn(d[0], d[1]);
        } else if ((e.key === " " || e.key === "Enter") && state !== "playing" && document.activeElement !== playBtn) {
            e.preventDefault();
            start();
        }
    });

    var touch = null;
    var board = canvas.parentElement;
    board.addEventListener("touchstart", function (e) {
        touch = {x: e.touches[0].clientX, y: e.touches[0].clientY};
    }, {passive: true});
    board.addEventListener("touchmove", function (e) {
        if (!touch || state !== "playing") return;
        e.preventDefault();
        var dx = e.touches[0].clientX - touch.x, dy = e.touches[0].clientY - touch.y;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
        if (Math.abs(dx) > Math.abs(dy)) turn(dx > 0 ? 1 : -1, 0);
        else turn(0, dy > 0 ? 1 : -1);
        touch = {x: e.touches[0].clientX, y: e.touches[0].clientY};
    }, {passive: false});

    playBtn.addEventListener("click", start);
    window.addEventListener("resize", resize);

    reset();
    resize();
    requestAnimationFrame(function (now) {
        last = now;
        requestAnimationFrame(loop);
    });
})();
