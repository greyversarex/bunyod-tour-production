// Custom Tour Cities Management
// This module handles the cities management for custom tours

let currentCityCountryId = null;

// Initialize tab switching for all custom tour sections
document.addEventListener('DOMContentLoaded', function() {
    // Setup tab click handlers
    document.querySelectorAll('.custom-tour-tab').forEach(tab => {
        tab.addEventListener('click', function(e) {
            e.preventDefault();
            const tabType = this.getAttribute('data-tab');
            const country = this.getAttribute('data-country');
            
            switchCustomTourTab(country, tabType);
        });
    });
});

// Switch between Components and Cities tabs
function switchCustomTourTab(country, tabType) {
    // Update tab buttons
    const tabs = document.querySelectorAll(`[data-country="${country}"].custom-tour-tab`);
    tabs.forEach(tab => {
        tab.classList.remove('active', 'text-gray-700', 'border-gray-800');
        tab.classList.add('text-gray-500', 'border-transparent');
    });
    
    const activeTab = document.querySelector(`[data-country="${country}"][data-tab="${tabType}"]`);
    if (activeTab) {
        activeTab.classList.add('active', 'text-gray-700', 'border-gray-800');
        activeTab.classList.remove('text-gray-500', 'border-transparent');
    }
    
    // Hide all tab contents for this country
    const componentsTab = document.getElementById(`components-tab-${country}`);
    const citiesTab = document.getElementById(`cities-tab-${country}`);
    
    if (componentsTab) componentsTab.style.display = 'none';
    if (citiesTab) citiesTab.style.display = 'none';
    
    // Show the selected tab content
    if (tabType === 'components' && componentsTab) {
        componentsTab.style.display = 'block';
    } else if (tabType === 'cities' && citiesTab) {
        citiesTab.style.display = 'block';
        // Load cities data when tab is opened
        const countryId = getCountryIdByName(country);
        if (countryId) {
            loadCustomTourCities(countryId, country);
        }
    }
}

// Map country name to ID
function getCountryIdByName(countryName) {
    const mapping = {
        'tajikistan': 1,
        'uzbekistan': 2,
        'kyrgyzstan': 3,
        'turkmenistan': 4,
        'kazakhstan': 5
    };
    return mapping[countryName] || null;
}

// Load custom tour cities for a country
async function loadCustomTourCities(countryId, country) {
    currentCityCountryId = countryId;
    console.log(`🏙️ Loading custom tour cities for country ${countryId}`);
    
    const container = document.getElementById(`customTourCities${capitalizeFirst(country)}`);
    if (!container) {
        console.error(`Container not found: customTourCities${capitalizeFirst(country)}`);
        return;
    }
    
    container.innerHTML = `
        <div class="flex justify-center items-center py-12">
            <i class="fas fa-spinner fa-spin text-3xl text-gray-400 mr-3"></i>
            <span class="text-gray-500">Загрузка городов...</span>
        </div>
    `;
    
    try {
        const response = await fetch(`${getApiUrl()}/custom-tour/admin/countries/${countryId}/cities`, {
            headers: getAuthHeaders()
        });
        
        const data = await response.json();
        
        if (data.success) {
            console.log(`✅ Loaded ${data.data.length} custom tour cities for country ${countryId}`);
            renderCitiesTable(data.data, country, countryId);
        } else {
            container.innerHTML = `<div class="text-center py-8 text-red-600">Ошибка: ${data.message}</div>`;
        }
    } catch (error) {
        console.error('Error loading custom tour cities:', error);
        container.innerHTML = `<div class="text-center py-8 text-red-600">Ошибка загрузки данных</div>`;
    }
}

