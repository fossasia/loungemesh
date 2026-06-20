/*
  Warnings:

  - You are about to drop the column `appleId` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `appleToken` on the `User` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "User_appleId_key";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "appleId",
DROP COLUMN "appleToken";
