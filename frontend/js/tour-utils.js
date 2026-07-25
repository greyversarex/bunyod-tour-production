(function (global) {
    'use strict';

    var TOUR_TYPE_MAP = {
        'group_general': { ru: 'Групповой общий', en: 'Group Shared' },
        'group_shared': { ru: 'Групповой общий', en: 'Group Shared' },
        'group shared': { ru: 'Групповой общий', en: 'Group Shared' },
        'group general': { ru: 'Групповой общий', en: 'Group Shared' },
        'групповой общий': { ru: 'Групповой общий', en: 'Group Shared' },
        'групповой совместный': { ru: 'Групповой общий', en: 'Group Shared' },

        'group_private': { ru: 'Групповой персональный', en: 'Group Private' },
        'group_personal': { ru: 'Групповой персональный', en: 'Group Private' },
        'group private': { ru: 'Групповой персональный', en: 'Group Private' },
        'group personal': { ru: 'Групповой персональный', en: 'Group Private' },
        'групповой персональный': { ru: 'Групповой персональный', en: 'Group Private' },
        'групповой приватный': { ru: 'Групповой персональный', en: 'Group Private' },

        'individual': { ru: 'Персональный', en: 'Private' },
        'personal': { ru: 'Персональный', en: 'Private' },
        'private': { ru: 'Персональный', en: 'Private' },
        'индивидуальный': { ru: 'Персональный', en: 'Private' },
        'персональный': { ru: 'Персональный', en: 'Private' },

        'group': { ru: 'Групповой', en: 'Group' },
        'групповой': { ru: 'Групповой', en: 'Group' },

        'vip': { ru: 'VIP', en: 'VIP' }
    };

    function localizeTourType(value, lang) {
        var language = lang === 'en' ? 'en' : 'ru';
        var fallbackLabel = language === 'en' ? 'Group' : 'Групповой';

        if (value == null || value === '') return fallbackLabel;

        if (typeof value === 'object') {
            return value[language] || value.ru || value.en || fallbackLabel;
        }

        var key = String(value).toLowerCase().trim();
        var direct = TOUR_TYPE_MAP[key];
        if (direct) return direct[language] || direct.en;

        var normalized = key.replace(/\s+/g, '_');
        var normalizedDirect = TOUR_TYPE_MAP[normalized];
        if (normalizedDirect) return normalizedDirect[language] || normalizedDirect.en;

        if (typeof global.getTranslation === 'function') {
            var translationKey = 'tour_type.' + normalized;
            var translated = global.getTranslation(translationKey);
            if (translated && translated !== translationKey) return translated;
        }

        return String(value);
    }

    global.localizeTourType = localizeTourType;
})(window);
