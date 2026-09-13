-- CreateTable
CREATE TABLE "BoardDefinition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "mcuFamily" TEXT NOT NULL,
    "logicVoltage" TEXT NOT NULL,
    "sourceRef" TEXT NOT NULL,
    "pins" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ComponentDefinition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "ports" TEXT NOT NULL,
    "protocols" TEXT NOT NULL,
    "requirements" TEXT NOT NULL,
    "portOptions" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "ownerKey" TEXT NOT NULL,
    "boardSlug" TEXT NOT NULL,
    "boardVersion" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "viewport" TEXT,
    "options" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "expiresAt" DATETIME
);

-- CreateTable
CREATE TABLE "ComponentInstanceRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "definitionSlug" TEXT NOT NULL,
    "definitionVersion" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "x" REAL NOT NULL,
    "y" REAL NOT NULL,
    "portConfig" TEXT NOT NULL,
    CONSTRAINT "ComponentInstanceRecord_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ConnectionRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "fromType" TEXT NOT NULL,
    "fromRef" TEXT NOT NULL,
    "toType" TEXT NOT NULL,
    "toRef" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "ConnectionRecord_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ValidationRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT,
    "projectRevision" INTEGER,
    "ruleSetVersion" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "diagnostics" TEXT NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ValidationRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "BoardDefinition_slug_idx" ON "BoardDefinition"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "BoardDefinition_slug_version_key" ON "BoardDefinition"("slug", "version");

-- CreateIndex
CREATE INDEX "ComponentDefinition_category_enabled_idx" ON "ComponentDefinition"("category", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "ComponentDefinition_slug_version_key" ON "ComponentDefinition"("slug", "version");

-- CreateIndex
CREATE INDEX "Project_ownerKey_idx" ON "Project"("ownerKey");

-- CreateIndex
CREATE INDEX "Project_expiresAt_idx" ON "Project"("expiresAt");

-- CreateIndex
CREATE INDEX "ComponentInstanceRecord_projectId_idx" ON "ComponentInstanceRecord"("projectId");

-- CreateIndex
CREATE INDEX "ConnectionRecord_projectId_idx" ON "ConnectionRecord"("projectId");

-- CreateIndex
CREATE INDEX "ValidationRun_projectId_createdAt_idx" ON "ValidationRun"("projectId", "createdAt");
