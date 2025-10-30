/*
  Warnings:

  - You are about to drop the `PageTranslation` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `name` to the `Page` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."PageTranslation" DROP CONSTRAINT "PageTranslation_pageId_fkey";

-- AlterTable
ALTER TABLE "Page" ADD COLUMN     "name" TEXT NOT NULL,
ALTER COLUMN "slug" DROP NOT NULL;

-- DropTable
DROP TABLE "public"."PageTranslation";

-- CreateTable
CREATE TABLE "Section" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "pageId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Section_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SectionTranslation" (
    "id" SERIAL NOT NULL,
    "sectionId" INTEGER NOT NULL,
    "locale" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SectionTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Section_pageId_idx" ON "Section"("pageId");

-- CreateIndex
CREATE UNIQUE INDEX "Section_pageId_name_key" ON "Section"("pageId", "name");

-- CreateIndex
CREATE INDEX "SectionTranslation_locale_idx" ON "SectionTranslation"("locale");

-- CreateIndex
CREATE UNIQUE INDEX "SectionTranslation_sectionId_locale_key" ON "SectionTranslation"("sectionId", "locale");

-- AddForeignKey
ALTER TABLE "Section" ADD CONSTRAINT "Section_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SectionTranslation" ADD CONSTRAINT "SectionTranslation_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;
