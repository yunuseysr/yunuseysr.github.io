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

    const TR = (document.documentElement.lang || '').toLowerCase().startsWith('tr');
    const tt = (en, tr) => (TR ? tr : en);
    const norm = s => (s || '').toLocaleLowerCase(TR ? 'tr-TR' : 'en-US').replace(/[^\p{L}\p{N}+#]+/gu, ' ').trim();

    /* --------------------------------------------- "I need…" (services) */
    const needs = document.getElementById('needFilters');
    const services = [...document.querySelectorAll('#serviceCards .service')];
    needs?.querySelectorAll('[data-need]').forEach(b => b.addEventListener('click', () => {
        const key = b.dataset.need;
        needs.querySelectorAll('[data-need]').forEach(x => x.classList.toggle('is-active', x === b));
        services.forEach(c => {
            c.classList.add('in');
            c.classList.toggle('is-dim', key !== 'all' && c.dataset.service !== key);
            c.classList.toggle('is-picked', c.dataset.service === key);
        });
        const picked = services.find(c => c.dataset.service === key);
        if (picked && window.matchMedia('(max-width: 900px)').matches) picked.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }));

    /* ------------------------------------- skills → the projects using them */
    const cardText = c => ` ${norm([...c.querySelectorAll('h3, p, .card__meta, .tag')].map(e => e.textContent).join(' '))} `;
    const hasWord = (text, w) => text.includes(` ${w} `) || text.includes(` ${w}`) && /\p{L}/u.test(w.slice(-1)) && new RegExp(` ${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\p{L}{0,4})? `, 'u').test(text);
    const SYN = { 'computer vision': ['opencv', 'cnn', 'image'], 'image processing': ['image processing', 'opencv', 'görüntü'],
        'görüntü işleme': ['görüntü', 'opencv'], 'bilgisayarla görme': ['opencv', 'cnn', 'görüntü'],
        'big data': ['big data', 'spark', 'büyük veri'], 'büyük veri': ['büyük veri', 'spark', 'big data'],
        'data pipelines': ['data pipeline', 'airflow', 'etl'], 'veri hatları': ['veri hattı', 'airflow', 'etl'],
        'deep learning': ['cnn', 'tensorflow'], 'derin öğrenme': ['cnn', 'tensorflow'],
        'neural networks dnn cnn': ['cnn'], 'sinir ağları dnn cnn': ['cnn'], 'slam lidar': ['slam', 'lidar'],
        'machine learning': ['cnn', 'tensorflow', 'sentiment', 'nlp'], 'makine öğrenmesi': ['cnn', 'tensorflow', 'duygu', 'nlp'] };
    const filterBar = document.getElementById('projectFilters');
    let skillPill = null;
    const showSkill = label => {
        const key = norm(label);
        const words = SYN[key] || [key];
        const hits = cards.filter(c => words.some(w => hasWord(cardText(c), w)));
        if (!hits.length) return false;
        filters?.querySelectorAll('.filter').forEach(b => b.classList.remove('is-active'));
        cards.forEach(c => { c.classList.toggle('is-hidden', !hits.includes(c)); c.classList.add('in'); });
        skillPill?.remove();
        skillPill = document.createElement('button');
        skillPill.type = 'button';
        skillPill.className = 'filter is-active skill-pill';
        skillPill.innerHTML = `${label} <span class="filter__n">${hits.length}</span> ✕`;
        skillPill.addEventListener('click', () => { skillPill.remove(); skillPill = null; applyFilter('all'); });
        filterBar?.appendChild(skillPill);
        document.getElementById('projects')?.scrollIntoView({ behavior: 'smooth' });
        return true;
    };
    document.querySelectorAll('.skill-group .chip').forEach(chip => {
        const has = cards.some(c => (SYN[norm(chip.textContent)] || [norm(chip.textContent)]).some(w => hasWord(cardText(c), w)));
        if (!has) return;
        chip.classList.add('chip--link');
        chip.setAttribute('role', 'button');
        chip.setAttribute('tabindex', '0');
        chip.title = tt('Show projects using this', 'Bunu kullanan projeleri göster');
        const go = () => showSkill(chip.textContent.trim());
        chip.addEventListener('click', go);
        chip.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    });
    filters?.querySelectorAll('.filter').forEach(b => b.addEventListener('click', () => { skillPill?.remove(); skillPill = null; }));

    /* ------------------------------------------------ Ctrl+K command palette */
    const items = [];
    document.querySelectorAll('#nav a').forEach(a => items.push({
        label: a.textContent.trim(), hint: tt('Section', 'Bölüm'), icon: '§', run: () => { location.hash = a.getAttribute('href'); }
    }));
    document.querySelectorAll('[data-demo]').forEach(b => {
        const card = b.closest('.card');
        const title = card?.querySelector('h3')?.textContent.trim();
        if (!title || items.some(i => i.key === b.dataset.demo)) return;
        items.push({ key: b.dataset.demo, label: title, hint: tt('Live demo', 'Canlı demo'), icon: '▶', run: () => b.click() });
    });
    document.querySelectorAll('[data-repo]').forEach(card => items.push({
        label: card.querySelector('h3')?.textContent.trim(), hint: 'GitHub', icon: '⎇',
        run: () => window.open(`https://github.com/yunuseysr/${card.dataset.repo}`, '_blank', 'noopener')
    }));
    const root = TR ? '../' : '';
    items.push(
        { label: tt('Developer tools', 'Geliştirici araçları'), hint: tt('Page', 'Sayfa'), icon: '🛠', run: () => { location.href = `${root}tools/${TR ? '?lang=tr' : ''}`; } },
        { label: tt('Notes', 'Notlar'), hint: tt('Page', 'Sayfa'), icon: '✎', run: () => { location.href = `${root}notes/${TR ? '?lang=tr' : ''}`; } },
        { label: tt('Download CV (PDF)', 'CV indir (PDF)'), hint: 'PDF', icon: '⬇',
          run: () => { location.href = `${root}assets/cv/Yunus-Emre-Yasar-CV${TR ? '-TR' : ''}.pdf`; } },
        { label: tt('Copy e-mail address', 'E-posta adresini kopyala'), hint: tt('Contact', 'İletişim'), icon: '✉',
          run: () => navigator.clipboard?.writeText('yunuseysr@gmail.com') },
        { label: TR ? 'English' : 'Türkçe', hint: tt('Language', 'Dil'), icon: '🌐', run: () => { location.href = TR ? '../' : 'tr/'; } }
    );

    let pal = null, sel = 0, shown = [];
    const openPalette = () => {
        if (pal) return;
        pal = document.createElement('div');
        pal.className = 'kpal';
        pal.innerHTML = `<div class="kpal__box" role="dialog" aria-modal="true" aria-label="${tt('Command palette', 'Komut paleti')}">
            <input class="kpal__in" type="text" placeholder="${tt('Jump to a section, demo or tool…', 'Bölüm, demo ya da araca git…')}" aria-label="${tt('Search', 'Ara')}">
            <ul class="kpal__list" role="listbox"></ul>
            <div class="kpal__foot"><kbd>↑</kbd><kbd>↓</kbd> ${tt('move', 'gez')} · <kbd>Enter</kbd> ${tt('open', 'aç')} · <kbd>Esc</kbd> ${tt('close', 'kapat')}</div></div>`;
        document.body.appendChild(pal);
        const input = pal.querySelector('input'), list = pal.querySelector('ul');
        const render = () => {
            const q = norm(input.value);
            shown = items.filter(i => i.label && (!q || norm(`${i.label} ${i.hint}`).includes(q))).slice(0, 12);
            sel = Math.min(sel, Math.max(0, shown.length - 1));
            list.innerHTML = shown.map((i, n) => `<li role="option" class="${n === sel ? 'is-sel' : ''}" data-n="${n}">
                <span class="kpal__ic">${i.icon}</span><span class="kpal__lb">${i.label}</span><span class="kpal__hint">${i.hint}</span></li>`).join('')
                || `<li class="kpal__none">${tt('Nothing found', 'Sonuç yok')}</li>`;
        };
        const pick = n => { const it = shown[n]; closePalette(); it?.run(); };
        input.addEventListener('input', () => { sel = 0; render(); });
        input.addEventListener('keydown', e => {
            if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(sel + 1, shown.length - 1); render(); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(sel - 1, 0); render(); }
            else if (e.key === 'Enter') { e.preventDefault(); pick(sel); }
            else if (e.key === 'Escape') closePalette();
        });
        list.addEventListener('click', e => { const li = e.target.closest('[data-n]'); if (li) pick(+li.dataset.n); });
        pal.addEventListener('click', e => { if (e.target === pal) closePalette(); });
        render();
        requestAnimationFrame(() => pal?.classList.add('show'));
        input.focus();
    };
    const closePalette = () => { pal?.remove(); pal = null; };
    document.addEventListener('keydown', e => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); pal ? closePalette() : openPalette(); }
    });
    document.querySelectorAll('[data-palette]').forEach(b => b.addEventListener('click', openPalette));
});
