/* Notes: show the article in the chosen language (?lang=en|tr, remembered; else the browser language). */
(() => {
    'use strict';
    const store = {
        get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } },
        set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } }
    };
    const qs = new URLSearchParams(location.search);
    const lang = qs.get('lang') || store.get('tools-lang') || ((navigator.language || '').toLowerCase().startsWith('tr') ? 'tr' : 'en');
    if (qs.get('lang')) store.set('tools-lang', lang);
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-l]').forEach(el => { el.hidden = el.dataset.l !== lang; });
    const title = document.querySelector(`[data-title-${lang}]`);
    if (title) document.title = title.getAttribute(`data-title-${lang}`);
    const home = document.querySelector('[data-home]');
    if (home) home.href = lang === 'tr' ? '../tr/' : '../';
    document.querySelectorAll('[data-lang]').forEach(a => {
        a.classList.toggle('active', a.dataset.lang === lang);
        a.addEventListener('click', e => { e.preventDefault(); store.set('tools-lang', a.dataset.lang); location.href = `?lang=${a.dataset.lang}${location.hash}`; });
    });
    document.querySelectorAll('a[data-keep-lang]').forEach(a => { const u = new URL(a.href); u.searchParams.set('lang', lang); a.href = u.href; });
})();
