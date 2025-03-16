/*
  Warnings:

  - You are about to drop the column `questionId` on the `QuizQuestion` table. All the data in the column will be lost.
  - You are about to drop the column `version` on the `QuizQuestion` table. All the data in the column will be lost.
  - You are about to drop the `Question` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `correctOption` to the `QuizQuestion` table without a default value. This is not possible if the table is not empty.
  - Added the required column `question` to the `QuizQuestion` table without a default value. This is not possible if the table is not empty.
  - Added the required column `questionType` to the `QuizQuestion` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "QuizQuestion" DROP CONSTRAINT "QuizQuestion_questionId_fkey";

-- AlterTable
ALTER TABLE "QuizQuestion" DROP COLUMN "questionId",
DROP COLUMN "version",
ADD COLUMN     "correctOption" INTEGER NOT NULL,
ADD COLUMN     "options" TEXT[],
ADD COLUMN     "question" TEXT NOT NULL,
ADD COLUMN     "questionType" "QuestionType" NOT NULL;

-- DropTable
DROP TABLE "Question";
