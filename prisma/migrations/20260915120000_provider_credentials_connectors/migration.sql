-- CreateTable
CREATE TABLE "ProviderCredential" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "label" TEXT,
    "secretEnc" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "userId" TEXT,
    "workspaceId" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProviderCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ProviderCredential_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ConnectorSync" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "connector" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "targetPath" TEXT NOT NULL,
    "fileCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "detail" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConnectorSync_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ProviderCredential_provider_status_idx" ON "ProviderCredential"("provider", "status");
CREATE INDEX "ProviderCredential_workspaceId_provider_idx" ON "ProviderCredential"("workspaceId", "provider");
CREATE INDEX "ProviderCredential_userId_provider_idx" ON "ProviderCredential"("userId", "provider");
CREATE INDEX "ConnectorSync_workspaceId_connector_idx" ON "ConnectorSync"("workspaceId", "connector");
