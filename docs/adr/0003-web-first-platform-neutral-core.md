# ADR 0003: Web-first implementation with a platform-neutral core

- Status: Accepted
- Date: 2026-07-21

## Decision

The first implementation supports the exact target `web-react`. Protocol validation, publishing,
runtime semantics, and editor commands cannot depend on React, DOM, CSS, browser APIs, or
application code.

React rendering belongs in `runtime-react`; browser integration belongs in `runtime-web`; visual
authoring UI belongs in `editor-web`.

## Consequences

The first proof stays narrow while preserving a realistic path to React Native, SwiftUI, or
Compose renderers. Future targets require their own exact catalogs and conformance evidence;
cross-platform pixel parity is not promised.
