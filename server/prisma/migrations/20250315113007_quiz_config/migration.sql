/*
  Warnings:

  - The `status` column on the `Quiz` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Added the required column `config` to the `Quiz` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "QuizStatus" AS ENUM ('STARTING', 'GENERATING', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "Quiz" ADD COLUMN     "config" JSONB NOT NULL,
DROP COLUMN "status",
ADD COLUMN     "status" "QuizStatus" NOT NULL DEFAULT 'STARTING';
