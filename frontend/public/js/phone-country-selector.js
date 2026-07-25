/**
 * Phone Country Selector Component
 * Provides country flag selector with phone country code and search
 */

const PHONE_COUNTRY_CODES = {
  'TJ': { name: 'Tajikistan', nameRu: 'Таджикистан', code: '+992', flag: '🇹🇯', format: 'XXX XX XX XX' },
  'UZ': { name: 'Uzbekistan', nameRu: 'Узбекистан', code: '+998', flag: '🇺🇿', format: 'XX XXX XX XX' },
  'KG': { name: 'Kyrgyzstan', nameRu: 'Кыргызстан', code: '+996', flag: '🇰🇬', format: 'XXX XXX XXX' },
  'KZ': { name: 'Kazakhstan', nameRu: 'Казахстан', code: '+7', flag: '🇰🇿', format: 'XXX XXX XX XX' },
  'TM': { name: 'Turkmenistan', nameRu: 'Туркменистан', code: '+993', flag: '🇹🇲', format: 'XX XXXXXX' },
  'RU': { name: 'Russia', nameRu: 'Россия', code: '+7', flag: '🇷🇺', format: 'XXX XXX XX XX' },
  'AF': { name: 'Afghanistan', nameRu: 'Афганистан', code: '+93', flag: '🇦🇫', format: 'XX XXX XXXX' },
  'AL': { name: 'Albania', nameRu: 'Албания', code: '+355', flag: '🇦🇱', format: 'XX XXX XXXX' },
  'DZ': { name: 'Algeria', nameRu: 'Алжир', code: '+213', flag: '🇩🇿', format: 'XXX XX XX XX' },
  'AD': { name: 'Andorra', nameRu: 'Андорра', code: '+376', flag: '🇦🇩', format: 'XXX XXX' },
  'AO': { name: 'Angola', nameRu: 'Ангола', code: '+244', flag: '🇦🇴', format: 'XXX XXX XXX' },
  'AR': { name: 'Argentina', nameRu: 'Аргентина', code: '+54', flag: '🇦🇷', format: 'XX XXXX XXXX' },
  'AM': { name: 'Armenia', nameRu: 'Армения', code: '+374', flag: '🇦🇲', format: 'XX XXX XXX' },
  'AU': { name: 'Australia', nameRu: 'Австралия', code: '+61', flag: '🇦🇺', format: 'XXX XXX XXX' },
  'AT': { name: 'Austria', nameRu: 'Австрия', code: '+43', flag: '🇦🇹', format: 'XXX XXXXXX' },
  'AZ': { name: 'Azerbaijan', nameRu: 'Азербайджан', code: '+994', flag: '🇦🇿', format: 'XX XXX XX XX' },
  'BH': { name: 'Bahrain', nameRu: 'Бахрейн', code: '+973', flag: '🇧🇭', format: 'XXXX XXXX' },
  'BD': { name: 'Bangladesh', nameRu: 'Бангладеш', code: '+880', flag: '🇧🇩', format: 'XXXX XXXXXX' },
  'BY': { name: 'Belarus', nameRu: 'Беларусь', code: '+375', flag: '🇧🇾', format: 'XX XXX XX XX' },
  'BE': { name: 'Belgium', nameRu: 'Бельгия', code: '+32', flag: '🇧🇪', format: 'XXX XX XX XX' },
  'BJ': { name: 'Benin', nameRu: 'Бенин', code: '+229', flag: '🇧🇯', format: 'XX XX XXXX' },
  'BT': { name: 'Bhutan', nameRu: 'Бутан', code: '+975', flag: '🇧🇹', format: 'XX XXX XXX' },
  'BO': { name: 'Bolivia', nameRu: 'Боливия', code: '+591', flag: '🇧🇴', format: 'X XXXXXXX' },
  'BA': { name: 'Bosnia', nameRu: 'Босния', code: '+387', flag: '🇧🇦', format: 'XX XXX XXX' },
  'BW': { name: 'Botswana', nameRu: 'Ботсвана', code: '+267', flag: '🇧🇼', format: 'XX XXX XXX' },
  'BR': { name: 'Brazil', nameRu: 'Бразилия', code: '+55', flag: '🇧🇷', format: 'XX XXXXX XXXX' },
  'BN': { name: 'Brunei', nameRu: 'Бруней', code: '+673', flag: '🇧🇳', format: 'XXX XXXX' },
  'BG': { name: 'Bulgaria', nameRu: 'Болгария', code: '+359', flag: '🇧🇬', format: 'XX XXX XXXX' },
  'BF': { name: 'Burkina Faso', nameRu: 'Буркина-Фасо', code: '+226', flag: '🇧🇫', format: 'XX XX XX XX' },
  'BI': { name: 'Burundi', nameRu: 'Бурунди', code: '+257', flag: '🇧🇮', format: 'XX XX XXXX' },
  'KH': { name: 'Cambodia', nameRu: 'Камбоджа', code: '+855', flag: '🇰🇭', format: 'XX XXX XXXX' },
  'CM': { name: 'Cameroon', nameRu: 'Камерун', code: '+237', flag: '🇨🇲', format: 'XXXX XXXX' },
  'CA': { name: 'Canada', nameRu: 'Канада', code: '+1', flag: '🇨🇦', format: 'XXX XXX XXXX' },
  'CF': { name: 'Central African Republic', nameRu: 'ЦАР', code: '+236', flag: '🇨🇫', format: 'XX XX XX XX' },
  'TD': { name: 'Chad', nameRu: 'Чад', code: '+235', flag: '🇹🇩', format: 'XX XX XX XX' },
  'CL': { name: 'Chile', nameRu: 'Чили', code: '+56', flag: '🇨🇱', format: 'X XXXX XXXX' },
  'CN': { name: 'China', nameRu: 'Китай', code: '+86', flag: '🇨🇳', format: 'XXX XXXX XXXX' },
  'CO': { name: 'Colombia', nameRu: 'Колумбия', code: '+57', flag: '🇨🇴', format: 'XXX XXX XXXX' },
  'CD': { name: 'Congo (DRC)', nameRu: 'Конго (ДРК)', code: '+243', flag: '🇨🇩', format: 'XX XXX XXXX' },
  'CG': { name: 'Congo', nameRu: 'Конго', code: '+242', flag: '🇨🇬', format: 'XX XXX XXXX' },
  'CR': { name: 'Costa Rica', nameRu: 'Коста-Рика', code: '+506', flag: '🇨🇷', format: 'XXXX XXXX' },
  'HR': { name: 'Croatia', nameRu: 'Хорватия', code: '+385', flag: '🇭🇷', format: 'XX XXX XXXX' },
  'CU': { name: 'Cuba', nameRu: 'Куба', code: '+53', flag: '🇨🇺', format: 'X XXX XXXX' },
  'CY': { name: 'Cyprus', nameRu: 'Кипр', code: '+357', flag: '🇨🇾', format: 'XX XXXXXX' },
  'CZ': { name: 'Czech Republic', nameRu: 'Чехия', code: '+420', flag: '🇨🇿', format: 'XXX XXX XXX' },
  'DK': { name: 'Denmark', nameRu: 'Дания', code: '+45', flag: '🇩🇰', format: 'XX XX XX XX' },
  'DJ': { name: 'Djibouti', nameRu: 'Джибути', code: '+253', flag: '🇩🇯', format: 'XX XX XX XX' },
  'DO': { name: 'Dominican Republic', nameRu: 'Доминиканская Респ.', code: '+1809', flag: '🇩🇴', format: 'XXX XXXX' },
  'EC': { name: 'Ecuador', nameRu: 'Эквадор', code: '+593', flag: '🇪🇨', format: 'XX XXX XXXX' },
  'EG': { name: 'Egypt', nameRu: 'Египет', code: '+20', flag: '🇪🇬', format: 'XX XXXX XXXX' },
  'SV': { name: 'El Salvador', nameRu: 'Сальвадор', code: '+503', flag: '🇸🇻', format: 'XXXX XXXX' },
  'EE': { name: 'Estonia', nameRu: 'Эстония', code: '+372', flag: '🇪🇪', format: 'XXXX XXXX' },
  'ET': { name: 'Ethiopia', nameRu: 'Эфиопия', code: '+251', flag: '🇪🇹', format: 'XX XXX XXXX' },
  'FI': { name: 'Finland', nameRu: 'Финляндия', code: '+358', flag: '🇫🇮', format: 'XX XXX XXXX' },
  'FR': { name: 'France', nameRu: 'Франция', code: '+33', flag: '🇫🇷', format: 'X XX XX XX XX' },
  'GA': { name: 'Gabon', nameRu: 'Габон', code: '+241', flag: '🇬🇦', format: 'X XX XX XX' },
  'GM': { name: 'Gambia', nameRu: 'Гамбия', code: '+220', flag: '🇬🇲', format: 'XXX XXXX' },
  'GE': { name: 'Georgia', nameRu: 'Грузия', code: '+995', flag: '🇬🇪', format: 'XXX XX XX XX' },
  'DE': { name: 'Germany', nameRu: 'Германия', code: '+49', flag: '🇩🇪', format: 'XXX XXXXXXX' },
  'GH': { name: 'Ghana', nameRu: 'Гана', code: '+233', flag: '🇬🇭', format: 'XX XXX XXXX' },
  'GR': { name: 'Greece', nameRu: 'Греция', code: '+30', flag: '🇬🇷', format: 'XXX XXX XXXX' },
  'GT': { name: 'Guatemala', nameRu: 'Гватемала', code: '+502', flag: '🇬🇹', format: 'XXXX XXXX' },
  'GN': { name: 'Guinea', nameRu: 'Гвинея', code: '+224', flag: '🇬🇳', format: 'XXX XX XX XX' },
  'HT': { name: 'Haiti', nameRu: 'Гаити', code: '+509', flag: '🇭🇹', format: 'XXXX XXXX' },
  'HN': { name: 'Honduras', nameRu: 'Гондурас', code: '+504', flag: '🇭🇳', format: 'XXXX XXXX' },
  'HK': { name: 'Hong Kong', nameRu: 'Гонконг', code: '+852', flag: '🇭🇰', format: 'XXXX XXXX' },
  'HU': { name: 'Hungary', nameRu: 'Венгрия', code: '+36', flag: '🇭🇺', format: 'XX XXX XXXX' },
  'IS': { name: 'Iceland', nameRu: 'Исландия', code: '+354', flag: '🇮🇸', format: 'XXX XXXX' },
  'IN': { name: 'India', nameRu: 'Индия', code: '+91', flag: '🇮🇳', format: 'XXXXX XXXXX' },
  'ID': { name: 'Indonesia', nameRu: 'Индонезия', code: '+62', flag: '🇮🇩', format: 'XXX XXXX XXXX' },
  'IR': { name: 'Iran', nameRu: 'Иран', code: '+98', flag: '🇮🇷', format: 'XXX XXX XXXX' },
  'IQ': { name: 'Iraq', nameRu: 'Ирак', code: '+964', flag: '🇮🇶', format: 'XXX XXX XXXX' },
  'IE': { name: 'Ireland', nameRu: 'Ирландия', code: '+353', flag: '🇮🇪', format: 'XX XXX XXXX' },
  'IL': { name: 'Israel', nameRu: 'Израиль', code: '+972', flag: '🇮🇱', format: 'XX XXX XXXX' },
  'IT': { name: 'Italy', nameRu: 'Италия', code: '+39', flag: '🇮🇹', format: 'XXX XXX XXXX' },
  'CI': { name: 'Ivory Coast', nameRu: 'Кот-д\'Ивуар', code: '+225', flag: '🇨🇮', format: 'XX XX XX XXXX' },
  'JM': { name: 'Jamaica', nameRu: 'Ямайка', code: '+1876', flag: '🇯🇲', format: 'XXX XXXX' },
  'JP': { name: 'Japan', nameRu: 'Япония', code: '+81', flag: '🇯🇵', format: 'XX XXXX XXXX' },
  'JO': { name: 'Jordan', nameRu: 'Иордания', code: '+962', flag: '🇯🇴', format: 'X XXXX XXXX' },
  'KE': { name: 'Kenya', nameRu: 'Кения', code: '+254', flag: '🇰🇪', format: 'XXX XXXXXX' },
  'KW': { name: 'Kuwait', nameRu: 'Кувейт', code: '+965', flag: '🇰🇼', format: 'XXXX XXXX' },
  'LA': { name: 'Laos', nameRu: 'Лаос', code: '+856', flag: '🇱🇦', format: 'XX XX XXX XXX' },
  'LV': { name: 'Latvia', nameRu: 'Латвия', code: '+371', flag: '🇱🇻', format: 'XX XXX XXX' },
  'LB': { name: 'Lebanon', nameRu: 'Ливан', code: '+961', flag: '🇱🇧', format: 'XX XXX XXX' },
  'LY': { name: 'Libya', nameRu: 'Ливия', code: '+218', flag: '🇱🇾', format: 'XX XXX XXXX' },
  'LI': { name: 'Liechtenstein', nameRu: 'Лихтенштейн', code: '+423', flag: '🇱🇮', format: 'XXX XXXX' },
  'LT': { name: 'Lithuania', nameRu: 'Литва', code: '+370', flag: '🇱🇹', format: 'XXX XXXXX' },
  'LU': { name: 'Luxembourg', nameRu: 'Люксембург', code: '+352', flag: '🇱🇺', format: 'XXX XXX XXX' },
  'MO': { name: 'Macau', nameRu: 'Макао', code: '+853', flag: '🇲🇴', format: 'XXXX XXXX' },
  'MK': { name: 'North Macedonia', nameRu: 'Северная Македония', code: '+389', flag: '🇲🇰', format: 'XX XXX XXX' },
  'MG': { name: 'Madagascar', nameRu: 'Мадагаскар', code: '+261', flag: '🇲🇬', format: 'XX XX XXX XX' },
  'MW': { name: 'Malawi', nameRu: 'Малави', code: '+265', flag: '🇲🇼', format: 'X XXXX XXXX' },
  'MY': { name: 'Malaysia', nameRu: 'Малайзия', code: '+60', flag: '🇲🇾', format: 'XX XXXX XXXX' },
  'MV': { name: 'Maldives', nameRu: 'Мальдивы', code: '+960', flag: '🇲🇻', format: 'XXX XXXX' },
  'ML': { name: 'Mali', nameRu: 'Мали', code: '+223', flag: '🇲🇱', format: 'XX XX XX XX' },
  'MT': { name: 'Malta', nameRu: 'Мальта', code: '+356', flag: '🇲🇹', format: 'XXXX XXXX' },
  'MR': { name: 'Mauritania', nameRu: 'Мавритания', code: '+222', flag: '🇲🇷', format: 'XX XX XX XX' },
  'MU': { name: 'Mauritius', nameRu: 'Маврикий', code: '+230', flag: '🇲🇺', format: 'XXXX XXXX' },
  'MX': { name: 'Mexico', nameRu: 'Мексика', code: '+52', flag: '🇲🇽', format: 'XX XXXX XXXX' },
  'MD': { name: 'Moldova', nameRu: 'Молдова', code: '+373', flag: '🇲🇩', format: 'XX XXX XXX' },
  'MC': { name: 'Monaco', nameRu: 'Монако', code: '+377', flag: '🇲🇨', format: 'XX XX XX XX' },
  'MN': { name: 'Mongolia', nameRu: 'Монголия', code: '+976', flag: '🇲🇳', format: 'XX XX XXXX' },
  'ME': { name: 'Montenegro', nameRu: 'Черногория', code: '+382', flag: '🇲🇪', format: 'XX XXX XXX' },
  'MA': { name: 'Morocco', nameRu: 'Марокко', code: '+212', flag: '🇲🇦', format: 'XX XXXX XXX' },
  'MZ': { name: 'Mozambique', nameRu: 'Мозамбик', code: '+258', flag: '🇲🇿', format: 'XX XXX XXXX' },
  'MM': { name: 'Myanmar', nameRu: 'Мьянма', code: '+95', flag: '🇲🇲', format: 'XX XXX XXXX' },
  'NA': { name: 'Namibia', nameRu: 'Намибия', code: '+264', flag: '🇳🇦', format: 'XX XXX XXXX' },
  'NP': { name: 'Nepal', nameRu: 'Непал', code: '+977', flag: '🇳🇵', format: 'XX XXXX XXXX' },
  'NL': { name: 'Netherlands', nameRu: 'Нидерланды', code: '+31', flag: '🇳🇱', format: 'X XXXX XXXX' },
  'NZ': { name: 'New Zealand', nameRu: 'Новая Зеландия', code: '+64', flag: '🇳🇿', format: 'XX XXX XXXX' },
  'NI': { name: 'Nicaragua', nameRu: 'Никарагуа', code: '+505', flag: '🇳🇮', format: 'XXXX XXXX' },
  'NE': { name: 'Niger', nameRu: 'Нигер', code: '+227', flag: '🇳🇪', format: 'XX XX XX XX' },
  'NG': { name: 'Nigeria', nameRu: 'Нигерия', code: '+234', flag: '🇳🇬', format: 'XXX XXX XXXX' },
  'KP': { name: 'North Korea', nameRu: 'Северная Корея', code: '+850', flag: '🇰🇵', format: 'XXX XXX XXXX' },
  'NO': { name: 'Norway', nameRu: 'Норвегия', code: '+47', flag: '🇳🇴', format: 'XXX XX XXX' },
  'OM': { name: 'Oman', nameRu: 'Оман', code: '+968', flag: '🇴🇲', format: 'XXXX XXXX' },
  'PK': { name: 'Pakistan', nameRu: 'Пакистан', code: '+92', flag: '🇵🇰', format: 'XXX XXXXXXX' },
  'PA': { name: 'Panama', nameRu: 'Панама', code: '+507', flag: '🇵🇦', format: 'XXXX XXXX' },
  'PY': { name: 'Paraguay', nameRu: 'Парагвай', code: '+595', flag: '🇵🇾', format: 'XXX XXXXXX' },
  'PE': { name: 'Peru', nameRu: 'Перу', code: '+51', flag: '🇵🇪', format: 'XXX XXX XXX' },
  'PH': { name: 'Philippines', nameRu: 'Филиппины', code: '+63', flag: '🇵🇭', format: 'XXX XXX XXXX' },
  'PL': { name: 'Poland', nameRu: 'Польша', code: '+48', flag: '🇵🇱', format: 'XXX XXX XXX' },
  'PT': { name: 'Portugal', nameRu: 'Португалия', code: '+351', flag: '🇵🇹', format: 'XX XXX XXXX' },
  'QA': { name: 'Qatar', nameRu: 'Катар', code: '+974', flag: '🇶🇦', format: 'XXXX XXXX' },
  'RO': { name: 'Romania', nameRu: 'Румыния', code: '+40', flag: '🇷🇴', format: 'XXX XXX XXX' },
  'RW': { name: 'Rwanda', nameRu: 'Руанда', code: '+250', flag: '🇷🇼', format: 'XXX XXX XXX' },
  'SA': { name: 'Saudi Arabia', nameRu: 'Саудовская Аравия', code: '+966', flag: '🇸🇦', format: 'XX XXX XXXX' },
  'SN': { name: 'Senegal', nameRu: 'Сенегал', code: '+221', flag: '🇸🇳', format: 'XX XXX XX XX' },
  'RS': { name: 'Serbia', nameRu: 'Сербия', code: '+381', flag: '🇷🇸', format: 'XX XXX XXXX' },
  'SG': { name: 'Singapore', nameRu: 'Сингапур', code: '+65', flag: '🇸🇬', format: 'XXXX XXXX' },
  'SK': { name: 'Slovakia', nameRu: 'Словакия', code: '+421', flag: '🇸🇰', format: 'XXX XXX XXX' },
  'SI': { name: 'Slovenia', nameRu: 'Словения', code: '+386', flag: '🇸🇮', format: 'XX XXX XXX' },
  'SO': { name: 'Somalia', nameRu: 'Сомали', code: '+252', flag: '🇸🇴', format: 'XX XXX XXX' },
  'ZA': { name: 'South Africa', nameRu: 'Южная Африка', code: '+27', flag: '🇿🇦', format: 'XX XXX XXXX' },
  'KR': { name: 'South Korea', nameRu: 'Южная Корея', code: '+82', flag: '🇰🇷', format: 'XX XXXX XXXX' },
  'ES': { name: 'Spain', nameRu: 'Испания', code: '+34', flag: '🇪🇸', format: 'XXX XXX XXX' },
  'LK': { name: 'Sri Lanka', nameRu: 'Шри-Ланка', code: '+94', flag: '🇱🇰', format: 'XX XXX XXXX' },
  'SD': { name: 'Sudan', nameRu: 'Судан', code: '+249', flag: '🇸🇩', format: 'XX XXX XXXX' },
  'SE': { name: 'Sweden', nameRu: 'Швеция', code: '+46', flag: '🇸🇪', format: 'XX XXX XX XX' },
  'CH': { name: 'Switzerland', nameRu: 'Швейцария', code: '+41', flag: '🇨🇭', format: 'XX XXX XX XX' },
  'SY': { name: 'Syria', nameRu: 'Сирия', code: '+963', flag: '🇸🇾', format: 'XXX XXX XXX' },
  'TW': { name: 'Taiwan', nameRu: 'Тайвань', code: '+886', flag: '🇹🇼', format: 'XXX XXX XXX' },
  'TZ': { name: 'Tanzania', nameRu: 'Танзания', code: '+255', flag: '🇹🇿', format: 'XX XXX XXXX' },
  'TH': { name: 'Thailand', nameRu: 'Таиланд', code: '+66', flag: '🇹🇭', format: 'XX XXXX XXXX' },
  'TN': { name: 'Tunisia', nameRu: 'Тунис', code: '+216', flag: '🇹🇳', format: 'XX XXX XXX' },
  'TR': { name: 'Turkey', nameRu: 'Турция', code: '+90', flag: '🇹🇷', format: 'XXX XXX XXXX' },
  'UG': { name: 'Uganda', nameRu: 'Уганда', code: '+256', flag: '🇺🇬', format: 'XXX XXXXXX' },
  'UA': { name: 'Ukraine', nameRu: 'Украина', code: '+380', flag: '🇺🇦', format: 'XX XXX XX XX' },
  'AE': { name: 'UAE', nameRu: 'ОАЭ', code: '+971', flag: '🇦🇪', format: 'XX XXX XXXX' },
  'GB': { name: 'United Kingdom', nameRu: 'Великобритания', code: '+44', flag: '🇬🇧', format: 'XXXX XXXXXX' },
  'US': { name: 'United States', nameRu: 'США', code: '+1', flag: '🇺🇸', format: 'XXX XXX XXXX' },
  'UY': { name: 'Uruguay', nameRu: 'Уругвай', code: '+598', flag: '🇺🇾', format: 'X XXX XXXX' },
  'VE': { name: 'Venezuela', nameRu: 'Венесуэла', code: '+58', flag: '🇻🇪', format: 'XXX XXX XXXX' },
  'VN': { name: 'Vietnam', nameRu: 'Вьетнам', code: '+84', flag: '🇻🇳', format: 'XX XXXX XXX' },
  'YE': { name: 'Yemen', nameRu: 'Йемен', code: '+967', flag: '🇾🇪', format: 'XXX XXX XXX' },
  'ZM': { name: 'Zambia', nameRu: 'Замбия', code: '+260', flag: '🇿🇲', format: 'XX XXX XXXX' },
  'ZW': { name: 'Zimbabwe', nameRu: 'Зимбабве', code: '+263', flag: '🇿🇼', format: 'XX XXX XXXX' },
  'AG': { name: 'Antigua and Barbuda', nameRu: 'Антигуа и Барбуда', code: '+1268', flag: '🇦🇬', format: 'XXX XXXX' },
  'BS': { name: 'Bahamas', nameRu: 'Багамы', code: '+1242', flag: '🇧🇸', format: 'XXX XXXX' },
  'BB': { name: 'Barbados', nameRu: 'Барбадос', code: '+1246', flag: '🇧🇧', format: 'XXX XXXX' },
  'BZ': { name: 'Belize', nameRu: 'Белиз', code: '+501', flag: '🇧🇿', format: 'XXX XXXX' },
  'CV': { name: 'Cape Verde', nameRu: 'Кабо-Верде', code: '+238', flag: '🇨🇻', format: 'XXX XXXX' },
  'KM': { name: 'Comoros', nameRu: 'Коморы', code: '+269', flag: '🇰🇲', format: 'XXX XXXX' },
  'DM': { name: 'Dominica', nameRu: 'Доминика', code: '+1767', flag: '🇩🇲', format: 'XXX XXXX' },
  'GQ': { name: 'Equatorial Guinea', nameRu: 'Экваториальная Гвинея', code: '+240', flag: '🇬🇶', format: 'XXX XXX XXX' },
  'ER': { name: 'Eritrea', nameRu: 'Эритрея', code: '+291', flag: '🇪🇷', format: 'X XXX XXX' },
  'SZ': { name: 'Eswatini', nameRu: 'Эсватини', code: '+268', flag: '🇸🇿', format: 'XXXX XXXX' },
  'FJ': { name: 'Fiji', nameRu: 'Фиджи', code: '+679', flag: '🇫🇯', format: 'XXX XXXX' },
  'GD': { name: 'Grenada', nameRu: 'Гренада', code: '+1473', flag: '🇬🇩', format: 'XXX XXXX' },
  'GW': { name: 'Guinea-Bissau', nameRu: 'Гвинея-Бисау', code: '+245', flag: '🇬🇼', format: 'XXX XXXX' },
  'GY': { name: 'Guyana', nameRu: 'Гайана', code: '+592', flag: '🇬🇾', format: 'XXX XXXX' },
  'KI': { name: 'Kiribati', nameRu: 'Кирибати', code: '+686', flag: '🇰🇮', format: 'XXXX XXXX' },
  'XK': { name: 'Kosovo', nameRu: 'Косово', code: '+383', flag: '🇽🇰', format: 'XX XXX XXX' },
  'LS': { name: 'Lesotho', nameRu: 'Лесото', code: '+266', flag: '🇱🇸', format: 'XXXX XXXX' },
  'LR': { name: 'Liberia', nameRu: 'Либерия', code: '+231', flag: '🇱🇷', format: 'XXX XXX XXXX' },
  'MH': { name: 'Marshall Islands', nameRu: 'Маршалловы Острова', code: '+692', flag: '🇲🇭', format: 'XXX XXXX' },
  'FM': { name: 'Micronesia', nameRu: 'Микронезия', code: '+691', flag: '🇫🇲', format: 'XXX XXXX' },
  'NR': { name: 'Nauru', nameRu: 'Науру', code: '+674', flag: '🇳🇷', format: 'XXX XXXX' },
  'PW': { name: 'Palau', nameRu: 'Палау', code: '+680', flag: '🇵🇼', format: 'XXX XXXX' },
  'PS': { name: 'Palestine', nameRu: 'Палестина', code: '+970', flag: '🇵🇸', format: 'XX XXX XXXX' },
  'PG': { name: 'Papua New Guinea', nameRu: 'Папуа-Новая Гвинея', code: '+675', flag: '🇵🇬', format: 'XXX XXXX' },
  'KN': { name: 'Saint Kitts and Nevis', nameRu: 'Сент-Китс и Невис', code: '+1869', flag: '🇰🇳', format: 'XXX XXXX' },
  'LC': { name: 'Saint Lucia', nameRu: 'Сент-Люсия', code: '+1758', flag: '🇱🇨', format: 'XXX XXXX' },
  'VC': { name: 'Saint Vincent', nameRu: 'Сент-Винсент', code: '+1784', flag: '🇻🇨', format: 'XXX XXXX' },
  'WS': { name: 'Samoa', nameRu: 'Самоа', code: '+685', flag: '🇼🇸', format: 'XX XXXXX' },
  'SM': { name: 'San Marino', nameRu: 'Сан-Марино', code: '+378', flag: '🇸🇲', format: 'XXX XXX XXXX' },
  'ST': { name: 'São Tomé and Príncipe', nameRu: 'Сан-Томе и Принсипи', code: '+239', flag: '🇸🇹', format: 'XXX XXXX' },
  'SC': { name: 'Seychelles', nameRu: 'Сейшелы', code: '+248', flag: '🇸🇨', format: 'X XXX XXX' },
  'SL': { name: 'Sierra Leone', nameRu: 'Сьерра-Леоне', code: '+232', flag: '🇸🇱', format: 'XX XXX XXX' },
  'SB': { name: 'Solomon Islands', nameRu: 'Соломоновы Острова', code: '+677', flag: '🇸🇧', format: 'XX XXXXX' },
  'SS': { name: 'South Sudan', nameRu: 'Южный Судан', code: '+211', flag: '🇸🇸', format: 'XX XXX XXXX' },
  'SR': { name: 'Suriname', nameRu: 'Суринам', code: '+597', flag: '🇸🇷', format: 'XXX XXXX' },
  'TL': { name: 'Timor-Leste', nameRu: 'Восточный Тимор', code: '+670', flag: '🇹🇱', format: 'XXXX XXXX' },
  'TG': { name: 'Togo', nameRu: 'Того', code: '+228', flag: '🇹🇬', format: 'XX XX XX XX' },
  'TO': { name: 'Tonga', nameRu: 'Тонга', code: '+676', flag: '🇹🇴', format: 'XXX XXXX' },
  'TT': { name: 'Trinidad and Tobago', nameRu: 'Тринидад и Тобаго', code: '+1868', flag: '🇹🇹', format: 'XXX XXXX' },
  'TV': { name: 'Tuvalu', nameRu: 'Тувалу', code: '+688', flag: '🇹🇻', format: 'XXXXX' },
  'VU': { name: 'Vanuatu', nameRu: 'Вануату', code: '+678', flag: '🇻🇺', format: 'XXX XXXX' },
  'VA': { name: 'Vatican City', nameRu: 'Ватикан', code: '+379', flag: '🇻🇦', format: 'XX XXXX XXXX' },
  'PR': { name: 'Puerto Rico', nameRu: 'Пуэрто-Рико', code: '+1787', flag: '🇵🇷', format: 'XXX XXXX' },
};

