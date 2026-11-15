(function () {
    "use strict";

    var K = window.Kasim;
    var N = 8, BEST = "play-blok-best";

    var SHAPES = [
        [[0, 0]],
        [[0, 0], [1, 0]], [[0, 0], [0, 1]],
        [[0, 0], [1, 0], [2, 0]], [[0, 0], [0, 1], [0, 2]],
        [[0, 0], [1, 0], [2, 0], [3, 0]], [[0, 0], [0, 1], [0, 2], [0, 3]],
        [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]], [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]],
        [[0, 0], [1, 0], [0, 1], [1, 1]],
        [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1], [0, 2], [1, 2], [2, 2]],
        [[0, 0], [1, 0], [0, 1]], [[0, 0], [1, 0], [1, 1]], [[0, 0], [0, 1], [1, 1]], [[1, 0], [0, 1], [1, 1]],
        [[0, 0], [0, 1], [0, 2], [1, 2]], [[1, 0], [1, 1], [1, 2], [0, 2]], [[0, 0], [1, 0], [2, 0], [0, 1]], [[0, 0], [1, 0], [2, 0], [2, 1]],
        [[0, 0], [1, 0], [2, 0], [1, 1]], [[1, 0], [0, 1], [1, 1], [2, 1]],
        [[0, 0], [1, 0], [1, 1], [2, 1]], [[1, 0], [2, 0], [0, 1], [1, 1]],
        [[0, 0], [0, 1], [0, 2], [1, 2], [2, 2]]
    ];
    var COLORS = ["#ff5d7a", "#ffc23d", "#5bc0eb", "#7bd389", "#b388ff", "#ff8c42", "#2ec4b6", "#e05780"];

    var canvas = document.getElementById("game");
    var ctx = canvas.getContext("2d");
    var scoreEl = document.getElementById("score");
    var bestEl = document.getElementById("best");
    var playBtn = document.getElementById("playBtn");

    var W, H, cell, gx, gy, gsize, trayY, trayH;
    var board, tray, score, drag = null, clearing = [], over = false, last = 0;
    var best = parseInt(K.storageGet(BEST), 10) || 0, startBest = best;
    bestEl.textContent = best;

    function resize() {
        var r = canvas.getBoundingClientRect();
        var dpr = Math.min(window.devicePixelRatio || 1, 2);
        W = r.width;
        H = r.height;
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        gsize = Math.min(W - 24, H * 0.66);
        cell = gsize / N;
        gx = (W - gsize) / 2;
        gy = 12;
        trayY = gy + gsize + 14;
        trayH = H - trayY - 8;
    }

    function dims(shape) {
        var w = 0, h = 0;
        shape.forEach(function (p) { w = Math.max(w, p[0] + 1); h = Math.max(h, p[1] + 1); });
        return {w: w, h: h};
    }

    function newPiece() {
        // bias towards friendlier pieces
        var s = SHAPES[Math.floor(Math.pow(Math.random(), 1.15) * SHAPES.length)];
        return {shape: s, color: COLORS[Math.floor(Math.random() * COLORS.length)]};
    }

    function refill() {
        tray = [newPiece(), newPiece(), newPiece()];
    }

    function fits(shape, x, y) {
        return shape.every(function (p) {
            var cx = x + p[0], cy = y + p[1];
            return cx >= 0 && cy >= 0 && cx < N && cy < N && !board[cy][cx];
        });
    }

    function canPlaceAnywhere(shape) {
        for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) if (fits(shape, x, y)) return true;
        return false;
    }

    function place(piece, x, y) {
        piece.shape.forEach(function (p) { board[y + p[1]][x + p[0]] = piece.color; });
        score += piece.shape.length;
        K.tone(330, 0.06, "triangle", 0.06);

        var rows = [], cols = [];
        for (var i = 0; i < N; i++) {
            if (board[i].every(Boolean)) rows.push(i);
            if (board.every(function (r) { return r[i]; })) cols.push(i);
        }
        var lines = rows.length + cols.length;
        if (lines) {
            var cells = {};
            rows.forEach(function (r) { for (var c = 0; c < N; c++) cells[r + "," + c] = [c, r]; });
            cols.forEach(function (c) { for (var r = 0; r < N; r++) cells[r + "," + c] = [c, r]; });
            Object.keys(cells).forEach(function (k) {
                var p = cells[k];
                clearing.push({x: p[0], y: p[1], color: board[p[1]][p[0]], t: 0});
                board[p[1]][p[0]] = null;
            });
            score += lines * 10 * lines;
            for (var n = 0; n < lines; n++) {
                (function (n) { setTimeout(function () { K.tone(523 * Math.pow(1.26, n), 0.2, "sine", 0.08); }, n * 90); })(n);
            }
            if (lines >= 2) K.toast(lines + " çizgi! +" + lines * 10 * lines);
        }
        scoreEl.textContent = score;
        if (score > best) {
            best = score;
            K.storageSet(BEST, String(best));
            bestEl.textContent = best;
        }
    }

    function checkOver() {
        var left = tray.filter(Boolean);
        if (!left.length) {
            refill();
            left = tray;
        }
        if (!left.some(function (p) { return canPlaceAnywhere(p.shape); })) {
            over = true;
            setTimeout(function () {
                K.overlay({
                    title: "Yer kalmadı",
                    bold: score + " puan",
                    text: score > startBest ? "Yeni rekor! ✨" : "Bir el daha?",
                    btn: "bir daha"
                });
            }, 500);
        }
    }

    /* ---------- drawing ---------- */
    function block(x, y, s, color, alpha) {
        ctx.globalAlpha = alpha === undefined ? 1 : alpha;
        var r = s * 0.18, p = s * 0.06;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(x + p, y + p, s - p * 2, s - p * 2, r) : ctx.rect(x + p, y + p, s - p * 2, s - p * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.22)";
        ctx.fillRect(x + p * 2, y + p * 2, s - p * 4, s * 0.16);
        ctx.globalAlpha = 1;
    }

    function slotRect(i) {
        var w = W / 3;
        return {x: i * w, y: trayY, w: w, h: trayH};
    }

    function trayScale(piece) {
        var d = dims(piece.shape), r = slotRect(0);
        return Math.min(cell * 0.55, (r.w - 16) / d.w, (r.h - 16) / d.h);
    }

    function snap() {
        if (!drag) return null;
        var d = dims(drag.piece.shape);
        var left = drag.x - d.w * cell / 2, top = drag.y - d.h * cell / 2 - drag.lift;
        var x = Math.round((left - gx) / cell), y = Math.round((top - gy) / cell);
        return fits(drag.piece.shape, x, y) ? {x: x, y: y, left: left, top: top} : {left: left, top: top};
    }

    function draw(dt) {
        ctx.clearRect(0, 0, W, H);

        // board
        ctx.fillStyle = "rgba(255,255,255,0.03)";
        ctx.fillRect(gx, gy, gsize, gsize);
        for (var y = 0; y < N; y++) {
            for (var x = 0; x < N; x++) {
                if (board[y][x]) block(gx + x * cell, gy + y * cell, cell, board[y][x]);
                else {
                    ctx.fillStyle = "rgba(255,255,255,0.04)";
                    ctx.fillRect(gx + x * cell + 2, gy + y * cell + 2, cell - 4, cell - 4);
                }
            }
        }

        // clearing animation
        for (var i = clearing.length - 1; i >= 0; i--) {
            var c = clearing[i];
            c.t += dt;
            var k = c.t / 0.35, s = cell * (1 - k * 0.6);
            block(gx + c.x * cell + (cell - s) / 2, gy + c.y * cell + (cell - s) / 2, s, c.color, 1 - k);
            if (c.t >= 0.35) clearing.splice(i, 1);
        }

        // ghost preview
        var sn = snap();
        if (sn && sn.x !== undefined) {
            drag.piece.shape.forEach(function (p) {
                block(gx + (sn.x + p[0]) * cell, gy + (sn.y + p[1]) * cell, cell, drag.piece.color, 0.3);
            });
        }

        // tray
        tray.forEach(function (piece, n) {
            if (!piece || (drag && drag.index === n)) return;
            var r = slotRect(n), s = trayScale(piece), d = dims(piece.shape);
            var ox = r.x + (r.w - d.w * s) / 2, oy = r.y + (r.h - d.h * s) / 2;
            var ok = canPlaceAnywhere(piece.shape);
            piece.shape.forEach(function (p) { block(ox + p[0] * s, oy + p[1] * s, s, piece.color, ok ? 1 : 0.3); });
        });

        // dragged piece
        if (drag) {
            drag.piece.shape.forEach(function (p) {
                block(sn.left + p[0] * cell, sn.top + p[1] * cell, cell, drag.piece.color, 0.95);
            });
        }
    }

    function loop(t) {
        var dt = Math.min((t - last) / 1000, 0.05);
        last = t;
        draw(dt);
        requestAnimationFrame(loop);
    }

    /* ---------- input ---------- */
    function local(e) {
        var r = canvas.getBoundingClientRect();
        return {x: e.clientX - r.left, y: e.clientY - r.top};
    }

    canvas.addEventListener("pointerdown", function (e) {
        if (over) return;
        var p = local(e);
        if (p.y < trayY - 10) return;
        var n = Math.floor(p.x / (W / 3));
        if (!tray[n]) return;
        drag = {index: n, piece: tray[n], x: p.x, y: p.y, lift: e.pointerType === "mouse" ? 0 : cell * 1.6};
        try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
        K.tone(500, 0.04, "triangle", 0.03);
    });

    canvas.addEventListener("pointermove", function (e) {
        if (!drag) return;
        var p = local(e);
        drag.x = p.x;
        drag.y = p.y;
    });

    function drop() {
        if (!drag) return;
        var sn = snap();
        if (sn && sn.x !== undefined) {
            tray[drag.index] = null;
            place(drag.piece, sn.x, sn.y);
            drag = null;
            checkOver();
        } else {
            drag = null;
        }
    }

    canvas.addEventListener("pointerup", drop);
    canvas.addEventListener("pointercancel", function () { drag = null; });

    function newGame() {
        board = [];
        for (var y = 0; y < N; y++) board.push(new Array(N).fill(null));
        score = 0;
        startBest = best;
        over = false;
        clearing = [];
        scoreEl.textContent = "0";
        refill();
        K.hideOverlay();
    }

    playBtn.addEventListener("click", newGame);
    window.addEventListener("resize", resize);
    resize();
    newGame();
    requestAnimationFrame(function (t) {
        last = t;
        requestAnimationFrame(loop);
    });
})();
