(function () {
    "use strict";

    var K = window.Kasim;
    var N = 4, STORE = "play-2048-state", BEST = "play-2048-best";

    /* tile colours climb through the palette */
    var COLORS = [
        [45, 35, 88], [22, 90, 74], [28, 92, 58], [10, 85, 62], [355, 78, 55], [330, 78, 64],
        [300, 52, 60], [268, 58, 66], [285, 60, 52], [45, 95, 56], [75, 60, 55], [190, 70, 50]
    ];

    var gridEl = document.getElementById("grid");
    var scoreEl = document.getElementById("score");
    var bestEl = document.getElementById("best");
    var playBtn = document.getElementById("playBtn");
    var newBtn = document.getElementById("newBtn");

    var cells, score, won, over, nextId = 1, best = parseInt(K.storageGet(BEST), 10) || 0;
    var onPlay = null;

    for (var i = 0; i < N * N; i++) {
        var bg = document.createElement("span");
        bg.className = "g-cell";
        bg.style.transform = pos(i % N, Math.floor(i / N));
        gridEl.appendChild(bg);
    }

    function pos(x, y) {
        return "translate(" + x * 100 + "%, " + y * 100 + "%)";
    }

    function makeTile(v, x, y, cls) {
        var el = document.createElement("span");
        el.className = "g-tile " + (cls || "");
        var t = {id: nextId++, v: v, x: x, y: y, el: el};
        setValue(t, v);
        el.style.transform = pos(x, y);
        gridEl.appendChild(el);
        return t;
    }

    function setValue(t, v) {
        t.v = v;
        render(t);
    }

    function render(t) {
        var v = t.v;
        var c = COLORS[Math.min(Math.log2(v) - 1, COLORS.length - 1)];
        t.el.innerHTML = "<span>" + v + "</span>";
        t.el.style.setProperty("--bg", K.hsl(c[0], c[1], c[2]));
        t.el.style.setProperty("--fg", c[2] > 70 ? "#2a1d25" : "#fff8f2");
        t.el.dataset.len = String(v).length;
    }

    function empties() {
        var out = [];
        for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) if (!cells[y][x]) out.push([x, y]);
        return out;
    }

    function addRandom() {
        var e = empties();
        if (!e.length) return;
        var p = e[Math.floor(Math.random() * e.length)];
        cells[p[1]][p[0]] = makeTile(Math.random() < 0.9 ? 2 : 4, p[0], p[1], "is-new");
    }

    function clear() {
        Array.prototype.slice.call(gridEl.querySelectorAll(".g-tile")).forEach(function (el) { el.remove(); });
        cells = [];
        for (var y = 0; y < N; y++) cells.push(new Array(N).fill(null));
    }

    function newGame() {
        clear();
        score = 0;
        won = false;
        over = false;
        addRandom();
        addRandom();
        K.hideOverlay();
        update();
    }

    function saveState() {
        K.jsonSet(STORE, {
            score: score, won: won,
            cells: cells.map(function (r) { return r.map(function (t) { return t ? t.v : 0; }); })
        });
    }

    function loadState() {
        var s = K.jsonGet(STORE, null);
        if (!s || !s.cells) return false;
        clear();
        score = s.score;
        won = s.won;
        over = false;
        s.cells.forEach(function (r, y) {
            r.forEach(function (v, x) { if (v) cells[y][x] = makeTile(v, x, y); });
        });
        if (!empties().length && !canMove()) return false;
        update();
        return true;
    }

    function update() {
        scoreEl.textContent = score;
        if (score > best) {
            best = score;
            K.storageSet(BEST, String(best));
        }
        bestEl.textContent = best;
    }

    function canMove() {
        for (var y = 0; y < N; y++) {
            for (var x = 0; x < N; x++) {
                var t = cells[y][x];
                if (!t) return true;
                if (x < N - 1 && cells[y][x + 1] && cells[y][x + 1].v === t.v) return true;
                if (y < N - 1 && cells[y + 1][x] && cells[y + 1][x].v === t.v) return true;
            }
        }
        return false;
    }

    function move(dx, dy) {
        if (over || !document.getElementById("overlay").classList.contains("hidden")) return;
        var xs = [0, 1, 2, 3], ys = [0, 1, 2, 3];
        if (dx === 1) xs.reverse();
        if (dy === 1) ys.reverse();
        var moved = false, merged = {}, gained = 0, top = 0;

        ys.forEach(function (y) {
            xs.forEach(function (x) {
                var t = cells[y][x];
                if (!t) return;
                var nx = x, ny = y;
                while (true) {
                    var tx = nx + dx, ty = ny + dy;
                    if (tx < 0 || ty < 0 || tx >= N || ty >= N) break;
                    var other = cells[ty][tx];
                    if (!other) { nx = tx; ny = ty; continue; }
                    if (other.v === t.v && !merged[other.id]) {
                        // merge t into other
                        cells[y][x] = null;
                        merged[other.id] = true;
                        t.el.style.transform = pos(tx, ty);
                        t.el.style.zIndex = 1;
                        other.v *= 2;
                        (function (dead, keep) {
                            setTimeout(function () {
                                dead.el.remove();
                                render(keep);
                                keep.el.classList.remove("is-merged");
                                void keep.el.offsetWidth;
                                keep.el.classList.add("is-merged");
                            }, 110);
                        })(t, other);
                        gained += other.v;
                        top = Math.max(top, other.v);
                        moved = true;
                        return;
                    }
                    break;
                }
                if (nx !== x || ny !== y) {
                    cells[y][x] = null;
                    cells[ny][nx] = t;
                    t.x = nx;
                    t.y = ny;
                    t.el.style.transform = pos(nx, ny);
                    moved = true;
                }
            });
        });

        if (!moved) return;
        // values are applied after the slide; mirror them now in the model
        score += gained;
        update();
        if (gained) K.tone(300 + Math.log2(top) * 60, 0.12, "sine", 0.07);
        else K.tone(220, 0.04, "triangle", 0.03);

        setTimeout(function () {
            addRandom();
            saveState();
            if (!won && top >= 2048) {
                won = true;
                saveState();
                onPlay = function () { K.hideOverlay(); };
                K.overlay({title: "2048! ✨", text: "Başardın! İstersen daha büyük sayılara devam et.", btn: "devam et"});
            } else if (!canMove()) {
                over = true;
                K.storageSet(STORE, "");
                onPlay = newGame;
                var b = K.best(BEST, score);
                K.overlay({
                    title: b.isBest && score > 0 ? "Yeni rekor!" : "Hamle kalmadı",
                    bold: score + " puan",
                    text: score >= 10000 ? "Muhteşem bir oyun!" : score >= 3000 ? "Çok iyiydi!" : "Bir daha deneyelim mi?",
                    btn: "bir daha"
                });
            }
        }, 130);
    }

    window.addEventListener("keydown", function (e) {
        var m = {ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
            a: [-1, 0], d: [1, 0], w: [0, -1], s: [0, 1]}[e.key];
        if (!m) return;
        e.preventDefault();
        move(m[0], m[1]);
    });

    gridEl.style.touchAction = "none";
    K.swipe(gridEl, move);

    playBtn.addEventListener("click", function () { (onPlay || newGame)(); });
    newBtn.addEventListener("click", newGame);

    if (!loadState()) newGame();
})();
