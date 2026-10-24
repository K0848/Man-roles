# Agent Note: Roleplayer persona cards and reading layout

Status: implemented

English | [中文](2026-10-24-roleplayer-persona-cards-and-reading-layout.zh.md)

## Problem

The dilemma interface needs an inspectable persona selection experience and a readable conversation without mixing research activity, shared state, and persona-specific interpretation. A visual redesign must preserve the product's authoritative lifecycle and recently repaired choice and connection behavior.

## Decision

The page composes public Button, Input, Menu, Pill, and StateDot primitives into product-specific cards. Portal menus escape sidebar clipping; the product controls keyboard entry and focus restoration. Persona metadata is presentation copy, while state counts, discussion status, and evidence availability derive from the store. CSS keeps shared button variants intact instead of restyling every descendant button.

The product keeps its own root and registers a private persona-card child slot. Cards consume the Host roster and local presentation metadata; browsing, flipping, and selecting are view state, while explicit confirmation invokes existing create or switch operations. The reading layout uses collapsible navigation and separate state, perspective, and evidence tabs. Remote failures remain observable and drafts stay keyed by dilemma.

Portraits ship as PNG files in the Web frontend public directory and use the existing static fallback. They are original artistic interpretations, not historical likeness claims. The PNG MIME entry serves this shipped asset class. The client bundle contains URLs rather than base64 image data, and no new plugin asset route or runtime dependency is introduced.

Explicit replies use the existing persisted reply id. The client validates a completed answer from the selected dilemma's current persona before sending it; the product and Remote projection retain the association during replay. Switching persona clears the reply target. State actions remain versioned Host mutations; the interface does not implement apparent undo by restoring a local business snapshot.

The product root owns the light document presentation while mounted and restores the previous appearance on unmount. The card gallery uses its own border-box sizing because its public Modal primitive portals outside the product root's CSS scope.

## Alternatives considered

Enabling the ordinary DSH layout and conversation plugins would restore coding-workspace behavior and competing root ownership. Importing those plugins' internal components would bypass their slot contracts. The product instead reuses public primitives and theme tokens while owning its domain layout. Adding a general plugin-assets route or embedding every portrait in JavaScript would enlarge shared infrastructure or startup payload; the existing frontend asset pipeline already serves the required files.

## Consequences

The frontend distribution must include the portrait directory alongside the UI bundle. Dynamic roster availability remains authoritative even when presentation metadata includes additional known personas. Backend confirmation, state history, evidence invalidation, waiting choices, unsettled cancellation, and deletion checkpoints remain the acceptance basis; prototype interactions are not substitutes for those operations. This decision complements the active connection-recovery and explicit-choice notes without superseding their lifecycle rules.

## Testing

Component tests cover explicit card confirmation, failure and offline states, responsive-panel focus, draft retention, and view actions. Store and real Loader tests verify reply ids in outgoing requests, reject stale or cross-persona targets, and reload the persisted association. The static-server Loader test verifies PNG bytes and MIME. Assembled browser verification uses the product profile and the same fixed local port.
