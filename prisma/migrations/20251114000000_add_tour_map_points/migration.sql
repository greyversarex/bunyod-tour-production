-- Add tour_map_points table for tour map visualization
-- This replaces coordinates stored in itinerary JSON with a dedicated table

-- CreateTable tour_map_points
CREATE TABLE IF NOT EXISTS "public"."tour_map_points" (
    "id" SERIAL NOT NULL,
    "tour_id" INTEGER NOT NULL,
    "step_number" INTEGER NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tour_map_points_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE schemaname = 'public' 
        AND tablename = 'tour_map_points' 
        AND indexname = 'tour_map_points_tour_id_step_number_key'
    ) THEN
        CREATE UNIQUE INDEX "tour_map_points_tour_id_step_number_key" ON "public"."tour_map_points"("tour_id", "step_number");
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'tour_map_points_tour_id_fkey'
    ) THEN
        ALTER TABLE "public"."tour_map_points" ADD CONSTRAINT "tour_map_points_tour_id_fkey" FOREIGN KEY ("tour_id") REFERENCES "public"."tours"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
