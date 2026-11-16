# LoungeMesh AI Development Rules

This repository follows the development standards and guardrails defined in [AGENTS.md](AGENTS.md).

## Quick Reference
- **Coverage & Pre-PR Testing**: 100% statement, branch, and function coverage required (`npm test`). E2E Playwright tests (`npm run build && npm run test:e2e`) and TypeScript compiler checks must pass before PR or commit.
- **Documentation & Skills Updates**: Whenever introducing or updating user flows or features, update all READMEs (`README.md`, `server/README.md`) and corresponding domain skills in `.agents/skills/`.
- **Adapter Boundary**: UI components and Pinia stores must never import `lib-jitsi-meet` directly; all WebRTC calls must go through `MediaService` / `JitsiAdapter`.
- **Scaling**: Never hardcode container memory limits (`mem_limit`). Rely on spatial viewport culling (`receiverConstraints.ts`, 0 streams off-screen), 360p camera avatar / 720p screensharing capture budgeting, single-roundtrip `/init` room bundling, and connection pooling.
- **Security**: Never expose `joinPin` or raw internal database fields in API responses. Always sanitize via `sanitizeMeetingConfig`.
- **Domain Skills**: Consult specialized skills in `.agents/skills/` for architecture, scaling, security, deployment, eventyay integration, and testing.
