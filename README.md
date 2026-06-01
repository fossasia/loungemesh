## loungemesh

loungemesh is an independent spatial video lounge service.

It provides informal, hallway-style interaction for online and hybrid events.
Participants move freely in a shared space.
Audio volume adapts automatically based on proximity.
This project is inspired by Chatmosphere, but uses a new implementation.
It is built for modern web technologies and current Jitsi versions.
The original Chatmosphere project is no longer actively maintained.
loungemesh provides a sustainable, extensible, and service-agnostic approach.

## Project status

This project is in the design and early implementation phase.
The repository focuses on:

* Architecture decisions
* Integration contracts
* Deployment strategy
* Contributor onboarding
* Incremental implementation milestones

No stable releases or production-ready builds exist yet.

## Motivation

Online conferences lack informal social spaces.
Physical events naturally have hallway conversations, spontaneous meetups, and casual networking.
Traditional video tools optimize for structured meetings, not fluid interaction.
loungemesh aims to:

* Recreate informal social dynamics online
* Integrate flexibly into various event platforms
* Remain fully open source and self-hostable
* Avoid reliance on outdated codebases

## Core idea

loungemesh provides a spatial video experience:

* Participants appear in a shared 2D space.
* Users move freely.
* Audio volume changes based on distance.
* Small group conversations emerge naturally.
* No explicit breakout rooms are required.

This experience complements traditional session rooms.

## Integration architecture

loungemesh operates as an independent application.
It integrates with host platforms, such as Eventyay, via APIs.
The host platform acts as the control plane:

* User authentication
* Access control
* Role management
* Room configuration
* Display name policies

loungemesh acts as the interaction layer:

* Spatial UI
* Proximity logic
* Audio handling
* Real-time presence

Jitsi acts as the media plane:

* Audio and video transport
* Signaling
* Optional server-side access enforcement

This separation keeps loungemesh reusable across different platforms.

## Planned use cases

Within a single event, organizers can offer:

* Spatial lounge rooms
  Informal networking and social interaction using loungemesh.
* Workshop or session rooms
  Structured meetings using standard Jitsi Meet interfaces.

Both room types run on the same Jitsi deployment.

## Technology direction

The choices below reflect design intent, not final implementation guarantees.

## Frontend

* Vue.js (Vue 3)
* TypeScript
* Modern build tooling, such as Vite

## Media

* Jitsi via lib-jitsi-meet
* Per-participant audio control
* Web Audio API for proximity-based attenuation

The Jitsi iframe API is insufficient.
Real proximity audio requires direct access to individual audio streams.

## Deployment

* Docker and Docker Compose
* Single-VM friendly
* No Kubernetes requirement
* Pinned Jitsi versions for stability

The goal is reproducible, automated deployment without operational complexity.

## Identity and nicknames

loungemesh does not manage user accounts.
Instead:

* The host platform provides the display name.
* Logged-in users are automatically identified.
* Rename restrictions are enforced by configuration.
* Optional guest access can be supported.

This ensures identity consistency across sessions and lounges.

## Security model planned

* Host platforms authorize access before users join.
* Optional JWT-based access enforcement on Jitsi.
* Short-lived join tokens.
* No reliance on hidden room URLs.

Security is part of the core design.

## Development approach

The project evolves in stages:

1. Architecture definition and API contracts
2. Minimal spatial UI and movement
3. Jitsi integration with proximity audio
4. Platform join flow and identity handling
5. Automated Docker-based deployment
6. Iterative refinement

The emphasis is on clarity and maintainability.

## Relationship to Chatmosphere

Chatmosphere demonstrated the value of spatial video chat.
However, it targets older Jitsi versions.
Its dependencies are difficult to upgrade.
It is no longer under active development.
loungemesh does not fork Chatmosphere.
It treats Chatmosphere as conceptual inspiration.

## Target audience

* Event platform developers
* Event organizers
* Open source conference communities
* Contributors interested in real-time web applications
* GSoC contributors looking for non-trivial projects

## Contributing

At this stage, contributions focus on:

* Architecture
* API design
* Documentation
* Initial version implementation

Contribution guidelines will expand during implementation.

## License

This project is intended to be released under the Apache 2.0 License.
It is fully compatible with the FOSSASIA ecosystem.