const PRIORITY_COUNTRIES = ['TJ', 'UZ', 'KG', 'KZ', 'TM', 'RU'];

// Самодостаточные стили компонента — внедряются один раз.
// Все правила scoped под [data-phone-selector], поэтому компонент
// работает на ЛЮБОЙ странице (даже без Tailwind) и ничего не ломает.
function injectPhoneSelectorStyles() {
  if (document.getElementById('phone-country-selector-styles')) return;
  const style = document.createElement('style');
  style.id = 'phone-country-selector-styles';
  style.textContent = `
    [data-phone-selector] .hidden { display: none !important; }
    [data-phone-selector] .flex { display: flex; }
    [data-phone-selector] .items-center { align-items: center; }
    [data-phone-selector] .gap-1 { gap: 0.25rem; }
    [data-phone-selector] .gap-2 { gap: 0.5rem; }
    [data-phone-selector] .relative { position: relative; }
    [data-phone-selector] .absolute { position: absolute; }
    [data-phone-selector] .sticky { position: sticky; }
    [data-phone-selector] .top-full { top: 100%; }
    [data-phone-selector] .top-0 { top: 0; }
    [data-phone-selector] .mt-1 { margin-top: 0.25rem; }
    [data-phone-selector] .my-1 { margin-top: 0.25rem; margin-bottom: 0.25rem; }
    [data-phone-selector] .ml-0\\.5 { margin-left: 0.125rem; }
    [data-phone-selector] .ml-1 { margin-left: 0.25rem; }
    [data-phone-selector] .z-50 { z-index: 50; }
    [data-phone-selector] .bg-white { background-color: #ffffff; }
    [data-phone-selector] .border { border-width: 1px; border-style: solid; border-color: #d1d5db; }
    [data-phone-selector] .border-t { border-top-width: 1px; border-top-style: solid; }
    [data-phone-selector] .border-b { border-bottom-width: 1px; border-bottom-style: solid; }
    [data-phone-selector] .border-gray-300 { border-color: #d1d5db; }
    [data-phone-selector] .border-gray-200 { border-color: #e5e7eb; }
    [data-phone-selector] .rounded-lg { border-radius: 0.5rem; }
    [data-phone-selector] .rounded-md { border-radius: 0.375rem; }
    [data-phone-selector] .rounded-t-lg { border-top-left-radius: 0.5rem; border-top-right-radius: 0.5rem; }
    [data-phone-selector] .shadow-lg { box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1); }
    [data-phone-selector] .p-2 { padding: 0.5rem; }
    [data-phone-selector] .px-2 { padding-left: 0.5rem; padding-right: 0.5rem; }
    [data-phone-selector] .px-3 { padding-left: 0.75rem; padding-right: 0.75rem; }
    [data-phone-selector] .px-4 { padding-left: 1rem; padding-right: 1rem; }
    [data-phone-selector] .py-2 { padding-top: 0.5rem; padding-bottom: 0.5rem; }
    [data-phone-selector] .py-1\\.5 { padding-top: 0.375rem; padding-bottom: 0.375rem; }
    [data-phone-selector] .w-full { width: 100%; }
    [data-phone-selector] .w-3 { width: 0.75rem; }
    [data-phone-selector] .h-3 { height: 0.75rem; }
    [data-phone-selector] .flex-1 { flex: 1 1 0%; }
    [data-phone-selector] .flex-shrink-0 { flex-shrink: 0; }
    [data-phone-selector] .truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    [data-phone-selector] .text-sm { font-size: 0.875rem; line-height: 1.25rem; }
    [data-phone-selector] .text-left { text-align: left; }
    [data-phone-selector] .text-center { text-align: center; }
    [data-phone-selector] .font-medium { font-weight: 500; }
    [data-phone-selector] .whitespace-nowrap { white-space: nowrap; }
    [data-phone-selector] .text-gray-500 { color: #6b7280; }
    [data-phone-selector] .text-gray-400 { color: #9ca3af; }
    [data-phone-selector] .outline-none { outline: 2px solid transparent; outline-offset: 2px; }
    [data-phone-selector] .hover\\:bg-gray-50:hover { background-color: #f9fafb; }
    [data-phone-selector] .hover\\:bg-gray-100:hover { background-color: #f3f4f6; }
    [data-phone-selector] .focus\\:ring-1:focus { box-shadow: 0 0 0 1px #9ca3af; }
    [data-phone-selector] .focus\\:ring-2:focus { box-shadow: 0 0 0 2px #9ca3af; }
    [data-phone-selector] .focus\\:border-gray-400:focus { border-color: #9ca3af; }
    [data-phone-selector] .focus\\:border-transparent:focus { border-color: transparent; }
    [data-phone-selector] button { background: none; cursor: pointer; font-family: inherit; }
    [data-phone-selector] input { font-family: inherit; }
    @media (min-width: 640px) {
      [data-phone-selector] .sm\\:gap-2 { gap: 0.5rem; }
      [data-phone-selector] .sm\\:px-3 { padding-left: 0.75rem; padding-right: 0.75rem; }
      [data-phone-selector] .sm\\:px-4 { padding-left: 1rem; padding-right: 1rem; }
    }
  `;
  document.head.appendChild(style);
}

