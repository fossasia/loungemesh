-- AlterTable
ALTER TABLE "Meeting" ADD COLUMN     "guestEmails" TEXT[] DEFAULT ARRAY[]::TEXT[];
