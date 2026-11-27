// Minimal stub so server controller tests can run under the root vitest
// runner without the server-only dependencies installed.
export default {
  sign: (..._args: unknown[]): string => "mock-token",
  verify: (..._args: unknown[]): Record<string, unknown> => ({}),
}
