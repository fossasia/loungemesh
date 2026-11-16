export function isAdmittedParticipant(
  features: {
    lobbyEnabled: boolean;
    hostId: string;
    lobbyApproved: Record<string, boolean>;
  },
  id: string,
): boolean {
  if (!features.lobbyEnabled) return true;
  if (features.hostId && id === features.hostId) return true;
  return !!features.lobbyApproved[id];
}
