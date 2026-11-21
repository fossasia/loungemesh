import { afterEach, describe, expect, it, vi } from "vitest"
import { throttle } from "./throttle"

describe("throttle with an existing trailing timer", () => {
  afterEach(() => vi.useRealTimers())

  it("keeps the next trailing call in its own window after an immediate call", () => {
    vi.useFakeTimers()
    const start = new Date("2026-10-11T10:00:00Z").getTime()
    vi.setSystemTime(start)
    const calls: Array<[string, number]> = []
    const send = throttle(
      (value: string) => calls.push([value, Date.now()]),
      100,
    )

    send("first")
    vi.advanceTimersByTime(50)
    send("superseded")
    // Move the wall clock without delivering the pending timer callback.
    vi.setSystemTime(start + 150)
    send("immediate")
    send("latest")

    vi.advanceTimersByTime(50)
    expect(calls).toEqual([
      ["first", start],
      ["immediate", start + 150],
    ])
    vi.advanceTimersByTime(50)
    expect(calls).toEqual([
      ["first", start],
      ["immediate", start + 150],
      ["latest", start + 250],
    ])
  })

  it("does not let an obsolete empty callback postpone the next immediate call", () => {
    vi.useFakeTimers()
    const start = new Date("2026-10-11T10:00:00Z").getTime()
    vi.setSystemTime(start)
    const callback = vi.fn()
    const send = throttle(callback, 100)
    send("first")
    vi.advanceTimersByTime(50)
    send("superseded")
    vi.setSystemTime(start + 150)
    send("immediate")
    vi.advanceTimersByTime(100)
    send("next")
    expect(callback.mock.calls).toEqual([["first"], ["immediate"], ["next"]])
  })
})
