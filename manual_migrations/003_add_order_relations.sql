-- ============================================================================
-- Миграция: Добавление связей для Transfer и Guide Hire в таблицу Orders
-- Дата: 2025-11-23
-- Описание: Безопасное добавление колонок transfer_request_id и guide_hire_request_id
-- ИДЕМПОТЕНТНА: Можно запускать несколько раз без ошибок
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. Добавление колонок (если не существуют)
-- ============================================================================

DO $$
BEGIN
    -- Добавляем transfer_request_id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' 
        AND column_name = 'transfer_request_id'
    ) THEN
        ALTER TABLE orders 
        ADD COLUMN transfer_request_id INTEGER;
        
        RAISE NOTICE '✅ Добавлена колонка transfer_request_id';
    ELSE
        RAISE NOTICE '⏭️  Колонка transfer_request_id уже существует, пропускаем';
    END IF;

    -- Добавляем guide_hire_request_id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' 
        AND column_name = 'guide_hire_request_id'
    ) THEN
        ALTER TABLE orders 
        ADD COLUMN guide_hire_request_id INTEGER;
        
        RAISE NOTICE '✅ Добавлена колонка guide_hire_request_id';
    ELSE
        RAISE NOTICE '⏭️  Колонка guide_hire_request_id уже существует, пропускаем';
    END IF;
END $$;

-- ============================================================================
-- 2. Создание UNIQUE индексов (если не существуют)
-- ============================================================================

DO $$
BEGIN
    -- UNIQUE индекс для transfer_request_id
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'orders' 
        AND indexname = 'orders_transfer_request_id_key'
    ) THEN
        CREATE UNIQUE INDEX orders_transfer_request_id_key 
        ON orders(transfer_request_id) 
        WHERE transfer_request_id IS NOT NULL;
        
        RAISE NOTICE '✅ Создан UNIQUE индекс для transfer_request_id';
    ELSE
        RAISE NOTICE '⏭️  UNIQUE индекс для transfer_request_id уже существует';
    END IF;

    -- UNIQUE индекс для guide_hire_request_id
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'orders' 
        AND indexname = 'orders_guide_hire_request_id_key'
    ) THEN
        CREATE UNIQUE INDEX orders_guide_hire_request_id_key 
        ON orders(guide_hire_request_id) 
        WHERE guide_hire_request_id IS NOT NULL;
        
        RAISE NOTICE '✅ Создан UNIQUE индекс для guide_hire_request_id';
    ELSE
        RAISE NOTICE '⏭️  UNIQUE индекс для guide_hire_request_id уже существует';
    END IF;
END $$;

-- ============================================================================
-- 3. Создание Foreign Key constraints (если не существуют)
-- ============================================================================

DO $$
BEGIN
    -- FK для transfer_request_id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'orders_transfer_request_id_fkey'
        AND table_name = 'orders'
    ) THEN
        ALTER TABLE orders 
        ADD CONSTRAINT orders_transfer_request_id_fkey 
        FOREIGN KEY (transfer_request_id) 
        REFERENCES transfer_requests(id) 
        ON DELETE SET NULL;
        
        RAISE NOTICE '✅ Создан FK constraint для transfer_request_id';
    ELSE
        RAISE NOTICE '⏭️  FK constraint для transfer_request_id уже существует';
    END IF;

    -- FK для guide_hire_request_id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'orders_guide_hire_request_id_fkey'
        AND table_name = 'orders'
    ) THEN
        ALTER TABLE orders 
        ADD CONSTRAINT orders_guide_hire_request_id_fkey 
        FOREIGN KEY (guide_hire_request_id) 
        REFERENCES guide_hire_requests(id) 
        ON DELETE SET NULL;
        
        RAISE NOTICE '✅ Создан FK constraint для guide_hire_request_id';
    ELSE
        RAISE NOTICE '⏭️  FK constraint для guide_hire_request_id уже существует';
    END IF;
END $$;

-- ============================================================================
-- 4. Верификация: проверка что колонки созданы
-- ============================================================================

DO $$
DECLARE
    transfer_col_exists BOOLEAN;
    guide_col_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'transfer_request_id'
    ) INTO transfer_col_exists;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'guide_hire_request_id'
    ) INTO guide_col_exists;
    
    IF transfer_col_exists AND guide_col_exists THEN
        RAISE NOTICE '========================================';
        RAISE NOTICE '✅ МИГРАЦИЯ УСПЕШНО ЗАВЕРШЕНА';
        RAISE NOTICE '✅ Обе колонки существуют в таблице orders';
        RAISE NOTICE '========================================';
    ELSE
        RAISE EXCEPTION 'ОШИБКА: Одна или обе колонки не были созданы!';
    END IF;
END $$;

COMMIT;

-- ============================================================================
-- Дополнительная информация: показать структуру таблицы orders
-- ============================================================================

SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'orders'
AND column_name IN ('transfer_request_id', 'guide_hire_request_id')
ORDER BY ordinal_position;
