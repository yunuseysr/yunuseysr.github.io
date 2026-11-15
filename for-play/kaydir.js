(function () {
    "use strict";

    var K = window.Kasim;
    var N = 4;
    var BEST_KEY = "play-kaydir-best";

    var grid = document.getElementById("grid");
    var movesEl = document.getElementById("moves");
    var timeEl = document.getElementById("time");
    var bestEl = document.getElementById("best");
    var overlay = document.getElementById("overlay");
    var ovTitle = document.getElementById("ovTitle");
    var ovText = document.getElementById("ovText");
    var playBtn = document.getElementById("playBtn");
    var shuffleBtn = document.getElementById("shuffleBtn");

    var best = parseInt(K.storageGet(BEST_KEY), 10) || 0;
    var board = [];   // board[pos] = tile number, 0 = empty
    var tiles = {};   // tile number → element
    var moves = 0, startAt = 0, timer = null, done = false;

    function fmt(sec) {
        return Math.floor(sec / 60) + ":" + ("0" + (sec % 60)).slice(-2);
    }

    function showBest() {
        bestEl.textContent = best || "–";
    }

    function place(n, pos) {
        var el = tiles[n];
        el.style.transform = "translate(" + (pos % N) * 100 + "%, " + Math.floor(pos / N) * 100 + "%)";
        el.classList.toggle("is-home", pos === n - 1);
    }

    function render() {
        board.forEach(function (n, pos) { if (n) place(n, pos); });
    }

    function neighbours(pos) {
        var r = Math.floor(pos / N), c = pos % N, out = [];
        if (r > 0) out.push(pos - N);
        if (r < N - 1) out.push(pos + N);
        if (c > 0) out.push(pos - 1);
        if (c < N - 1) out.push(pos + 1);
        return out;
    }

    /* Shuffle by random legal moves → always solvable. */
    function shuffle() {
        board = [];
        for (var i = 1; i < N * N; i++) board.push(i);
        board.push(0);
        var empty = N * N - 1, prev = -1;
        for (var k = 0; k < 220; k++) {
            var opts = neighbours(empty).filter(function (p) { return p !== prev; });
            var pick = opts[Math.floor(Math.random() * opts.length)];
            board[empty] = board[pick];
            board[pick] = 0;
            prev = empty;
            empty = pick;
        }
        if (solved()) return shuffle();

        clearInterval(timer);
        timer = null;
        moves = 0;
        done = false;
        movesEl.textContent = "0";
        timeEl.textContent = "0:00";
        overlay.classList.add("hidden");
        render();
    }

    function solved() {
        for (var i = 0; i < N * N - 1; i++) if (board[i] !== i + 1) return false;
        return true;
    }

    function tryMove(pos) {
        if (done) return;
        var empty = board.indexOf(0);
        if (neighbours(empty).indexOf(pos) === -1) return;
        if (!timer) {
            startAt = Date.now();
            timer = setInterval(function () {
                timeEl.textContent = fmt(Math.floor((Date.now() - startAt) / 1000));
            }, 500);
        }
        board[empty] = board[pos];
        board[pos] = 0;
        place(board[empty], empty);
        moves++;
        movesEl.textContent = moves;
        K.tone(260 + board[empty] * 22, 0.05, "triangle", 0.04);
        if (solved()) setTimeout(finish, 300);
    }

    function finish() {
        done = true;
        clearInterval(timer);
        timer = null;
        var secs = Math.floor((Date.now() - startAt) / 1000);
        var isBest = !best || moves < best;
        if (isBest) {
            best = moves;
            K.storageSet(BEST_KEY, String(best));
            showBest();
        }
        ovTitle.textContent = isBest ? "Yeni rekor!" : "Tamamlandı";
        ovText.innerHTML = "";
        var b = document.createElement("b");
        b.textContent = moves + " hamle · " + fmt(secs);
        ovText.appendChild(b);
        ovText.appendChild(document.createElement("br"));
        ovText.appendChild(document.createTextNode(
            moves < 80 ? "Çok hızlı çözdün, ustasın!" :
                moves < 160 ? "Güzel iş, taşlar yerli yerinde." :
                    "Sabırla çözdün, bu da bir sanat."));
        overlay.classList.remove("hidden");
        setTimeout(function () { playBtn.focus(); }, 50);
    }

    /* build tiles once */
    for (var n = 1; n < N * N; n++) {
        var t = document.createElement("button");
        t.type = "button";
        t.className = "tile";
        t.textContent = n;
        t.dataset.n = n;
        t.addEventListener("click", function (e) {
            tryMove(board.indexOf(+e.currentTarget.dataset.n));
        });
        tiles[n] = t;
        grid.appendChild(t);
    }

    /* arrow keys move the tile *into* the empty slot from that direction */
    window.addEventListener("keydown", function (e) {
        var empty = board.indexOf(0), r = Math.floor(empty / N), c = empty % N, pos = -1;
        if (e.key === "ArrowUp" && r < N - 1) pos = empty + N;
        else if (e.key === "ArrowDown" && r > 0) pos = empty - N;
        else if (e.key === "ArrowLeft" && c < N - 1) pos = empty + 1;
        else if (e.key === "ArrowRight" && c > 0) pos = empty - 1;
        else return;
        e.preventDefault();
        tryMove(pos);
    });

    playBtn.addEventListener("click", shuffle);
    shuffleBtn.addEventListener("click", shuffle);
    showBest();
    shuffle();
})();
