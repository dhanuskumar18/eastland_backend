/*
  Warnings:

  - You are about to drop the `ProductCategory` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `VideoCategory` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "CategoryType" AS ENUM ('VIDEO', 'PRODUCT');

-- DropForeignKey
ALTER TABLE "public"."Video" DROP CONSTRAINT "Video_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "public"."_ProductCategories" DROP CONSTRAINT "_ProductCategories_A_fkey";

-- DropForeignKey
ALTER TABLE "public"."_ProductCategories" DROP CONSTRAINT "_ProductCategories_B_fkey";

-- DropTable
DROP TABLE "public"."ProductCategory";

-- DropTable
DROP TABLE "public"."VideoCategory";

-- CreateTable
CREATE TABLE "globals" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "globals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "globalsTranslation" (
    "id" SERIAL NOT NULL,
    "globalsId" INTEGER NOT NULL,
    "locale" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "globalsTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "type" "CategoryType" NOT NULL DEFAULT 'PRODUCT',

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "globalsTranslation_locale_idx" ON "globalsTranslation"("locale");

-- CreateIndex
CREATE UNIQUE INDEX "globalsTranslation_globalsId_locale_key" ON "globalsTranslation"("globalsId", "locale");

-- AddForeignKey
ALTER TABLE "globalsTranslation" ADD CONSTRAINT "globalsTranslation_globalsId_fkey" FOREIGN KEY ("globalsId") REFERENCES "globals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Video" ADD CONSTRAINT "Video_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProductCategories" ADD CONSTRAINT "_ProductCategories_A_fkey" FOREIGN KEY ("A") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProductCategories" ADD CONSTRAINT "_ProductCategories_B_fkey" FOREIGN KEY ("B") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
