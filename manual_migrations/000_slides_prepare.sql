-- 000_slides_prepare.sql
-- Цель: привести старые строки в slides к полному JSON-объекту {ru, en}
-- Работает как с TEXT, так и с JSONB колонками (универсальная миграция)

-- Проверяем тип колонки и выбираем правильную стратегию
DO $$
DECLARE
  title_type text;
BEGIN
  -- Получаем тип колонки title
  SELECT data_type INTO title_type
  FROM information_schema.columns
  WHERE table_name = 'slides' AND column_name = 'title';

  -- Если колонка TEXT, работаем со строками
  IF title_type = 'text' THEN
    -- 1. Добавляем ключ "en" если его нет в title (TEXT версия)
    UPDATE slides
    SET title = (
        CASE
            -- если уже json-подобная строка, пробуем привести к json и добавить en
            WHEN left(trim(title), 1) = '{' THEN
                (
                    COALESCE(
                        (title::jsonb || jsonb_build_object(
                            'en',
                            COALESCE((title::jsonb ->> 'en'), '')
                        )),
                        jsonb_build_object('ru', title, 'en', '')
                    )
                )::text
            ELSE
                -- если это просто голый текст "Привет", превращаем в {"ru":"Привет","en":""}
                jsonb_build_object('ru', title, 'en', '')::text
        END
    )
    WHERE title IS NOT NULL;

    -- 2. Добавляем ключ "en" если его нет в description (TEXT версия)
    UPDATE slides
    SET description = (
        CASE
            WHEN left(trim(description), 1) = '{' THEN
                (
                    COALESCE(
                        (description::jsonb || jsonb_build_object(
                            'en',
                            COALESCE((description::jsonb ->> 'en'), '')
                        )),
                        jsonb_build_object('ru', description, 'en', '')
                    )
                )::text
            ELSE
                jsonb_build_object('ru', description, 'en', '')::text
        END
    )
    WHERE description IS NOT NULL;

    -- 3. Добавляем ключ "en" если его нет в buttonText (TEXT версия, может быть NULL)
    UPDATE slides
    SET "buttonText" = (
        CASE
            WHEN left(trim("buttonText"), 1) = '{' THEN
                (
                    COALESCE(
                        ("buttonText"::jsonb || jsonb_build_object(
                            'en',
                            COALESCE(("buttonText"::jsonb ->> 'en'), '')
                        )),
                        jsonb_build_object('ru', "buttonText", 'en', '')
                    )
                )::text
            ELSE
                jsonb_build_object('ru', "buttonText", 'en', '')::text
        END
    )
    WHERE "buttonText" IS NOT NULL;

  -- Если колонка уже JSONB, работаем с JSONB напрямую
  ELSIF title_type = 'jsonb' THEN
    -- 1. Добавляем ключ "en" если его нет в title (JSONB версия)
    UPDATE slides
    SET title = title || jsonb_build_object('en', COALESCE(title->>'en', ''))
    WHERE title IS NOT NULL AND NOT (title ? 'en');

    -- 2. Добавляем ключ "en" если его нет в description (JSONB версия)
    UPDATE slides
    SET description = description || jsonb_build_object('en', COALESCE(description->>'en', ''))
    WHERE description IS NOT NULL AND NOT (description ? 'en');

    -- 3. Добавляем ключ "en" если его нет в buttonText (JSONB версия)
    UPDATE slides
    SET "buttonText" = "buttonText" || jsonb_build_object('en', COALESCE("buttonText"->>'en', ''))
    WHERE "buttonText" IS NOT NULL AND NOT ("buttonText" ? 'en');
  END IF;
END $$;
