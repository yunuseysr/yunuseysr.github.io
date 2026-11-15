(function () {
    "use strict";

    var K = window.Kasim;
    var N = 9, MINES = 10, BEST = "play-mayin-best";
    var NUM_COLORS = ["", "#7fb7ff", "#7bd389", "#ff7a8a", "#b388ff", "#ffb26b", "#5fd3c6", "#f4ebe4", "#c9b8ad"];

    var gridEl = document.getElementById("grid");
    var minesEl = document.getElementById("mines");
    var timeEl = document.getElementById("time");
    var bestEl = document.getElementById("best");
    var flagBtn = document.getElementById("flagBtn");
    var newBtn = document.getElementById("newBtn");
    var playBtn = document.getElementById("playBtn");

    var cells, els, started, over, flagMode = false, flags, revealed, startAt, timer;

    function showBest() {
        var b = parseInt(K.storageGet(BEST), 10);
        bestEl.textContent = b ? K.fmt(b) : "–";
    }

    function idx(x, y) { return y * N + x; }

    function around(i) {
        var x = i % N, y = Math.floor(i / N), out = [];
        for (var dy = -1; dy <= 1; dy++) {
            for (var dx = -1; dx <= 1; dx++) {
                if (!dx && !dy) continue;
                var nx = x + dx, ny = y + dy;
                if (nx >= 0 && ny >= 0 && nx < N && ny < N) out.push(idx(nx, ny));
            }
        }
        return out;
    }

    function newGame() {
        clearInterval(timer);
        timer = null;
        started = false;
        over = false;
        flags = 0;
        revealed = 0;
        cells = [];
        for (var i = 0; i < N * N; i++) cells.push({mine: false, n: 0, open: false, flag: false});
        minesEl.textContent = MINES;
        timeEl.textContent = "0:00";
        K.hideOverlay();
        build();
    }

    function build() {
        gridEl.textContent = "";
        els = [];
        cells.forEach(function (_, i) {
            var b = document.createElement("button");
            b.type = "button";
            b.className = "m-cell";
            b.setAttribute("aria-label", "Kapalı kare");
            var pressTimer = null, longPressed = false;
            b.addEventListener("pointerdown", function (e) {
                if (e.pointerType === "mouse") return;
                longPressed = false;
                pressTimer = setTimeout(function () {
                    longPressed = true;
                    toggleFlag(i);
                    if (navigator.vibrate) navigator.vibrate(15);
                }, 380);
            });
            ["pointerup", "pointerleave", "pointercancel"].forEach(function (ev) {
                b.addEventListener(ev, function () { clearTimeout(pressTimer); });
            });
            b.addEventListener("click", function () {
                if (longPressed) { longPressed = false; return; }
                if (flagMode) toggleFlag(i); else open(i);
            });
            b.addEventListener("contextmenu", function (e) {
                e.preventDefault();
                toggleFlag(i);
            });
            gridEl.appendChild(b);
            els.push(b);
        });
    }

    function placeMines(safe) {
        var banned = around(safe).concat([safe]);
        var spots = [];
        for (var i = 0; i < N * N; i++) if (banned.indexOf(i) === -1) spots.push(i);
        K.shuffle(spots).slice(0, MINES).forEach(function (i) { cells[i].mine = true; });
        cells.forEach(function (c, i) {
            c.n = around(i).filter(function (j) { return cells[j].mine; }).length;
        });
    }

    function toggleFlag(i) {
        var c = cells[i];
        if (over || c.open) return;
        c.flag = !c.flag;
        flags += c.flag ? 1 : -1;
        els[i].classList.toggle("is-flag", c.flag);
        els[i].textContent = c.flag ? "🚩" : "";
        minesEl.textContent = MINES - flags;
        K.tone(c.flag ? 700 : 500, 0.06, "triangle", 0.05);
    }

    function open(i) {
        var c = cells[i];
        if (over || c.flag) return;
        if (c.open) return chord(i);
        if (!started) {
            started = true;
            placeMines(i);
            startAt = Date.now();
            timer = setInterval(function () { timeEl.textContent = K.fmt((Date.now() - startAt) / 1000); }, 500);
        }
        if (c.mine) return lose(i);
        flood(i);
        K.tone(420 + Math.random() * 80, 0.05, "sine", 0.05);
        if (revealed === N * N - MINES) win();
    }

    /* tapping an opened number with enough flags around opens the rest */
    function chord(i) {
        var c = cells[i];
        if (!c.n) return;
        var nb = around(i);
        var f = nb.filter(function (j) { return cells[j].flag; }).length;
        if (f !== c.n) return;
        nb.forEach(function (j) {
            if (over) return;
            if (!cells[j].open && !cells[j].flag) {
                if (cells[j].mine) return lose(j);
                flood(j);
            }
        });
        if (!over && revealed === N * N - MINES) win();
    }

    function flood(start) {
        var stack = [start];
        while (stack.length) {
            var i = stack.pop(), c = cells[i];
            if (c.open || c.flag) continue;
            c.open = true;
            revealed++;
            var el = els[i];
            el.classList.add("is-open");
            el.style.animationDelay = (Math.random() * 0.12) + "s";
            el.setAttribute("aria-label", c.n ? c.n + " mayın komşu" : "Boş");
            if (c.n) {
                el.textContent = c.n;
                el.style.color = NUM_COLORS[c.n];
            } else {
                around(i).forEach(function (j) { if (!cells[j].open) stack.push(j); });
            }
        }
    }

    function stop() {
        over = true;
        clearInterval(timer);
        timer = null;
    }

    function lose(i) {
        stop();
        K.tone(110, 0.5, "sawtooth", 0.07);
        els[i].classList.add("is-boom");
        cells.forEach(function (c, j) {
            if (c.mine) {
                setTimeout(function () {
                    els[j].classList.add("is-open", "is-mine");
                    els[j].textContent = "💣";
                }, j === i ? 0 : 200 + Math.random() * 500);
            } else if (c.flag) {
                els[j].classList.add("is-wrong");
            }
        });
        setTimeout(function () {
            K.overlay({title: "Bum!", text: "Mayına bastın. Bir daha deneyelim mi?", btn: "yeni oyun"});
        }, 1100);
    }

    function win() {
        stop();
        var secs = Math.max(1, Math.round((Date.now() - startAt) / 1000));
        cells.forEach(function (c, j) {
            if (c.mine && !c.flag) {
                els[j].textContent = "🚩";
                els[j].classList.add("is-flag");
            }
        });
        minesEl.textContent = "0";
        var b = K.best(BEST, secs, true);
        showBest();
        [523, 659, 784].forEach(function (f, k) {
            setTimeout(function () { K.tone(f, 0.25, "sine", 0.07); }, k * 120);
        });
        setTimeout(function () {
            K.overlay({
                title: b.isBest ? "Yeni rekor!" : "Temizlendi!",
                bold: K.fmt(secs),
                text: "Bütün mayınları buldun, tarla güvende.",
                btn: "yeni oyun"
            });
        }, 600);
    }

    flagBtn.addEventListener("click", function () {
        flagMode = !flagMode;
        flagBtn.classList.toggle("is-active", flagMode);
        flagBtn.setAttribute("aria-pressed", String(flagMode));
    });
    newBtn.addEventListener("click", newGame);
    playBtn.addEventListener("click", newGame);

    showBest();
    newGame();
})();
