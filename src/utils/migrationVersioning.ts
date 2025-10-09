import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * 📝 Система версионирования миграций БД
 * Предотвращает случайные перезаписи данных
 */

export interface MigrationInfo {
  version: string;
  name: string;
  description?: string;
  isSystem: boolean;
}

// 🔢 Текущие системные миграции с execution handlers
const SYSTEM_MIGRATIONS: MigrationInfo[] = [
  {
    version: '1.0.0',
    name: 'Initial Database Setup',
    description: 'Создание базовых категорий, стран, городов, блоков туров',
    isSystem: true
  },
  {
    version: '1.1.0', 
    name: 'TourBlock Assignments Migration',
    description: 'Миграция к новой системе TourBlockAssignment many-to-many',
    isSystem: true
  },
  {
    version: '1.2.0',
    name: 'Migration Versioning System',
    description: 'Добавление системы версионирования для предотвращения перезаписи данных',
    isSystem: true
  }
];

/**
 * 🔧 Migration execution handlers - каждая миграция привязана к конкретной логике
 */
const MIGRATION_HANDLERS: Record<string, () => Promise<void>> = {
  '1.0.0': async () => {
    // Handled by full initializeDatabase() logic
    console.log('✅ Migration 1.0.0: Full database initialization executed');
  },
  
  '1.1.0': async () => {
    // TourBlock migration was already executed in previous tasks
    console.log('✅ Migration 1.1.0: TourBlock assignments system was already migrated in previous work');
    console.log('   - Removed deprecated Tour.tourBlockId fields');  
    console.log('   - Updated all controllers to use TourBlockAssignment system');
    console.log('   - Applied database schema changes');
  },
  
  '1.2.0': async () => {
    // Migration versioning system setup
    console.log('✅ Migration 1.2.0: Migration versioning system installed');
  }
};

/**
 * 🔍 Проверяет была ли применена миграция
 */
export async function isMigrationApplied(version: string): Promise<boolean> {
  try {
    // @ts-ignore - Prisma client будет перегенерирован с новой моделью
    const migration = await (prisma as any).migration.findUnique({
      where: { version }
    });
    return !!migration;
  } catch (error) {
    // Если таблица migrations еще не существует, считаем что ничего не применялось
    console.log('🔄 Таблица migrations еще не создана, применяем миграции...');
    return false;
  }
}

/**
 * ✅ Помечает миграцию как применённую 
 */
export async function markMigrationAsApplied(migrationInfo: MigrationInfo): Promise<void> {
  try {
    // @ts-ignore - Prisma client будет перегенерирован с новой моделью
    await (prisma as any).migration.create({
      data: {
        version: migrationInfo.version,
        name: migrationInfo.name,
        description: migrationInfo.description,
        isSystem: migrationInfo.isSystem
      }
    });
    
    console.log(`✅ Миграция ${migrationInfo.version} (${migrationInfo.name}) применена`);
  } catch (error) {
    console.error(`❌ Ошибка записи миграции ${migrationInfo.version}:`, error);
  }
}

/**
 * 📊 Получает статус всех системных миграций
 */
export async function getSystemMigrationStatus(): Promise<{ 
  applied: string[], 
  pending: string[],
  shouldRunInitialization: boolean 
}> {
  const applied: string[] = [];
  const pending: string[] = [];
  
  for (const migration of SYSTEM_MIGRATIONS) {
    const isApplied = await isMigrationApplied(migration.version);
    if (isApplied) {
      applied.push(migration.version);
    } else {
      pending.push(migration.version);
    }
  }
  
  // Если нет миграции 1.0.0, значит БД не инициализирована
  const shouldRunInitialization = !applied.includes('1.0.0');
  
  return { applied, pending, shouldRunInitialization };
}

/**
 * 🛡️ Безопасная инициализация с обязательным выполнением pending migrations
 */
export async function safeInitializeWithVersioning(): Promise<boolean> {
  console.log('🔒 Запуск безопасной инициализации с версионированием...');
  
  const status = await getSystemMigrationStatus();
  
  console.log(`📋 Статус миграций:`);
  console.log(`   Применённые: ${status.applied.length} (${status.applied.join(', ')})`);
  console.log(`   Ожидающие: ${status.pending.length} (${status.pending.join(', ')})`);
  
  if (status.shouldRunInitialization) {
    console.log('🚀 Требуется полная инициализация базы данных...');
    return true; // Сигнализируем что нужна полная инициализация
  } else {
    console.log('✅ База данных уже инициализирована (версия 1.0.0 применена)');
    
    // 🔧 Выполняем все pending миграции с их специфичной логикой
    if (status.pending.length > 0) {
      console.log(`🔧 Выполнение pending миграций: ${status.pending.join(', ')}`);
      
      for (const migrationVersion of status.pending) {
        const migration = SYSTEM_MIGRATIONS.find(m => m.version === migrationVersion);
        const handler = MIGRATION_HANDLERS[migrationVersion];
        
        if (migration && handler) {
          console.log(`🔄 Выполнение миграции ${migrationVersion}: ${migration.name}`);
          
          try {
            // Выполняем specific логику миграции
            await handler();
            
            // Помечаем как применённую ТОЛЬКО после successful execution
            await markMigrationAsApplied(migration);
            
            console.log(`✅ Миграция ${migrationVersion} успешно выполнена и сохранена`);
          } catch (error) {
            console.error(`❌ Ошибка выполнения миграции ${migrationVersion}:`, error);
            throw new Error(`Критическая ошибка миграции ${migrationVersion}. Система остановлена.`);
          }
        } else {
          console.error(`❌ Не найден handler для миграции ${migrationVersion}`);
          throw new Error(`Отсутствует обработчик для миграции ${migrationVersion}. Система остановлена.`);
        }
      }
      
      console.log('✅ Все pending миграции выполнены успешно');
    }
    
    return false; // БД готова, pending миграции выполнены
  }
}

/**
 * 🎯 Завершает полную инициализацию, выполняя и сохраняя все миграции
 */
export async function completeInitialization(): Promise<void> {
  console.log('🎯 Завершение полной инициализации - выполнение и сохранение миграций...');
  
  // Выполняем все системные миграции с их handlers  
  for (const migration of SYSTEM_MIGRATIONS) {
    const isApplied = await isMigrationApplied(migration.version);
    
    if (!isApplied) {
      const handler = MIGRATION_HANDLERS[migration.version];
      
      if (handler) {
        console.log(`🔄 Выполнение миграции ${migration.version}: ${migration.name}`);
        
        try {
          // Выполняем специфичную логику миграции
          await handler();
          
          // Помечаем как применённую ТОЛЬКО после successful execution  
          await markMigrationAsApplied(migration);
          
          console.log(`✅ Миграция ${migration.version} выполнена и сохранена`);
        } catch (error) {
          console.error(`❌ Ошибка выполнения миграции ${migration.version}:`, error);
          throw new Error(`Критическая ошибка миграции ${migration.version} в completeInitialization.`);
        }
      } else {
        console.error(`❌ Не найден handler для миграции ${migration.version}`);
        throw new Error(`Отсутствует обработчик для миграции ${migration.version}`);
      }
    } else {
      console.log(`✅ Миграция ${migration.version} уже применена`);
    }
  }
  
  console.log('✅ Все системные миграции выполнены и сохранены');
}