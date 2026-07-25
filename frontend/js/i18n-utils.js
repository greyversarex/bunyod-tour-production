(function (global) {
    'use strict';

    var STYLE_ID = 'bt-i18n-utils-style';
    var BAR_ID = 'bt-i18n-progress-bar';
    var TOAST_CONTAINER_ID = 'bt-i18n-toast-container';
    var BAR_DURATION_MS = 1200;

    function injectStyles() {
        if (document.getElementById(STYLE_ID)) return;
        var style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = [
            '#' + BAR_ID + ' {',
            '  position: fixed; top: 0; left: 0; height: 3px; width: 0%;',
            '  background: linear-gradient(90deg, #3b82f6, #06b6d4);',
            '  z-index: 99999; pointer-events: none;',
            '  transition: width 1s ease-out, opacity 0.3s ease-out;',
            '  box-shadow: 0 1px 4px rgba(59,130,246,0.4);',
            '}',
            '#' + BAR_ID + '.bt-i18n-progress--active { width: 92%; opacity: 1; }',
            '#' + BAR_ID + '.bt-i18n-progress--done { width: 100%; opacity: 0; transition: width 0.2s ease-out, opacity 0.5s ease-out 0.1s; }',
            '#' + TOAST_CONTAINER_ID + ' {',
            '  position: fixed; bottom: 90px; left: 50%; transform: translateX(-50%);',
            '  z-index: 9997; display: flex; flex-direction: column; gap: 8px;',
            '  pointer-events: none;',
            '}',
            '@media (max-width: 640px) {',
            '  #' + TOAST_CONTAINER_ID + ' { bottom: 80px; width: calc(100% - 32px); }',
            '}',
            '.bt-i18n-toast {',
            '  background: #1f2937; color: #fff; padding: 10px 16px;',
            '  border-radius: 8px; font-size: 14px; line-height: 1.4;',
            '  box-shadow: 0 6px 20px rgba(0,0,0,0.18);',
            '  max-width: 90vw; pointer-events: auto;',
            '  opacity: 0; transform: translateY(8px);',
            '  transition: opacity 0.25s ease-out, transform 0.25s ease-out;',
            '}',
            '.bt-i18n-toast--visible { opacity: 1; transform: translateY(0); }',
            '.bt-i18n-toast--error { background: #b91c1c; }',
            '.bt-i18n-toast--success { background: #047857; }',
            '.bt-i18n-toast--warning { background: #b45309; }'
        ].join('\n');
        document.head.appendChild(style);
    }

    function ensureProgressBar() {
        var bar = document.getElementById(BAR_ID);
        if (bar) return bar;
        bar = document.createElement('div');
        bar.id = BAR_ID;
        document.body.appendChild(bar);
        return bar;
    }

    function ensureToastContainer() {
        var container = document.getElementById(TOAST_CONTAINER_ID);
        if (container) return container;
        container = document.createElement('div');
        container.id = TOAST_CONTAINER_ID;
        document.body.appendChild(container);
        return container;
    }

    var progressTimer = null;

    function showLanguageProgress() {
        if (!document.body) return;
        injectStyles();
        var bar = ensureProgressBar();
        bar.classList.remove('bt-i18n-progress--done');
        // Force reflow so transitions restart cleanly
        // eslint-disable-next-line no-unused-expressions
        bar.offsetWidth;
        bar.classList.add('bt-i18n-progress--active');

        if (progressTimer) clearTimeout(progressTimer);
        progressTimer = setTimeout(function () {
            bar.classList.remove('bt-i18n-progress--active');
            bar.classList.add('bt-i18n-progress--done');
            progressTimer = setTimeout(function () {
                bar.classList.remove('bt-i18n-progress--done');
            }, 600);
        }, BAR_DURATION_MS);
    }

    function showI18nToast(message, type, durationMs) {
        if (!document.body) {
            document.addEventListener('DOMContentLoaded', function () {
                showI18nToast(message, type, durationMs);
            }, { once: true });
            return;
        }
        injectStyles();
        var container = ensureToastContainer();
        var toast = document.createElement('div');
        toast.className = 'bt-i18n-toast';
        if (type === 'error' || type === 'success' || type === 'warning') {
            toast.classList.add('bt-i18n-toast--' + type);
        }
        toast.textContent = String(message == null ? '' : message);
        container.appendChild(toast);

        // Trigger entrance animation
        requestAnimationFrame(function () {
            toast.classList.add('bt-i18n-toast--visible');
        });

        var ttl = typeof durationMs === 'number' ? durationMs : 3500;
        setTimeout(function () {
            toast.classList.remove('bt-i18n-toast--visible');
            setTimeout(function () {
                if (toast.parentNode) toast.parentNode.removeChild(toast);
            }, 300);
        }, ttl);
    }

    function tryParseJsonObject(value) {
        if (typeof value !== 'string') return null;
        var trimmed = value.trim();
        // Only attempt to parse if it looks like a JSON object
        if (!trimmed || trimmed[0] !== '{' || trimmed[trimmed.length - 1] !== '}') return null;
        try {
            var parsed = JSON.parse(trimmed);
            return (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : null;
        } catch (e) { return null; }
    }

    function getMultilingualText(value, lang, fallback) {
        var primary = (lang === 'en') ? 'en' : 'ru';
        var secondary = primary === 'en' ? 'ru' : 'en';
        var fallbackText = typeof fallback === 'string' ? fallback : '';

        if (value == null) return fallbackText;

        if (typeof value === 'object' && !Array.isArray(value)) {
            return value[primary] || value[secondary] || value.en || value.ru || fallbackText;
        }

        if (typeof value === 'string') {
            var parsed = tryParseJsonObject(value);
            if (parsed) {
                return parsed[primary] || parsed[secondary] || parsed.en || parsed.ru || fallbackText || value;
            }
            return value;
        }

        return String(value);
    }

    function getCurrentLang() {
        return (global.currentLanguage || (global.localStorage && global.localStorage.getItem('selectedLanguage')) || 'ru');
    }

    function attachGlobalListeners() {
        var handler = function () {
            try { showLanguageProgress(); } catch (e) { /* never break the page */ }
        };
        document.addEventListener('languageChanged', handler);
        // Some places dispatch on window with the same name
        global.addEventListener('languageChanged', handler);
    }

    function init() {
        injectStyles();
        attachGlobalListeners();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }

    global.getMultilingualText = getMultilingualText;
    global.showI18nToast = showI18nToast;
    global.showI18nProgress = showLanguageProgress;
    global.getCurrentI18nLang = getCurrentLang;
})(window);
