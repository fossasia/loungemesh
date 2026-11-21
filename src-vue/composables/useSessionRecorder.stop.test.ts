import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useSessionRecorder } from "./useSessionRecorder"
import { useSessionRecording } from "./useSessionRecording"

vi.mock("@/utils/recordingToMp4", () => ({
  ensureRecordingMp4: vi.fn(async (blob: Blob) => blob),
}))

class DeferredRecorder {
  static instances: DeferredRecorder[] = []
  static isTypeSupported = () => true
  state = "inactive"
  mimeType = "video/webm"
  ondataavailable?: (event: { data: Blob }) => void
  onstop?: () => void
  start = vi.fn(() => {
    this.state = "recording"
  })
  requestData = vi.fn()
  stop = vi.fn(() => {
    if (this.state === "inactive")
      throw new DOMException("Already stopped", "InvalidStateError")
    this.state = "inactive"
  })
  constructor() {
    DeferredRecorder.instances.push(this)
  }
  finish(blob: Blob) {
    this.ondataavailable?.({ data: blob })
    this.onstop?.()
  }
}

beforeEach(() => {
  DeferredRecorder.instances = []
  vi.stubGlobal("MediaRecorder", DeferredRecorder)
  vi.stubGlobal("AudioContext", undefined)
  Object.defineProperty(HTMLCanvasElement.prototype, "captureStream", {
    configurable: true,
    value: vi.fn(() => ({})),
  })
  vi.spyOn(window, "requestAnimationFrame").mockReturnValue(1)
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {})
})

afterEach(() => {
  delete (HTMLCanvasElement.prototype as Partial<HTMLCanvasElement>)
    .captureStream
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function createRecorder() {
  return useSessionRecorder({
    getVideoSources: () => [],
    getAudioTracks: () => [],
  })
}

describe("concurrent recording stop", () => {
  it("completes both the stop control and an overlapping export", async () => {
    const recorder = createRecorder()
    const exportRecording = vi.fn()
    const controls = useSessionRecording(recorder, exportRecording)
    await controls.toggleRecording()
    const stopped = controls.toggleRecording()
    const exported = controls.downloadRecording()
    const active = DeferredRecorder.instances[0]!
    expect(active.stop).toHaveBeenCalledTimes(1)
    active.finish(new Blob(["recording"]))
    await Promise.all([stopped, exported])
    expect(exportRecording).toHaveBeenCalledWith(controls.recordingBlob.value)
    expect(controls.recordingBlob.value?.size).toBe(9)
  })

  it("shares the final blob when stop and export overlap before the browser stop event", async () => {
    const recorder = createRecorder()
    expect(recorder.start()).toBe(true)
    const active = DeferredRecorder.instances[0]!
    const stopped = recorder.stop()
    const exported = recorder.stop()
    expect(active.stop).toHaveBeenCalledTimes(1)
    expect(recorder.start()).toBe(false)
    active.finish(new Blob(["final recording"]))
    expect(recorder.start()).toBe(false)
    const [first, second] = await Promise.all([stopped, exported])
    expect(first?.size).toBe(15)
    expect(second).toBe(first)
    expect(recorder.isRecording.value).toBe(false)
  })

  it("creates a fresh stop operation for a subsequent recording", async () => {
    const recorder = createRecorder()
    await expect(recorder.stop()).resolves.toBeNull()
    expect(recorder.start()).toBe(true)
    const first = recorder.stop()
    DeferredRecorder.instances[0]!.finish(new Blob(["first"]))
    await first
    expect(recorder.start()).toBe(true)
    const second = recorder.stop()
    DeferredRecorder.instances[1]!.finish(new Blob(["second"]))
    expect((await second)?.size).toBe(6)
    await expect(recorder.stop()).resolves.toBeNull()
  })

  it("allows another recording after the browser rejects stopping", async () => {
    const recorder = createRecorder()
    recorder.start()
    DeferredRecorder.instances[0]!.stop.mockImplementation(() => {
      throw new Error("device failure")
    })
    await expect(recorder.stop()).resolves.toBeNull()
    expect(recorder.start()).toBe(true)
    const stopped = recorder.stop()
    DeferredRecorder.instances[1]!.finish(new Blob(["retry"]))
    expect((await stopped)?.size).toBe(5)
  })
})
