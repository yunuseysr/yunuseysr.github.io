/* Shared helpers for the play corner: palette, storage, accent colour,
   overlay, best scores, swipe, toast and tiny WebAudio tones. */
(function () {
    "use strict";

    var PALETTE = [
        {name: "altın sarısı", h: 45, s: 95, l: 56},
        {name: "bal turuncusu", h: 28, s: 92, l: 55},
        {name: "bordo", h: 345, s: 68, l: 40},
        {name: "pembe", h: 330, s: 78, l: 68},
        {name: "lavanta", h: 268, s: 58, l: 70},
        {name: "mor", h: 285, s: 60, l: 50},
        {name: "kar beyazı", h: 45, s: 35, l: 90},
        {name: "mercan", h: 10, s: 85, l: 62},
        {name: "kırmızı", h: 355, s: 78, l: 50},
        {name: "şeftali", h: 22, s: 90, l: 74},
        {name: "eflatun", h: 300, s: 52, l: 62},
        {name: "limon yeşili", h: 75, s: 60, l: 60}
    ];

    function clamp(v, lo, hi) {
        return Math.max(lo, Math.min(hi, v));
    }

    function hsl(h, s, l, a) {
        return "hsl(" + h + " " + clamp(s, 0, 100) + "% " + clamp(l, 0, 100) + "%" +
            (a !== undefined ? " / " + a : "") + ")";
    }

    function storageGet(key) {
        try { return window.localStorage.getItem(key); } catch (e) { return null; }
    }

    function storageSet(key, val) {
        try { window.localStorage.setItem(key, val); } catch (e) { /* ignore */ }
    }

    function jsonGet(key, fallback) {
        try { return JSON.parse(storageGet(key)) || fallback; } catch (e) { return fallback; }
    }

    function jsonSet(key, val) {
        storageSet(key, JSON.stringify(val));
    }

    function shuffle(a) {
        for (var i = a.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var t = a[i]; a[i] = a[j]; a[j] = t;
        }
        return a;
    }

    function fmt(sec) {
        sec = Math.max(0, Math.floor(sec));
        return Math.floor(sec / 60) + ":" + ("0" + (sec % 60)).slice(-2);
    }

    /* Save a score if it beats the stored one. Returns {isBest, best}. */
    function best(key, val, lowerIsBetter) {
        var prev = parseInt(storageGet(key), 10) || 0;
        var isBest = lowerIsBetter ? (!prev || val < prev) : val > prev;
        if (isBest) storageSet(key, String(val));
        return {isBest: isBest, best: isBest ? val : prev};
    }

    /* Accent colour: picked on the hub, kept while moving between games. */
    var saved = storageGet("play-color");
    var color = PALETTE.filter(function (c) { return c.name === saved; })[0];
    var isHub = !!document.querySelector(".hub");
    if (!color || isHub) {
        var choices = PALETTE.filter(function (c) { return c.name !== saved && c.l < 85 && c.l > 45; });
        color = choices[Math.floor(Math.random() * choices.length)];
        storageSet("play-color", color.name);
    }

    var root = document.documentElement;
    root.style.setProperty("--flower", hsl(color.h, color.s, clamp(color.l, 55, 80)));
    root.style.setProperty("--flower-soft", hsl(color.h, color.s, color.l, 0.22));

    /* ---------- overlay ---------- */
    function overlay(o) {
        var ov = document.getElementById("overlay");
        var title = document.getElementById("ovTitle");
        var text = document.getElementById("ovText");
        var btn = document.getElementById("playBtn");
        title.textContent = o.title || "";
        text.innerHTML = "";
        if (o.bold) {
            var b = document.createElement("b");
            b.textContent = o.bold;
            text.appendChild(b);
            if (o.text) text.appendChild(document.createElement("br"));
        }
        if (o.text) text.appendChild(document.createTextNode(o.text));
        if (o.btn) btn.textContent = o.btn;
        ov.classList.remove("hidden");
        setTimeout(function () { btn.focus(); }, 60);
    }

    function hideOverlay() {
        document.getElementById("overlay").classList.add("hidden");
    }

    /* ---------- toast ---------- */
    var toastEl = null, toastTimer = null;

    function toast(msg) {
        if (!toastEl) {
            toastEl = document.createElement("div");
            toastEl.className = "toast";
            toastEl.setAttribute("role", "status");
            (document.querySelector(".board") || document.body).appendChild(toastEl);
        }
        toastEl.textContent = msg;
        toastEl.classList.add("show");
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () { toastEl.classList.remove("show"); }, 1600);
    }

    /* ---------- swipe (touch + mouse drag) ---------- */
    function swipe(el, cb) {
        var start = null;
        el.addEventListener("pointerdown", function (e) {
            start = {x: e.clientX, y: e.clientY};
        });
        el.addEventListener("pointerup", function (e) {
            if (!start) return;
            var dx = e.clientX - start.x, dy = e.clientY - start.y;
            start = null;
            if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
            if (Math.abs(dx) > Math.abs(dy)) cb(dx > 0 ? 1 : -1, 0);
            else cb(0, dy > 0 ? 1 : -1);
        });
        el.addEventListener("pointercancel", function () { start = null; });
    }

    /* ---------- sound ---------- */
    var audio = null;
    var soundOn = storageGet("play-sound") !== "0";

    function tone(freq, dur, type, vol) {
        if (!soundOn) return;
        try {
            audio = audio || new (window.AudioContext || window.webkitAudioContext)();
            if (audio.state === "suspended") audio.resume();
            var t = audio.currentTime;
            var o = audio.createOscillator();
            var g = audio.createGain();
            o.type = type || "sine";
            o.frequency.value = freq;
            g.gain.setValueAtTime(0.0001, t);
            g.gain.exponentialRampToValueAtTime(vol || 0.12, t + 0.012);
            g.gain.exponentialRampToValueAtTime(0.0001, t + (dur || 0.15));
            o.connect(g);
            g.connect(audio.destination);
            o.start(t);
            o.stop(t + (dur || 0.15) + 0.03);
        } catch (e) { /* no audio */ }
    }

    /* A sound toggle is added to every game's header. */
    var hud = document.querySelector(".game-hud");
    if (hud) {
        var sb = document.createElement("button");
        sb.type = "button";
        sb.className = "sound-btn";
        var paint = function () {
            sb.textContent = soundOn ? "♪" : "♪̸";
            sb.classList.toggle("off", !soundOn);
            sb.setAttribute("aria-label", soundOn ? "Sesi kapat" : "Sesi aç");
        };
        paint();
        sb.addEventListener("click", function () {
            soundOn = !soundOn;
            storageSet("play-sound", soundOn ? "1" : "0");
            paint();
            tone(660, 0.1);
        });
        hud.querySelector(".back-link").insertAdjacentElement("afterend", sb);
    }

    window.Kasim = {
        PALETTE: PALETTE,
        color: color,
        clamp: clamp,
        hsl: hsl,
        storageGet: storageGet,
        storageSet: storageSet,
        jsonGet: jsonGet,
        jsonSet: jsonSet,
        shuffle: shuffle,
        fmt: fmt,
        best: best,
        overlay: overlay,
        hideOverlay: hideOverlay,
        toast: toast,
        swipe: swipe,
        tone: tone
    };
})();
