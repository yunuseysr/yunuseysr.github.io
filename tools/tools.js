/* =========================================================================
   Developer tools — everything runs in the browser; nothing is uploaded.
   Language: ?lang=en|tr (remembered), else the browser language.
   Routing: #<tool-id>; empty hash = the tool list.
   ========================================================================= */
(() => {
    'use strict';

    /* ------------------------------------------------------------ basics */
    const store = {
        get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } },
        set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } }
    };
    const qs = new URLSearchParams(location.search);
    const LANG = qs.get('lang') || store.get('tools-lang') ||
        ((navigator.language || '').toLowerCase().startsWith('tr') ? 'tr' : 'en');
    if (qs.get('lang')) store.set('tools-lang', LANG);
    const TR = LANG === 'tr';
    const t = (en, tr) => (TR ? tr : en);
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const $ = (sel, root = document) => root.querySelector(sel);
    const html = (el, markup) => { el.innerHTML = markup; return el; };
    const bigintSafe = (k, v) => (typeof v === 'bigint' ? v.toString() : v);
    const nf = n => Number(n).toLocaleString(TR ? 'tr-TR' : 'en-US');
    const bytes = n => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`);

    function download(name, data, type = 'application/octet-stream') {
        const url = URL.createObjectURL(data instanceof Blob ? data : new Blob([data], { type }));
        const a = Object.assign(document.createElement('a'), { href: url, download: name });
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
    }

    async function copy(text, btn) {
        try {
            await navigator.clipboard.writeText(text);
            if (btn) { const o = btn.innerHTML; btn.innerHTML = '✓ ' + t('Copied', 'Kopyalandı'); setTimeout(() => (btn.innerHTML = o), 1200); }
        } catch (e) { /* clipboard blocked */ }
    }

    const copyBtn = id => `<button type="button" class="tbtn" data-copy="${id}"><i class="fas fa-copy"></i> ${t('Copy', 'Kopyala')}</button>`;
    function wireCopy(root) {
        root.querySelectorAll('[data-copy]').forEach(b => b.addEventListener('click', () => {
            const src = root.querySelector('#' + b.dataset.copy);
            copy(src.value ?? src.textContent, b);
        }));
    }

    /* =================================================================
       1) Data file explorer — DuckDB-WASM (Parquet / CSV / JSON)
       ================================================================= */
    const DUCKDB = 'https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.29.0/+esm';
    let duck = null;

    async function getDuck(status) {
        if (duck) return duck;
        status(t('Loading the DuckDB engine (about 7 MB, only once)…', 'DuckDB motoru yükleniyor (yaklaşık 7 MB, bir kez)…'));
        const m = await import(DUCKDB);
        const bundle = await m.selectBundle(m.getJsDelivrBundles());
        const workerUrl = URL.createObjectURL(new Blob([`importScripts("${bundle.mainWorker}");`], { type: 'text/javascript' }));
        const worker = new Worker(workerUrl);
        const logger = m.VoidLogger ? new m.VoidLogger() : new m.ConsoleLogger();
        const db = new m.AsyncDuckDB(logger, worker);
        await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
        URL.revokeObjectURL(workerUrl);
        duck = { m, db, conn: await db.connect() };
        return duck;
    }

    function arrowRows(res) {
        const fields = res.schema.fields.map(f => ({ name: f.name, type: String(f.type) }));
        const rows = [];
        for (const r of res) rows.push(fields.map(f => r[f.name]));
        return { fields, rows };
    }

    function cell(v, type) {
        if (v === null || v === undefined) return ['null', 'NULL'];
        if (typeof v === 'bigint') return ['num', v.toString()];
        if (typeof v === 'number') {
            if (/Timestamp|Date/.test(type)) { const d = new Date(v); return ['', isNaN(d) ? String(v) : d.toISOString().replace('.000Z', 'Z').replace('T00:00:00Z', '')]; }
            return ['num', Number.isInteger(v) ? String(v) : String(+v.toPrecision(10))];
        }
        if (typeof v === 'boolean') return ['', String(v)];
        if (v instanceof Date) return ['', v.toISOString()];
        if (v instanceof Uint8Array) return ['', `<${v.length} bytes>`];
        if (typeof v === 'object') return ['', JSON.stringify(v.toJSON ? v.toJSON() : v, bigintSafe)];
        return ['', String(v)];
    }

    function table({ fields, rows }, limit = 500) {
        return `<div class="ttable-wrap"><table class="ttable"><thead><tr>${fields.map(f =>
            `<th>${esc(f.name)}<small>${esc(f.type.replace(/<.*>/, '<…>'))}</small></th>`).join('')}</tr></thead><tbody>${
            rows.slice(0, limit).map(r => `<tr>${r.map((v, i) => { const [cls, txt] = cell(v, fields[i].type);
                return `<td class="${cls}" title="${esc(txt)}">${esc(txt)}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div>`;
    }

    function sampleCsv() {
        let s = 7;
        const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
        const pick = a => a[Math.floor(r() * a.length)];
        const states = ['SP', 'RJ', 'MG', 'RS', 'PR', 'SC', 'BA', 'DF', 'GO', 'ES'];
        const cats = ['electronics', 'furniture', 'toys', 'sports', 'beauty', 'books', 'garden', 'fashion'];
        const statuses = ['delivered', 'delivered', 'delivered', 'delivered', 'shipped', 'canceled'];
        const lines = ['order_id,order_date,customer_state,category,price,freight,status,review_score'];
        for (let i = 1; i <= 2000; i++) {
            const d = new Date(Date.UTC(2024, 0, 1) + Math.floor(r() * 365) * 86400000).toISOString().slice(0, 10);
            const status = pick(statuses);
            lines.push([`ORD-${String(i).padStart(5, '0')}`, d, pick(states), pick(cats), (5 + r() * 495).toFixed(2),
                (r() * 40).toFixed(2), status, status === 'delivered' ? 1 + Math.floor(r() * 5) : ''].join(','));
        }
        return lines.join('\n');
    }

    function mountData(root) {
        html(root, `
            <label class="drop" id="drop" tabindex="0">
                <i class="fas fa-upload"></i>
                <b>${t('Drop a Parquet, CSV or JSON file here', 'Buraya bir Parquet, CSV ya da JSON dosyası bırak')}</b>
                <small>${t('or click to choose · it is read by DuckDB inside your browser and never uploaded',
                    'ya da tıklayıp seç · tarayıcının içinde DuckDB ile okunur, hiçbir yere yüklenmez')}</small>
                <input type="file" id="file" accept=".parquet,.csv,.tsv,.txt,.json,.jsonl,.ndjson" hidden>
            </label>
            <div class="trow"><button type="button" class="tbtn" id="sample"><i class="fas fa-database"></i> ${t('Try with sample data (2 000 orders)', 'Örnek veriyle dene (2 000 sipariş)')}</button></div>
            <p class="tmsg" id="msg"></p>
            <div id="result" hidden>
                <div class="tstats" id="stats"></div>
                <div class="ttabs" role="tablist">
                    ${['preview', 'schema', 'profile', 'sql', 'export'].map((k, i) => `<button type="button" class="ttab${i ? '' : ' is-on'}" data-tab="${k}">${{
                        preview: t('Preview', 'Önizleme'), schema: t('Schema', 'Şema'), profile: t('Profile', 'Profil'),
                        sql: 'SQL', export: t('Convert & export', 'Dönüştür & indir') }[k]}</button>`).join('')}
                </div>
                <div id="pane"></div>
            </div>`);

        const msg = $('#msg', root), stats = $('#stats', root), pane = $('#pane', root);
        let name = null, meta = {}, lastSql = 'SELECT * FROM data LIMIT 100', tab = 'preview';
        const status = (text, cls = '') => { msg.textContent = text; msg.className = 'tmsg ' + cls; };

        async function q(sql) {
            const { conn } = await getDuck(status);
            return arrowRows(await conn.query(sql));
        }

        async function open(file, text) {
            try {
                const { m, db } = await getDuck(status);
                status(t('Reading…', 'Okunuyor…'));
                const ext = (file ? file.name : 'sample.csv').split('.').pop().toLowerCase();
                name = `input_${Date.now()}.${ext}`;
                if (file) await db.registerFileHandle(name, file, m.DuckDBDataProtocol.BROWSER_FILEREADER, true);
                else await db.registerFileText(name, text);
                const reader = ext === 'parquet' ? `read_parquet('${name}')`
                    : /^(json|jsonl|ndjson)$/.test(ext) ? `read_json_auto('${name}')` : `read_csv_auto('${name}')`;
                await q(`CREATE OR REPLACE VIEW data AS SELECT * FROM ${reader}`);
                const n = (await q('SELECT count(*) AS n FROM data')).rows[0][0];
                const cols = (await q('DESCRIBE data')).rows.length;
                meta = { file: file ? file.name : 'sample-orders.csv', size: file ? file.size : text.length, rows: n, cols, ext };
                if (ext === 'parquet') {
                    try {
                        const pm = (await q(`SELECT count(DISTINCT row_group_id) AS g, string_agg(DISTINCT compression, ', ') AS c FROM parquet_metadata('${name}')`)).rows[0];
                        meta.groups = pm[0]; meta.codecs = pm[1];
                    } catch (e) { /* older files */ }
                }
                stats.innerHTML = [
                    [meta.file, t('file', 'dosya')], [bytes(meta.size), t('size', 'boyut')], [nf(meta.rows), t('rows', 'satır')],
                    [meta.cols, t('columns', 'sütun')], [meta.ext.toUpperCase(), t('format', 'biçim')],
                    ...(meta.groups !== undefined ? [[meta.groups, t('row groups', 'satır grubu')], [meta.codecs || '–', t('compression', 'sıkıştırma')]] : [])
                ].map(([v, l]) => `<div class="tstat"><b>${esc(String(v))}</b><span>${l}</span></div>`).join('');
                $('#result', root).hidden = false;
                status(t('Loaded. Query it as the table "data".', 'Yüklendi. "data" tablosu olarak sorgulayabilirsin.'), 'is-ok');
                lastSql = 'SELECT * FROM data LIMIT 100';
                show(tab);
            } catch (e) {
                status(t('Could not read the file: ', 'Dosya okunamadı: ') + (e.message || e), 'is-err');
            }
        }

        async function show(k) {
            tab = k;
            root.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('is-on', b.dataset.tab === k));
            pane.innerHTML = `<p class="tmsg">${t('Working…', 'Hesaplanıyor…')}</p>`;
            try {
                if (k === 'preview') {
                    pane.innerHTML = table(await q('SELECT * FROM data LIMIT 200')) +
                        `<p class="tmsg">${t('First 200 rows.', 'İlk 200 satır.')}</p>`;
                } else if (k === 'schema') {
                    const d = await q('DESCRIBE data');
                    pane.innerHTML = table({ fields: d.fields.slice(0, 3), rows: d.rows.map(r => r.slice(0, 3)) });
                    if (meta.ext === 'parquet') {
                        const ps = await q(`SELECT name, type, converted_type, repetition_type FROM parquet_schema('${name}') WHERE name <> 'duckdb_schema'`).catch(() => null);
                        if (ps) pane.innerHTML += `<h3 class="tlabel" style="margin-top:1.2rem">${t('Parquet physical schema', 'Parquet fiziksel şema')}</h3>` + table(ps);
                    }
                } else if (k === 'profile') {
                    const s = await q('SUMMARIZE data');
                    const idx = n => s.fields.findIndex(f => f.name === n);
                    const rows = s.rows.map(r => {
                        const nullPct = parseFloat(r[idx('null_percentage')]) || 0;
                        return [r[idx('column_name')], r[idx('column_type')], r[idx('approx_unique')], r[idx('min')], r[idx('max')],
                            r[idx('avg')] !== null && r[idx('avg')] !== undefined ? (+r[idx('avg')]).toPrecision(6) : null,
                            `${nullPct.toFixed(1)} %`];
                    });
                    pane.innerHTML = table({
                        fields: ['column', 'type', 'unique ≈', 'min', 'max', 'avg', 'null %'].map(n => ({ name: n, type: '' })), rows
                    }) + `<p class="tmsg">${t('Computed with DuckDB SUMMARIZE over every row.', 'Tüm satırlar üzerinde DuckDB SUMMARIZE ile hesaplandı.')}</p>`;
                } else if (k === 'sql') {
                    pane.innerHTML = `
                        <textarea class="tarea" id="sql" spellcheck="false" style="min-height:120px">${esc(lastSql)}</textarea>
                        <div class="trow"><button type="button" class="tbtn tbtn--primary" id="run"><i class="fas fa-play"></i> ${t('Run', 'Çalıştır')}</button>
                        <span class="tmsg" style="margin:0">Ctrl+Enter · ${t('DuckDB SQL; the file is the table', 'DuckDB SQL; dosya şu tablodur:')} <code>data</code></span></div>
                        <div id="sqlOut"></div>`;
                    const run = async () => {
                        lastSql = $('#sql', pane).value;
                        const out = $('#sqlOut', pane);
                        const t0 = performance.now();
                        try {
                            const r = await q(lastSql);
                            out.innerHTML = table(r) + `<p class="tmsg is-ok">${nf(r.rows.length)} ${t('rows', 'satır')} · ${Math.round(performance.now() - t0)} ms</p>`;
                        } catch (e) { out.innerHTML = `<p class="tmsg is-err">${esc(e.message || e)}</p>`; }
                    };
                    $('#run', pane).addEventListener('click', run);
                    $('#sql', pane).addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); run(); } });
                    run();
                } else if (k === 'export') {
                    pane.innerHTML = `
                        <p class="tview__sub" style="margin-bottom:1rem">${t('Export the whole file — or the result of your last SQL query — to another format.',
                            'Dosyanın tamamını ya da son SQL sorgunun sonucunu başka bir biçime dönüştür.')}</p>
                        <div class="trow">
                            <select class="tselect" id="src" style="width:auto"><option value="all">${t('Whole file', 'Tüm dosya')}</option><option value="sql">${t('Last SQL result', 'Son SQL sonucu')}</option></select>
                            <button type="button" class="tbtn tbtn--primary" data-fmt="parquet"><i class="fas fa-download"></i> Parquet</button>
                            <button type="button" class="tbtn" data-fmt="csv"><i class="fas fa-download"></i> CSV</button>
                            <button type="button" class="tbtn" data-fmt="json"><i class="fas fa-download"></i> JSON</button>
                        </div><p class="tmsg" id="xmsg"></p>`;
                    pane.querySelectorAll('[data-fmt]').forEach(b => b.addEventListener('click', async () => {
                        const fmt = b.dataset.fmt, x = $('#xmsg', pane);
                        const src = $('#src', pane).value === 'sql' ? lastSql.replace(/;\s*$/, '') : 'SELECT * FROM data';
                        const out = `export_${Date.now()}.${fmt}`;
                        const opts = { parquet: "(FORMAT PARQUET, COMPRESSION ZSTD)", csv: "(HEADER, DELIMITER ',')", json: '(FORMAT JSON, ARRAY true)' }[fmt];
                        try {
                            x.textContent = t('Converting…', 'Dönüştürülüyor…'); x.className = 'tmsg';
                            const { db } = await getDuck(status);
                            await q(`COPY (${src}) TO '${out}' ${opts}`);
                            const buf = await db.copyFileToBuffer(out);
                            await db.dropFile(out);
                            const base = meta.file.replace(/\.[^.]+$/, '');
                            download(`${base}.${fmt}`, new Blob([buf]));
                            x.textContent = `${base}.${fmt} · ${bytes(buf.length)}`; x.className = 'tmsg is-ok';
                        } catch (e) { x.textContent = e.message || String(e); x.className = 'tmsg is-err'; }
                    }));
                }
            } catch (e) {
                pane.innerHTML = `<p class="tmsg is-err">${esc(e.message || e)}</p>`;
            }
        }

        const drop = $('#drop', root), input = $('#file', root);
        input.addEventListener('change', () => input.files[0] && open(input.files[0]));
        ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('is-over'); }));
        ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('is-over'); }));
        drop.addEventListener('drop', e => e.dataTransfer.files[0] && open(e.dataTransfer.files[0]));
        drop.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
        $('#sample', root).addEventListener('click', () => open(null, sampleCsv()));
        root.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => show(b.dataset.tab)));
    }

    /* =================================================================
       2) JSON → schema (PySpark, Spark SQL, PostgreSQL, Pydantic, TS, JSON Schema)
       ================================================================= */
    const ISO_DT = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/;
    const ISO_D = /^\d{4}-\d{2}-\d{2}$/;

    function infer(v) {
        if (v === null) return { t: 'null' };
        if (Array.isArray(v)) return { t: 'array', of: v.map(infer).reduce(merge, { t: 'never' }) };
        if (typeof v === 'object') {
            const fields = {};
            for (const [k, x] of Object.entries(v)) fields[k] = infer(x);
            return { t: 'object', fields };
        }
        if (typeof v === 'string') return { t: ISO_DT.test(v) ? 'timestamp' : ISO_D.test(v) ? 'date' : 'string' };
        if (typeof v === 'number') return { t: Number.isInteger(v) ? 'integer' : 'number' };
        if (typeof v === 'boolean') return { t: 'boolean' };
        return { t: 'string' };
    }

    function merge(a, b) {
        if (a.t === 'never') return b;
        if (b.t === 'never') return a;
        if (a.t === 'null') return { ...b, nullable: true };
        if (b.t === 'null') return { ...a, nullable: true };
        const nullable = a.nullable || b.nullable;
        if (a.t === b.t) {
            if (a.t === 'object') {
                const fields = {};
                for (const k of new Set([...Object.keys(a.fields), ...Object.keys(b.fields)])) {
                    if (a.fields[k] && b.fields[k]) fields[k] = merge(a.fields[k], b.fields[k]);
                    else fields[k] = { ...(a.fields[k] || b.fields[k]), nullable: true };
                }
                return { t: 'object', fields, nullable };
            }
            if (a.t === 'array') return { t: 'array', of: merge(a.of, b.of), nullable };
            return { ...a, nullable };
        }
        const pair = new Set([a.t, b.t]);
        if (pair.has('integer') && pair.has('number')) return { t: 'number', nullable };
        if (pair.has('date') && pair.has('timestamp')) return { t: 'timestamp', nullable };
        return { t: 'string', nullable };
    }

    const pascal = s => s.replace(/(^|[_\-\s]+)([a-zA-Z0-9])/g, (_, __, c) => c.toUpperCase()).replace(/[^A-Za-z0-9]/g, '') || 'Item';
    const ident = s => (/^[A-Za-z_][A-Za-z0-9_]*$/.test(s) ? s : JSON.stringify(s));
    const sqlIdent = s => (/^[a-z_][a-z0-9_]*$/.test(s) ? s : `"${s.replace(/"/g, '""')}"`);
    const sparkIdent = s => (/^[A-Za-z_][A-Za-z0-9_]*$/.test(s) ? s : `\`${s.replace(/`/g, '``')}\``);

    const GEN = {
        pyspark(s) {
            const ty = x => ({ string: 'StringType()', integer: 'LongType()', number: 'DoubleType()', boolean: 'BooleanType()',
                timestamp: 'TimestampType()', date: 'DateType()', null: 'StringType()', never: 'StringType()' }[x.t]
                || (x.t === 'array' ? `ArrayType(${ty(x.of)}, True)` : struct(x, 0)));
            const struct = (o, depth) => {
                const pad = '    '.repeat(depth + 1);
                return `StructType([\n${Object.entries(o.fields).map(([k, f]) =>
                    `${pad}StructField(${JSON.stringify(k)}, ${f.t === 'object' ? struct(f, depth + 1) : ty(f)}, ${f.nullable === false ? 'False' : 'True'}),`).join('\n')}\n${'    '.repeat(depth)}])`;
            };
            return `from pyspark.sql.types import (\n    ArrayType, BooleanType, DateType, DoubleType, LongType,\n    StringType, StructField, StructType, TimestampType,\n)\n\nschema = ${s.t === 'object' ? struct(s, 0) : ty(s)}\n`;
        },
        sparksql(s, name) {
            const ty = x => ({ string: 'STRING', integer: 'BIGINT', number: 'DOUBLE', boolean: 'BOOLEAN', timestamp: 'TIMESTAMP',
                date: 'DATE', null: 'STRING', never: 'STRING' }[x.t]
                || (x.t === 'array' ? `ARRAY<${ty(x.of)}>` : `STRUCT<${Object.entries(x.fields).map(([k, f]) => `${sparkIdent(k)}: ${ty(f)}`).join(', ')}>`));
            if (s.t !== 'object') return `-- top level is not an object\n${ty(s)}`;
            return `CREATE TABLE ${sparkIdent(name)} (\n${Object.entries(s.fields).map(([k, f]) => `    ${sparkIdent(k)} ${ty(f)}`).join(',\n')}\n) USING PARQUET;\n`;
        },
        postgres(s, name) {
            const ty = x => ({ string: 'TEXT', integer: 'BIGINT', number: 'DOUBLE PRECISION', boolean: 'BOOLEAN',
                timestamp: 'TIMESTAMPTZ', date: 'DATE', null: 'TEXT', never: 'TEXT' }[x.t]
                || (x.t === 'array' ? (['object', 'array'].includes(x.of.t) ? 'JSONB' : `${ty(x.of)}[]`) : 'JSONB'));
            if (s.t !== 'object') return `-- top level is not an object\n${ty(s)}`;
            return `CREATE TABLE ${sqlIdent(name)} (\n${Object.entries(s.fields).map(([k, f]) =>
                `    ${sqlIdent(k)} ${ty(f)}${f.nullable === false ? ' NOT NULL' : ''}`).join(',\n')}\n);\n`;
        },
        pydantic(s, name) {
            const classes = [];
            const ty = (x, hint) => {
                let base = { string: 'str', integer: 'int', number: 'float', boolean: 'bool', timestamp: 'datetime',
                    date: 'date', null: 'None', never: 'Any' }[x.t];
                if (x.t === 'array') base = `list[${ty(x.of, hint + 'Item')}]`;
                if (x.t === 'object') base = cls(x, hint);
                return x.nullable && x.t !== 'null' ? `Optional[${base}]` : base;
            };
            const cls = (o, cname) => {
                cname = pascal(cname);
                const body = Object.entries(o.fields).map(([k, f]) => {
                    const safe = /^[A-Za-z_][A-Za-z0-9_]*$/.test(k) && !['class', 'from', 'def', 'import', 'global'].includes(k);
                    const field = safe ? k : k.replace(/[^A-Za-z0-9_]/g, '_').replace(/^(\d)/, '_$1');
                    return `    ${field}: ${ty(f, k)}${f.nullable ? ' = None' : ''}${safe ? '' : ` = Field(alias=${JSON.stringify(k)})`}`;
                });
                classes.push(`class ${cname}(BaseModel):\n${body.join('\n') || '    pass'}\n`);
                return cname;
            };
            const top = s.t === 'object' ? cls(s, name) : null;
            const head = 'from __future__ import annotations\n\nfrom datetime import date, datetime\nfrom typing import Any, Optional\n\nfrom pydantic import BaseModel, Field\n\n';
            return head + (top ? classes.join('\n\n') : `Root = ${ty(s, name)}\n`);
        },
        typescript(s, name) {
            const out = [];
            const ty = (x, hint) => {
                let b = { string: 'string', integer: 'number', number: 'number', boolean: 'boolean', timestamp: 'string',
                    date: 'string', null: 'null', never: 'unknown' }[x.t];
                if (x.t === 'array') { const inner = ty(x.of, hint + 'Item'); b = /[|]/.test(inner) ? `(${inner})[]` : `${inner}[]`; }
                if (x.t === 'object') b = iface(x, hint);
                return x.nullable && x.t !== 'null' ? `${b} | null` : b;
            };
            const iface = (o, n) => {
                n = pascal(n);
                out.push(`export interface ${n} {\n${Object.entries(o.fields).map(([k, f]) =>
                    `    ${ident(k)}${f.nullable ? '?' : ''}: ${ty(f, k)};`).join('\n')}\n}\n`);
                return n;
            };
            if (s.t === 'object') iface(s, name); else out.push(`export type ${pascal(name)} = ${ty(s, name)};\n`);
            return out.join('\n');
        },
        jsonschema(s, name) {
            const conv = x => {
                const base = { string: { type: 'string' }, integer: { type: 'integer' }, number: { type: 'number' },
                    boolean: { type: 'boolean' }, timestamp: { type: 'string', format: 'date-time' }, date: { type: 'string', format: 'date' },
                    null: { type: 'null' }, never: {} }[x.t];
                let o = base ? { ...base } : null;
                if (x.t === 'array') o = { type: 'array', items: conv(x.of) };
                if (x.t === 'object') o = { type: 'object', properties: Object.fromEntries(Object.entries(x.fields).map(([k, f]) => [k, conv(f)])),
                    required: Object.entries(x.fields).filter(([, f]) => !f.nullable).map(([k]) => k) };
                if (x.nullable && o.type && x.t !== 'null') o.type = [o.type, 'null'];
                return o;
            };
            return JSON.stringify({ $schema: 'https://json-schema.org/draft/2020-12/schema', title: pascal(name), ...conv(s) }, null, 2) + '\n';
        }
    };

    const SCHEMA_SAMPLE = JSON.stringify([
        { order_id: 'ORD-00001', created_at: '2024-03-14T10:22:33Z', customer: { id: 42, state: 'SP', vip: false },
            items: [{ sku: 'A-1', qty: 2, price: 19.9 }], total: 39.8, coupon: null },
        { order_id: 'ORD-00002', created_at: '2024-03-15T08:01:00Z', customer: { id: 7, state: 'RJ', vip: true },
            items: [{ sku: 'B-7', qty: 1, price: 120 }], total: 120, coupon: 'SPRING10', note: 'gift wrap' }
    ], null, 2);

    function mountSchema(root) {
        const targets = [['pyspark', 'PySpark'], ['sparksql', 'Spark SQL'], ['postgres', 'PostgreSQL'], ['pydantic', 'Pydantic'],
            ['typescript', 'TypeScript'], ['jsonschema', 'JSON Schema']];
        let target = store.get('tools-schema-target') || 'pyspark';
        html(root, `
            <div class="tcols">
                <div>
                    <label class="tlabel" for="in">JSON</label>
                    <textarea class="tarea" id="in" spellcheck="false">${esc(SCHEMA_SAMPLE)}</textarea>
                    <div class="trow">
                        <label class="tlabel" for="name" style="margin:0">${t('Name', 'Ad')}</label>
                        <input class="tinput" id="name" value="orders" style="width:180px">
                    </div>
                    <p class="tmsg">${t('An array of records is merged: missing fields become nullable, int + float becomes double.',
                        'Kayıt dizisi birleştirilir: eksik alanlar nullable olur, int + float double olur.')}</p>
                </div>
                <div>
                    <div class="ttabs">${targets.map(([k, l]) => `<button type="button" class="ttab${k === target ? ' is-on' : ''}" data-t="${k}">${l}</button>`).join('')}</div>
                    <pre class="tout" id="out"></pre>
                    <div class="trow">${copyBtn('out')}</div>
                </div>
            </div>`);
        const run = () => {
            const out = $('#out', root);
            try {
                const v = JSON.parse($('#in', root).value);
                let s = infer(v);
                if (s.t === 'array' && s.of.t === 'object') s = s.of;
                out.textContent = GEN[target](s, $('#name', root).value.trim() || 'data');
            } catch (e) { out.textContent = '⚠ ' + e.message; }
        };
        root.querySelectorAll('[data-t]').forEach(b => b.addEventListener('click', () => {
            target = b.dataset.t; store.set('tools-schema-target', target);
            root.querySelectorAll('[data-t]').forEach(x => x.classList.toggle('is-on', x === b)); run();
        }));
        $('#in', root).addEventListener('input', run);
        $('#name', root).addEventListener('input', run);
        wireCopy(root);
        run();
    }

    /* =================================================================
       3) JSON formatter / validator
       ================================================================= */
    /** Index of the first syntax error (browsers don't all report a position), or -1. */
    function jsonErrorIndex(s) {
        let i = 0;
        const fail = () => { throw i; };
        const ws = () => { while (i < s.length && ' \t\n\r'.includes(s[i])) i++; };
        const str = () => {
            i++;
            while (i < s.length) {
                const c = s[i];
                if (c === '"') { i++; return; }
                if (c === '\\') { i += 2; continue; }
                if (c < ' ') fail();
                i++;
            }
            fail();
        };
        const value = () => {
            ws();
            const c = s[i];
            if (c === '{') {
                i++; ws();
                if (s[i] === '}') { i++; return; }
                for (;;) {
                    ws(); if (s[i] !== '"') fail(); str(); ws(); if (s[i] !== ':') fail(); i++; value(); ws();
                    if (s[i] === ',') { i++; continue; }
                    if (s[i] === '}') { i++; return; }
                    fail();
                }
            }
            if (c === '[') {
                i++; ws();
                if (s[i] === ']') { i++; return; }
                for (;;) {
                    value(); ws();
                    if (s[i] === ',') { i++; continue; }
                    if (s[i] === ']') { i++; return; }
                    fail();
                }
            }
            if (c === '"') return str();
            const m = /^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?/.exec(s.slice(i, i + 64));
            if (m && m[0]) { i += m[0].length; return; }
            for (const w of ['true', 'false', 'null']) if (s.startsWith(w, i)) { i += w.length; return; }
            fail();
        };
        try { value(); ws(); if (i < s.length) fail(); return -1; } catch (e) { return typeof e === 'number' ? e : -1; }
    }

    function errorPos(text, e) {
        const m = /line (\d+) column (\d+)/.exec(e.message);
        if (m) return { line: +m[1], col: +m[2] };
        const p = /position (\d+)/.exec(e.message);
        const idx = p ? +p[1] : jsonErrorIndex(text);
        if (idx < 0) return null;
        const before = text.slice(0, idx).split('\n');
        return { line: before.length, col: before[before.length - 1].length + 1 };
    }

    const sortKeys = v => (Array.isArray(v) ? v.map(sortKeys) : v && typeof v === 'object'
        ? Object.fromEntries(Object.keys(v).sort().map(k => [k, sortKeys(v[k])])) : v);

    function jsonStats(v) {
        let keys = 0, depth = 0;
        const walk = (x, d) => {
            depth = Math.max(depth, d);
            if (Array.isArray(x)) x.forEach(y => walk(y, d + 1));
            else if (x && typeof x === 'object') { keys += Object.keys(x).length; Object.values(x).forEach(y => walk(y, d + 1)); }
        };
        walk(v, 0);
        return { keys, depth };
    }

    function mountJson(root) {
        html(root, `
            <div class="tcols">
                <div>
                    <label class="tlabel" for="in">${t('Input', 'Girdi')}</label>
                    <textarea class="tarea" id="in" spellcheck="false" placeholder='{"paste": "JSON here"}'>{"name":"Yunus","skills":["Spark","Airflow","Python"],"remote":true,"projects":{"open_source":4}}</textarea>
                    <div class="trow">
                        <button type="button" class="tbtn tbtn--primary" data-act="format"><i class="fas fa-code"></i> ${t('Format', 'Biçimlendir')}</button>
                        <button type="button" class="tbtn" data-act="minify">${t('Minify', 'Küçült')}</button>
                        <button type="button" class="tbtn" data-act="sort">${t('Sort keys', 'Anahtarları sırala')}</button>
                        <select class="tselect" id="indent" style="width:auto"><option value="2">2 ${t('spaces', 'boşluk')}</option><option value="4">4 ${t('spaces', 'boşluk')}</option><option value="tab">Tab</option></select>
                    </div>
                    <p class="tmsg" id="msg"></p>
                </div>
                <div>
                    <label class="tlabel">${t('Output', 'Çıktı')}</label>
                    <pre class="tout" id="out"></pre>
                    <div class="trow">${copyBtn('out')}<button type="button" class="tbtn" id="dl"><i class="fas fa-download"></i> .json</button></div>
                </div>
            </div>`);
        const input = $('#in', root), out = $('#out', root), msg = $('#msg', root);
        const indent = () => ($('#indent', root).value === 'tab' ? '\t' : +$('#indent', root).value);
        const act = mode => {
            const text = input.value;
            if (!text.trim()) { out.textContent = ''; msg.textContent = ''; return; }
            try {
                let v = JSON.parse(text);
                if (mode === 'sort') v = sortKeys(v);
                out.textContent = mode === 'minify' ? JSON.stringify(v) : JSON.stringify(v, null, indent());
                const s = jsonStats(v);
                msg.className = 'tmsg is-ok';
                msg.textContent = `✓ ${t('Valid JSON', 'Geçerli JSON')} · ${bytes(new Blob([text]).size)} · ${s.keys} ${t('keys', 'anahtar')} · ${t('depth', 'derinlik')} ${s.depth}`;
            } catch (e) {
                const p = errorPos(text, e);
                msg.className = 'tmsg is-err';
                msg.textContent = `✗ ${e.message}${p ? ` (${t('line', 'satır')} ${p.line}, ${t('column', 'sütun')} ${p.col})` : ''}`;
                out.innerHTML = text.split('\n').map((l, i) => p && i + 1 === p.line ? `<span class="err-line">${esc(l) || ' '}</span>` : esc(l)).join('\n');
            }
        };
        root.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', () => act(b.dataset.act)));
        input.addEventListener('input', () => act('format'));
        $('#indent', root).addEventListener('change', () => act('format'));
        $('#dl', root).addEventListener('click', () => download('formatted.json', out.textContent, 'application/json'));
        wireCopy(root);
        act('format');
    }

    /* =================================================================
       4) JWT decoder (+ optional HMAC verification)
       ================================================================= */
    const b64urlDecode = s => {
        s = s.replace(/-/g, '+').replace(/_/g, '/');
        const bin = atob(s + '==='.slice((s.length + 3) % 4));
        return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)));
    };
    const b64urlEncode = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const enc = s => new TextEncoder().encode(s);

    async function hmac(alg, secret, data) {
        const hash = { HS256: 'SHA-256', HS384: 'SHA-384', HS512: 'SHA-512' }[alg];
        const key = await crypto.subtle.importKey('raw', enc(secret), { name: 'HMAC', hash }, false, ['sign']);
        return b64urlEncode(await crypto.subtle.sign('HMAC', key, enc(data)));
    }

    function mountJwt(root) {
        html(root, `
            <label class="tlabel" for="tok">${t('Token', 'Jeton')}</label>
            <textarea class="tarea" id="tok" spellcheck="false" style="min-height:110px" placeholder="eyJhbGciOi…"></textarea>
            <div class="trow"><button type="button" class="tbtn" id="sample"><i class="fas fa-random"></i> ${t('Sample token', 'Örnek jeton')}</button>
            <span class="tmsg" style="margin:0">${t('Decoded locally — the token never leaves this page.', 'Yerelde çözülür — jeton bu sayfadan çıkmaz.')}</span></div>
            <div id="colored" class="tout" style="min-height:0;white-space:pre-wrap;word-break:break-all;margin-bottom:1rem"></div>
            <div class="tcols">
                <div><label class="tlabel">Header</label><pre class="tout" id="h" style="min-height:120px"></pre></div>
                <div><label class="tlabel">Payload</label><pre class="tout" id="p" style="min-height:120px"></pre></div>
            </div>
            <div class="tcols" style="margin-top:1rem">
                <div class="tpanel"><label class="tlabel">${t('Claims', 'Alanlar')}</label><dl class="kv" id="claims"></dl></div>
                <div class="tpanel"><label class="tlabel">${t('Signature', 'İmza')}</label>
                    <p class="tmsg" id="sigInfo" style="margin-top:0"></p>
                    <input class="tinput" id="secret" placeholder="${t('HMAC secret (HS256/384/512) to verify', 'Doğrulamak için HMAC anahtarı (HS256/384/512)')}">
                    <p class="tmsg" id="sig"></p></div>
            </div>`);
        const tok = $('#tok', root);
        let parts = [], header = {};
        const fmtTime = s => {
            const d = new Date(s * 1000);
            const rel = new Intl.RelativeTimeFormat(TR ? 'tr' : 'en', { numeric: 'auto' });
            const diff = s - Date.now() / 1000, a = Math.abs(diff);
            const [u, n] = a > 86400 ? ['day', 86400] : a > 3600 ? ['hour', 3600] : a > 60 ? ['minute', 60] : ['second', 1];
            return `${d.toLocaleString(TR ? 'tr-TR' : 'en-GB')} (${rel.format(Math.round(diff / n), u)})`;
        };
        const verify = async () => {
            const sig = $('#sig', root), secret = $('#secret', root).value;
            if (!parts.length) { sig.textContent = ''; return; }
            if (!/^HS(256|384|512)$/.test(header.alg || '')) {
                $('#secret', root).hidden = true;
                sig.textContent = header.alg === 'none' ? t('alg "none": the token is not signed.', 'alg "none": jeton imzasız.')
                    : t('Verifying this algorithm needs the issuer’s public key; only the structure is checked here.', 'Bu algoritmayı doğrulamak için yayıncının açık anahtarı gerekir; burada yalnızca yapı kontrol edilir.');
                sig.className = 'tmsg'; return;
            }
            $('#secret', root).hidden = false;
            if (!secret) { sig.textContent = t('Enter the secret to check the signature.', 'İmzayı kontrol etmek için anahtarı gir.'); sig.className = 'tmsg'; return; }
            const ok = (await hmac(header.alg, secret, `${parts[0]}.${parts[1]}`)) === parts[2];
            sig.innerHTML = ok ? `<span class="badge-ok">✓ ${t('Signature valid', 'İmza geçerli')}</span>` : `<span class="badge-bad">✗ ${t('Signature does not match', 'İmza eşleşmiyor')}</span>`;
        };
        const decode = () => {
            const raw = tok.value.trim().replace(/^Bearer\s+/i, '');
            parts = raw.split('.');
            const colored = $('#colored', root), claims = $('#claims', root);
            if (parts.length !== 3) {
                parts = []; colored.textContent = raw ? t('A JWT has three dot-separated parts.', 'JWT noktayla ayrılmış üç parçadan oluşur.') : '';
                ['#h', '#p'].forEach(s => ($(s, root).textContent = '')); claims.innerHTML = ''; $('#sigInfo', root).textContent = ''; verify(); return;
            }
            colored.innerHTML = `<span class="jwt-part">${esc(parts[0])}</span>.<span class="jwt-part p">${esc(parts[1])}</span>.<span class="jwt-part s">${esc(parts[2])}</span>`;
            let payload = {};
            try { header = JSON.parse(b64urlDecode(parts[0])); $('#h', root).textContent = JSON.stringify(header, null, 2); }
            catch (e) { header = {}; $('#h', root).textContent = '⚠ ' + t('Header is not valid base64url JSON', 'Header geçerli base64url JSON değil'); }
            try { payload = JSON.parse(b64urlDecode(parts[1])); $('#p', root).textContent = JSON.stringify(payload, null, 2); }
            catch (e) { $('#p', root).textContent = '⚠ ' + t('Payload is not valid base64url JSON', 'Payload geçerli base64url JSON değil'); }
            const now = Date.now() / 1000, rows = [];
            if (header.alg) rows.push(['alg', esc(header.alg)]);
            for (const k of ['iss', 'sub', 'aud']) if (payload[k] !== undefined) rows.push([k, esc(JSON.stringify(payload[k]))]);
            for (const k of ['iat', 'nbf', 'auth_time']) if (typeof payload[k] === 'number') rows.push([k, esc(fmtTime(payload[k]))]);
            if (typeof payload.exp === 'number') rows.push(['exp', `${esc(fmtTime(payload.exp))} ${payload.exp < now
                ? `<span class="badge-bad">${t('expired', 'süresi dolmuş')}</span>` : `<span class="badge-ok">${t('valid', 'geçerli')}</span>`}`]);
            if (typeof payload.nbf === 'number' && payload.nbf > now) rows.push(['', `<span class="badge-bad">${t('not valid yet (nbf)', 'henüz geçerli değil (nbf)')}</span>`]);
            claims.innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('') || `<dd>${t('No standard claims.', 'Standart alan yok.')}</dd>`;
            $('#sigInfo', root).textContent = `${t('Signature', 'İmza')}: ${parts[2].length} ${t('characters', 'karakter')}`;
            verify();
        };
        tok.addEventListener('input', decode);
        $('#secret', root).addEventListener('input', verify);
        $('#sample', root).addEventListener('click', async () => {
            const now = Math.floor(Date.now() / 1000);
            const h = b64urlEncode(enc(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
            const p = b64urlEncode(enc(JSON.stringify({ sub: '1234567890', name: 'Ada Lovelace', role: 'admin', iat: now, exp: now + 3600 })));
            tok.value = `${h}.${p}.${await hmac('HS256', 'my-secret', `${h}.${p}`)}`;
            $('#secret', root).value = 'my-secret';
            decode();
        });
        decode();
    }

    /* =================================================================
       5) Timestamp converter
       ================================================================= */
    function parseTime(raw) {
        const s = raw.trim();
        if (!s) return null;
        if (/^-?\d+(\.\d+)?$/.test(s)) {
            const digits = s.replace(/^-/, '').split('.')[0].length;
            const n = parseFloat(s);
            const [ms, unit] = digits <= 11 ? [n * 1000, 's'] : digits <= 14 ? [n, 'ms'] : digits <= 17 ? [n / 1000, 'µs'] : [n / 1e6, 'ns'];
            return { date: new Date(ms), unit };
        }
        const d = new Date(/^\d{4}-\d{2}-\d{2} \d/.test(s) ? s.replace(' ', 'T') : s);
        return isNaN(d) ? { error: true } : { date: d, unit: t('date text', 'tarih metni') };
    }

    function mountTime(root) {
        const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        html(root, `
            <div class="tpanel" style="margin-bottom:1rem"><label class="tlabel">${t('Now', 'Şu an')}</label>
                <div class="tstats" style="margin:0"><div class="tstat"><b id="nowS"></b><span>unix (s)</span></div>
                <div class="tstat"><b id="nowMs"></b><span>unix (ms)</span></div><div class="tstat"><b id="nowIso"></b><span>ISO 8601 (UTC)</span></div></div></div>
            <label class="tlabel" for="in">${t('Timestamp or date', 'Zaman damgası ya da tarih')}</label>
            <input class="tinput" id="in" placeholder="1731673353 · 1731673353000 · 2026-11-15T12:22:33Z · Sun, 15 Nov 2026 12:22:33 GMT">
            <div class="trow"><button type="button" class="tbtn" id="now"><i class="fas fa-search"></i> ${t('Use now', 'Şimdiyi kullan')}</button>
            <span class="tmsg" style="margin:0" id="det"></span></div>
            <div class="ttable-wrap"><table class="ttable"><tbody id="rows"></tbody></table></div>`);
        const input = $('#in', root);
        const tick = () => {
            const n = Date.now();
            $('#nowS', root).textContent = Math.floor(n / 1000); $('#nowMs', root).textContent = n;
            $('#nowIso', root).textContent = new Date(n).toISOString().replace(/\.\d+Z$/, 'Z');
        };
        tick();
        const timer = setInterval(tick, 1000);
        const fmt = (d, tz) => new Intl.DateTimeFormat(TR ? 'tr-TR' : 'en-GB', { dateStyle: 'full', timeStyle: 'long', timeZone: tz }).format(d);
        const render = () => {
            const r = parseTime(input.value), rows = $('#rows', root), det = $('#det', root);
            if (!r) { rows.innerHTML = ''; det.textContent = ''; return; }
            if (r.error) { rows.innerHTML = ''; det.textContent = t('Not a date I understand.', 'Anlaşılır bir tarih değil.'); det.className = 'tmsg is-err'; return; }
            const d = r.date, ms = d.getTime();
            det.className = 'tmsg is-ok'; det.textContent = `${t('Read as', 'Şöyle okundu:')} ${r.unit}`;
            const diff = (ms - Date.now()) / 1000, a = Math.abs(diff);
            const [u, n] = a > 31536000 ? ['year', 31536000] : a > 2592000 ? ['month', 2592000] : a > 86400 ? ['day', 86400] : a > 3600 ? ['hour', 3600] : a > 60 ? ['minute', 60] : ['second', 1];
            const start = Date.UTC(d.getUTCFullYear(), 0, 1);
            const list = [
                ['Unix (s)', Math.floor(ms / 1000)], ['Unix (ms)', ms], ['Unix (µs)', `${ms}000`],
                ['ISO 8601 (UTC)', d.toISOString()], ['RFC 2822 / HTTP', d.toUTCString()],
                [`${t('Local', 'Yerel')} (${zone})`, fmt(d, zone)], ['UTC', fmt(d, 'UTC')], ['Europe/Istanbul', fmt(d, 'Europe/Istanbul')],
                ['America/New_York', fmt(d, 'America/New_York')],
                [t('Relative', 'Göreli'), new Intl.RelativeTimeFormat(TR ? 'tr' : 'en', { numeric: 'auto' }).format(Math.round(diff / n), u)],
                [t('Day of year', 'Yılın günü'), Math.floor((ms - start) / 86400000) + 1]
            ];
            rows.innerHTML = list.map(([k, v]) => `<tr><td style="color:var(--text-dim)">${esc(k)}</td><td><code>${esc(String(v))}</code></td>
                <td><button type="button" class="tbtn" data-v="${esc(String(v))}"><i class="fas fa-copy"></i></button></td></tr>`).join('');
            rows.querySelectorAll('[data-v]').forEach(b => b.addEventListener('click', () => copy(b.dataset.v, b)));
        };
        input.addEventListener('input', render);
        $('#now', root).addEventListener('click', () => { input.value = String(Math.floor(Date.now() / 1000)); render(); });
        input.value = String(Math.floor(Date.now() / 1000));
        render();
        return () => clearInterval(timer);
    }

    /* =================================================================
       6) Cron explainer + next runs
       ================================================================= */
    const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const MONTHS_TR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
    const DAYS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const DAYS_TR = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
    const MACROS = { '@yearly': '0 0 1 1 *', '@annually': '0 0 1 1 *', '@monthly': '0 0 1 * *', '@weekly': '0 0 * * 0',
        '@daily': '0 0 * * *', '@midnight': '0 0 * * *', '@hourly': '0 * * * *' };
    const FIELDS = [
        { name: 'minute', min: 0, max: 59 }, { name: 'hour', min: 0, max: 23 }, { name: 'day', min: 1, max: 31 },
        { name: 'month', min: 1, max: 12, names: ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'], base: 1 },
        { name: 'weekday', min: 0, max: 7, names: ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'], base: 0 }
    ];

    function parseField(src, f) {
        const set = new Set();
        const val = s => {
            const up = s.toUpperCase();
            if (f.names && f.names.includes(up)) return f.names.indexOf(up) + f.base;
            if (!/^\d+$/.test(s)) throw new Error(`${f.name}: "${s}"`);
            const n = +s;
            if (n < f.min || n > f.max) throw new Error(`${f.name}: ${n} ${t('is out of range', 'aralık dışında')} ${f.min}–${f.max}`);
            return n;
        };
        for (const part of src.split(',')) {
            const [range, stepS] = part.split('/');
            const step = stepS === undefined ? 1 : +stepS;
            if (!step || step < 1) throw new Error(`${f.name}: step "${stepS}"`);
            let lo, hi;
            if (range === '*' || range === '?') { lo = f.min; hi = f.name === 'weekday' ? 6 : f.max; }
            else if (range.includes('-')) { [lo, hi] = range.split('-').map(val); }
            else { lo = val(range); hi = stepS === undefined ? lo : (f.name === 'weekday' ? 6 : f.max); }
            if (lo > hi) throw new Error(`${f.name}: ${range}`);
            for (let v = lo; v <= hi; v += step) set.add(f.name === 'weekday' && v === 7 ? 0 : v);
        }
        return set;
    }

    function parseCron(expr) {
        const e = MACROS[expr.trim().toLowerCase()] || expr.trim();
        const parts = e.split(/\s+/);
        if (parts.length !== 5) throw new Error(t('A cron expression has 5 fields: minute hour day month weekday.',
            'Cron ifadesi 5 alandır: dakika saat gün ay haftanın-günü.'));
        if (/[LW#]/i.test(e.replace(/[A-Z]{3}/gi, ''))) throw new Error(t('L, W and # (Quartz) are not supported.', 'L, W ve # (Quartz) desteklenmiyor.'));
        const sets = parts.map((p, i) => parseField(p, FIELDS[i]));
        return { parts, sets, domStar: parts[2] === '*' || parts[2] === '?', dowStar: parts[4] === '*' || parts[4] === '?' };
    }

    function cronMatchesDay(c, d) {
        const dom = c.sets[2].has(d.getDate()), dow = c.sets[4].has(d.getDay());
        if (c.domStar && c.dowStar) return true;
        if (c.domStar) return dow;
        if (c.dowStar) return dom;
        return dom || dow; // classic cron: either one
    }

    function nextRuns(c, from, count = 10) {
        const out = [], d = new Date(from.getTime());
        d.setSeconds(0, 0); d.setMinutes(d.getMinutes() + 1);
        const limit = new Date(from.getTime() + 5 * 366 * 86400000);
        while (out.length < count && d < limit) {
            if (!c.sets[3].has(d.getMonth() + 1) || !cronMatchesDay(c, d)) { d.setDate(d.getDate() + 1); d.setHours(0, 0, 0, 0); continue; }
            if (!c.sets[1].has(d.getHours())) { d.setHours(d.getHours() + 1, 0, 0, 0); continue; }
            if (!c.sets[0].has(d.getMinutes())) { d.setMinutes(d.getMinutes() + 1, 0, 0); continue; }
            out.push(new Date(d.getTime()));
            d.setMinutes(d.getMinutes() + 1);
        }
        return out;
    }

    function listText(arr, fmt = String) {
        const a = arr.map(fmt);
        const and = t(' and ', ' ve ');
        return a.length <= 1 ? a.join('') : `${a.slice(0, -1).join(', ')}${and}${a[a.length - 1]}`;
    }

    function rangeOrList(set, field, fmt) {
        const v = [...set].sort((a, b) => a - b);
        const contiguous = v.length > 2 && v.every((x, i) => !i || x === v[i - 1] + 1);
        return contiguous ? `${fmt(v[0])}–${fmt(v[v.length - 1])}` : listText(v, fmt);
    }

    function describeCron(c) {
        const [mi, ho, dom, mo, dow] = c.parts;
        const pad = n => String(n).padStart(2, '0');
        const mins = [...c.sets[0]].sort((a, b) => a - b), hours = [...c.sets[1]].sort((a, b) => a - b);
        let time;
        const stepOf = p => (/^\*\/(\d+)$/.exec(p) || [])[1];
        if (mi === '*' && ho === '*') time = t('Every minute', 'Her dakika');
        else if (stepOf(mi) && ho === '*') time = t(`Every ${stepOf(mi)} minutes`, `${stepOf(mi)} dakikada bir`);
        else if (mins.length === 1 && ho === '*') time = t(`At minute ${mins[0]} of every hour`, `Her saatin ${mins[0]}. dakikasında`);
        else if (mins.length === 1 && stepOf(ho)) time = t(`At minute ${mins[0]} every ${stepOf(ho)} hours`, `${stepOf(ho)} saatte bir, ${mins[0]}. dakikada`);
        else if (mins.length * hours.length <= 6) {
            const times = hours.flatMap(h => mins.map(m => `${pad(h)}:${pad(m)}`));
            time = t(`At ${listText(times)}`, `Saat ${listText(times)}`);
        } else if (mi === '*' || stepOf(mi)) {
            const every = mi === '*' ? t('Every minute', 'Her dakika') : t(`Every ${stepOf(mi)} minutes`, `${stepOf(mi)} dakikada bir`);
            time = TR ? `${every}, ${pad(hours[0])}:00–${pad(hours[hours.length - 1])}:59 arasında`
                : `${every}, between ${pad(hours[0])}:00 and ${pad(hours[hours.length - 1])}:59`;
        } else {
            time = t(`At minute ${listText(mins)} past hour ${rangeOrList(c.sets[1], 'h', String)}`,
                `Saat ${rangeOrList(c.sets[1], 'h', String)} için ${listText(mins)}. dakikada`);
        }
        const days = TR ? DAYS_TR : DAYS_EN, months = TR ? MONTHS_TR : MONTHS_EN;
        const bits = [time];
        if (!c.domStar) bits.push(t(`on day ${rangeOrList(c.sets[2], 'd', String)} of the month`, `ayın ${rangeOrList(c.sets[2], 'd', String)}. gününde`));
        if (!c.dowStar) bits.push((c.domStar ? '' : t('or ', 'ya da ')) + t(`on ${rangeOrList(c.sets[4], 'w', d => days[d])}`, `${rangeOrList(c.sets[4], 'w', d => days[d])} günleri`));
        if (mo !== '*' && mo !== '?') bits.push(t(`in ${rangeOrList(c.sets[3], 'm', m => months[m - 1])}`, `${rangeOrList(c.sets[3], 'm', m => months[m - 1])} aylarında`));
        return bits.join(', ') + '.';
    }

    function mountCron(root) {
        const presets = [['*/15 * * * *', t('every 15 min', '15 dakikada bir')], ['0 9 * * 1-5', t('weekdays 09:00', 'hafta içi 09:00')],
            ['30 2 * * 0', t('Sundays 02:30', 'pazar 02:30')], ['0 0 1 * *', t('monthly', 'aylık')], ['0 */6 * * *', t('every 6 hours', '6 saatte bir')], ['@daily', '@daily']];
        html(root, `
            <label class="tlabel" for="in">${t('Cron expression', 'Cron ifadesi')}</label>
            <input class="tinput" id="in" value="0 9 * * 1-5" spellcheck="false" style="font-family:ui-monospace,monospace;font-size:1.1rem">
            <div class="trow">${presets.map(([e, l]) => `<button type="button" class="tbtn" data-e="${e}" title="${e}">${l}</button>`).join('')}</div>
            <p class="cron-human" id="human"></p>
            <p class="tmsg" id="msg"></p>
            <div class="tcols">
                <div class="tpanel"><label class="tlabel">${t('Next runs', 'Sonraki çalışmalar')} (${Intl.DateTimeFormat().resolvedOptions().timeZone})</label><ol class="runs" id="runs"></ol></div>
                <div class="tpanel"><label class="tlabel">${t('Fields', 'Alanlar')}</label><dl class="kv" id="fields"></dl>
                <p class="tmsg">${t('Airflow, Kubernetes CronJob, GitHub Actions and crontab all use this 5-field syntax (GitHub Actions and Kubernetes run in UTC).',
                    'Airflow, Kubernetes CronJob, GitHub Actions ve crontab bu 5 alanlı sözdizimini kullanır (GitHub Actions ve Kubernetes UTC ile çalışır).')}</p></div>
            </div>`);
        const input = $('#in', root);
        const names = [t('minute', 'dakika'), t('hour', 'saat'), t('day of month', 'ayın günü'), t('month', 'ay'), t('day of week', 'haftanın günü')];
        const run = () => {
            const msg = $('#msg', root);
            try {
                const c = parseCron(input.value);
                $('#human', root).textContent = describeCron(c);
                msg.textContent = '';
                const runs = nextRuns(c, new Date());
                const f = new Intl.DateTimeFormat(TR ? 'tr-TR' : 'en-GB', { weekday: 'short', year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
                $('#runs', root).innerHTML = runs.map(d => `<li>${esc(f.format(d))}</li>`).join('') || `<li>${t('No run in the next 5 years.', 'Önümüzdeki 5 yılda çalışma yok.')}</li>`;
                $('#fields', root).innerHTML = c.parts.map((p, i) => `<dt>${names[i]}</dt><dd>${esc(p)}  →  ${esc([...c.sets[i]].sort((a, b) => a - b).join(', ').slice(0, 90))}</dd>`).join('');
            } catch (e) {
                $('#human', root).textContent = ''; $('#runs', root).innerHTML = ''; $('#fields', root).innerHTML = '';
                msg.textContent = e.message; msg.className = 'tmsg is-err';
            }
        };
        input.addEventListener('input', run);
        root.querySelectorAll('[data-e]').forEach(b => b.addEventListener('click', () => { input.value = b.dataset.e; run(); }));
        run();
    }

    /* =================================================================
       7) cURL → code
       ================================================================= */
    function shellSplit(s) {
        const out = []; let cur = '', q = null, i = 0, has = false;
        s = s.replace(/\\\r?\n/g, ' ');
        while (i < s.length) {
            const c = s[i];
            if (q === "'") { if (c === "'") q = null; else cur += c; }
            else if (q === '"') {
                if (c === '\\' && /["\\$`]/.test(s[i + 1])) { cur += s[++i]; }
                else if (c === '"') q = null; else cur += c;
            } else if (c === "'" || c === '"') { q = c; has = true; }
            else if (c === '$' && s[i + 1] === "'") { // $'…' ANSI-C quoting
                i += 2; has = true;
                while (i < s.length && s[i] !== "'") {
                    if (s[i] === '\\') { const n = s[++i]; cur += { n: '\n', t: '\t', r: '\r', '\\': '\\', "'": "'" }[n] ?? n; } else cur += s[i];
                    i++;
                }
            } else if (/\s/.test(c)) { if (cur || has) { out.push(cur); cur = ''; has = false; } }
            else if (c === '\\') { cur += s[++i] ?? ''; }
            else cur += c;
            i++;
        }
        if (cur || has) out.push(cur);
        return out;
    }

    function parseCurl(cmd) {
        const a = shellSplit(cmd.trim());
        if (a[0] !== 'curl') throw new Error(t('The command should start with curl.', 'Komut curl ile başlamalı.'));
        const r = { method: null, url: null, headers: [], data: [], form: [], auth: null, insecure: false, follow: false, get: false, json: false };
        const takes = new Set(['-X', '--request', '-H', '--header', '-d', '--data', '--data-raw', '--data-binary', '--data-ascii', '--data-urlencode',
            '--json', '-u', '--user', '-F', '--form', '-b', '--cookie', '-A', '--user-agent', '-e', '--referer', '--url', '-o', '--output', '-m', '--max-time', '--connect-timeout']);
        for (let i = 1; i < a.length; i++) {
            let arg = a[i], val;
            const eq = /^(--[a-z-]+)=(.*)$/s.exec(arg);
            if (eq) { arg = eq[1]; val = eq[2]; }
            else if (/^-[A-Za-z]./.test(arg) && takes.has(arg.slice(0, 2))) { val = arg.slice(2); arg = arg.slice(0, 2); }
            else if (takes.has(arg)) val = a[++i];
            switch (arg) {
                case '-X': case '--request': r.method = val.toUpperCase(); break;
                case '-H': case '--header': { const k = val.indexOf(':'); if (k > 0) r.headers.push([val.slice(0, k).trim(), val.slice(k + 1).trim()]); break; }
                case '-d': case '--data': case '--data-raw': case '--data-binary': case '--data-ascii': case '--data-urlencode': r.data.push(val); break;
                case '--json': r.data.push(val); r.json = true; break;
                case '-u': case '--user': r.auth = val; break;
                case '-F': case '--form': { const k = val.indexOf('='); r.form.push([val.slice(0, k), val.slice(k + 1)]); break; }
                case '-b': case '--cookie': r.headers.push(['Cookie', val]); break;
                case '-A': case '--user-agent': r.headers.push(['User-Agent', val]); break;
                case '-e': case '--referer': r.headers.push(['Referer', val]); break;
                case '-k': case '--insecure': r.insecure = true; break;
                case '-L': case '--location': r.follow = true; break;
                case '-G': case '--get': r.get = true; break;
                case '--url': r.url = val; break;
                default: if (!arg.startsWith('-') && !r.url) r.url = arg;
            }
        }
        if (!r.url) throw new Error(t('No URL found.', 'URL bulunamadı.'));
        if (!/^https?:\/\//.test(r.url)) r.url = 'http://' + r.url;
        if (r.json) {
            if (!r.headers.some(([k]) => /^content-type$/i.test(k))) r.headers.push(['Content-Type', 'application/json']);
            if (!r.headers.some(([k]) => /^accept$/i.test(k))) r.headers.push(['Accept', 'application/json']);
        }
        let body = r.data.join('&');
        if (r.get && body) { r.url += (r.url.includes('?') ? '&' : '?') + body; body = ''; }
        r.body = body || null;
        r.method = r.method || (r.body || r.form.length ? 'POST' : 'GET');
        const ct = (r.headers.find(([k]) => /^content-type$/i.test(k)) || [])[1] || '';
        r.isJson = !!r.body && (/json/i.test(ct) || r.json) && (() => { try { JSON.parse(r.body); return true; } catch (e) { return false; } })();
        if (r.body && !ct && !r.isJson) r.formUrl = true;
        return r;
    }

    const py = s => JSON.stringify(s);
    const CURL_GEN = {
        python(r) {
            const L = ['import requests', ''];
            const headers = r.headers.filter(([k]) => !(r.isJson && /^content-type$/i.test(k)));
            L.push(`url = ${py(r.url)}`);
            if (headers.length) L.push('headers = {', ...headers.map(([k, v]) => `    ${py(k)}: ${py(v)},`), '}');
            if (r.isJson) L.push(`payload = ${JSON.stringify(JSON.parse(r.body), null, 4).replace(/\btrue\b/g, 'True').replace(/\bfalse\b/g, 'False').replace(/\bnull\b/g, 'None')}`);
            else if (r.body) L.push(`data = ${py(r.body)}`);
            if (r.form.length) L.push('files = {', ...r.form.map(([k, v]) => v.startsWith('@') ? `    ${py(k)}: open(${py(v.slice(1))}, "rb"),` : `    ${py(k)}: (None, ${py(v)}),`), '}');
            const args = ['url'];
            if (headers.length) args.push('headers=headers');
            if (r.isJson) args.push('json=payload'); else if (r.body) args.push('data=data');
            if (r.form.length) args.push('files=files');
            if (r.auth) { const [u, p = ''] = r.auth.split(/:(.*)/s); args.push(`auth=(${py(u)}, ${py(p)})`); }
            if (r.insecure) args.push('verify=False');
            args.push('timeout=30');
            L.push('', `response = requests.${r.method.toLowerCase()}(${args.join(', ')})`, 'response.raise_for_status()', 'print(response.status_code)', `print(response.${r.isJson || /json/i.test(JSON.stringify(r.headers)) ? 'json()' : 'text'})`);
            return L.join('\n') + '\n';
        },
        javascript(r) {
            const headers = [...r.headers];
            if (r.auth) headers.push(['Authorization', `Basic \${btoa(${JSON.stringify(r.auth)})}`]);
            const L = [];
            if (r.form.length) {
                L.push('const form = new FormData();', ...r.form.map(([k, v]) => v.startsWith('@')
                    ? `form.append(${JSON.stringify(k)}, fileInput.files[0]); // ${v.slice(1)}` : `form.append(${JSON.stringify(k)}, ${JSON.stringify(v)});`), '');
            }
            L.push(`const response = await fetch(${JSON.stringify(r.url)}, {`, `    method: ${JSON.stringify(r.method)},`);
            if (headers.length) L.push('    headers: {', ...headers.map(([k, v]) => `        ${JSON.stringify(k)}: ${v.includes('${') ? '`' + v + '`' : JSON.stringify(v)},`), '    },');
            if (r.isJson) L.push(`    body: JSON.stringify(${JSON.stringify(JSON.parse(r.body), null, 4).replace(/\n/g, '\n    ')}),`);
            else if (r.body) L.push(`    body: ${JSON.stringify(r.body)},`);
            if (r.form.length) L.push('    body: form,');
            L.push('});', '', `if (!response.ok) throw new Error(\`HTTP \${response.status}\`);`, `const data = await response.${r.isJson ? 'json' : 'text'}();`, 'console.log(data);');
            return L.join('\n') + '\n';
        },
        go(r) {
            const L = ['package main', '', 'import (', '\t"fmt"', '\t"io"', '\t"net/http"'];
            if (r.body) L.push('\t"strings"');
            if (r.insecure) L.push('\t"crypto/tls"');
            L.push(')', '', 'func main() {');
            L.push(r.body ? `\tbody := strings.NewReader(${JSON.stringify(r.body).replace(/\\u0026/g, '&')})` : '');
            L.push(`\treq, err := http.NewRequest(${JSON.stringify(r.method)}, ${JSON.stringify(r.url)}, ${r.body ? 'body' : 'nil'})`, '\tif err != nil {', '\t\tpanic(err)', '\t}');
            r.headers.forEach(([k, v]) => L.push(`\treq.Header.Set(${JSON.stringify(k)}, ${JSON.stringify(v)})`));
            if (r.auth) { const [u, p = ''] = r.auth.split(/:(.*)/s); L.push(`\treq.SetBasicAuth(${JSON.stringify(u)}, ${JSON.stringify(p)})`); }
            L.push(r.insecure ? '\tclient := &http.Client{Transport: &http.Transport{TLSClientConfig: &tls.Config{InsecureSkipVerify: true}}}' : '\tclient := &http.Client{}');
            L.push('\tresp, err := client.Do(req)', '\tif err != nil {', '\t\tpanic(err)', '\t}', '\tdefer resp.Body.Close()', '',
                '\tdata, err := io.ReadAll(resp.Body)', '\tif err != nil {', '\t\tpanic(err)', '\t}', '\tfmt.Println(resp.StatusCode, string(data))', '}');
            if (r.form.length) L.splice(L.indexOf('func main() {') + 1, 0, '\t// multipart form fields (-F) are not converted; see mime/multipart');
            return L.filter(x => x !== '').join('\n').replace('func main() {', '\nfunc main() {') + '\n';
        }
    };

    const CURL_SAMPLE = `curl -X POST 'https://api.example.com/v1/orders?expand=items' \\
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.e30.abc' \\
  -H 'Content-Type: application/json' \\
  -d '{"customer_id": 42, "items": [{"sku": "A-1", "qty": 2}], "gift": false}'`;

    function mountCurl(root) {
        const targets = [['python', 'Python (requests)'], ['javascript', 'JavaScript (fetch)'], ['go', 'Go (net/http)']];
        let target = store.get('tools-curl-target') || 'python';
        html(root, `
            <label class="tlabel" for="in">cURL</label>
            <textarea class="tarea" id="in" spellcheck="false" style="min-height:140px">${esc(CURL_SAMPLE)}</textarea>
            <p class="tmsg" id="msg">${t('Tip: in the browser DevTools Network tab, right-click a request → Copy → Copy as cURL.',
                'İpucu: tarayıcı DevTools → Network sekmesinde bir isteğe sağ tıkla → Copy → Copy as cURL.')}</p>
            <div class="ttabs">${targets.map(([k, l]) => `<button type="button" class="ttab${k === target ? ' is-on' : ''}" data-t="${k}">${l}</button>`).join('')}</div>
            <pre class="tout" id="out"></pre>
            <div class="trow">${copyBtn('out')}</div>`);
        const run = () => {
            const out = $('#out', root);
            try { out.textContent = CURL_GEN[target](parseCurl($('#in', root).value)); }
            catch (e) { out.textContent = '⚠ ' + e.message; }
        };
        root.querySelectorAll('[data-t]').forEach(b => b.addEventListener('click', () => {
            target = b.dataset.t; store.set('tools-curl-target', target);
            root.querySelectorAll('[data-t]').forEach(x => x.classList.toggle('is-on', x === b)); run();
        }));
        $('#in', root).addEventListener('input', run);
        wireCopy(root);
        run();
    }

    /* =================================================================
       8) Encode / decode
       ================================================================= */
    const CODECS = {
        b64: { label: 'Base64', enc: s => btoa(String.fromCharCode(...enc(s))), dec: s => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\s+/g, '')), c => c.charCodeAt(0))) },
        b64url: { label: 'Base64URL', enc: s => b64urlEncode(enc(s)), dec: s => b64urlDecode(s.trim()) },
        url: { label: 'URL', enc: s => encodeURIComponent(s), dec: s => decodeURIComponent(s.replace(/\+/g, ' ')) },
        html: { label: 'HTML', enc: s => esc(s), dec: s => { const d = document.createElement('textarea'); d.innerHTML = s; return d.value; } },
        hex: { label: 'Hex', enc: s => [...enc(s)].map(b => b.toString(16).padStart(2, '0')).join(' '),
            dec: s => new TextDecoder().decode(Uint8Array.from((s.replace(/[^0-9a-f]/gi, '').match(/../g) || []).map(h => parseInt(h, 16)))) }
    };

    function mountEncode(root) {
        let codec = 'b64';
        html(root, `
            <div class="ttabs">${Object.entries(CODECS).map(([k, c]) => `<button type="button" class="ttab${k === codec ? ' is-on' : ''}" data-c="${k}">${c.label}</button>`).join('')}</div>
            <div class="tcols">
                <div><label class="tlabel" for="a">${t('Text', 'Metin')}</label><textarea class="tarea" id="a" spellcheck="false">Merhaba dünya — çğıöşü 👋</textarea>
                    <div class="trow">${copyBtn('a')}</div></div>
                <div><label class="tlabel" for="b">${t('Encoded', 'Kodlanmış')}</label><textarea class="tarea" id="b" spellcheck="false"></textarea>
                    <div class="trow">${copyBtn('b')}</div></div>
            </div>
            <p class="tmsg" id="msg">${t('Type on either side. Text is handled as UTF-8.', 'İki taraftan birine yaz. Metin UTF-8 olarak işlenir.')}</p>`);
        const a = $('#a', root), b = $('#b', root), msg = $('#msg', root);
        const fromA = () => { try { b.value = CODECS[codec].enc(a.value); msg.className = 'tmsg'; } catch (e) { msg.textContent = e.message; msg.className = 'tmsg is-err'; } };
        const fromB = () => { try { a.value = CODECS[codec].dec(b.value); msg.className = 'tmsg'; } catch (e) { msg.textContent = t('Cannot decode: ', 'Çözülemedi: ') + e.message; msg.className = 'tmsg is-err'; } };
        a.addEventListener('input', fromA); b.addEventListener('input', fromB);
        root.querySelectorAll('[data-c]').forEach(x => x.addEventListener('click', () => {
            codec = x.dataset.c; root.querySelectorAll('[data-c]').forEach(y => y.classList.toggle('is-on', y === x)); fromA();
        }));
        wireCopy(root);
        fromA();
    }

    /* =================================================================
       Registry, home page and routing
       ================================================================= */
    const TOOLS = [
        { id: 'data', group: 'data', icon: 'fas fa-database', mount: mountData, tags: ['Parquet', 'CSV', 'JSON', 'SQL', 'DuckDB'],
            title: t('Parquet / CSV / JSON explorer', 'Parquet / CSV / JSON gezgini'),
            desc: t('Drop a data file: preview, schema, Parquet metadata, column profile, SQL, and convert between Parquet, CSV and JSON.',
                'Bir veri dosyası bırak: önizleme, şema, Parquet metadata, sütun profili, SQL ve Parquet / CSV / JSON arası dönüşüm.') },
        { id: 'schema', group: 'data', icon: 'fas fa-project-diagram', mount: mountSchema, tags: ['PySpark', 'SQL', 'Pydantic', 'TypeScript'],
            title: t('JSON → schema', 'JSON → şema'),
            desc: t('Turn sample JSON into a PySpark StructType, Spark SQL / PostgreSQL table, Pydantic model, TypeScript types or JSON Schema.',
                'Örnek JSON\'dan PySpark StructType, Spark SQL / PostgreSQL tablosu, Pydantic modeli, TypeScript tipleri ya da JSON Schema üret.') },
        { id: 'json', group: 'dev', icon: 'fas fa-code', mount: mountJson, tags: ['format', 'validate'],
            title: t('JSON formatter & validator', 'JSON biçimlendirici & doğrulayıcı'),
            desc: t('Format, minify or sort keys; invalid JSON shows the exact line and column.', 'Biçimlendir, küçült ya da anahtarları sırala; hatalı JSON tam satır ve sütunu gösterir.') },
        { id: 'jwt', group: 'dev', icon: 'fas fa-user-shield', mount: mountJwt, tags: ['JWT', 'HS256', 'auth'],
            title: t('JWT decoder', 'JWT çözücü'),
            desc: t('Read the header and claims, see expiry in plain time, verify HS256/384/512 signatures.', 'Header ve alanları oku, son kullanma zamanını gör, HS256/384/512 imzasını doğrula.') },
        { id: 'time', group: 'dev', icon: 'fas fa-calendar', mount: mountTime, tags: ['unix', 'ISO 8601', 'time zones'],
            title: t('Timestamp converter', 'Zaman damgası çevirici'),
            desc: t('Unix seconds / ms / µs / ns or any date text → ISO, RFC 2822, local and other time zones.', 'Unix saniye / ms / µs / ns ya da tarih metni → ISO, RFC 2822, yerel ve diğer saat dilimleri.') },
        { id: 'cron', group: 'dev', icon: 'fas fa-bell', mount: mountCron, tags: ['crontab', 'Airflow', 'K8s'],
            title: t('Cron explainer', 'Cron çözücü'),
            desc: t('Read a cron expression in plain words and see its next 10 runs in your time zone.', 'Cron ifadesini düz cümleyle oku ve senin saat diliminde sonraki 10 çalışmasını gör.') },
        { id: 'curl', group: 'dev', icon: 'fas fa-terminal', mount: mountCurl, tags: ['Python', 'fetch', 'Go'],
            title: t('cURL → code', 'cURL → kod'),
            desc: t('Paste a curl command (e.g. “Copy as cURL” from DevTools) and get Python requests, JavaScript fetch or Go.',
                'Bir curl komutu yapıştır (ör. DevTools’taki “Copy as cURL”), Python requests, JavaScript fetch ya da Go kodu al.') },
        { id: 'encode', group: 'dev', icon: 'fas fa-random', mount: mountEncode, tags: ['Base64', 'URL', 'Hex'],
            title: t('Encode / decode', 'Kodla / çöz'),
            desc: t('Base64, Base64URL, URL, HTML entities and hex — UTF-8 safe, both directions.', 'Base64, Base64URL, URL, HTML karakterleri ve hex — UTF-8 güvenli, iki yönlü.') }
    ];

    const app = document.getElementById('app');
    let cleanup = null;

    function home() {
        document.title = t('Developer Tools — Yunus Emre Yaşar', 'Geliştirici Araçları — Yunus Emre Yaşar');
        const groups = [['data', t('Data & AI', 'Veri & Yapay Zeka')], ['dev', t('Everyday developer tools', 'Günlük geliştirici araçları')]];
        html(app, `
            <section class="thero">
                <span class="section__label">${t('Free tools', 'Ücretsiz araçlar')}</span>
                <h1>${t('Developer Tools', 'Geliştirici Araçları')}</h1>
                <p>${t('Small tools I reach for every day as a data engineer — now in your browser. No sign-up, no tracking.',
                    'Bir veri mühendisi olarak her gün kullandığım küçük araçlar — artık tarayıcında. Kayıt yok, takip yok.')}</p>
                <span class="privacy"><i class="fas fa-user-shield"></i> ${t('Everything runs locally: your files, tokens and data are never uploaded.',
                    'Her şey yerelde çalışır: dosyaların, jetonların ve verilerin hiçbir yere yüklenmez.')}</span>
                <input class="tsearch" id="search" type="search" placeholder="${t('Search tools…  (e.g. parquet, jwt, cron)', 'Araç ara…  (ör. parquet, jwt, cron)')}" aria-label="${t('Search tools', 'Araç ara')}">
            </section>
            ${groups.map(([g, label]) => `<section class="tgroup" data-group="${g}"><h2>${label}</h2><div class="tgrid">${TOOLS.filter(x => x.group === g).map(x => `
                <a class="ttile" href="#${x.id}" data-search="${esc((x.title + ' ' + x.desc + ' ' + x.tags.join(' ')).toLowerCase())}">
                    <span class="ttile__ic"><i class="${x.icon}"></i></span><h3>${x.title}</h3><p>${x.desc}</p>
                    <span class="ttile__tags">${x.tags.map(g2 => `<span>${g2}</span>`).join('')}</span></a>`).join('')}</div></section>`).join('')}`);
        const search = $('#search', app);
        search.addEventListener('input', () => {
            const q = search.value.toLowerCase().trim();
            app.querySelectorAll('.ttile').forEach(a => (a.hidden = !!q && !a.dataset.search.includes(q)));
            app.querySelectorAll('.tgroup').forEach(g => (g.hidden = ![...g.querySelectorAll('.ttile')].some(a => !a.hidden)));
        });
        search.addEventListener('keydown', e => { if (e.key === 'Enter') { const first = app.querySelector('.ttile:not([hidden])'); if (first) location.hash = first.getAttribute('href'); } });
    }

    function view(tool) {
        document.title = `${tool.title} — ${t('Developer Tools', 'Geliştirici Araçları')}`;
        html(app, `
            <section class="tview">
                <a class="tview__back" href="#"><i class="fas fa-arrow-left"></i> ${t('All tools', 'Tüm araçlar')}</a>
                <div class="tview__head"><div><h1>${tool.title}</h1><p class="tview__sub">${tool.desc}</p></div>
                    <span class="privacy"><i class="fas fa-user-shield"></i> ${t('Runs locally', 'Yerelde çalışır')}</span></div>
                <div id="tool"></div>
            </section>`);
        cleanup = tool.mount($('#tool', app)) || null;
        window.scrollTo(0, 0);
    }

    function route() {
        if (typeof cleanup === 'function') cleanup();
        cleanup = null;
        const tool = TOOLS.find(x => x.id === location.hash.slice(1));
        tool ? view(tool) : home();
    }

    /* page chrome */
    document.documentElement.lang = LANG;
    document.querySelector('[data-home]').href = TR ? '../tr/' : '../';
    document.getElementById('footNote').textContent = t('Runs entirely in your browser', 'Tamamen tarayıcında çalışır');
    document.querySelectorAll('[data-lang]').forEach(a => {
        a.classList.toggle('active', a.dataset.lang === LANG);
        a.addEventListener('click', e => { e.preventDefault(); store.set('tools-lang', a.dataset.lang); location.href = `?lang=${a.dataset.lang}${location.hash}`; });
    });
    window.addEventListener('hashchange', route);
    route();
})();