// Render cities table with form
function renderCitiesTable(cities, country, countryId) {
    const container = document.getElementById(`customTourCities${capitalizeFirst(country)}`);
    if (!container) return;
    
    let html = `
        <!-- Add City Form -->
        <div class="bg-gray-50 rounded-lg p-6 mb-6">
            <h3 class="text-lg font-semibold mb-4">Добавить город</h3>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Город</label>
                    <select id="newCitySelect_${country}" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-600 focus:border-transparent">
                        <option value="">Выберите город...</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Количество дней</label>
                    <input type="number" id="newCityDays_${country}" min="1" value="1" 
                        class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-600 focus:border-transparent" 
                        placeholder="Введите количество дней">
                </div>
                <div class="flex items-end">
                    <button onclick="addCustomTourCity('${country}', ${countryId})" 
                        class="w-full px-6 py-2 bg-gray-800 hover:bg-gray-700 text-white font-semibold rounded-lg transition-colors">
                        <i class="fas fa-plus mr-2"></i>Добавить
                    </button>
                </div>
            </div>
        </div>
        
        <!-- Cities Table -->
        <div class="overflow-x-auto">
            <table class="min-w-full bg-white border border-gray-200 rounded-lg">
                <thead class="bg-gray-50">
                    <tr>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Город</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Количество дней</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Статус</th>
                        <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Действия</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-200">
    `;
    
    if (cities.length === 0) {
        html += `
            <tr>
                <td colspan="4" class="px-6 py-8 text-center text-gray-500">
                    <i class="fas fa-city text-3xl mb-2"></i>
                    <p>Города пока не добавлены</p>
                </td>
            </tr>
        `;
    } else {
        cities.forEach(city => {
            html += `
                <tr>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <div class="flex items-center">
                            <i class="fas fa-city text-gray-400 mr-2"></i>
                            <span class="font-medium text-gray-900">${city.city.nameRu}</span>
                            <span class="ml-2 text-sm text-gray-500">(${city.city.nameEn})</span>
                        </div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <span class="text-2xl font-bold text-gray-900">${city.daysCount}</span>
                        <span class="text-sm text-gray-500 ml-1">${city.daysCount === 1 ? 'день' : city.daysCount < 5 ? 'дня' : 'дней'}</span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <span class="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${city.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                            ${city.isActive ? 'Активен' : 'Неактивен'}
                        </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button onclick="editCustomTourCity(${city.id}, '${country}')" 
                            class="text-blue-600 hover:text-blue-900 mr-3">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button onclick="toggleCityStatus(${city.id}, ${!city.isActive}, '${country}', ${countryId})" 
                            class="text-yellow-600 hover:text-yellow-900 mr-3">
                            <i class="fas fa-${city.isActive ? 'eye-slash' : 'eye'}"></i>
                        </button>
                        <button onclick="deleteCustomTourCity(${city.id}, '${country}', ${countryId})" 
                            class="text-red-600 hover:text-red-900">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        });
    }
    
    html += `
                </tbody>
            </table>
        </div>
    `;
    
    container.innerHTML = html;
    
    // Load cities for dropdown
    loadCitiesForDropdown(countryId, country);
}

// Load cities for dropdown (all cities in the country)
async function loadCitiesForDropdown(countryId, country) {
    try {
        const response = await fetch(`${getApiUrl()}/cities/country/${countryId}`);
        const data = await response.json();
        
        if (data.success) {
            const select = document.getElementById(`newCitySelect_${country}`);
            if (select) {
                select.innerHTML = '<option value="">Выберите город...</option>';
                data.data.forEach(city => {
                    select.innerHTML += `<option value="${city.id}">${city.nameRu} (${city.nameEn})</option>`;
                });
            }
        }
    } catch (error) {
        console.error('Error loading cities for dropdown:', error);
    }
}

// Add new custom tour city
async function addCustomTourCity(country, countryId) {
    const cityId = parseInt(document.getElementById(`newCitySelect_${country}`).value);
    const daysCount = parseInt(document.getElementById(`newCityDays_${country}`).value);
    
    if (!cityId) {
        alert('Пожалуйста, выберите город');
        return;
    }
    
    if (!daysCount || daysCount < 1) {
        alert('Количество дней должно быть больше 0');
        return;
    }
    
    try {
        const response = await fetch(`${getApiUrl()}/custom-tour/admin/countries/${countryId}/cities`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ cityId, daysCount })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('✅ Город успешно добавлен!', 'success');
            loadCustomTourCities(countryId, country);
        } else {
            alert('Ошибка: ' + data.message);
        }
    } catch (error) {
        console.error('Error adding custom tour city:', error);
        alert('Ошибка соединения с сервером');
    }
}

// Edit custom tour city (update days count)
async function editCustomTourCity(cityId, country) {
    const newDays = prompt('Введите новое количество дней:');
    
    if (newDays === null) return; // Cancelled
    
    const daysCount = parseInt(newDays);
    if (!daysCount || daysCount < 1) {
        alert('Количество дней должно быть больше 0');
        return;
    }
    
    try {
        const response = await fetch(`${getApiUrl()}/custom-tour/admin/cities/${cityId}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({ daysCount })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('✅ Город обновлен!', 'success');
            loadCustomTourCities(currentCityCountryId, country);
        } else {
            alert('Ошибка: ' + data.message);
        }
    } catch (error) {
        console.error('Error updating custom tour city:', error);
        alert('Ошибка соединения с сервером');
    }
}

// Toggle city active status
async function toggleCityStatus(cityId, newStatus, country, countryId) {
    try {
        const response = await fetch(`${getApiUrl()}/custom-tour/admin/cities/${cityId}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({ isActive: newStatus })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification(`✅ Статус изменен на ${newStatus ? 'активен' : 'неактивен'}!`, 'success');
            loadCustomTourCities(countryId, country);
        } else {
            alert('Ошибка: ' + data.message);
        }
    } catch (error) {
        console.error('Error toggling city status:', error);
        alert('Ошибка соединения с сервером');
    }
}

// Delete custom tour city
async function deleteCustomTourCity(cityId, country, countryId) {
    if (!confirm('Вы уверены, что хотите удалить этот город?')) {
        return;
    }
    
    try {
        const response = await fetch(`${getApiUrl()}/custom-tour/admin/cities/${cityId}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('✅ Город удален!', 'success');
            loadCustomTourCities(countryId, country);
        } else {
            alert('Ошибка: ' + data.message);
        }
    } catch (error) {
        console.error('Error deleting custom tour city:', error);
        alert('Ошибка соединения с сервером');
    }
}

// Helper: Capitalize first letter
function capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// Make functions globally available
window.switchCustomTourTab = switchCustomTourTab;
window.loadCustomTourCities = loadCustomTourCities;
window.addCustomTourCity = addCustomTourCity;
window.editCustomTourCity = editCustomTourCity;
window.toggleCityStatus = toggleCityStatus;
window.deleteCustomTourCity = deleteCustomTourCity;
