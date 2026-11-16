/* =========================================================================
   Live GitHub data
   - #repoList: public, non-fork repos (newest activity first), minus the
     "featured" and "exclude" lists in assets/data/repos.json
   - [data-repo] cards: live ★ count and "updated …" line
   Falls back to assets/data/repos-snapshot.json when the GitHub API is
   unavailable (offline, rate limit). Copy follows <html lang>.
   ========================================================================= */
(() => {
    'use strict';

    const TR = (document.documentElement.lang || '').toLowerCase().startsWith('tr');
    const t = (en, tr) => (TR ? tr : en);
    const base = new URL('../assets/data/', document.currentScript.src);
    const CACHE_KEY = 'gh-repos-v1';
    const TTL = 60 * 60 * 1000;

    const LANG_COLORS = {
        Python: '#3572A5', JavaScript: '#f1e05a', TypeScript: '#3178c6', Java: '#b07219', 'C++': '#f34b7d',
        C: '#555555', 'C#': '#178600', Shell: '#89e051', 'Jupyter Notebook': '#DA5B0B', HTML: '#e34c26',
        CSS: '#563d7c', Go: '#00ADD8', Rust: '#dea584', Kotlin: '#A97BFF'
    };

    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    function ago(iso) {
        const diff = (new Date(iso) - Date.now()) / 1000;
        const rtf = new Intl.RelativeTimeFormat(TR ? 'tr' : 'en', { numeric: 'auto' });
        const steps = [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60]];
        for (const [unit, sec] of steps) {
            if (Math.abs(diff) >= sec || unit === 'minute') return rtf.format(Math.round(diff / sec), unit);
        }
        return '';
    }

    function readCache() {
        try {
            const c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
            return c && Date.now() - c.t < TTL ? c.data : null;
        } catch (e) { return null; }
    }

    function writeCache(data) {
        try { localStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), data })); } catch (e) { /* ignore */ }
    }

    async function repos(user) {
        const cached = readCache();
        if (cached) return { data: cached, live: true };
        try {
            const res = await fetch(`https://api.github.com/users/${encodeURIComponent(user)}/repos?per_page=100&sort=pushed`,
                { headers: { Accept: 'application/vnd.github+json' } });
            if (!res.ok) throw new Error(res.status);
            const data = (await res.json()).filter(r => !r.fork && !r.private).map(r => ({
                name: r.name, description: r.description, html_url: r.html_url, language: r.language,
                stargazers_count: r.stargazers_count, forks_count: r.forks_count, pushed_at: r.pushed_at
            }));
            writeCache(data);
            return { data, live: true };
        } catch (e) {
            const res = await fetch(new URL('repos-snapshot.json', base));
            return { data: await res.json(), live: false };
        }
    }

    function card(r, cfg) {
        const d = cfg.descriptions?.[r.name];
        const desc = d ? (TR ? d.tr : d.en) : r.description;
        const lang = r.language
            ? `<span class="repo__lang"><i style="background:${LANG_COLORS[r.language] || '#8b949e'}"></i>${esc(r.language)}</span>` : '';
        return `
            <a class="repo" href="${esc(r.html_url)}" target="_blank" rel="noopener">
                <span class="repo__name"><i class="fab fa-github"></i> ${esc(r.name)}</span>
                <span class="repo__desc">${esc(desc || t('No description yet.', 'Henüz açıklama yok.'))}</span>
                <span class="repo__meta">${lang}
                    ${r.stargazers_count ? `<span>★ ${r.stargazers_count}</span>` : ''}
                    <span>${t('updated', 'güncellendi')} ${esc(ago(r.pushed_at))}</span>
                </span>
            </a>`;
    }

    async function init() {
        const list = document.getElementById('repoList');
        const featuredCards = document.querySelectorAll('[data-repo]');
        if (!list && !featuredCards.length) return;

        let cfg = { user: 'yunuseysr', featured: [], exclude: [], descriptions: {} };
        try { cfg = { ...cfg, ...(await (await fetch(new URL('repos.json', base))).json()) }; } catch (e) { /* defaults */ }

        let result;
        try { result = await repos(cfg.user); } catch (e) {
            if (list) list.innerHTML = `<p class="repo-empty">${t('Could not load repositories.', 'Repolar yüklenemedi.')}</p>`;
            return;
        }
        const byName = Object.fromEntries(result.data.map(r => [r.name, r]));

        featuredCards.forEach(el => {
            const r = byName[el.dataset.repo];
            if (!r) return;
            let meta = el.querySelector('.repo-stats');
            if (!meta) {
                meta = document.createElement('div');
                meta.className = 'repo-stats';
                el.querySelector('.tags')?.insertAdjacentElement('beforebegin', meta);
            }
            meta.innerHTML = (r.stargazers_count ? `<span>★ ${r.stargazers_count}</span>` : '') +
                `<span><i class="fas fa-code-branch"></i> ${t('updated', 'güncellendi')} ${esc(ago(r.pushed_at))}</span>`;
        });

        if (list) {
            const skip = new Set([...(cfg.featured || []), ...(cfg.exclude || [])]);
            const shown = result.data.filter(r => !skip.has(r.name))
                .sort((a, b) => new Date(b.pushed_at) - new Date(a.pushed_at));
            list.innerHTML = shown.map(r => card(r, cfg)).join('') ||
                `<p class="repo-empty">${t('Nothing here yet.', 'Henüz bir şey yok.')}</p>`;
            list.setAttribute('aria-busy', 'false');
        }
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
