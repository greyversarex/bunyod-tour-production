/**
 * REPLIT CACHE MANAGEMENT
 * Handles cache clearing and preview refresh for Replit environment
 */

// Очистка кеша для Replit Preview
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(function(registrations) {
        for(let registration of registrations) {
            registration.unregister();
        }
    });
}

// Принудительное обновление для встроенного preview Replit
const replitVersion = 'DARK-FILTER-v3-' + Date.now();
if (localStorage.getItem('replitPreviewVersion') !== replitVersion) {
    localStorage.setItem('replitPreviewVersion', replitVersion);
    // Добавляем уникальный параметр для Replit preview
    if (!window.location.search.includes('repl_preview=')) {
        const separator = window.location.search ? '&' : '?';
        window.location.href = window.location.pathname + window.location.search + separator + 'repl_preview=' + Date.now();
    }
}