-- 001_slides_jsonb.sql
-- Цель: после подготовки из 000_... меняем тип колонок с TEXT на JSONB.

-- Важно: запускается ПОСЛЕ 000_slides_prepare.sql, который уже подготовил данные
-- Теперь просто меняем типы, все данные уже в формате {"ru":"...","en":"..."}

ALTER TABLE slides
  ALTER COLUMN title TYPE JSONB USING title::jsonb,
  ALTER COLUMN description TYPE JSONB USING description::jsonb,
  ALTER COLUMN "buttonText" TYPE JSONB USING "buttonText"::jsonb;

-- Добавляем комментарии для документации
COMMENT ON COLUMN slides.title IS 'Multilingual title (JSON: {ru, en})';
COMMENT ON COLUMN slides.description IS 'Multilingual description (JSON: {ru, en})';
COMMENT ON COLUMN slides."buttonText" IS 'Multilingual button text (JSON: {ru, en}, nullable)';
