-- CreateTable
CREATE TABLE "public"."custom_tour_orders" (
    "id" SERIAL NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "selected_countries" TEXT NOT NULL,
    "selected_cities" TEXT NOT NULL,
    "tourists" TEXT NOT NULL,
    "selected_components" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "total_price" DOUBLE PRECISION,
    "customer_notes" TEXT,
    "admin_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_tour_orders_pkey" PRIMARY KEY ("id")
);
