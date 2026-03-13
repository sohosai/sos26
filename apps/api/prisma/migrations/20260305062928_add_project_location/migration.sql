/*
  Warnings:

  - Added the required column `location` to the `Project` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ProjectLocation" AS ENUM ('INDOOR', 'OUTDOOR', 'STAGE');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "location" "ProjectLocation" NOT NULL;
