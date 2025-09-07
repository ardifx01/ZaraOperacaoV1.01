-- AlterTable
ALTER TABLE "machines" ADD COLUMN "productionSpeed" REAL DEFAULT 0;
ALTER TABLE "machines" ADD COLUMN "targetProduction" REAL DEFAULT 0;

-- CreateTable
CREATE TABLE "machine_status_history" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "machineId" INTEGER NOT NULL,
    "userId" INTEGER,
    "previousStatus" TEXT,
    "newStatus" TEXT NOT NULL,
    "reason" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "machine_status_history_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "machines" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "machine_status_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
