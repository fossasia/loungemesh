/** Marks session commands encoded for safe XMPP transport (no raw JSON/XML metacharacters). */
export const XMPP_COMMAND_WIRE_PREFIX = '~';

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

function base64ToUtf8(encoded: string): string {
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

/** Wrap a JSON command string so colons, ampersands, and tags cannot break Prosody XML. */
export function encodeXmppCommandValue(value: string): string {
  return XMPP_COMMAND_WIRE_PREFIX + bytesToBase64(new TextEncoder().encode(value));
}

/** Decode a wrapped command, or pass through legacy plain JSON payloads. */
export function decodeXmppCommandValue(wire: string): string {
  if (!wire.startsWith(XMPP_COMMAND_WIRE_PREFIX)) return wire;
  return base64ToUtf8(wire.slice(XMPP_COMMAND_WIRE_PREFIX.length));
}
