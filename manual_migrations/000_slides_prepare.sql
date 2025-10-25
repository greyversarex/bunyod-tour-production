-- 000_slides_prepare.sql
-- Цель: привести старые строки в slides к полному JSON-объекту {ru, en}
-- до того, как мы попробуем привести колонки к jsonb.

-- Если колонка уже jsonb или уже содержит "en", запросы ниже просто не сломают ничего.

-- 1. Добавляем ключ "en" если его нет в title
UPDATE slides
SET title = (
    CASE
        -- если уже json-подобная строка, пробуем привести к json и добавить en
        WHEN left(trim(title), 1) = '{' THEN
            (
                -- превращаем TEXT -> JSONB, добавляем en если нет, потом обратно в TEXT
                (
                    COALESCE(
                        (title::jsonb || jsonb_build_object(
                            'en',
                            COALESCE((title::jsonb ->> 'en'), '')
                        )),
                        jsonb_build_object('ru', title, 'en', '')
                    )
                )::text
            )
        ELSE
            -- если это просто голый текст "Привет", превращаем в {"ru":"Привет","en":""}
            jsonb_build_object('ru', title, 'en', '')::text
    END
)
WHERE title IS NOT NULL;

-- 2. Добавляем ключ "en" если его нет в description
UPDATE slides
SET description = (
    CASE
        WHEN left(trim(description), 1) = '{' THEN
            (
                (
                    COALESCE(
                        (description::jsonb || jsonb_build_object(
                            'en',
                            COALESCE((description::jsonb ->> 'en'), '')
                        )),
                        jsonb_build_object('ru', description, 'en', '')
                    )
                )::text
            )
        ELSE
            jsonb_build_object('ru', description, 'en', '')::text
    END
)
WHERE description IS NOT NULL;

-- 3. Добавляем ключ "en" если его нет в buttonText (может быть NULL)
UPDATE slides
SET "buttonText" = (
    CASE
        WHEN left(trim("buttonText"), 1) = '{' THEN
            (
                (
                    COALESCE(
                        ("buttonText"::jsonb || jsonb_build_object(
                            'en',
                            COALESCE(("buttonText"::jsonb ->> 'en'), '')
                        )),
                        jsonb_build_object('ru', "buttonText", 'en', '')
                    )
                )::text
            )
        ELSE
            jsonb_build_object('ru', "buttonText", 'en', '')::text
    END
)
WHERE "buttonText" IS NOT NULL;
