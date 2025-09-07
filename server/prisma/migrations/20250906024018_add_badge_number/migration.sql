/*
  Warnings:

  - A unique constraint covering the columns `[badgeNumber]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "users" ADD COLUMN "badgeNumber" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_badgeNumber_key" ON "users"("badgeNumber");
