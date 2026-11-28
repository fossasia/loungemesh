import { beforeEach, describe, expect, it, vi } from "vitest"
import { createPinia, setActivePinia } from "pinia"

const { downloadBlob, canvasToPngBlob } = vi.hoisted(() => ({
  downloadBlob: vi.fn(),
  canvasToPngBlob: vi.fn(),
}))

vi.mock("@/utils/sessionExport", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils/sessionExport")>()),
  renderWhiteboardToCanvas: vi.fn(() => ({}) as HTMLCanvasElement),
  canvasToPngBlob,
  downloadBlob,
}))

import { useSessionExport } from "./useSessionExport"
import { useSessionFeaturesStore } from "@/stores/sessionFeaturesStore"

describe("whiteboard snapshot download names", () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    downloadBlob.mockClear()
    canvasToPngBlob.mockReset()
  })

  it("uses PNG extensions and distinct numbered names for every snapshot", async () => {
    const features = useSessionFeaturesStore()
    features.whiteboardSnapshots = [[], []]
    const png = new Blob(["png"], { type: "image/png" })
    canvasToPngBlob.mockResolvedValue(png)

    await useSessionExport(() => "Room").exportWhiteboard()

    const names = downloadBlob.mock.calls.map(([, name]) => name)
    expect(names).toEqual([
      expect.stringMatching(/^loungemesh-room-\d{8}-\d{4}\.png$/),
      expect.stringMatching(/^loungemesh-room-snapshot-1-\d{8}-\d{4}\.png$/),
      expect.stringMatching(/^loungemesh-room-snapshot-2-\d{8}-\d{4}\.png$/),
    ])
    expect(new Set(names).size).toBe(3)
    expect(downloadBlob.mock.calls.every(([blob]) => blob === png)).toBe(true)
  })

  it("skips missing snapshot blobs without renumbering subsequent downloads", async () => {
    const features = useSessionFeaturesStore()
    features.whiteboardSnapshots = [[], []]
    const png = new Blob(["png"], { type: "image/png" })
    canvasToPngBlob
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(png)

    await useSessionExport(() => "Room").exportWhiteboard()

    expect(downloadBlob).toHaveBeenCalledTimes(1)
    expect(downloadBlob).toHaveBeenCalledWith(
      png,
      expect.stringMatching(/^loungemesh-room-snapshot-2-\d{8}-\d{4}\.png$/),
    )
  })
})
