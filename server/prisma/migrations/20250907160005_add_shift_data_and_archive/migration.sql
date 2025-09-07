-- CreateTable
CREATE TABLE "shift_data" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "machineId" INTEGER NOT NULL,
    "operatorId" INTEGER NOT NULL,
    "shiftType" TEXT NOT NULL,
    "shiftDate" DATETIME NOT NULL,
    "startTime" DATETIME NOT NULL,
    "endTime" DATETIME NOT NULL,
    "totalProduction" REAL NOT NULL DEFAULT 0,
    "targetProduction" REAL NOT NULL DEFAULT 0,
    "efficiency" REAL NOT NULL DEFAULT 0,
    "downtime" REAL NOT NULL DEFAULT 0,
    "qualityTests" INTEGER NOT NULL DEFAULT 0,
    "approvedTests" INTEGER NOT NULL DEFAULT 0,
    "rejectedTests" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "productionData" TEXT,
    "qualityData" TEXT,
    "maintenanceData" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "archivedAt" DATETIME,
    CONSTRAINT "shift_data_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "machines" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "shift_data_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "production_archives" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "shiftDataId" INTEGER NOT NULL,
    "machineId" INTEGER NOT NULL,
    "operatorId" INTEGER NOT NULL,
    "archiveDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedData" TEXT NOT NULL,
    "dataSize" INTEGER,
    "checksum" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "production_archives_shiftDataId_fkey" FOREIGN KEY ("shiftDataId") REFERENCES "shift_data" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "production_archives_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "machines" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "production_archives_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "shift_data_machineId_operatorId_shiftDate_shiftType_key" ON "shift_data"("machineId", "operatorId", "shiftDate", "shiftType");

-- CreateIndex
CREATE UNIQUE INDEX "production_archives_shiftDataId_key" ON "production_archives"("shiftDataId");
