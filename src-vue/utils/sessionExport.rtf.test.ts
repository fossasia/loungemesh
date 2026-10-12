import { describe, expect, it } from "vitest"
import { markdownToRtf } from "./sessionExport"

describe("RTF notes text encoding", () => {
  it.each([
    ["Café — 你好", "Caf\\u233? \\u8212? \\u20320?\\u22909?"],
    ["😀", "\\u-10179?\\u-8704?"],
    ["\u7fff\u8000\uffff", "\\u32767?\\u-32768?\\u-1?"],
  ])("encodes %s using signed UTF-16 escapes", (text, encoded) => {
    const rtf = markdownToRtf(text, "Title")
    expect(rtf).toContain(encoded)
    expect(rtf).not.toMatch(/[^\x00-\x7f]/)
  })

  it("escapes title delimiters and control words as literal text", () => {
    const rtf = markdownToRtf("Body", "Résumé {draft} \\line")
    expect(rtf).toContain("R\\u233?sum\\u233? \\{draft\\} \\\\line")
  })

  it.each([
    ["# Café", "\\b Caf\\u233?"],
    ["- Café", "\\bullet  Caf\\u233?"],
    ["> Café", "{\\i Caf\\u233?"],
    ["**Café**", "\\b Caf\\u233?\\b0"],
    ["[Café](https://example.test)", "\\ul Caf\\u233?"],
    ["```\nCafé {path} \\line\n```", "{\\f1 Caf\\u233? \\{path\\} \\\\line}"],
  ])("preserves existing formatting for %s", (markdown, encoded) => {
    expect(markdownToRtf(markdown, "Title")).toContain(encoded)
  })
})
