/**
 * CACHE MANAGEMENT
 * Снимает регистрацию service worker'ов, чтобы браузер не отдавал устаревшие версии страниц.
 */

// Очистка кеша: убираем ранее зарегистрированные service worker'ы
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(function(registrations) {
        for(let registration of registrations) {
            registration.unregister();
        }
    });
}
