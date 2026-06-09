/** Invisible separator used to prefix chat wire payloads without showing in UI. */
const WIRE_SEP = '\u2063';

const WIRE_PREFIX = new RegExp(`^${WIRE_SEP}lm:([^${WIRE_SEP}]+)${WIRE_SEP}(.*)$`, 's');

/** Embed a stable message id in the XMPP chat body so all clients share the same id. */
export function encodeChatWireText(messageId: string, text: string): string {
  return `${WIRE_SEP}lm:${messageId}${WIRE_SEP}${text}`;
}

/** Strip wire metadata from an incoming chat body. */
export function decodeChatWireText(wire: string): { messageId?: string; text: string } {
  const match = wire.match(WIRE_PREFIX);
  if (!match) return { text: wire };
  return { messageId: match[1], text: match[2] };
}
