-- CreateTable
CREATE TABLE "public"."vehicles" (
    "id" SERIAL NOT NULL,
    "name" JSONB NOT NULL,
    "description" JSONB,
    "type" TEXT NOT NULL,
    "license_plate" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "images" TEXT,
    "price_per_day" DOUBLE PRECISION,
    "currency" TEXT DEFAULT 'TJS',
    "country_id" INTEGER,
    "city_id" INTEGER,
    "brand" TEXT,
    "year" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_license_plate_key" ON "public"."vehicles"("license_plate");

-- AddForeignKey
ALTER TABLE "public"."vehicles" ADD CONSTRAINT "vehicles_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "public"."countries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."vehicles" ADD CONSTRAINT "vehicles_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
