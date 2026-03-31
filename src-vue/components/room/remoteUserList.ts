import type { RemoteUser } from '@/stores/conferenceStore';

export type RemoteUserListEntry = {
  id: string;
  x: number;
  y: number;
  mute: boolean;
};

/** Structured list for RemoteUsers v-for / v-memo (kept in .ts for unit-test coverage). */
export function buildRemoteUserList(users: Record<string, RemoteUser>): RemoteUserListEntry[] {
  return Object.values(users).map((u) => ({
    id: u.id,
    x: u.pos.x,
    y: u.pos.y,
    mute: u.mute,
  }));
}
