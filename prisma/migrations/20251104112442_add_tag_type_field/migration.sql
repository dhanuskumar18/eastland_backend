/*
  Warnings:

  - A unique constraint covering the columns `[name,type]` on the table `Tag` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `type` to the `Tag` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "TagType" AS ENUM ('VIDEO', 'PRODUCT');

-- DropIndex
DROP INDEX "public"."Tag_name_key";

-- AlterTable
ALTER TABLE "Tag" ADD COLUMN     "type" "TagType" NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Tag_name_type_key" ON "Tag"("name", "type");
