import prisma from '../config/database';

/**
 * Ключи настроек в таблице site_settings, управляющие выбором дат доступности
 * ОТДЕЛЬНО для гидов и ОТДЕЛЬНО для водителей/машин.
 *
 *  value === 'true'  → ВКЛЮЧЕНО: гиды (или водители) сами выбирают доступные даты
 *                      (старое, оригинальное поведение).
 *  value === 'false' (или настройка отсутствует) → ВЫКЛЮЧЕНО: все будущие даты
 *                      всегда доступны для найма/бронирования, даже если в этот
 *                      день уже есть бронь. Прошедшие даты недоступны.
 *
 * По умолчанию (если настройки нет в БД) выбор дат ВЫКЛЮЧЕН — все даты открыты.
 * Это поведение легко обратимо: достаточно включить настройку в админ-панели.
 *
 * ВАЖНО: данные настройки касаются ТОЛЬКО гидов и водителей/машин и НИКАК
 * не влияют на туры.
 */
export const GUIDE_DATE_SELECTION_SETTING_KEY = 'date_selection_enabled_guides';
export const DRIVER_DATE_SELECTION_SETTING_KEY = 'date_selection_enabled_drivers';

/**
 * Универсальное чтение булевой настройки выбора дат по ключу.
 * Возвращает false (все даты открыты) если настройки нет или при ошибке.
 */
async function readDateSelectionFlag(key: string): Promise<boolean> {
  try {
    const setting = await prisma.siteSetting.findUnique({
      where: { key }
    });
    if (!setting) return false;
    return setting.value === 'true';
  } catch (error) {
    console.error(`Error reading ${key} setting:`, error);
    // При ошибке — безопасное значение по умолчанию: все даты открыты.
    return false;
  }
}

/**
 * Возвращает true, если выбор дат доступности ВКЛЮЧЁН для ГИДОВ
 * (гиды сами выбирают даты). false — все будущие даты открыты для найма.
 */
export async function isGuideDateSelectionEnabled(): Promise<boolean> {
  return readDateSelectionFlag(GUIDE_DATE_SELECTION_SETTING_KEY);
}

/**
 * Возвращает true, если выбор дат доступности ВКЛЮЧЁН для ВОДИТЕЛЕЙ/МАШИН
 * (водители сами выбирают даты). false — все будущие даты открыты для бронирования.
 */
export async function isDriverDateSelectionEnabled(): Promise<boolean> {
  return readDateSelectionFlag(DRIVER_DATE_SELECTION_SETTING_KEY);
}