class PhoneCountrySelector {
  constructor(containerId, defaultCountry = 'TJ') {
    this.containerId = containerId;
    this.defaultCountry = defaultCountry;
    this.selectedCountry = defaultCountry;
    this.isOpen = false;
    injectPhoneSelectorStyles();
    this.init();
  }

  getSortedCountries() {
    const entries = Object.entries(PHONE_COUNTRY_CODES);
    const priority = entries.filter(([code]) => PRIORITY_COUNTRIES.includes(code));
    const rest = entries.filter(([code]) => !PRIORITY_COUNTRIES.includes(code));
    rest.sort((a, b) => a[1].name.localeCompare(b[1].name));
    return { priority, rest };
  }

  renderCountryList(filter = '') {
    const { priority, rest } = this.getSortedCountries();
    const lang = window.currentLanguage || 'en';
    const lowerFilter = filter.toLowerCase();

    const matchesFilter = ([code, data]) => {
      if (!lowerFilter) return true;
      return data.name.toLowerCase().includes(lowerFilter) ||
             data.nameRu.toLowerCase().includes(lowerFilter) ||
             data.code.includes(lowerFilter) ||
             code.toLowerCase().includes(lowerFilter);
    };

    const filteredPriority = priority.filter(matchesFilter);
    const filteredRest = rest.filter(matchesFilter);

    const renderItem = ([code, data]) => {
      const displayName = lang === 'ru' ? data.nameRu : data.name;
      return `
        <button type="button" class="phone-country-item w-full text-left px-3 py-2 hover:bg-gray-100 flex items-center gap-2" data-country="${code}" style="font-size: 0.875rem;">
          <span style="font-size: 1.25rem; line-height: 1; flex-shrink: 0;">${data.flag}</span>
          <span class="flex-1 truncate">${displayName}</span>
          <span class="text-gray-500 flex-shrink-0">${data.code}</span>
        </button>
      `;
    };

    let html = '';
    if (filteredPriority.length > 0) {
      html += filteredPriority.map(renderItem).join('');
      if (filteredRest.length > 0) {
        html += '<div class="border-t border-gray-200 my-1"></div>';
      }
    }
    html += filteredRest.map(renderItem).join('');

    if (!html) {
      const noResults = lang === 'ru' ? 'Не найдено' : 'Not found';
      html = `<div class="px-3 py-2 text-gray-400 text-sm text-center">${noResults}</div>`;
    }

    return html;
  }

