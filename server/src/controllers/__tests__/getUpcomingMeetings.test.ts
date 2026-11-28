import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { mockFindMany } = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
}))

vi.mock("../../config/db.js", () => ({
  prisma: { meeting: { findMany: mockFindMany } },
}))

vi.mock("../../config/redis.js", () => ({
  redisClient: {
    get: vi.fn(),
    set: vi.fn(),
    setEx: vi.fn(),
    del: vi.fn(),
    on: vi.fn(),
  },
}))

vi.mock("../../utils/crypto.js", () => ({
  decryptToken: vi.fn(),
  encryptToken: vi.fn(),
}))

vi.mock("../../utils/mailer.js", () => ({
  sendLiveMeetingInvitation: vi.fn(),
  sendMeetingInvitation: vi.fn(),
}))

import { getUpcomingMeetings } from "../meetingController.js"

const NOW = new Date("2026-11-27T12:00:00.000Z")
const MIN = 60 * 1000

type MeetingRow = {
  id: string
  isScheduled: boolean
  hostId: string
  guestEmails: string[]
  moderatorEmails: string[]
  startTime: Date | null
  endTime: Date | null
  recurrence: string | null
  joinPin?: string | null
  configs?: {
    joinPin?: string | null
    userGrants?: string | null
    lobbyEnabled?: boolean
    lobbyForm?: string
    stagePromotionEnabled?: boolean
    allowParticipantRecording?: boolean
    notesTemplate?: string
    internalFlag?: boolean
  } | null
}

const minutesFromNow = (n: number): Date => new Date(NOW.getTime() + n * MIN)

const base = (overrides: Partial<MeetingRow>): MeetingRow => ({
  id: "m",
  isScheduled: true,
  hostId: "host-1",
  guestEmails: [],
  moderatorEmails: [],
  startTime: minutesFromNow(60),
  endTime: minutesFromNow(120),
  recurrence: "NONE",
  joinPin: null,
  configs: null,
  ...overrides,
})

const FIXTURES: MeetingRow[] = [
  base({
    id: "not-started",
    startTime: minutesFromNow(60),
    endTime: minutesFromNow(120),
  }),
  base({
    id: "in-progress",
    startTime: minutesFromNow(-30),
    endTime: minutesFromNow(30),
  }),
  base({
    id: "just-ended",
    startTime: minutesFromNow(-120),
    endTime: minutesFromNow(-1),
  }),
  base({
    id: "no-end-future-start",
    startTime: minutesFromNow(60),
    endTime: null,
  }),
  base({
    id: "no-end-past-start",
    startTime: minutesFromNow(-60),
    endTime: null,
  }),
  base({
    id: "recurring",
    startTime: minutesFromNow(-120),
    endTime: minutesFromNow(-60),
    recurrence: "WEEKLY",
  }),
  base({
    id: "ends-now",
    startTime: minutesFromNow(-60),
    endTime: new Date(NOW.getTime()),
  }),
  base({
    id: "future-start-past-end",
    startTime: minutesFromNow(60),
    endTime: minutesFromNow(-30),
  }),
  base({
    id: "with-join-pin",
    startTime: minutesFromNow(-30),
    endTime: minutesFromNow(30),
    joinPin: "1234",
    configs: { joinPin: "5678" },
  }),
  base({
    id: "with-public-config",
    startTime: minutesFromNow(60),
    endTime: minutesFromNow(120),
    configs: {
      joinPin: "9999",
      userGrants: JSON.stringify({ "host-1": { moderator: true } }),
      lobbyEnabled: true,
      lobbyForm: "details",
      stagePromotionEnabled: false,
      allowParticipantRecording: true,
      notesTemplate: "Be on time",
      internalFlag: true,
    },
  }),
  base({
    id: "moderator-via-grants",
    hostId: "someone-else",
    guestEmails: ["host@example.com"],
    startTime: minutesFromNow(60),
    endTime: minutesFromNow(120),
    configs: {
      userGrants: JSON.stringify({ "host-1": { moderator: true } }),
    },
  }),
  base({
    id: "guest-only",
    hostId: "someone-else",
    guestEmails: ["host@example.com"],
    startTime: minutesFromNow(60),
    endTime: minutesFromNow(120),
    configs: {
      userGrants: JSON.stringify({ "other-user": { moderator: true } }),
    },
  }),
  base({
    id: "malformed-grants",
    hostId: "someone-else",
    guestEmails: ["host@example.com"],
    startTime: minutesFromNow(60),
    endTime: minutesFromNow(120),
    configs: { userGrants: "{not json" },
  }),
]

