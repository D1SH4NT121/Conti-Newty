import { prisma } from '../src/db/client';

export async function clearDatabase() {
  await prisma.toolExecution.deleteMany({});
  await prisma.agentEvent.deleteMany({});
  await prisma.agentTask.deleteMany({});
  await prisma.message.deleteMany({});
  await prisma.thread.deleteMany({});
  await prisma.readOnlyPath.deleteMany({});
  await prisma.appAccess.deleteMany({});
  await prisma.appDeployment.deleteMany({});
  await prisma.appWorkspace.deleteMany({});
  await prisma.usageLog.deleteMany({});
  await prisma.auditLog.deleteMany({});
  await prisma.connectorSync.deleteMany({});
  await prisma.providerCredential.deleteMany({});
  await prisma.workspaceMember.deleteMany({});
  await prisma.orgInvite.deleteMany({});
  await prisma.orgJoinCode.deleteMany({});
  await prisma.workspace.deleteMany({});
  await prisma.membership.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.organization.deleteMany({});
}
