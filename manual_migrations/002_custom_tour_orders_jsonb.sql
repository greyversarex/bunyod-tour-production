-- =========================================================================
-- Manual Migration: Convert custom_tour_orders TEXT columns to JSONB
-- =========================================================================
-- This migration safely converts selected_countries, selected_cities,
-- tourists, and selected_components from TEXT to JSONB without data loss.
-- Uses USING clause to preserve existing data by casting text to jsonb.
-- =========================================================================

BEGIN;

-- Check if columns are already JSONB (idempotent)
DO $$
DECLARE
  v_selected_countries_type text;
  v_selected_cities_type text;
  v_tourists_type text;
  v_selected_components_type text;
BEGIN
  -- Get current column types
  SELECT data_type INTO v_selected_countries_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'custom_tour_orders'
    AND column_name = 'selected_countries';

  SELECT data_type INTO v_selected_cities_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'custom_tour_orders'
    AND column_name = 'selected_cities';

  SELECT data_type INTO v_tourists_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'custom_tour_orders'
    AND column_name = 'tourists';

  SELECT data_type INTO v_selected_components_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'custom_tour_orders'
    AND column_name = 'selected_components';

  -- Convert selected_countries if it's text
  IF v_selected_countries_type = 'text' THEN
    RAISE NOTICE 'Converting selected_countries from TEXT to JSONB...';
    EXECUTE 'ALTER TABLE public.custom_tour_orders ALTER COLUMN selected_countries TYPE jsonb USING selected_countries::jsonb';
  ELSE
    RAISE NOTICE 'selected_countries is already JSONB, skipping';
  END IF;

  -- Convert selected_cities if it's text
  IF v_selected_cities_type = 'text' THEN
    RAISE NOTICE 'Converting selected_cities from TEXT to JSONB...';
    EXECUTE 'ALTER TABLE public.custom_tour_orders ALTER COLUMN selected_cities TYPE jsonb USING selected_cities::jsonb';
  ELSE
    RAISE NOTICE 'selected_cities is already JSONB, skipping';
  END IF;

  -- Convert tourists if it's text
  IF v_tourists_type = 'text' THEN
    RAISE NOTICE 'Converting tourists from TEXT to JSONB...';
    EXECUTE 'ALTER TABLE public.custom_tour_orders ALTER COLUMN tourists TYPE jsonb USING tourists::jsonb';
  ELSE
    RAISE NOTICE 'tourists is already JSONB, skipping';
  END IF;

  -- Convert selected_components if it's text
  IF v_selected_components_type = 'text' THEN
    RAISE NOTICE 'Converting selected_components from TEXT to JSONB...';
    EXECUTE 'ALTER TABLE public.custom_tour_orders ALTER COLUMN selected_components TYPE jsonb USING selected_components::jsonb';
  ELSE
    RAISE NOTICE 'selected_components is already JSONB, skipping';
  END IF;
END $$;

COMMIT;

-- Verify the changes
SELECT 
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'custom_tour_orders'
  AND column_name IN ('selected_countries', 'selected_cities', 'tourists', 'selected_components')
ORDER BY column_name;
