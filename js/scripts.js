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
});
