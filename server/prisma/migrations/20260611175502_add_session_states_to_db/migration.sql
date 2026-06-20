-- AlterTable
ALTER TABLE "MeetingConfig" ADD COLUMN     "activePoll" TEXT,
ADD COLUMN     "roomDefaults" TEXT,
ADD COLUMN     "sharedNotes" TEXT,
ADD COLUMN     "userGrants" TEXT;
