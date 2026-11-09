(function () {
    "use strict";

    var NS = "http://www.w3.org/2000/svg";
    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var root = document.documentElement;

    /* Chrysanthemum colours — one is picked on every page load. */
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

    /* Petal rings, outer → inner. */
    var LAYERS = [
        {n: 34, len: 92, w: 7.2},
        {n: 30, len: 82, w: 7.2},
        {n: 26, len: 70, w: 7},
        {n: 22, len: 58, w: 6.6},
        {n: 18, len: 46, w: 6.2},
        {n: 14, len: 35, w: 5.8},
        {n: 11, len: 25, w: 5.2},
        {n: 8, len: 15, w: 4.4}
    ];

    var head = document.getElementById("head");
    var defs = document.getElementById("flowerDefs");
    var stemGroup = document.getElementById("stemGroup");
    var colorName = document.getElementById("colorName");
    var flowerBtn = document.getElementById("flowerBtn");
    var poem = document.getElementById("poem");

    var current = null;

    function clamp(v, lo, hi) {
        return Math.max(lo, Math.min(hi, v));
    }

    function hsl(h, s, l, a) {
        return "hsl(" + h + " " + clamp(s, 0, 100) + "% " + clamp(l, 0, 100) + "%" +
            (a !== undefined ? " / " + a : "") + ")";
    }

    function el(tag, attrs, parent) {
        var node = document.createElementNS(NS, tag);
        for (var k in attrs) node.setAttribute(k, attrs[k]);
        if (parent) parent.appendChild(node);
        return node;
    }

    function storageGet(key) {
        try { return window.localStorage.getItem(key); } catch (e) { return null; }
    }

    function storageSet(key, val) {
        try { window.localStorage.setItem(key, val); } catch (e) { /* ignore */ }
    }

    /* Pick a colour different from the previous one (this visit or last visit). */
    function pickColor() {
        var last = current ? current.name : storageGet("kasimpati-last");
        var choices = PALETTE.filter(function (c) { return c.name !== last; });
        var base = choices[Math.floor(Math.random() * choices.length)];
        storageSet("kasimpati-last", base.name);
        return {
            name: base.name,
            h: (base.h + Math.round(Math.random() * 10 - 5) + 360) % 360,
            s: base.s,
            l: base.l
        };
    }

    /* Spoon-shaped petal growing upward from (0,0). */
    function petalPath(L, w) {
        return "M0,0" +
            " C" + (-w * 0.35) + "," + (-L * 0.2) + " " + (-w) + "," + (-L * 0.55) + " " + (-w * 0.85) + "," + (-L * 0.9) +
            " Q0," + (-L * 1.05) + " " + (w * 0.85) + "," + (-L * 0.9) +
            " C" + w + "," + (-L * 0.55) + " " + (w * 0.35) + "," + (-L * 0.2) + " 0,0Z";
    }

    function buildGradients(c) {
        defs.textContent = "";
        LAYERS.forEach(function (_, i) {
            var g = el("linearGradient", {id: "pg" + i, x1: "0", y1: "1", x2: "0", y2: "0"}, defs);
            // inner rings sit deeper in the cup → a little darker and richer
            el("stop", {offset: "0%", "stop-color": hsl(c.h, c.s, c.l - 24 - i * 1.5)}, g);
            el("stop", {offset: "55%", "stop-color": hsl(c.h, c.s, c.l - i * 2.2)}, g);
            el("stop", {offset: "100%", "stop-color": hsl(c.h, c.s - 8, c.l + 14 - i * 2.5)}, g);
        });
        var rg = el("radialGradient", {id: "centerGrad", cx: "50%", cy: "45%", r: "60%"}, defs);
        el("stop", {offset: "0%", "stop-color": hsl(c.h, c.s, c.l + 6)}, rg);
        el("stop", {offset: "100%", "stop-color": hsl(c.h, c.s, c.l - 28)}, rg);

        var sg = el("linearGradient", {id: "stemGrad", x1: "0", y1: "0", x2: "0", y2: "1"}, defs);
        el("stop", {offset: "0%", "stop-color": "#4f8a4c"}, sg);
        el("stop", {offset: "100%", "stop-color": "#24502a"}, sg);
        var lg = el("linearGradient", {id: "leafGrad", x1: "0", y1: "0", x2: "1", y2: "1"}, defs);
        el("stop", {offset: "0%", "stop-color": "#5c9a55"}, lg);
        el("stop", {offset: "100%", "stop-color": "#2b5a2f"}, lg);
    }

    function buildHead(c) {
        head.textContent = "";
        var count = LAYERS.length;
        var outline = hsl(c.h, c.s, c.l - 34, 0.45);
        var vein = hsl(c.h, c.s - 10, c.l + 22, 0.35);

        LAYERS.forEach(function (layer, i) {
            var ring = el("g", {}, head);
            var offset = Math.random() * (360 / layer.n);
            for (var p = 0; p < layer.n; p++) {
                var angle = offset + p * (360 / layer.n) + (Math.random() * 4 - 2);
                var L = layer.len * (0.92 + Math.random() * 0.14);
                var wrap = el("g", {transform: "rotate(" + angle.toFixed(2) + ")"}, ring);
                var shape = el("g", {"class": "petal-shape"}, wrap);
                // centre opens first, outer rings follow
                var delay = (count - 1 - i) * 0.11 + Math.random() * 0.25;
                shape.style.setProperty("--d", delay.toFixed(2) + "s");
                el("path", {
                    d: petalPath(L, layer.w),
                    fill: "url(#pg" + i + ")",
                    stroke: outline,
                    "stroke-width": "0.45"
                }, shape);
                el("path", {
                    d: "M0," + (-L * 0.12) + " L0," + (-L * 0.82),
                    stroke: vein,
                    "stroke-width": "0.6",
                    "stroke-linecap": "round",
                    fill: "none"
                }, shape);
            }
        });

        el("circle", {"class": "center-disc", cx: "0", cy: "0", r: "6.5", fill: "url(#centerGrad)"}, head);
    }

    var LEAF = "M0,0 C8,-10 18,-16 26,-14 C24,-21 31,-27 39,-22 C41,-29 51,-29 55,-20 " +
        "C61,-20 66,-13 63,-7 C69,-3 67,5 60,7 C62,13 56,17 50,15 C46,21 38,21 34,15 " +
        "C28,19 20,17 18,11 C10,11 4,7 0,0Z";

    function buildStem() {
        stemGroup.textContent = "";
        el("path", {
            "class": "stem",
            d: "M0,20 C4,70 -6,120 2,205",
            fill: "none",
            stroke: "url(#stemGrad)",
            "stroke-width": "5",
            "stroke-linecap": "round",
            pathLength: "1"
        }, stemGroup);

        [
            {t: "translate(1,118) rotate(-18) scale(1.05)", d: "0.7s"},
            {t: "translate(-1,158) scale(-0.95,0.95) rotate(-12)", d: "0.9s"}
        ].forEach(function (leaf) {
            var g = el("g", {transform: leaf.t}, stemGroup);
            var inner = el("g", {"class": "leaf"}, g);
            inner.style.setProperty("--d", leaf.d);
            inner.style.transformOrigin = "0% 50%";
            el("path", {d: LEAF, fill: "url(#leafGrad)"}, inner);
            el("path", {
                d: "M2,0 C20,-4 40,-6 58,-4",
                stroke: "rgba(200,235,190,0.35)",
                "stroke-width": "0.9",
                fill: "none"
            }, inner);
        });
    }

    function paint() {
        current = pickColor();
        root.style.setProperty("--flower", hsl(current.h, current.s, clamp(current.l, 55, 80)));
        root.style.setProperty("--flower-soft", hsl(current.h, current.s, current.l, 0.22));
        buildGradients(current);
        buildHead(current);
        colorName.innerHTML = "bugünkü kasımpatın: <b></b>";
        colorName.querySelector("b").textContent = current.name;
    }

    /* ---------- first bloom ---------- */
    buildStem();
    paint();

    setTimeout(function () {
        poem.classList.add("in");
    }, reduceMotion ? 0 : 1600);

    flowerBtn.addEventListener("click", function () {
        paint();
    });

    /* ---------- falling autumn leaves + a few stray petals ---------- */
    var field = document.getElementById("fallField");
    var LEAF_COLORS = ["#b5541c", "#d07a2a", "#8e3b1a", "#c9962e", "#6f2c14"];

    function spawn() {
        var isPetal = Math.random() < 0.3;
        var f = document.createElement("span");
        f.className = "faller " + (isPetal ? "faller--petal" : "faller--leaf");
        var size = isPetal ? 6 + Math.random() * 4 : 10 + Math.random() * 8;
        var duration = 10 + Math.random() * 8;
        f.style.left = (Math.random() * 100) + "vw";
        f.style.width = size + "px";
        f.style.height = (isPetal ? size * 1.8 : size) + "px";
        f.style.background = isPetal
            ? hsl(current.h, current.s, current.l + 6, 0.85)
            : LEAF_COLORS[Math.floor(Math.random() * LEAF_COLORS.length)];
        f.style.animationDuration = duration + "s";
        f.style.setProperty("--drift", (Math.random() * 160 - 80) + "px");
        f.style.setProperty("--spin", (Math.random() * 720 - 360) + "deg");
        field.appendChild(f);
        setTimeout(function () { f.remove(); }, duration * 1000 + 200);
    }

    if (!reduceMotion) {
        for (var i = 0; i < 5; i++) setTimeout(spawn, i * 800);
        setInterval(spawn, 1900);
    }
})();
