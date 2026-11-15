(function () {
    "use strict";

    var K = window.Kasim;
    var BEST = "play-renk-best";
    var PADS = [
        {h: 45, s: 95, l: 56, f: 329.63},   // sarı
        {h: 355, s: 78, l: 56, f: 440.0},   // kırmızı
        {h: 150, s: 55, l: 48, f: 554.37},  // yeşil
        {h: 212, s: 75, l: 58, f: 659.25}   // mavi
    ];

    var pads = Array.prototype.slice.call(document.querySelectorAll(".pad"));
    var label = document.getElementById("label");
    var scoreEl = document.getElementById("score");
    var bestEl = document.getElementById("best");
    var playBtn = document.getElementById("playBtn");

    var seq = [], step = 0, accepting = false, best = parseInt(K.storageGet(BEST), 10) || 0;
    bestEl.textContent = best;

    pads.forEach(function (p, i) {
        var c = PADS[i];
        p.style.setProperty("--c", K.hsl(c.h, c.s, c.l));
        p.style.setProperty("--c-dim", K.hsl(c.h, c.s - 25, c.l - 30));
        p.addEventListener("pointerdown", function (e) {
            e.preventDefault();
            input(i);
        });
    });

    function light(i, ms) {
        var p = pads[i];
        p.classList.add("lit");
        K.tone(PADS[i].f, ms / 1000 + 0.05, "sine", 0.14);
        setTimeout(function () { p.classList.remove("lit"); }, ms);
    }

    function playSeq() {
        accepting = false;
        label.textContent = "dinle…";
        var speed = Math.max(260, 520 - seq.length * 18);
        seq.forEach(function (n, k) {
            setTimeout(function () { light(n, speed); }, 600 + k * (speed + 140));
        });
        setTimeout(function () {
            accepting = true;
            step = 0;
            label.textContent = "sıra sende";
        }, 600 + seq.length * (speed + 140));
    }

    function addAndPlay() {
        seq.push(Math.floor(Math.random() * 4));
        scoreEl.textContent = seq.length - 1;
        playSeq();
    }

    function input(i) {
        if (!accepting) return;
        light(i, 220);
        if (i !== seq[step]) return fail();
        step++;
        if (step === seq.length) {
            accepting = false;
            scoreEl.textContent = seq.length;
            label.textContent = seq.length % 5 === 0 ? "harika! ✨" : "güzel!";
            setTimeout(addAndPlay, 700);
        }
    }

    function fail() {
        accepting = false;
        K.tone(130, 0.5, "sawtooth", 0.06);
        document.getElementById("pads").classList.add("shake");
        setTimeout(function () { document.getElementById("pads").classList.remove("shake"); }, 500);
        var score = seq.length - 1;
        var b = K.best(BEST, score);
        bestEl.textContent = b.best;
        label.textContent = "";
        setTimeout(function () {
            K.overlay({
                title: b.isBest && score > 0 ? "Yeni rekor!" : score + " tur",
                bold: b.isBest && score > 0 ? score + " tur" : "",
                text: score < 4 ? "Isınma turuydu, bir daha deneyelim." :
                    score < 9 ? "Güzel bir hafıza!" :
                        score < 15 ? "Çok iyi, sıralar uzadıkça daha da zorlaşıyor." : "İnanılmaz bir hafıza! 🧠",
                btn: "bir daha"
            });
        }, 600);
    }

    playBtn.addEventListener("click", function () {
        K.hideOverlay();
        seq = [];
        scoreEl.textContent = "0";
        addAndPlay();
    });
})();
