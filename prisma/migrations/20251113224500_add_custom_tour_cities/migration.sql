-- Add total_days column to custom_tour_orders table
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'custom_tour_orders' 
        AND column_name = 'total_days'
    ) THEN
        ALTER TABLE "public"."custom_tour_orders" ADD COLUMN "total_days" INTEGER;
    END IF;
END $$;

-- CreateTable custom_tour_cities
CREATE TABLE IF NOT EXISTS "public"."custom_tour_cities" (
    "id" SERIAL NOT NULL,
    "country_id" INTEGER NOT NULL,
    "city_id" INTEGER NOT NULL,
    "days_count" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_tour_cities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE schemaname = 'public' 
        AND tablename = 'custom_tour_cities' 
        AND indexname = 'custom_tour_cities_country_id_city_id_key'
    ) THEN
        CREATE UNIQUE INDEX "custom_tour_cities_country_id_city_id_key" ON "public"."custom_tour_cities"("country_id", "city_id");
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'custom_tour_cities_city_id_fkey'
    ) THEN
        ALTER TABLE "public"."custom_tour_cities" ADD CONSTRAINT "custom_tour_cities_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'custom_tour_cities_country_id_fkey'
    ) THEN
        ALTER TABLE "public"."custom_tour_cities" ADD CONSTRAINT "custom_tour_cities_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "public"."countries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- Add CHECK constraint for days_count > 0
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'custom_tour_cities_days_count_check'
    ) THEN
        ALTER TABLE "public"."custom_tour_cities" ADD CONSTRAINT "custom_tour_cities_days_count_check" CHECK ("days_count" > 0);
    END IF;
END $$;
