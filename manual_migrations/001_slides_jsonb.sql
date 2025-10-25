-- Миграция: Конвертация slides.title и slides.description из TEXT в JSONB
-- Эта миграция автоматически применяется через update.sh если колонки еще TEXT

-- Безопасная конвертация TEXT → JSONB
-- Если данные уже валидный JSON, просто меняем тип
-- Если нет - они будут обернуты в JSON строку

ALTER TABLE slides
  ALTER COLUMN title TYPE JSONB USING 
    CASE 
      WHEN title IS NULL THEN '{"ru":"","en":""}'::jsonb
      WHEN title::text ~ '^\s*\{.*\}\s*$' THEN title::jsonb
      ELSE jsonb_build_object('ru', title, 'en', '')
    END,
  ALTER COLUMN description TYPE JSONB USING 
    CASE 
      WHEN description IS NULL THEN '{"ru":"","en":""}'::jsonb
      WHEN description::text ~ '^\s*\{.*\}\s*$' THEN description::jsonb
      ELSE jsonb_build_object('ru', description, 'en', '')
    END,
  ALTER COLUMN "buttonText" TYPE JSONB USING 
    CASE 
      WHEN "buttonText" IS NULL THEN NULL
      WHEN "buttonText"::text ~ '^\s*\{.*\}\s*$' THEN "buttonText"::jsonb
      ELSE jsonb_build_object('ru', "buttonText", 'en', '')
    END;

-- Добавляем комментарии для документации
COMMENT ON COLUMN slides.title IS 'Multilingual title (JSON: {ru, en})';
COMMENT ON COLUMN slides.description IS 'Multilingual description (JSON: {ru, en})';
COMMENT ON COLUMN slides."buttonText" IS 'Multilingual button text (JSON: {ru, en}, nullable)';