  getMaxDigits() {
    const data = PHONE_COUNTRY_CODES[this.selectedCountry];
    return (data.format.match(/X/g) || []).length;
  }

  updateHint(currentLen, maxLen) {
    const hint = document.getElementById(`${this.containerId}-hint`);
    if (!hint) return;
    const lang = window.currentLanguage || 'en';

    if (currentLen === 0) {
      hint.style.display = 'none';
      return;
    }

    if (currentLen < maxLen) {
      hint.style.display = 'block';
      hint.style.color = '#EF4444';
      const remaining = maxLen - currentLen;
      hint.textContent = lang === 'ru'
        ? `Введите ещё ${remaining} цифр${remaining === 1 ? 'у' : (remaining < 5 ? 'ы' : '')}`
        : `Enter ${remaining} more digit${remaining === 1 ? '' : 's'}`;
    } else {
      hint.style.display = 'block';
      hint.style.color = '#10B981';
      hint.textContent = lang === 'ru' ? '✓ Номер введён верно' : '✓ Phone number is correct';
      setTimeout(() => { hint.style.display = 'none'; }, 2000);
    }
  }

  init() {
    const container = document.getElementById(this.containerId);
    if (!container) return;

    const defaultData = PHONE_COUNTRY_CODES[this.defaultCountry];
    const lang = window.currentLanguage || 'en';
    const searchPlaceholder = lang === 'ru' ? 'Поиск страны...' : 'Search country...';
    const defaultMax = (defaultData.format.match(/X/g) || []).length;

    const html = `
      <div style="width: 100%;">
        <div class="flex items-center gap-1 sm:gap-2" style="width: 100%;">
          <div class="relative" style="flex-shrink: 0;">
            <button id="${this.containerId}-button" type="button" class="flex items-center gap-1 px-2 sm:px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm font-medium whitespace-nowrap hover:bg-gray-50" style="min-width: 70px;">
              <span style="font-size: 1.125rem; line-height: 1;">${defaultData.flag}</span>
              <span>${defaultData.code}</span>
              <svg class="w-3 h-3 ml-0.5 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
            </button>
            <div id="${this.containerId}-dropdown" class="hidden absolute top-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-50" style="width: min(320px, calc(100vw - 32px)); left: 0;">
              <div class="p-2 border-b border-gray-200 sticky top-0 bg-white rounded-t-lg">
                <input type="text" id="${this.containerId}-search" 
                  class="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-gray-400 focus:border-gray-400 outline-none"
                  placeholder="${searchPlaceholder}" autocomplete="off">
              </div>
              <div id="${this.containerId}-list" style="max-height: 250px; overflow-y: auto;">
                ${this.renderCountryList()}
              </div>
            </div>
          </div>
          <input type="tel" id="${this.containerId}-input" 
            class="px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-transparent" 
            placeholder="${defaultData.format}"
            inputmode="numeric"
            maxlength="${defaultMax}"
            style="flex: 1; min-width: 0; width: 100%;">
        </div>
        <div id="${this.containerId}-hint" style="display: none; font-size: 0.75rem; margin-top: 4px; padding-left: 2px; transition: color 0.2s;"></div>
      </div>
    `;

    container.innerHTML = html;

    const button = document.getElementById(`${this.containerId}-button`);
    const dropdown = document.getElementById(`${this.containerId}-dropdown`);
    const input = document.getElementById(`${this.containerId}-input`);
    const searchInput = document.getElementById(`${this.containerId}-search`);
    const listContainer = document.getElementById(`${this.containerId}-list`);

    if (!button || !dropdown || !input || !searchInput || !listContainer) return;

    button.addEventListener('click', (e) => {
      e.stopPropagation();
      this.isOpen = !this.isOpen;
      dropdown.classList.toggle('hidden', !this.isOpen);
      if (this.isOpen) {
        searchInput.value = '';
        listContainer.innerHTML = this.renderCountryList();
        this.attachCountryListeners(listContainer, button, dropdown, input);
        setTimeout(() => searchInput.focus(), 50);
      }
    });

    searchInput.addEventListener('input', (e) => {
      e.stopPropagation();
      const filter = e.target.value;
      listContainer.innerHTML = this.renderCountryList(filter);
      this.attachCountryListeners(listContainer, button, dropdown, input);
    });

    searchInput.addEventListener('click', (e) => e.stopPropagation());
    searchInput.addEventListener('keydown', (e) => e.stopPropagation());
    dropdown.addEventListener('click', (e) => e.stopPropagation());

    document.addEventListener('click', () => {
      if (this.isOpen) {
        this.isOpen = false;
        dropdown.classList.add('hidden');
      }
    });

    input.addEventListener('input', (e) => {
      const digits = e.target.value.replace(/\D/g, '');
      const maxLen = this.getMaxDigits();
      // Обрезаем до максимума
      const clamped = digits.slice(0, maxLen);
      e.target.value = clamped;
      this.updateHint(clamped.length, maxLen);
    });
  }

