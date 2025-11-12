/*
  Warnings:

  - Changed the type of `selected_countries` on the `custom_tour_orders` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `selected_cities` on the `custom_tour_orders` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `tourists` on the `custom_tour_orders` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `selected_components` on the `custom_tour_orders` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "public"."custom_tour_orders" DROP COLUMN "selected_countries",
ADD COLUMN     "selected_countries" JSONB NOT NULL,
DROP COLUMN "selected_cities",
ADD COLUMN     "selected_cities" JSONB NOT NULL,
DROP COLUMN "tourists",
ADD COLUMN     "tourists" JSONB NOT NULL,
DROP COLUMN "selected_components",
ADD COLUMN     "selected_components" JSONB NOT NULL;
