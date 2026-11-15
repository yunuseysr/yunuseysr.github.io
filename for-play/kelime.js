(function () {
    "use strict";

    var K = window.Kasim;
    var LEN = 5, TRIES = 6;

    /* 5-letter Turkish words (upper-case, Turkish casing). Guesses are not
       dictionary-checked — any 5 letters are accepted, to keep it relaxed. */
    var WORDS = (
        "KALEM KİTAP ÇİÇEK BAHAR GÜNEŞ DENİZ BULUT ORMAN NEHİR ELMAS ASLAN TAVUK BALIK KÖPEK HOROZ " +
        "ARMUT KİRAZ LİMON ÇİLEK KAVUN İNCİR BADEM CEVİZ ŞEKER PASTA ÇORBA EKMEK SABAH AKŞAM HAFTA " +
        "KASIM NİSAN MAYIS EYLÜL ŞUBAT SEVGİ HAYAL MUTLU GÜZEL TATLI NAZİK SICAK SOĞUK HAFİF YAVAŞ " +
        "HIZLI BEYAZ SİYAH YEŞİL PEMBE DALGA KUŞAK GÖNÜL MASAL ŞARKI MÜZİK RESİM KAHVE TABAK KAŞIK " +
        "ÇATAL BIÇAK DOLAP BAHÇE KÖPRÜ YOLCU ŞEHİR DÜNYA GÖLGE KUMAŞ ÇANTA SİLGİ SINAV KARNE BEBEK " +
        "ÇOCUK TEYZE NİNNİ PAMUK BALON VAPUR KAYIK ROKET ARABA MOTOR ŞOFÖR PİLOT TERZİ ÇOBAN KUZEY " +
        "GÜNEY SAKİN HUZUR GÜLÜŞ AŞKIM CANIM BALIM MELEK ZAMAN YARIN BUGÜN HAYAT DİLEK KADER ROMAN " +
        "KUZEN SEPET KAVAK ÇINAR MANGO KEKİK BİBER SALÇA TUZLU"
    ).split(" ").filter(function (w) { return Array.from(w).length === LEN && /^[A-ZÇĞİÖŞÜ]+$/.test(w); });

    var ROWS = [
        "E R T Y U I O P Ğ Ü",
        "A S D F G H J K L Ş İ",
        "↵ Z C V B N M Ö Ç ⌫"
    ];

    var grid = document.getElementById("grid");
    var kb = document.getElementById("kb");
    var streakEl = document.getElementById("streak");
    var bestEl = document.getElementById("best");
    var playBtn = document.getElementById("playBtn");

    var now = new Date();
    var DAY = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 864e5);
    var STORE = "play-kelime";
    var data = K.jsonGet(STORE, {day: 0, guesses: [], done: false, won: false, streak: 0, best: 0, lastWin: 0});
    if (data.day !== DAY) {
        data.day = DAY;
        data.guesses = [];
        data.done = false;
        data.won = false;
    }

    var mode = "daily", answer, guesses, current = [], busy = false, keyEls = {};

    function dailyWord() {
        return WORDS[(DAY * 37) % WORDS.length];
    }

    function chars(w) {
        return Array.from(w);
    }

    function evaluate(guess, ans) {
        var g = chars(guess), a = chars(ans), res = new Array(LEN).fill("no"), left = {};
        for (var i = 0; i < LEN; i++) {
            if (g[i] === a[i]) res[i] = "ok";
            else left[a[i]] = (left[a[i]] || 0) + 1;
        }
        for (var j = 0; j < LEN; j++) {
            if (res[j] !== "ok" && left[g[j]]) {
                res[j] = "near";
                left[g[j]]--;
            }
        }
        return res;
    }

    function buildGrid() {
        grid.textContent = "";
        for (var r = 0; r < TRIES; r++) {
            var row = document.createElement("div");
            row.className = "word-row";
            for (var c = 0; c < LEN; c++) {
                var t = document.createElement("span");
                t.className = "word-tile";
                t.style.setProperty("--i", c);
                row.appendChild(t);
            }
            grid.appendChild(row);
        }
    }

    function buildKeyboard() {
        kb.textContent = "";
        ROWS.forEach(function (line) {
            var row = document.createElement("div");
            row.className = "kb-row";
            line.split(" ").forEach(function (k) {
                var b = document.createElement("button");
                b.type = "button";
                b.className = "key" + (k === "↵" || k === "⌫" ? " key--wide" : "");
                b.textContent = k === "↵" ? "gir" : k;
                b.setAttribute("aria-label", k === "↵" ? "Gir" : k === "⌫" ? "Sil" : k);
                b.addEventListener("click", function () { press(k); });
                if (k.length === 1 && k !== "↵" && k !== "⌫") keyEls[k] = b;
                row.appendChild(b);
            });
            kb.appendChild(row);
        });
    }

    function rowEl(r) {
        return grid.children[r];
    }

    function paintRow(r, word, res, animate) {
        var tiles = rowEl(r).children, cs = chars(word);
        for (var i = 0; i < LEN; i++) {
            tiles[i].textContent = cs[i] || "";
            tiles[i].classList.toggle("filled", !!cs[i]);
            if (res) {
                tiles[i].classList.add("is-" + res[i]);
                if (animate) tiles[i].classList.add("flip");
            }
        }
    }

    function paintKeys(word, res) {
        var rank = {no: 1, near: 2, ok: 3};
        chars(word).forEach(function (ch, i) {
            var el = keyEls[ch];
            if (!el) return;
            var cur = el.dataset.s;
            if (!cur || rank[res[i]] > rank[cur]) {
                el.dataset.s = res[i];
                el.className = "key is-" + res[i];
            }
        });
    }

    function start(m) {
        mode = m;
        K.hideOverlay();
        buildGrid();
        buildKeyboard();
        current = [];
        busy = false;
        if (mode === "daily") {
            answer = dailyWord();
            guesses = data.guesses;
            guesses.forEach(function (g, r) {
                var res = evaluate(g, answer);
                paintRow(r, g, res, false);
                paintKeys(g, res);
            });
            if (data.done) showEnd(data.won, false);
        } else {
            do { answer = WORDS[Math.floor(Math.random() * WORDS.length)]; } while (answer === dailyWord());
            guesses = [];
        }
    }

    function press(k) {
        if (busy || !answer || !document.getElementById("overlay").classList.contains("hidden")) return;
        if (guesses.length >= TRIES) return;
        if (k === "⌫") {
            current.pop();
        } else if (k === "↵") {
            return submit();
        } else if (current.length < LEN) {
            current.push(k);
            K.tone(440 + current.length * 30, 0.05, "triangle", 0.04);
        }
        paintRow(guesses.length, current.join(""), null);
    }

    function submit() {
        var r = guesses.length;
        if (current.length < LEN) {
            var row = rowEl(r);
            row.classList.remove("shake");
            void row.offsetWidth;
            row.classList.add("shake");
            K.toast("5 harf olmalı");
            return;
        }
        var word = current.join("");
        var res = evaluate(word, answer);
        guesses.push(word);
        current = [];
        busy = true;
        paintRow(r, word, res, true);
        res.forEach(function (s, i) {
            setTimeout(function () {
                K.tone(s === "ok" ? 784 : s === "near" ? 587 : 330, 0.12, "sine", 0.06);
            }, i * 160 + 150);
        });

        var won = word === answer;
        var lost = !won && guesses.length >= TRIES;
        if (mode === "daily") {
            data.guesses = guesses;
            if (won || lost) {
                data.done = true;
                data.won = won;
                if (won) {
                    data.streak = data.lastWin === DAY - 1 ? data.streak + 1 : 1;
                    data.lastWin = DAY;
                    data.best = Math.max(data.best, data.streak);
                } else {
                    data.streak = 0;
                }
                K.storageSet("play-kelime-best", String(data.best));
            }
            K.jsonSet(STORE, data);
        }

        setTimeout(function () {
            paintKeys(word, res);
            busy = false;
            showStats();
            if (won || lost) showEnd(won, true);
        }, LEN * 160 + 400);
    }

    var CHEERS = ["Dahi!", "Muhteşem!", "Harika!", "Çok iyi!", "Güzel!", "Son anda!"];

    function showEnd(won, fresh) {
        if (won && fresh) {
            var row = rowEl(guesses.length - 1);
            row.classList.add("win");
            [523, 659, 784, 1047].forEach(function (f, k) {
                setTimeout(function () { K.tone(f, 0.25, "sine", 0.06); }, k * 110);
            });
        }
        setTimeout(function () {
            K.overlay({
                title: won ? CHEERS[guesses.length - 1] : "Bu sefer olmadı",
                bold: won ? guesses.length + "/6 denemede bildin" : "Kelime: " + answer,
                text: mode === "daily"
                    ? (won ? "Seri: " + data.streak + " gün. " : "") + "Yarın yeni bir kelime gelecek. İstersen serbest modda devam et."
                    : "Bir tane daha?",
                btn: "serbest oyna"
            });
        }, fresh ? 900 : 0);
    }

    function showStats() {
        var alive = data.lastWin >= DAY - 1 ? data.streak : 0;
        streakEl.textContent = alive;
        bestEl.textContent = data.best;
    }

    window.addEventListener("keydown", function (e) {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (e.key === "Enter") {
            if (!document.getElementById("overlay").classList.contains("hidden")) return;
            e.preventDefault();
            press("↵");
        } else if (e.key === "Backspace") {
            press("⌫");
        } else if (e.key.length === 1) {
            var ch = e.key.toLocaleUpperCase("tr-TR");
            if (/^[A-ZÇĞİÖŞÜ]$/.test(ch) && "QWX".indexOf(ch) === -1) press(ch);
        }
    });

    playBtn.addEventListener("click", function () { start("free"); });

    showStats();
    start("daily");
})();
