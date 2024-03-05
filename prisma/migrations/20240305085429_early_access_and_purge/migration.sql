-- AlterTable
ALTER TABLE "Guild" ADD COLUMN     "EarlyAccess_Enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "Purge_Limit" INTEGER NOT NULL DEFAULT 300;
