/**
 * One-time migration: inject the i18n early-boot snippet into the <head> of every
 * frontend HTML page that uses the i18n system.
 *
 * The snippet runs SYNCHRONOUSLY during <head> parsing — before the browser paints
 * any body content — so it can:
 *   1. Detect the active language (default: English) and set window.currentLanguage
 *      + <html lang> before first paint.
 *   2. The static HTML is baked in ENGLISH (the default language), so for English
 *      visitors we DO NOT hide <body> — the page paints instantly, with no wait for
 *      the large i18n.js dictionary to download. We hide <body> (opacity:0) and wait
 *      for translation ONLY when a non-English language (e.g. Russian) is selected,
 *      to avoid a flash of English before it is translated.
 *   3. When we do hide, reveal the page reliably (translation done / window load /
 *      hard timeout) so a failed or stalled i18n.js can never leave a blank page.
 *
 * i18n.js removes the FOUC style (id "i18n-fouc-prevention") right after it applies
 * translations, and skips its own (now late, deferred) FOUC logic when it sees
 * window._i18nEarlyBoot === true.
 *
 * Idempotent: re-running updates the snippet in place instead of duplicating it.
 */
const fs = require('fs');
const path = require('path');

const FRONTEND_DIR = path.join(__dirname, '..', 'frontend');
const START_MARKER = '<!-- i18n-early-boot:start -->';
const END_MARKER = '<!-- i18n-early-boot:end -->';

const SNIPPET = `${START_MARKER}
    <!-- РАННЯЯ ИНИЦИАЛИЗАЦИЯ ЯЗЫКА + ЗАЩИТА ОТ FOUC.
         Выполняется СИНХРОННО при парсинге <head>, ДО первой отрисовки <body>,
         поэтому браузер никогда не показывает русский текст разметки до перевода.
         Управляется из /public/js/i18n.js (снятие защиты после перевода).
         data-cfasync="false" — критично: запрещает Cloudflare Rocket Loader
         откладывать этот скрипт. Иначе он не выполнится до первой отрисовки и
         защита от FOUC не сработает (русский текст мелькнёт на продакшене). -->
    <script data-cfasync="false">
    (function () {
        try {
            var SUPPORTED = ['en', 'ru'];
            var lang = 'en'; // Язык по умолчанию — английский (фундаментальное правило проекта)
            try {
                var sess = sessionStorage.getItem('bt_lang');
                if (sess && SUPPORTED.indexOf(sess) !== -1) {
                    lang = sess;
                } else {
                    var stored = localStorage.getItem('selectedLanguage');
                    if (stored && SUPPORTED.indexOf(stored) !== -1) {
                        lang = stored;
                        try { sessionStorage.setItem('bt_lang', lang); } catch (e) {}
                    } else {
                        try { localStorage.setItem('selectedLanguage', 'en'); } catch (e) {}
                        try { sessionStorage.setItem('bt_lang', 'en'); } catch (e) {}
                    }
                }
            } catch (e) {}

            window.currentLanguage = lang;
            try { document.documentElement.lang = lang; } catch (e) {}
            window._i18nEarlyBoot = true;

            // reveal() снимает защиту от FOUC. Определяем ВСЕГДА (безопасный no-op,
            // если прятать нечего), т.к. на него могут ссылаться другие скрипты.
            function reveal() {
                try {
                    if (window._foucSafetyTimer) { clearTimeout(window._foucSafetyTimer); window._foucSafetyTimer = null; }
                    var s = document.getElementById('i18n-fouc-prevention');
                    if (s && s.parentNode) s.parentNode.removeChild(s);
                    if (document.body) document.body.style.opacity = '';
                } catch (e) {}
            }
            window._i18nReveal = reveal;

            // КЛЮЧЕВОЕ ДЛЯ СКОРОСТИ: разметка свёрстана на АНГЛИЙСКОМ (язык по умолчанию).
            // Для английского НЕ прячем body — страница отрисовывается мгновенно, без ожидания
            // загрузки большого i18n.js. Прячем и ждём перевода ТОЛЬКО если выбран не-английский
            // язык (напр. русский), чтобы не мелькнул английский текст до перевода на русский.
            if (lang !== 'en') {
                var style = document.createElement('style');
                style.id = 'i18n-fouc-prevention';
                style.textContent = 'body{opacity:0!important}';
                (document.head || document.documentElement).appendChild(style);

                // Подстраховка: если i18n.js не загрузится/не выполнится (404, ошибка скрипта),
                // показываем страницу по событию load, чтобы она не осталась пустой.
                window.addEventListener('load', function () { setTimeout(reveal, 0); });
                // Абсолютный предохранитель на случай зависшей сети (страница не должна
                // остаться пустой навсегда). При нормальной работе таймер снимается в i18n.js.
                window._foucSafetyTimer = setTimeout(reveal, 8000);
            }
        } catch (e) {}
    })();
    </script>
    ${END_MARKER}`;

function processFile(filePath) {
    let html = fs.readFileSync(filePath, 'utf8');

    if (!html.includes('public/js/i18n.js')) {
        return { file: path.basename(filePath), status: 'skipped (no i18n.js)' };
    }

    // Idempotent: replace an existing block instead of adding a duplicate.
    if (html.includes(START_MARKER)) {
        const blockRe = new RegExp(
            START_MARKER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
            '[\\s\\S]*?' +
            END_MARKER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        );
        const updated = html.replace(blockRe, SNIPPET);
        if (updated !== html) {
            fs.writeFileSync(filePath, updated, 'utf8');
            return { file: path.basename(filePath), status: 'updated' };
        }
        return { file: path.basename(filePath), status: 'unchanged' };
    }

    // Insert right after the opening <head> tag.
    const headRe = /<head\b[^>]*>/i;
    const match = html.match(headRe);
    if (!match) {
        return { file: path.basename(filePath), status: 'ERROR: no <head> tag' };
    }
    const insertAt = match.index + match[0].length;
    const updated = html.slice(0, insertAt) + '\n    ' + SNIPPET + html.slice(insertAt);
    fs.writeFileSync(filePath, updated, 'utf8');
    return { file: path.basename(filePath), status: 'injected' };
}

const files = fs.readdirSync(FRONTEND_DIR).filter((f) => f.endsWith('.html'));
const results = files.map((f) => processFile(path.join(FRONTEND_DIR, f)));

const summary = results.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
}, {});

results
    .filter((r) => r.status !== 'skipped (no i18n.js)')
    .forEach((r) => console.log(`  ${r.status.padEnd(12)} ${r.file}`));

console.log('\nSummary:', JSON.stringify(summary, null, 2));
