(function () {
    "use strict";

    var K = window.Kasim;
    var REMOVE = {kolay: 38, orta: 47, zor: 53};

    var gridEl = document.getElementById("grid");
    var numpad = document.getElementById("numpad");
    var levelsEl = document.getElementById("levels");
    var errorsEl = document.getElementById("errors");
    var timeEl = document.getElementById("time");
    var bestEl = document.getElementById("best");
    var playBtn = document.getElementById("playBtn");

    var level = K.storageGet("play-sudoku-level") || "kolay";
    var solution, given, board, notes, els, sel = -1, noteMode = false, errors = 0;
    var startAt = 0, timer = null, done = false, padBtns = {};

    /* ---------- generator (bitmask backtracking, most-constrained cell first) ---------- */
    function box(i) { return Math.floor(Math.floor(i / 9) / 3) * 3 + Math.floor((i % 9) / 3); }

    function solve(g, limit, randomize) {
        g = g.slice();
        var rows = new Array(9).fill(0), cols = new Array(9).fill(0), boxes = new Array(9).fill(0);
        for (var i = 0; i < 81; i++) {
            if (g[i]) {
                var bit = 1 << g[i];
                rows[Math.floor(i / 9)] |= bit;
                cols[i % 9] |= bit;
                boxes[box(i)] |= bit;
            }
        }
        var count = 0, first = null;

        function rec() {
            var best = -1, bestMask = 0, bestN = 10;
            for (var i = 0; i < 81; i++) {
                if (g[i]) continue;
                var m = ~(rows[Math.floor(i / 9)] | cols[i % 9] | boxes[box(i)]) & 0x3FE;
                var n = 0;
                for (var v = 1; v <= 9; v++) if (m & (1 << v)) n++;
                if (n < bestN) { best = i; bestMask = m; bestN = n; if (!n) return; }
            }
            if (best === -1) {
                count++;
                if (!first) first = g.slice();
                return;
            }
            var vals = [];
            for (var w = 1; w <= 9; w++) if (bestMask & (1 << w)) vals.push(w);
            if (randomize) K.shuffle(vals);
            var r = Math.floor(best / 9), c = best % 9, b = box(best);
            for (var k = 0; k < vals.length; k++) {
                var bit = 1 << vals[k];
                g[best] = vals[k];
                rows[r] |= bit; cols[c] |= bit; boxes[b] |= bit;
                rec();
                rows[r] &= ~bit; cols[c] &= ~bit; boxes[b] &= ~bit;
                g[best] = 0;
                if (count >= limit) return;
            }
        }

        rec();
        return {count: count, grid: first};
    }

    function generate(remove) {
        var full = solve(new Array(81).fill(0), 1, true).grid;
        var puzzle = full.slice();
        var order = K.shuffle(Array.from({length: 81}, function (_, i) { return i; }));
        var removed = 0;
        for (var k = 0; k < order.length && removed < remove; k++) {
            var i = order[k], keep = puzzle[i];
            puzzle[i] = 0;
            if (solve(puzzle, 2, false).count !== 1) puzzle[i] = keep;
            else removed++;
        }
        return {puzzle: puzzle, solution: full};
    }

    /* ---------- UI ---------- */
    function buildPad() {
        numpad.textContent = "";
        var row = document.createElement("div");
        row.className = "numpad__row";
        for (var v = 1; v <= 9; v++) {
            var b = document.createElement("button");
            b.type = "button";
            b.className = "num";
            b.textContent = v;
            b.addEventListener("click", (function (n) { return function () { enter(n); }; })(v));
            padBtns[v] = b;
            row.appendChild(b);
        }
        numpad.appendChild(row);

        var tools = document.createElement("div");
        tools.className = "numpad__row numpad__row--tools";
        [["sil", function () { enter(0); }], ["✎ not", toggleNotes], ["yeni", newGame]].forEach(function (t) {
            var b = document.createElement("button");
            b.type = "button";
            b.className = "ghost-btn";
            b.textContent = t[0];
            b.addEventListener("click", t[1]);
            if (t[0] === "✎ not") b.id = "noteBtn";
            tools.appendChild(b);
        });
        numpad.appendChild(tools);
    }

    function toggleNotes() {
        noteMode = !noteMode;
        var b = document.getElementById("noteBtn");
        b.classList.toggle("is-active", noteMode);
        b.setAttribute("aria-pressed", String(noteMode));
    }

    function buildChips() {
        Array.prototype.forEach.call(levelsEl.children, function (b) {
            b.classList.toggle("is-active", b.dataset.v === level);
            b.onclick = function () {
                level = b.dataset.v;
                K.storageSet("play-sudoku-level", level);
                newGame();
            };
        });
    }

    function showBest() {
        var b = parseInt(K.storageGet("play-sudoku-best-" + level), 10);
        bestEl.textContent = b ? K.fmt(b) : "–";
    }

    function newGame() {
        clearInterval(timer);
        timer = null;
        startAt = 0;
        done = false;
        errors = 0;
        sel = -1;
        errorsEl.textContent = "0";
        timeEl.textContent = "0:00";
        K.hideOverlay();
        buildChips();
        showBest();
        var p = generate(REMOVE[level]);
        solution = p.solution;
        given = p.puzzle.map(function (v) { return v !== 0; });
        board = p.puzzle.slice();
        notes = board.map(function () { return []; });
        build();
        render();
    }

    function build() {
        gridEl.textContent = "";
        els = [];
        for (var i = 0; i < 81; i++) {
            var c = document.createElement("button");
            c.type = "button";
            c.className = "s-cell";
            var r = Math.floor(i / 9), col = i % 9;
            if (col % 3 === 2 && col < 8) c.classList.add("b-r");
            if (r % 3 === 2 && r < 8) c.classList.add("b-b");
            c.addEventListener("click", (function (n) { return function () { select(n); }; })(i));
            gridEl.appendChild(c);
            els.push(c);
        }
    }

    function peers(i, j) {
        return Math.floor(i / 9) === Math.floor(j / 9) || i % 9 === j % 9 || box(i) === box(j);
    }

    function render() {
        var selVal = sel >= 0 ? board[sel] : 0;
        var counts = {};
        board.forEach(function (v) { if (v) counts[v] = (counts[v] || 0) + 1; });
        for (var i = 0; i < 81; i++) {
            var el = els[i], v = board[i];
            el.classList.toggle("is-given", given[i]);
            el.classList.toggle("is-sel", i === sel);
            el.classList.toggle("is-peer", sel >= 0 && i !== sel && peers(i, sel));
            el.classList.toggle("is-same", !!v && v === selVal && i !== sel);
            el.classList.toggle("is-wrong", !!v && !given[i] && v !== solution[i]);
            if (v) {
                el.textContent = v;
            } else if (notes[i].length) {
                el.innerHTML = "<span class='s-notes'>" + [1, 2, 3, 4, 5, 6, 7, 8, 9].map(function (n) {
                    return "<i>" + (notes[i].indexOf(n) !== -1 ? n : "") + "</i>";
                }).join("") + "</span>";
            } else {
                el.textContent = "";
            }
            el.setAttribute("aria-label", "Satır " + (Math.floor(i / 9) + 1) + ", sütun " + (i % 9 + 1) + (v ? ": " + v : ": boş"));
        }
        for (var n = 1; n <= 9; n++) padBtns[n].classList.toggle("is-done", counts[n] === 9);
    }

    function select(i) {
        sel = i;
        render();
    }

    function enter(v) {
        if (done || sel < 0 || given[sel]) return;
        if (!startAt) {
            startAt = Date.now();
            timer = setInterval(function () { timeEl.textContent = K.fmt((Date.now() - startAt) / 1000); }, 500);
        }
        if (noteMode && v) {
            if (board[sel]) return;
            var list = notes[sel], at = list.indexOf(v);
            if (at === -1) list.push(v); else list.splice(at, 1);
            K.tone(600, 0.04, "triangle", 0.03);
        } else if (!v) {
            board[sel] = 0;
            notes[sel] = [];
        } else {
            board[sel] = v;
            notes[sel] = [];
            if (v !== solution[sel]) {
                errors++;
                errorsEl.textContent = errors;
                K.tone(180, 0.15, "triangle", 0.06);
            } else {
                K.tone(520 + v * 30, 0.08, "sine", 0.06);
                // clean this number out of peers' notes
                for (var j = 0; j < 81; j++) {
                    if (peers(j, sel)) {
                        var k = notes[j].indexOf(v);
                        if (k !== -1) notes[j].splice(k, 1);
                    }
                }
            }
        }
        render();
        if (board.every(function (x, i) { return x === solution[i]; })) finish();
    }

    function finish() {
        done = true;
        clearInterval(timer);
        timer = null;
        var secs = Math.max(1, Math.round((Date.now() - startAt) / 1000));
        var b = K.best("play-sudoku-best-" + level, secs, true);
        showBest();
        els.forEach(function (el, i) {
            el.style.animationDelay = ((Math.floor(i / 9) + i % 9) * 0.03) + "s";
            el.classList.add("is-win");
        });
        [523, 659, 784, 1047].forEach(function (f, k) {
            setTimeout(function () { K.tone(f, 0.25, "sine", 0.06); }, k * 120);
        });
        setTimeout(function () {
            K.overlay({
                title: b.isBest ? "Yeni rekor!" : "Çözdün!",
                bold: K.fmt(secs) + " · " + level + (errors ? " · " + errors + " hata" : " · hatasız"),
                text: errors ? "Güzel iş! Bir sonrakinde hatasız deneyelim mi?" : "Kusursuz bir sudoku!",
                btn: "yeni bulmaca"
            });
        }, 1200);
    }

    window.addEventListener("keydown", function (e) {
        if (e.key >= "1" && e.key <= "9") enter(+e.key);
        else if (e.key === "Backspace" || e.key === "Delete" || e.key === "0") enter(0);
        else if (e.key === "n" || e.key === "N") toggleNotes();
        else {
            var d = {ArrowLeft: -1, ArrowRight: 1, ArrowUp: -9, ArrowDown: 9}[e.key];
            if (!d) return;
            e.preventDefault();
            var next = sel < 0 ? 0 : sel + d;
            if (next >= 0 && next < 81 && !(Math.abs(d) === 1 && Math.floor(next / 9) !== Math.floor(sel / 9))) select(next);
        }
    });

    playBtn.addEventListener("click", newGame);
    buildPad();
    newGame();
})();
