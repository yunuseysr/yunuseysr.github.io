(function () {
    "use strict";

    var K = window.Kasim;
    var hsl = K.hsl;
    var PAIRS = 8;

    var grid = document.getElementById("grid");
    var movesEl = document.getElementById("moves");
    var timeEl = document.getElementById("time");
    var bestEl = document.getElementById("best");
    var overlay = document.getElementById("overlay");
    var ovTitle = document.getElementById("ovTitle");
    var ovText = document.getElementById("ovText");
    var playBtn = document.getElementById("playBtn");

    var best = parseInt(K.storageGet("play-hafiza-best"), 10) || 0;
    var open = [], matched = 0, moves = 0, lock = false;
    var startAt = 0, timer = null;

    function showBest() {
        bestEl.textContent = best ? best : "–";
    }

    function shuffle(a) {
        for (var i = a.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var t = a[i]; a[i] = a[j]; a[j] = t;
        }
        return a;
    }

    /* Small chrysanthemum: three rings of petals around a centre. */
    function flowerSVG(c) {
        var rings = [
            {n: 16, len: 40, w: 6.5, dl: 0},
            {n: 12, len: 29, w: 6, dl: -6},
            {n: 8, len: 17, w: 5, dl: -12}
        ];
        var out = '<svg viewBox="-46 -46 92 92" aria-hidden="true">';
        rings.forEach(function (r, ri) {
            var off = ri * 9;
            for (var i = 0; i < r.n; i++) {
                var a = off + i * 360 / r.n;
                out += '<ellipse cx="0" cy="' + (-r.len / 2) + '" rx="' + r.w + '" ry="' + (r.len / 2) +
                    '" transform="rotate(' + a.toFixed(1) + ')" fill="' + hsl(c.h, c.s, c.l + r.dl + (i % 2 ? 5 : 0)) +
                    '" stroke="' + hsl(c.h, c.s, c.l - 30, 0.4) + '" stroke-width="0.5"/>';
            }
        });
        out += '<circle r="5.5" fill="' + hsl(c.h, c.s, c.l - 22) + '"/></svg>';
        return out;
    }

    function fmt(sec) {
        return Math.floor(sec / 60) + ":" + ("0" + (sec % 60)).slice(-2);
    }

    function tick() {
        timeEl.textContent = fmt(Math.floor((Date.now() - startAt) / 1000));
    }

    function newGame() {
        clearInterval(timer);
        timer = null;
        open = [];
        matched = 0;
        moves = 0;
        lock = false;
        movesEl.textContent = "0";
        timeEl.textContent = "0:00";
        overlay.classList.add("hidden");

        // today's colour always joins, the rest are random
        var others = shuffle(K.PALETTE.filter(function (c) { return c !== K.color; })).slice(0, PAIRS - 1);
        var colors = others.concat([K.color]);
        var deck = shuffle(colors.concat(colors));

        grid.textContent = "";
        deck.forEach(function (c, i) {
            var card = document.createElement("button");
            card.type = "button";
            card.className = "mcard";
            card.dataset.name = c.name;
            card.setAttribute("aria-label", "Kapalı kart " + (i + 1));
            card.style.setProperty("--c", hsl(c.h, c.s, c.l));
            card.style.animationDelay = (i * 0.03) + "s";
            card.innerHTML =
                '<span class="mcard__inner">' +
                '<span class="mcard__back">❦</span>' +
                '<span class="mcard__face">' + flowerSVG(c) + '<span class="mcard__name"></span></span>' +
                '</span>';
            card.querySelector(".mcard__name").textContent = c.name;
            card.addEventListener("click", function () { flip(card); });
            grid.appendChild(card);
        });
    }

    function flip(card) {
        if (lock || card.classList.contains("is-open") || card.classList.contains("is-matched")) return;
        if (!timer) {
            startAt = Date.now();
            timer = setInterval(tick, 500);
        }

        card.classList.add("is-open");
        K.tone(520, 0.06, "triangle", 0.04);
        card.setAttribute("aria-label", card.dataset.name);
        open.push(card);
        if (open.length < 2) return;

        moves++;
        movesEl.textContent = moves;
        var a = open[0], b = open[1];
        open = [];

        if (a.dataset.name === b.dataset.name) {
            setTimeout(function () {
                a.classList.add("is-matched");
                b.classList.add("is-matched");
            }, 250);
            K.tone(784, 0.2, "sine", 0.07);
            matched++;
            if (matched === PAIRS) setTimeout(finish, 700);
        } else {
            lock = true;
            setTimeout(function () {
                a.classList.remove("is-open");
                b.classList.remove("is-open");
                a.setAttribute("aria-label", "Kapalı kart");
                b.setAttribute("aria-label", "Kapalı kart");
                lock = false;
            }, 800);
        }
    }

    function finish() {
        clearInterval(timer);
        timer = null;
        var secs = Math.floor((Date.now() - startAt) / 1000);
        var isBest = !best || moves < best;
        if (isBest) {
            best = moves;
            K.storageSet("play-hafiza-best", String(best));
            showBest();
        }

        var msg = moves <= 10 ? "Bu nasıl bir hafıza! Neredeyse hiç yanılmadın."
            : moves <= 14 ? "Çok iyi! Bütün kasımpatılar eşini buldu."
                : moves <= 20 ? "Güzel bir bahçe oldu. Her çiçek yerli yerinde."
                    : "Biraz uğraştırdı ama sonunda bütün bahçe açtı. ❦";

        ovTitle.textContent = isBest ? "Yeni rekor! ❦" : "Bahçe tamam";
        ovText.innerHTML = "";
        var b = document.createElement("b");
        b.textContent = moves + " hamle · " + fmt(secs);
        ovText.appendChild(b);
        ovText.appendChild(document.createElement("br"));
        ovText.appendChild(document.createTextNode(msg));
        overlay.classList.remove("hidden");
        setTimeout(function () { playBtn.focus(); }, 50);
    }

    playBtn.addEventListener("click", newGame);
    showBest();
    newGame();
})();
