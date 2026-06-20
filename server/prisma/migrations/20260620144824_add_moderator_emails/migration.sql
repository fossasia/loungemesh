-- AlterTable
ALTER TABLE "Meeting" ADD COLUMN     "moderatorEmails" TEXT[] DEFAULT ARRAY[]::TEXT[];
