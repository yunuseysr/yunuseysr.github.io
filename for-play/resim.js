(function () {
    "use strict";

    var K = window.Kasim;
    var N = 10, STORE = "play-resim-solved";

    var PICS = [
        {name: "Kalp", color: "#ff5d7a", rows: [
            ".##....##.",
            "####..####",
            "##########",
            "##########",
            "##########",
            ".########.",
            "..######..",
            "...####...",
            "....##....",
            ".........."]},
        {name: "Yıldız", color: "#ffd65a", rows: [
            "....##....",
            "....##....",
            "...####...",
            "##########",
            ".########.",
            "..######..",
            "..######..",
            ".###..###.",
            ".##....##.",
            "##......##"]},
        {name: "Mantar", color: "#ff7a6b", rows: [
            "...####...",
            ".########.",
            "###.##.###",
            "##########",
            "#.######.#",
            "##########",
            "...####...",
            "...####...",
            "...####...",
            "..######.."]},
        {name: "Kedi", color: "#ffb26b", rows: [
            "#........#",
            "##......##",
            "###....###",
            "##########",
            "#..####..#",
            "#..####..#",
            "##########",
            "###.##.###",
            ".########.",
            "..######.."]},
        {name: "Ev", color: "#d4a373", rows: [
            "....##....",
            "...####...",
            "..######..",
            ".########.",
            "##########",
            ".#......#.",
            ".#.##...#.",
            ".#.##.###.",
            ".#....###.",
            ".########."]},
        {name: "Çiçek", color: "#b388ff", rows: [
            "...#..#...",
            "..######..",
            ".###..###.",
            "..######..",
            "...#..#...",
            "....##....",
            ".#..##..#.",
            ".##.##.##.",
            "..######..",
            "....##...."]},
        {name: "Fincan", color: "#c9a27a", rows: [
            "..#..#....",
            "...#..#...",
            "..........",
            "#########.",
            "#########.",
            "#######.##",
            "#######..#",
            "#######.##",
            ".#####....",
            "##########"]},
        {name: "Hilal", color: "#fff1b8", rows: [
            "...####...",
            "..###.....",
            ".###......",
            ".##.......",
            ".##.......",
            ".##.......",
            ".###......",
            "..###.....",
            "...####...",
            ".........."]}
    ];

    var gridEl = document.getElementById("grid");
    var levelsEl = document.getElementById("levels");
    var solvedEl = document.getElementById("solved");
    var timeEl = document.getElementById("time");
    var modeBtn = document.getElementById("modeBtn");
    var clearBtn = document.getElementById("clearBtn");
    var playBtn = document.getElementById("playBtn");

    var solved = K.jsonGet(STORE, []);
    var level = 0, pic, rowClues, colClues, state, cellEls, rowClueEls, colClueEls;
    var mode = "fill", painting = null, startAt = 0, timer = null, done = false;

    function clues(line) {
        var out = [], run = 0;
        for (var i = 0; i < line.length; i++) {
            if (line[i]) run++;
            else if (run) { out.push(run); run = 0; }
        }
        if (run) out.push(run);
        return out.length ? out : [0];
    }

    function same(a, b) {
        return a.length === b.length && a.every(function (v, i) { return v === b[i]; });
    }

    function buildChips() {
        levelsEl.textContent = "";
        PICS.forEach(function (p, i) {
            var b = document.createElement("button");
            b.type = "button";
            b.className = "chip" + (i === level ? " is-active" : "");
            b.textContent = solved.indexOf(p.name) !== -1 ? p.name : (i + 1) + ". ?";
            b.addEventListener("click", function () { load(i); });
            levelsEl.appendChild(b);
        });
        solvedEl.textContent = solved.length + "/" + PICS.length;
        K.storageSet("play-resim-count", String(solved.length));
    }

    function load(i) {
        level = i;
        pic = PICS[i];
        done = false;
        clearInterval(timer);
        timer = null;
        startAt = 0;
        timeEl.textContent = "0:00";
        gridEl.classList.remove("is-done");
        K.hideOverlay();
        var target = pic.rows.map(function (r) { return r.split("").map(function (c) { return c === "#" ? 1 : 0; }); });
        rowClues = target.map(clues);
        colClues = [];
        for (var x = 0; x < N; x++) colClues.push(clues(target.map(function (r) { return r[x]; })));
        state = target.map(function (r) { return r.map(function () { return 0; }); }); // 0 empty, 1 fill, 2 cross
        build();
        buildChips();
        refresh();
    }

    function build() {
        gridEl.textContent = "";
        gridEl.style.setProperty("--n", N);
        cellEls = [];
        rowClueEls = [];
        colClueEls = [];
        var corner = document.createElement("span");
        corner.className = "nono__corner";
        gridEl.appendChild(corner);
        colClues.forEach(function (c) {
            var el = document.createElement("span");
            el.className = "nono__clue nono__clue--col";
            el.innerHTML = c.map(function (n) { return "<i>" + n + "</i>"; }).join("");
            gridEl.appendChild(el);
            colClueEls.push(el);
        });
        for (var y = 0; y < N; y++) {
            var rc = document.createElement("span");
            rc.className = "nono__clue nono__clue--row";
            rc.innerHTML = rowClues[y].map(function (n) { return "<i>" + n + "</i>"; }).join("");
            gridEl.appendChild(rc);
            rowClueEls.push(rc);
            for (var x = 0; x < N; x++) {
                var c = document.createElement("span");
                c.className = "nono__cell";
                if (x % 5 === 4 && x < N - 1) c.classList.add("b-r");
                if (y % 5 === 4 && y < N - 1) c.classList.add("b-b");
                c.dataset.x = x;
                c.dataset.y = y;
                gridEl.appendChild(c);
                cellEls.push(c);
            }
        }
    }

    function refresh() {
        for (var y = 0; y < N; y++) {
            for (var x = 0; x < N; x++) {
                var el = cellEls[y * N + x], s = state[y][x];
                el.classList.toggle("is-fill", s === 1);
                el.classList.toggle("is-cross", s === 2);
            }
        }
        var ok = true;
        for (var r = 0; r < N; r++) {
            var good = same(clues(state[r].map(function (v) { return v === 1 ? 1 : 0; })), rowClues[r]);
            rowClueEls[r].classList.toggle("is-ok", good);
            ok = ok && good;
        }
        for (var c = 0; c < N; c++) {
            var col = state.map(function (row) { return row[c] === 1 ? 1 : 0; });
            var goodC = same(clues(col), colClues[c]);
            colClueEls[c].classList.toggle("is-ok", goodC);
            ok = ok && goodC;
        }
        if (ok && !done && startAt) win();
    }

    function apply(el) {
        if (!el || !el.classList.contains("nono__cell") || done) return;
        var x = +el.dataset.x, y = +el.dataset.y;
        if (state[y][x] === painting) return;
        state[y][x] = painting;
        K.tone(painting === 1 ? 520 : painting === 2 ? 380 : 300, 0.035, "triangle", 0.03);
        refresh();
    }

    gridEl.addEventListener("pointerdown", function (e) {
        var el = e.target.closest(".nono__cell");
        if (!el || done) return;
        e.preventDefault();
        if (!startAt) {
            startAt = Date.now();
            timer = setInterval(function () { timeEl.textContent = K.fmt((Date.now() - startAt) / 1000); }, 500);
        }
        var cur = state[+el.dataset.y][+el.dataset.x];
        var want = (e.button === 2 || mode === "cross") ? 2 : 1;
        painting = cur === want ? 0 : want;
        apply(el);
    });

    window.addEventListener("pointermove", function (e) {
        if (painting === null) return;
        apply(document.elementFromPoint(e.clientX, e.clientY));
    });

    window.addEventListener("pointerup", function () { painting = null; });
    window.addEventListener("pointercancel", function () { painting = null; });
    gridEl.addEventListener("contextmenu", function (e) { e.preventDefault(); });

    function win() {
        done = true;
        clearInterval(timer);
        timer = null;
        var secs = (Date.now() - startAt) / 1000;
        if (solved.indexOf(pic.name) === -1) {
            solved.push(pic.name);
            K.jsonSet(STORE, solved);
        }
        gridEl.style.setProperty("--pic", pic.color);
        cellEls.forEach(function (el, i) {
            el.style.animationDelay = ((i % N) + Math.floor(i / N)) * 0.025 + "s";
        });
        gridEl.classList.add("is-done");
        buildChips();
        [523, 659, 784, 1047].forEach(function (f, k) {
            setTimeout(function () { K.tone(f, 0.25, "sine", 0.06); }, k * 110);
        });
        setTimeout(function () {
            K.overlay({
                title: pic.name + "!",
                bold: K.fmt(secs),
                text: "Resim ortaya çıktı.",
                btn: solved.length === PICS.length && level === PICS.length - 1 ? "baştan" : "sonraki resim"
            });
        }, 1400);
    }

    modeBtn.addEventListener("click", function () {
        mode = mode === "fill" ? "cross" : "fill";
        modeBtn.textContent = mode === "fill" ? "■ boya" : "✕ işaretle";
        modeBtn.classList.toggle("is-active", mode === "cross");
    });

    clearBtn.addEventListener("click", function () {
        if (done) return;
        state.forEach(function (r) { r.fill(0); });
        refresh();
    });

    playBtn.addEventListener("click", function () {
        gridEl.classList.remove("is-done");
        load((level + 1) % PICS.length);
    });

    // start from the first unsolved picture
    var first = PICS.findIndex(function (p) { return solved.indexOf(p.name) === -1; });
    load(first === -1 ? 0 : first);
})();
