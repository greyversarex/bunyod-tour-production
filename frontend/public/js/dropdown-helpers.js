/**
 * DROPDOWN HELPERS
 * Универсальные функции для работы с выпадающими списками
 * Убирает дублирование кода загрузки стран/городов (было 4 копии функций)
 */

/**
 * Универсальная загрузка стран в select
 * @param {string} selectId - ID элемента <select>
 * @param {number|null} selectedId - ID выбранной страны (для edit режима)
 * @param {string} lang - Язык интерфейса ('ru' или 'en')
 */
async function loadCountriesDropdown(selectId, selectedId = null, lang = 'ru') {
  try {
    const response = await fetch('/api/countries', {
      headers: getAuthHeaders(false)
    });
    
    const data = await response.json();
    const select = document.getElementById(selectId);
    
    if (!select) {
      console.error(`Select element with id "${selectId}" not found`);
      return;
    }
    
    // Очищаем select
    select.innerHTML = '<option value="">Выберите страну</option>';
    
    // Заполняем опциями
    if (data.success && data.data) {
      data.data.forEach(country => {
        const option = document.createElement('option');
        option.value = country.id;
        
        // Используем нужный язык или fallback (с безопасной установкой текста)
        const displayName = lang === 'en' && country.nameEn ? 
          country.nameEn : 
          country.nameRu || country.name;
        
        // ✅ Используем safeSetText для защиты от XSS
        if (window.safeSetText) {
          safeSetText(option, displayName);
        } else {
          option.textContent = displayName;
        }
        
        // Выбираем если это редактирование
        if (selectedId && country.id === parseInt(selectedId)) {
          option.selected = true;
        }
        
        select.appendChild(option);
      });
      
      console.log(`✅ Loaded ${data.data.length} countries into #${selectId}`);
    }
  } catch (error) {
    console.error('Error loading countries:', error);
    alert('Ошибка загрузки стран');
  }
}

/**
 * Универсальная загрузка городов по стране в select
 * @param {string} selectId - ID элемента <select>
 * @param {number} countryId - ID страны
 * @param {number|null} selectedId - ID выбранного города (для edit режима)
 * @param {string} lang - Язык интерфейса ('ru' или 'en')
 */
async function loadCitiesDropdown(selectId, countryId, selectedId = null, lang = 'ru') {
  try {
    const select = document.getElementById(selectId);
    
    if (!select) {
      console.error(`Select element with id "${selectId}" not found`);
      return;
    }
    
    // Очищаем select
    select.innerHTML = '<option value="">Выберите город</option>';
    
    if (!countryId) {
      console.log('No country selected, cities list cleared');
      return;
    }
    
    const response = await fetch(`/api/cities/country/${countryId}`, {
      headers: getAuthHeaders(false)
    });
    
    const data = await response.json();
    
    // Заполняем опциями
    if (data.success && data.data) {
      data.data.forEach(city => {
        const option = document.createElement('option');
        option.value = city.id;
        
        // Используем нужный язык или fallback (с безопасной установкой текста)
        const displayName = lang === 'en' && city.nameEn ? 
          city.nameEn : 
          city.nameRu || city.name;
        
        // ✅ Используем safeSetText для защиты от XSS
        if (window.safeSetText) {
          safeSetText(option, displayName);
        } else {
          option.textContent = displayName;
        }
        
        // Выбираем если это редактирование
        if (selectedId && city.id === parseInt(selectedId)) {
          option.selected = true;
        }
        
        select.appendChild(option);
      });
      
      console.log(`✅ Loaded ${data.data.length} cities for country ${countryId} into #${selectId}`);
    }
  } catch (error) {
    console.error('Error loading cities:', error);
    alert('Ошибка загрузки городов');
  }
}

/**
 * Настройка каскадных dropdown'ов Страна → Город
 * @param {Object} config - Конфигурация
 * @param {string} config.countrySelectId - ID select страны
 * @param {string} config.citySelectId - ID select города
 * @param {number|null} config.selectedCountryId - Предварительно выбранная страна
 * @param {number|null} config.selectedCityId - Предварительно выбранный город
 * @param {string} config.lang - Язык ('ru' или 'en')
 */
async function setupCountryCityDropdowns(config) {
  const {
    countrySelectId,
    citySelectId,
    selectedCountryId = null,
    selectedCityId = null,
    lang = 'ru'
  } = config;
  
  // 1. Загружаем страны
  await loadCountriesDropdown(countrySelectId, selectedCountryId, lang);
  
  // 2. Если есть выбранная страна, загружаем города
  if (selectedCountryId) {
    await loadCitiesDropdown(citySelectId, selectedCountryId, selectedCityId, lang);
  }
  
  // 3. Настраиваем обработчик изменения страны
  const countrySelect = document.getElementById(countrySelectId);
  if (countrySelect) {
    countrySelect.addEventListener('change', (e) => {
      const countryId = e.target.value;
      if (countryId) {
        loadCitiesDropdown(citySelectId, parseInt(countryId), null, lang);
      } else {
        // Очищаем города если страна не выбрана
        const citySelect = document.getElementById(citySelectId);
        if (citySelect) {
          citySelect.innerHTML = '<option value="">Выберите город</option>';
        }
      }
    });
  }
  
  console.log(`✅ Country-City dropdowns configured: ${countrySelectId} → ${citySelectId}`);
}

/**
 * Загрузка категорий туров
 * @param {string} selectId - ID элемента <select>
 * @param {number|null} selectedId - ID выбранной категории
 * @param {string} lang - Язык интерфейса
 */
