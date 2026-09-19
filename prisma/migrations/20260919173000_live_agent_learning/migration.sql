CREATE TYPE "SessionStatus" AS ENUM ('CREATED', 'RUNNING', 'PAUSED', 'COMPLETED', 'FAILED', 'CANCELLED');
CREATE TYPE "ParticipantRole" AS ENUM ('DRIVER', 'OBSERVER');
CREATE TYPE "SkillStatus" AS ENUM ('TENTATIVE', 'CONFIRMED', 'REJECTED', 'SUPERSEDED');

CREATE TABLE "LiveSession" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "currentDriverId" TEXT,
    "title" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'CREATED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LiveSession_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "LiveSession_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LiveSession_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LiveSession_currentDriverId_fkey" FOREIGN KEY ("currentDriverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "SessionParticipant" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "ParticipantRole" NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CONNECTED',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SessionParticipant_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SessionParticipant_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "LiveSession"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SessionParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "SessionEvent" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "actorId" TEXT,
    "type" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SessionEvent_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SessionEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "LiveSession"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SessionEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "AgentRedirect" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "correctedById" TEXT NOT NULL,
    "instruction" TEXT NOT NULL,
    "context" TEXT NOT NULL,
    "evidence" TEXT NOT NULL,
    "agentStep" TEXT,
    "resultingState" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AgentRedirect_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AgentRedirect_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "LiveSession"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AgentRedirect_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AgentRedirect_correctedById_fkey" FOREIGN KEY ("correctedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "SkillEntry" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "sourceSessionId" TEXT,
    "createdById" TEXT NOT NULL,
    "supersedesId" TEXT,
    "stableId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT,
    "rule" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "example" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "status" "SkillStatus" NOT NULL DEFAULT 'TENTATIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SkillEntry_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SkillEntry_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SkillEntry_sourceSessionId_fkey" FOREIGN KEY ("sourceSessionId") REFERENCES "LiveSession"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SkillEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SkillEntry_supersedesId_fkey" FOREIGN KEY ("supersedesId") REFERENCES "SkillEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "SkillReview" (
    "id" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "decision" "SkillStatus" NOT NULL,
    "context" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SkillReview_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SkillReview_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "SkillEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SkillReview_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

ALTER TABLE "AgentTask" ADD COLUMN "sessionId" TEXT;
ALTER TABLE "AgentTask" ADD CONSTRAINT "AgentTask_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "LiveSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "SessionParticipant_sessionId_userId_key" ON "SessionParticipant"("sessionId", "userId");
CREATE UNIQUE INDEX "SessionParticipant_active_driver_key" ON "SessionParticipant"("sessionId") WHERE "role" = 'DRIVER' AND "status" = 'CONNECTED';
CREATE INDEX "LiveSession_workspaceId_status_idx" ON "LiveSession"("workspaceId", "status");
CREATE INDEX "LiveSession_workspaceId_createdAt_idx" ON "LiveSession"("workspaceId", "createdAt");
CREATE INDEX "LiveSession_currentDriverId_status_idx" ON "LiveSession"("currentDriverId", "status");
CREATE INDEX "SessionParticipant_sessionId_role_status_idx" ON "SessionParticipant"("sessionId", "role", "status");
CREATE INDEX "SessionParticipant_userId_status_idx" ON "SessionParticipant"("userId", "status");
CREATE INDEX "SessionEvent_sessionId_createdAt_idx" ON "SessionEvent"("sessionId", "createdAt");
CREATE INDEX "SessionEvent_sessionId_type_idx" ON "SessionEvent"("sessionId", "type");
CREATE INDEX "AgentRedirect_workspaceId_createdAt_idx" ON "AgentRedirect"("workspaceId", "createdAt");
CREATE INDEX "AgentRedirect_sessionId_createdAt_idx" ON "AgentRedirect"("sessionId", "createdAt");
CREATE INDEX "AgentRedirect_correctedById_createdAt_idx" ON "AgentRedirect"("correctedById", "createdAt");
CREATE INDEX "SkillEntry_workspaceId_status_idx" ON "SkillEntry"("workspaceId", "status");
CREATE INDEX "SkillEntry_workspaceId_stableId_idx" ON "SkillEntry"("workspaceId", "stableId");
CREATE INDEX "SkillEntry_sourceSessionId_status_idx" ON "SkillEntry"("sourceSessionId", "status");
CREATE INDEX "SkillReview_skillId_createdAt_idx" ON "SkillReview"("skillId", "createdAt");
CREATE INDEX "SkillReview_reviewerId_decision_idx" ON "SkillReview"("reviewerId", "decision");