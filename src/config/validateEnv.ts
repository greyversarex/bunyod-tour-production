/**
 * ВАЛИДАЦИЯ ПЕРЕМЕННЫХ ОКРУЖЕНИЯ
 * Проверяет наличие всех критичных переменных при старте сервера
 * Предотвращает запуск с дефолтными/отсутствующими секретами
 */

interface EnvironmentConfig {
  required: string[];
  optional: string[];
  warnings: string[];
}

const envConfig: EnvironmentConfig = {
  // ❌ ОБЯЗАТЕЛЬНЫЕ - сервер не запустится без них
  required: [
    'DATABASE_URL',
    'JWT_SECRET'
  ],
  
  // ⚠️ ОПЦИОНАЛЬНЫЕ НО ВАЖНЫЕ - показывает предупреждение
  optional: [
    'ALIF_MERCHANT_KEY',
    'ALIF_MERCHANT_PASSWORD',
    'SMTP_HOST',
    'SMTP_USER',
    'SMTP_PASS'
  ],
  
  // 📝 ДОПОЛНИТЕЛЬНЫЕ - просто логирует
  warnings: [
    'STRIPE_SECRET_KEY',
    'PAYME_MERCHANT_ID',
    'CLICK_MERCHANT_ID'
  ]
};

/**
 * Валидация обязательных переменных окружения
 * Бросает ошибку если что-то отсутствует
 */
export function validateRequiredEnvVars(): void {
  const missing: string[] = [];
  
  envConfig.required.forEach(varName => {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  });
  
  if (missing.length > 0) {
    console.error('\n❌ КРИТИЧЕСКАЯ ОШИБКА: Отсутствуют обязательные переменные окружения!\n');
    console.error('Не найдены:');
    missing.forEach(varName => {
      console.error(`  - ${varName}`);
    });
    console.error('\n📝 Создайте файл .env и добавьте эти переменные.\n');
    
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  
  console.log('✅ Все обязательные переменные окружения установлены');
}

/**
 * Проверка опциональных но важных переменных
 * Показывает предупреждения
 */
export function checkOptionalEnvVars(): void {
  const missing: string[] = [];
  
  envConfig.optional.forEach(varName => {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  });
  
  if (missing.length > 0) {
    console.warn('\n⚠️  ПРЕДУПРЕЖДЕНИЕ: Отсутствуют опциональные переменные:');
    missing.forEach(varName => {
      console.warn(`  - ${varName}`);
    });
    console.warn('Некоторые функции могут не работать (платежи, email рассылка).\n');
  }
}

/**
 * Логирование дополнительных переменных
 */
export function logAdditionalEnvVars(): void {
  const configured: string[] = [];
  const missing: string[] = [];
  
  envConfig.warnings.forEach(varName => {
    if (process.env[varName]) {
      configured.push(varName);
    } else {
      missing.push(varName);
    }
  });
  
  if (configured.length > 0) {
    console.log('📦 Настроенные дополнительные сервисы:', configured.join(', '));
  }
  
  if (missing.length > 0) {
    console.log('📝 Не настроенные сервисы:', missing.join(', '));
  }
}

/**
 * Валидация конкретных значений (не только наличие)
 */
export function validateEnvValues(): void {
  // Проверка JWT_SECRET на дефолтное значение
  if (process.env.JWT_SECRET === 'default-secret-key' || 
      process.env.JWT_SECRET === 'fallback_secret_key' ||
      process.env.JWT_SECRET === 'tour-guide-secret-key') {
    console.error('\n❌ ОШИБКА БЕЗОПАСНОСТИ: JWT_SECRET использует дефолтное значение!');
    console.error('Это критическая уязвимость безопасности.');
    console.error('Установите уникальный секретный ключ в .env файле.\n');
    
    throw new Error('JWT_SECRET must not use default value');
  }

  // Проверка JWT_SECRET на минимальную длину (32 символа для безопасности)
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    console.error('\n❌ ОШИБКА БЕЗОПАСНОСТИ: JWT_SECRET слишком короткий!');
    console.error(`📏 Текущая длина: ${process.env.JWT_SECRET.length} символов`);
    console.error('Минимальная длина: 32 символа');
    console.error('💡 Используйте сильный, случайно сгенерированный ключ длиной минимум 32 символа.\n');
    
    throw new Error('JWT_SECRET must be at least 32 characters long');
  }
  
  // Проверка DATABASE_URL на правильный формат
  if (process.env.DATABASE_URL && !process.env.DATABASE_URL.startsWith('postgresql://')) {
    console.warn('\n⚠️  Предупреждение: DATABASE_URL может иметь неправильный формат');
    console.warn('Ожидается PostgreSQL connection string (postgresql://...)');
  }
  
  console.log('✅ Значения переменных окружения валидны');
}

/**
 * Полная валидация окружения при старте
 */
export function validateEnvironment(): void {
  console.log('\n🔍 Проверка переменных окружения...\n');
  
  try {
    // 1. Проверяем обязательные переменные
    validateRequiredEnvVars();
    
    // 2. Проверяем значения
    validateEnvValues();
    
    // 3. Предупреждения об опциональных
    checkOptionalEnvVars();
    
    // 4. Логируем дополнительные
    logAdditionalEnvVars();
    
    console.log('\n✅ Валидация окружения завершена успешно\n');
  } catch (error) {
    console.error('\n💥 Не удалось запустить сервер из-за проблем с окружением\n');
    throw error;
  }
}

/**
 * Получить значение переменной с fallback
 * НО: для критичных переменных fallback не используется
 */
export function getEnvVar(name: string, defaultValue?: string): string {
  const value = process.env[name];
  
  if (!value) {
    if (envConfig.required.includes(name)) {
      throw new Error(`Required environment variable ${name} is not set`);
    }
    
    if (defaultValue === undefined) {
      throw new Error(`Environment variable ${name} is not set and no default value provided`);
    }
    
    return defaultValue;
  }
  
  return value;
}