async function loadCategoriesDropdown(selectId, selectedId = null, lang = 'ru') {
  try {
    const response = await fetch('/api/categories', {
      headers: getAuthHeaders(false)
    });
    
    const data = await response.json();
    const select = document.getElementById(selectId);
    
    if (!select) {
      console.error(`Select element with id "${selectId}" not found`);
      return;
    }
    
    // Очищаем select
    select.innerHTML = '<option value="">Выберите категорию</option>';
    
    // Заполняем опциями
    if (data.success && data.data) {
      data.data.forEach(category => {
        const option = document.createElement('option');
        option.value = category.id;
        
        // Парсим многоязычное название
        let categoryName = category.name;
        if (typeof categoryName === 'string') {
          try {
            const parsed = JSON.parse(categoryName);
            categoryName = parsed[lang] || parsed.ru || categoryName;
          } catch {
            categoryName = category.name;
          }
        } else if (typeof categoryName === 'object') {
          categoryName = categoryName[lang] || categoryName.ru || 'Без названия';
        }
        
        // ✅ Используем safeSetText для защиты от XSS
        if (window.safeSetText) {
          safeSetText(option, categoryName);
        } else {
          option.textContent = categoryName;
        }
        
        // Выбираем если это редактирование
        if (selectedId && category.id === parseInt(selectedId)) {
          option.selected = true;
        }
        
        select.appendChild(option);
      });
      
      console.log(`✅ Loaded ${data.data.length} categories into #${selectId}`);
    }
  } catch (error) {
    console.error('Error loading categories:', error);
    alert('Ошибка загрузки категорий');
  }
}

/**
 * Загрузка отелей для привязки к туру
 * @param {string} selectId - ID элемента <select>
 * @param {Array} selectedIds - Массив ID выбранных отелей
 * @param {string} lang - Язык интерфейса
 */
async function loadHotelsDropdown(selectId, selectedIds = [], lang = 'ru') {
  try {
    const response = await fetch('/api/hotels', {
      headers: getAuthHeaders(false)
    });
    
    const data = await response.json();
    const select = document.getElementById(selectId);
    
    if (!select) {
      console.error(`Select element with id "${selectId}" not found`);
      return;
    }
    
    // Очищаем select
    select.innerHTML = '';
    
    // Заполняем опциями
    if (data.success && data.data) {
      data.data.forEach(hotel => {
        const option = document.createElement('option');
        option.value = hotel.id;
        
        // Парсим многоязычное название
        let hotelName = hotel.name;
        if (typeof hotelName === 'string') {
          try {
            const parsed = JSON.parse(hotelName);
            hotelName = parsed[lang] || parsed.ru || hotelName;
          } catch {
            hotelName = hotel.name;
          }
        } else if (typeof hotelName === 'object') {
          hotelName = hotelName[lang] || hotelName.ru || 'Без названия';
        }
        
        // ✅ Используем safeSetText для защиты от XSS
        if (window.safeSetText) {
          safeSetText(option, hotelName);
        } else {
          option.textContent = hotelName;
        }
        
        // Выбираем если это редактирование
        if (selectedIds.includes(hotel.id)) {
          option.selected = true;
        }
        
        select.appendChild(option);
      });
      
      console.log(`✅ Loaded ${data.data.length} hotels into #${selectId}`);
    }
  } catch (error) {
    console.error('Error loading hotels:', error);
    alert('Ошибка загрузки отелей');
  }
}

/**
 * Загрузка гидов для привязки к туру
 * @param {string} selectId - ID элемента <select>
 * @param {Array} selectedIds - Массив ID выбранных гидов
 * @param {string} lang - Язык интерфейса
 */
async function loadGuidesDropdown(selectId, selectedIds = [], lang = 'ru') {
  try {
    const response = await fetch('/api/guides?includeRaw=true', {
      headers: getAuthHeaders(false)
    });
    
    const data = await response.json();
    const select = document.getElementById(selectId);
    
    if (!select) {
      console.error(`Select element with id "${selectId}" not found`);
      return;
    }
    
    // Очищаем select
    select.innerHTML = '';
    
    // Заполняем опциями
    if (data.success && data.data) {
      data.data.forEach(guide => {
        const option = document.createElement('option');
        option.value = guide.id;
        
        // Используем локализованное имя
        let guideName = guide._localized?.name || 'Без имени';
        
        // ✅ Используем safeSetText для защиты от XSS
        if (window.safeSetText) {
          safeSetText(option, guideName);
        } else {
          option.textContent = guideName;
        }
        
        // Выбираем если это редактирование
        if (selectedIds.includes(guide.id)) {
          option.selected = true;
        }
        
        select.appendChild(option);
      });
      
      console.log(`✅ Loaded ${data.data.length} guides into #${selectId}`);
    }
  } catch (error) {
    console.error('Error loading guides:', error);
    alert('Ошибка загрузки гидов');
  }
}

/**
 * Заполнение multiple select выбранными значениями
 * @param {string} selectId - ID элемента <select>
 * @param {Array} selectedIds - Массив ID для выбора
 */
function setMultipleSelectValues(selectId, selectedIds = []) {
  const select = document.getElementById(selectId);
  if (!select) return;
  
  const options = select.options;
  for (let i = 0; i < options.length; i++) {
    options[i].selected = selectedIds.includes(parseInt(options[i].value));
  }
}

// Экспортируем в глобальную область
window.loadCountriesDropdown = loadCountriesDropdown;
window.loadCitiesDropdown = loadCitiesDropdown;
window.setupCountryCityDropdowns = setupCountryCityDropdowns;
window.loadCategoriesDropdown = loadCategoriesDropdown;
window.loadHotelsDropdown = loadHotelsDropdown;
window.loadGuidesDropdown = loadGuidesDropdown;
window.setMultipleSelectValues = setMultipleSelectValues;
