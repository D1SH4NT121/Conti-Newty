export type ParticipantRole = 'DRIVER' | 'OBSERVER';
export const ParticipantRole = {
  DRIVER: 'DRIVER' as const,
  OBSERVER: 'OBSERVER' as const,
};

export type SessionStatus = 'CREATED' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
export const SessionStatus = {
  CREATED: 'CREATED' as const,
  RUNNING: 'RUNNING' as const,
  PAUSED: 'PAUSED' as const,
  COMPLETED: 'COMPLETED' as const,
  FAILED: 'FAILED' as const,
  CANCELLED: 'CANCELLED' as const,
};

export type SkillStatus = 'TENTATIVE' | 'CONFIRMED' | 'REJECTED' | 'SUPERSEDED';
export const SkillStatus = {
  TENTATIVE: 'TENTATIVE' as const,
  CONFIRMED: 'CONFIRMED' as const,
  REJECTED: 'REJECTED' as const,
  SUPERSEDED: 'SUPERSEDED' as const,
};