  attachCountryListeners(listContainer, button, dropdown, input) {
    listContainer.querySelectorAll('.phone-country-item').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const countryCode = btn.getAttribute('data-country');
        this.selectedCountry = countryCode;

        const data = PHONE_COUNTRY_CODES[countryCode];
        button.innerHTML = `<span style="font-size: 1.25rem; line-height: 1;">${data.flag}</span><span>${data.code}</span><svg class="w-3 h-3 ml-1 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>`;

        input.placeholder = data.format;

        // Обновляем maxlength под новую страну
        const newMax = this.getMaxDigits();
        input.maxLength = newMax;

        // Обрезаем уже введённый номер если он длиннее
        const current = input.value.replace(/\D/g, '');
        const clamped = current.slice(0, newMax);
        input.value = clamped;

        // Сбрасываем подсказку
        const hint = document.getElementById(`${this.containerId}-hint`);
        if (hint) hint.style.display = 'none';

        this.isOpen = false;
        dropdown.classList.add('hidden');
        input.focus();
      });
    });
  }

  getFullPhoneNumber() {
    const input = document.getElementById(`${this.containerId}-input`);
    if (!input) return '';
    
    const countryCode = PHONE_COUNTRY_CODES[this.selectedCountry]?.code || '';
    const phoneNumber = input.value.trim();
    
    return `${countryCode} ${phoneNumber}`.trim();
  }

  getPhoneData() {
    const input = document.getElementById(`${this.containerId}-input`);
    
    if (!input) return { country: '', code: '', number: '', full: '' };
    
    const countryCode = this.selectedCountry;
    const data = PHONE_COUNTRY_CODES[countryCode];
    
    return {
      country: countryCode,
      countryName: data.name,
      code: data.code,
      number: input.value.trim(),
      full: `${data.code} ${input.value.trim()}`.trim()
    };
  }

  setPhoneNumber(fullNumber) {
    const input = document.getElementById(`${this.containerId}-input`);
    const button = document.getElementById(`${this.containerId}-button`);
    
    if (!input || !button) return;

    let foundCountry = null;
    let numberPart = fullNumber;

    const sortedEntries = Object.entries(PHONE_COUNTRY_CODES).sort((a, b) => b[1].code.length - a[1].code.length);

    for (const [code, data] of sortedEntries) {
      if (fullNumber.startsWith(data.code)) {
        foundCountry = code;
        numberPart = fullNumber.slice(data.code.length).trim();
        break;
      }
    }

    if (foundCountry) {
      this.selectedCountry = foundCountry;
      const data = PHONE_COUNTRY_CODES[foundCountry];
      button.innerHTML = `<span style="font-size: 1.25rem; line-height: 1;">${data.flag}</span><span>${data.code}</span><svg class="w-3 h-3 ml-1 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>`;
      input.placeholder = data.format;
    }
    
    input.value = numberPart.replace(/\D/g, '');
  }
}

// Глобальный реестр инстансов селекторов — доступен как window.phoneSelectors['containerId']
window.phoneSelectors = window.phoneSelectors || {};

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-phone-selector]').forEach(el => {
    const defaultCountry = el.getAttribute('data-default-country') || 'TJ';
    const instance = new PhoneCountrySelector(el.id, defaultCountry);
    window.phoneSelectors[el.id] = instance;
  });
});

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PhoneCountrySelector;
}
