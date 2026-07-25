(function (global) {
    'use strict';

    function parseTourDate(value) {
        if (!value) return null;
        if (value instanceof Date) {
            return isNaN(value.getTime()) ? null : new Date(value.getFullYear(), value.getMonth(), value.getDate());
        }
        const str = String(value);
        const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (match) {
            const d = new Date(parseInt(match[1], 10), parseInt(match[2], 10) - 1, parseInt(match[3], 10));
            return isNaN(d.getTime()) ? null : d;
        }
        const fallback = new Date(str);
        if (isNaN(fallback.getTime())) return null;
        return new Date(fallback.getFullYear(), fallback.getMonth(), fallback.getDate());
    }

    function formatTourDate(value, locale, options) {
        const d = parseTourDate(value);
        if (!d) return '';
        return d.toLocaleDateString(locale, options);
    }

    function daysUntilTour(value) {
        const d = parseTourDate(value);
        if (!d) return null;
        const today = new Date();
        // Use Date.UTC for date-only diff so DST transitions don't shift the count by ±1 day
        const tourUTC = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
        const todayUTC = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
        return Math.round((tourUTC - todayUTC) / (1000 * 60 * 60 * 24));
    }

    global.parseTourDate = parseTourDate;
    global.formatTourDate = formatTourDate;
    global.daysUntilTour = daysUntilTour;
})(window);
