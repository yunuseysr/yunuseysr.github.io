/* =========================================================================
   Yunus Emre Yaşar — Portfolio interactions
   - Typewriter headline (phrases read from #typed[data-phrases])
   - Active-nav highlighting via IntersectionObserver
   - Reveal-on-scroll
   - Mobile sidebar toggle
   ========================================================================= */

document.addEventListener('DOMContentLoaded', () => {

    /* ----------------------------------------------------- current year */
    const year = document.getElementById('year');
    if (year) year.textContent = new Date().getFullYear();

    /* --------------------------------------------------- mobile sidebar */
    const sidebar  = document.getElementById('sidebar');
    const toggle   = document.getElementById('navToggle');
    const backdrop = document.getElementById('navBackdrop');

    const closeNav = () => {
        sidebar?.classList.remove('open');
        backdrop?.classList.remove('show');
    };
    toggle?.addEventListener('click', () => {
        sidebar?.classList.toggle('open');
        backdrop?.classList.toggle('show');
    });
    backdrop?.addEventListener('click', closeNav);
    document.querySelectorAll('#nav a').forEach(a =>
        a.addEventListener('click', closeNav)
    );

    /* --------------------------------------------- active nav on scroll */
    const navLinks = [...document.querySelectorAll('#nav a')];
    const sections = navLinks
        .map(a => document.querySelector(a.getAttribute('href')))
        .filter(Boolean);

    if ('IntersectionObserver' in window && sections.length) {
        const spy = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;
                navLinks.forEach(a => a.classList.toggle(
                    'active',
                    a.getAttribute('href') === '#' + entry.target.id
                ));
            });
        }, { rootMargin: '-45% 0px -50% 0px' });
        sections.forEach(s => spy.observe(s));
    }

    /* ------------------------------------------------- reveal on scroll */
    const reveal = document.querySelectorAll('[data-reveal]');
    if ('IntersectionObserver' in window && reveal.length) {
        const ro = new IntersectionObserver((entries, obs) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('in');
                    obs.unobserve(entry.target);
                }
            });
        }, { threshold: 0.12 });
        reveal.forEach(el => ro.observe(el));
    } else {
        reveal.forEach(el => el.classList.add('in'));
    }

    /* ------------------------------------------------- typewriter intro */
    const typed = document.getElementById('typed');
    if (typed) {
        let phrases;
        try { phrases = JSON.parse(typed.dataset.phrases || '[]'); } catch { phrases = []; }
        if (!phrases.length) phrases = ['Big Data & AI Engineer'];

        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduce) {
            typed.textContent = phrases[0];
        } else {
            let p = 0, c = 0, deleting = false;
            const tick = () => {
                const word = phrases[p];
                typed.textContent = word.slice(0, c);
                if (!deleting && c < word.length) {
                    c++; setTimeout(tick, 70);
                } else if (!deleting && c === word.length) {
                    deleting = true; setTimeout(tick, 1600);
                } else if (deleting && c > 0) {
                    c--; setTimeout(tick, 35);
                } else {
                    deleting = false; p = (p + 1) % phrases.length; setTimeout(tick, 300);
                }
            };
            tick();
        }
    }

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ------------------------------------------- hero neural-net canvas */
    const net = document.getElementById('heroNet');
    if (net && net.getContext) {
        const ctx = net.getContext('2d');
        const hero = net.parentElement;
        let W = 0, H = 0, nodes = [], visible = true, raf = 0;
        const mouse = { x: -9999, y: -9999 };
        const LINK = 130, MOUSE_R = 170;

        const resize = () => {
            const r = hero.getBoundingClientRect();
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            W = r.width; H = r.height;
            net.width = Math.round(W * dpr);
            net.height = Math.round(H * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            const n = Math.min(90, Math.round(W * H / 15000));
            nodes = Array.from({ length: n }, () => ({
                x: Math.random() * W,
                y: Math.random() * H,
                vx: (Math.random() - .5) * .35,
                vy: (Math.random() - .5) * .35,
                r: Math.random() * 1.6 + .8,
                hue: Math.random() < .5 ? 'rgba(34,211,238,' : 'rgba(168,85,247,'
            }));
            if (reduceMotion) draw();
        };

        const draw = () => {
            ctx.clearRect(0, 0, W, H);
            for (let i = 0; i < nodes.length; i++) {
                const a = nodes[i];
                for (let j = i + 1; j < nodes.length; j++) {
                    const b = nodes[j];
                    const d = Math.hypot(a.x - b.x, a.y - b.y);
                    if (d < LINK) {
                        ctx.strokeStyle = `rgba(148,163,255,${(1 - d / LINK) * .22})`;
                        ctx.lineWidth = 1;
                        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
                    }
                }
                const dm = Math.hypot(a.x - mouse.x, a.y - mouse.y);
                if (dm < MOUSE_R) {
                    ctx.strokeStyle = `rgba(34,211,238,${(1 - dm / MOUSE_R) * .55})`;
                    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke();
                }
            }
            nodes.forEach(n => {
                const glow = Math.hypot(n.x - mouse.x, n.y - mouse.y) < MOUSE_R;
                ctx.fillStyle = n.hue + (glow ? .95 : .55) + ')';
                ctx.beginPath(); ctx.arc(n.x, n.y, glow ? n.r + 1 : n.r, 0, Math.PI * 2); ctx.fill();
            });
        };

        const step = () => {
            nodes.forEach(n => {
                // gentle pull towards the cursor, like activations firing
                const dx = mouse.x - n.x, dy = mouse.y - n.y, d = Math.hypot(dx, dy);
                if (d < MOUSE_R && d > 1) { n.vx += dx / d * .012; n.vy += dy / d * .012; }
                n.vx *= .995; n.vy *= .995;
                const sp = Math.hypot(n.vx, n.vy);
                if (sp > .9) { n.vx *= .9 / sp; n.vy *= .9 / sp; }
                if (sp < .08) { n.vx += (Math.random() - .5) * .05; n.vy += (Math.random() - .5) * .05; }
                n.x += n.vx; n.y += n.vy;
                if (n.x < 0 || n.x > W) n.vx *= -1;
                if (n.y < 0 || n.y > H) n.vy *= -1;
            });
            draw();
            raf = visible ? requestAnimationFrame(step) : 0;
        };

        hero.addEventListener('pointermove', e => {
            const r = hero.getBoundingClientRect();
            mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top;
        });
        hero.addEventListener('pointerleave', () => { mouse.x = mouse.y = -9999; });
        window.addEventListener('resize', resize);
        resize();

        if (!reduceMotion) {
            if ('IntersectionObserver' in window) {
                new IntersectionObserver(([entry]) => {
                    visible = entry.isIntersecting;
                    if (visible && !raf) raf = requestAnimationFrame(step);
                }).observe(hero);
            }
            raf = requestAnimationFrame(step);
        }
    }

    /* ------------------------------------------------ counting stats */
    const nums = document.querySelectorAll('.stat__num');
    const countUp = el => {
        const m = el.textContent.trim().match(/^(\D*)(\d+(?:\.\d+)?)(.*)$/);
        if (!m) return;
        const [, pre, num, post] = m;
        const target = parseFloat(num), dec = (num.split('.')[1] || '').length;
        const t0 = performance.now(), dur = 1400;
        const tick = now => {
            const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
            el.textContent = pre + (target * e).toFixed(dec) + post;
            if (k < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    };
    if (!reduceMotion && 'IntersectionObserver' in window && nums.length) {
        const co = new IntersectionObserver((entries, obs) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) { countUp(entry.target); obs.unobserve(entry.target); }
            });
        }, { threshold: .6 });
        nums.forEach(n => co.observe(n));
    }

    /* ------------------------------------------ cursor spotlight on cards */
    document.querySelectorAll('.card, .skill-group').forEach(card => {
        card.addEventListener('pointermove', e => {
            const r = card.getBoundingClientRect();
            card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
            card.style.setProperty('--my', (e.clientY - r.top) + 'px');
        });
    });

    /* ------------------------------------------------- project filters */
    const filters = document.getElementById('projectFilters');
    const cards = [...document.querySelectorAll('#projectCards .card')];
    const applyFilter = key => {
        filters?.querySelectorAll('.filter').forEach(b =>
            b.classList.toggle('is-active', b.dataset.filter === key));
        cards.forEach(c => {
            const show = key === 'all' || (c.dataset.cat || '').split(' ').includes(key);
            c.classList.toggle('is-hidden', !show);
            if (show) c.classList.add('in');
        });
    };
    if (filters) {
        filters.querySelectorAll('.filter').forEach(b => {
            const n = b.dataset.filter === 'all' ? cards.length
                : cards.filter(c => (c.dataset.cat || '').split(' ').includes(b.dataset.filter)).length;
            b.insertAdjacentHTML('beforeend', ` <span class="filter__n">${n}</span>`);
            b.addEventListener('click', () => applyFilter(b.dataset.filter));
        });
    }
    document.querySelectorAll('[data-filter-jump]').forEach(a =>
        a.addEventListener('click', () => applyFilter(a.dataset.filterJump)));
});
