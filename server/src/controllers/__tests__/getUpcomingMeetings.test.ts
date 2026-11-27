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
]

// Minimal evaluator for the exact where shapes getUpcomingMeetings builds,
// mirroring Prisma semantics: null never satisfies gte or not.
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
  return timeOr.OR.some(
    (c: any) =>
      (c.endTime?.gte !== undefined &&
        row.endTime !== null &&
        row.endTime >= c.endTime.gte) ||
      (c.startTime?.gte !== undefined &&
        row.startTime !== null &&
        row.startTime >= c.startTime.gte) ||
      (c.recurrence?.not !== undefined &&
        row.recurrence !== null &&
        row.recurrence !== c.recurrence.not),
  )
}

async function callUpcoming(): Promise<string[]> {
  const req: any = { user: { id: "host-1", email: "host@example.com" } }
  const res: any = { json: vi.fn(), status: vi.fn().mockReturnThis() }
  await getUpcomingMeetings(req, res)
  return (res.json.mock.calls[0][0] as MeetingRow[]).map((m) => m.id)
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
})
