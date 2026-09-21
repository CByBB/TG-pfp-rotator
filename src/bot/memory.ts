import type { AuthMemory, UserPhase } from '../types.js';

export class AuthMemoryStore {
  private readonly states = new Map<number, AuthMemory>();

  get(userId: number): AuthMemory {
    const existing = this.states.get(userId);
    if (existing) {
      return existing;
    }
    const created: AuthMemory = { phase: 'idle', codeBuffer: '', codeViaApp: true };
    this.states.set(userId, created);
    return created;
  }

  set(userId: number, patch: Partial<AuthMemory>): AuthMemory {
    const next = { ...this.get(userId), ...patch };
    this.states.set(userId, next);
    return next;
  }

  setPhase(userId: number, phase: UserPhase): AuthMemory {
    return this.set(userId, {
      phase,
      codeBuffer: phase === 'awaiting_code' ? '' : this.get(userId).codeBuffer,
    });
  }

  clear(userId: number): void {
    this.states.delete(userId);
  }
}
