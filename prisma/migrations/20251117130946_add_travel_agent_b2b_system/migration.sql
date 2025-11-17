/*
  Warnings:

  - Changed the type of `selected_countries` on the `custom_tour_orders` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `selected_cities` on the `custom_tour_orders` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `tourists` on the `custom_tour_orders` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `selected_components` on the `custom_tour_orders` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "public"."ApplicationStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "public"."AgentStatus" AS ENUM ('pending', 'active', 'suspended');

-- CreateEnum
CREATE TYPE "public"."BookingStatus" AS ENUM ('pending', 'confirmed', 'completed', 'cancelled');

-- AlterTable
ALTER TABLE "public"."custom_tour_orders" DROP COLUMN "selected_countries",
ADD COLUMN     "selected_countries" JSONB NOT NULL,
DROP COLUMN "selected_cities",
ADD COLUMN     "selected_cities" JSONB NOT NULL,
DROP COLUMN "tourists",
ADD COLUMN     "tourists" JSONB NOT NULL,
DROP COLUMN "selected_components",
ADD COLUMN     "selected_components" JSONB NOT NULL;

-- CreateTable
CREATE TABLE "public"."travel_agent_applications" (
    "id" SERIAL NOT NULL,
    "full_name" TEXT NOT NULL,
    "citizenship" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "documents" TEXT,
    "agreement_accepted" BOOLEAN NOT NULL DEFAULT false,
    "privacy_policy_accepted" BOOLEAN NOT NULL DEFAULT false,
    "status" "public"."ApplicationStatus" NOT NULL DEFAULT 'pending',
    "rejection_reason" TEXT,
    "processed_at" TIMESTAMP(3),
    "processed_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "travel_agent_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."travel_agents" (
    "id" SERIAL NOT NULL,
    "application_id" INTEGER,
    "agent_id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "citizenship" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "documents" TEXT,
    "status" "public"."AgentStatus" NOT NULL DEFAULT 'active',
    "must_change_password" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "last_login_at" TIMESTAMP(3),

    CONSTRAINT "travel_agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."agent_tour_bookings" (
    "id" SERIAL NOT NULL,
    "agent_id" INTEGER NOT NULL,
    "booking_number" TEXT NOT NULL,
    "tour_name" TEXT NOT NULL,
    "tour_start_date" TIMESTAMP(3) NOT NULL,
    "tour_end_date" TIMESTAMP(3) NOT NULL,
    "tourists_count" INTEGER NOT NULL,
    "tourists" TEXT NOT NULL,
    "total_price" DOUBLE PRECISION,
    "agent_commission" DOUBLE PRECISION,
    "status" "public"."BookingStatus" NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_tour_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "travel_agents_application_id_key" ON "public"."travel_agents"("application_id");

-- CreateIndex
CREATE UNIQUE INDEX "travel_agents_agent_id_key" ON "public"."travel_agents"("agent_id");

-- CreateIndex
CREATE UNIQUE INDEX "travel_agents_email_key" ON "public"."travel_agents"("email");

-- CreateIndex
CREATE UNIQUE INDEX "agent_tour_bookings_booking_number_key" ON "public"."agent_tour_bookings"("booking_number");

-- AddForeignKey
ALTER TABLE "public"."travel_agents" ADD CONSTRAINT "travel_agents_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "public"."travel_agent_applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."agent_tour_bookings" ADD CONSTRAINT "agent_tour_bookings_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."travel_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