// Minimal evaluator for the exact where shapes getUpcomingMeetings builds,
// mirroring Prisma semantics: null never satisfies gte or not, and a null
// equality matches only null.
function matchesCondition(row: MeetingRow, c: any): boolean {
  if (c.AND !== undefined) return c.AND.every((sub: any) => matchesCondition(row, sub))
  if (c.OR !== undefined) return c.OR.some((sub: any) => matchesCondition(row, sub))
  if (c.endTime !== undefined) {
    if (c.endTime === null) return row.endTime === null
    if (c.endTime.gte !== undefined) return row.endTime !== null && row.endTime >= c.endTime.gte
  }
  if (c.startTime !== undefined) {
    if (c.startTime === null) return row.startTime === null
    if (c.startTime.gte !== undefined) return row.startTime !== null && row.startTime >= c.startTime.gte
  }
  if (c.recurrence?.not !== undefined) {
    return row.recurrence !== null && row.recurrence !== c.recurrence.not
  }
  return false
}

function matchesWhere(row: MeetingRow, where: any): boolean {
  if (where.isScheduled !== row.isScheduled) return false
  const [accessOr, timeOr] = where.AND
  const access = accessOr.OR.some(
    (c: any) =>
      (c.hostId !== undefined && c.hostId === row.hostId) ||
      (c.guestEmails?.has !== undefined &&
        row.guestEmails.includes(c.guestEmails.has)) ||
      (c.moderatorEmails?.has !== undefined &&
        row.moderatorEmails.includes(c.moderatorEmails.has)),
  )
  if (!access) return false
  return matchesCondition(row, timeOr)
}

async function callUpcomingRows(): Promise<any[]> {
  const req: any = { user: { id: "host-1", email: "host@example.com" } }
  const res: any = { json: vi.fn(), status: vi.fn().mockReturnThis() }
  await getUpcomingMeetings(req, res)
  return res.json.mock.calls[0][0] as any[]
}

async function callUpcoming(): Promise<string[]> {
  return (await callUpcomingRows()).map((m) => m.id)
}

describe("getUpcomingMeetings", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    mockFindMany.mockImplementation((args: any) =>
      Promise.resolve(FIXTURES.filter((row) => matchesWhere(row, args.where))),
    )
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it("returns a meeting that has not started yet", async () => {
    expect(await callUpcoming()).toContain("not-started")
  })

  it("returns a meeting that is in progress", async () => {
    expect(await callUpcoming()).toContain("in-progress")
  })

  it("does not return a meeting that just ended", async () => {
    expect(await callUpcoming()).not.toContain("just-ended")
  })

  it("returns a meeting with no end time when its start is in the future", async () => {
    expect(await callUpcoming()).toContain("no-end-future-start")
  })

  it("does not return a meeting with no end time when its start has passed", async () => {
    expect(await callUpcoming()).not.toContain("no-end-past-start")
  })

  it("returns a recurring meeting even when its times have passed", async () => {
    expect(await callUpcoming()).toContain("recurring")
  })

  it("returns a meeting whose end time is exactly now", async () => {
    expect(await callUpcoming()).toContain("ends-now")
  })

  it("does not return a meeting whose end has passed even when its start is in the future", async () => {
    expect(await callUpcoming()).not.toContain("future-start-past-end")
  })

  it("never returns joinPin on the meeting or its configs", async () => {
    const rows = await callUpcomingRows()
    const pinned = rows.find((m) => m.id === "with-join-pin")
    expect(pinned).toBeDefined()
    expect(pinned).not.toHaveProperty("joinPin")
    expect(pinned.configs).not.toHaveProperty("joinPin")
  })

  it("returns only the public config fields for a meeting", async () => {
    const rows = await callUpcomingRows()
    const row = rows.find((m) => m.id === "with-public-config")
    expect(row).toBeDefined()
    expect(row.configs).toEqual({
      lobbyEnabled: true,
      lobbyForm: "details",
      stagePromotionEnabled: false,
      allowParticipantRecording: true,
      notesTemplate: "Be on time",
    })
  })

  it("reports viewerRole host for a meeting the caller hosts", async () => {
    const rows = await callUpcomingRows()
    expect(rows.find((m) => m.id === "not-started")?.viewerRole).toBe("host")
  })

  it("reports viewerRole moderator for a grant moderator", async () => {
    const rows = await callUpcomingRows()
    expect(rows.find((m) => m.id === "moderator-via-grants")?.viewerRole).toBe("moderator")
  })

  it("reports viewerRole null for a guest with no moderator grant", async () => {
    const rows = await callUpcomingRows()
    expect(rows.find((m) => m.id === "guest-only")?.viewerRole).toBeNull()
  })

  it("reports viewerRole null when the grants value is malformed", async () => {
    const rows = await callUpcomingRows()
    expect(rows.find((m) => m.id === "malformed-grants")?.viewerRole).toBeNull()
  })
})
