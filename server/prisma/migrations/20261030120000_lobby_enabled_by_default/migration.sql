-- New meetings wait in the lobby unless the host turns it off.
ALTER TABLE "MeetingConfig" ALTER COLUMN "lobbyEnabled" SET DEFAULT true;
