# Agent Note: Roleplayer client observes connection loss and restores selection

Status: implemented

English | [中文](2026-10-23-man-roleplayer-client-recovery.zh.md)

## Problem

A product projection can retain an active turn after its Host disconnects. Rendering that cached projection as ready and advancing its elapsed time implies progress that the browser cannot verify. Reloading also needs to restore the user's chosen dilemma rather than implicitly choosing the oldest list entry.

## Decision

The projection owner subscribes to the existing connection Host-description source. An absent description retracts readiness; a connected description triggers a Host reload. Generation checks discard obsolete list and turn responses. The view stops advancing activity time while disconnected, preserves local drafts, and disables sending, switching, cancellation, and other remote operations until synchronization finishes. Stop-failed and unknown execution remain locked pending Host confirmation. Background projection refreshes retain readiness within a connected generation.

The browser persists only the selected opaque handle. List loading validates that selection and safely chooses an existing entry if it is missing. Storage denial does not block the product. New dilemmas and explicit selections move to the top without removing another dilemma's pending turn. Chinese display labels explain evidence type and trust without editing source content.

## Alternatives considered

Creating another connection loop duplicates the runtime's stream ownership. The existing observable Host description already publishes connection loss and established generations.

Treating disconnection as cancellation invents a Host outcome. Cached activity remains visible as an interrupted observation until the Host reload supplies its actual result.

## Consequences

The client distinguishes transport availability from turn completion and state-analysis status. Browser-local selection is a viewing preference, not product authority. Drafts survive disconnection within the mounted view; full-page draft persistence is not provided.

Focused projection and component tests cover connection recovery, obsolete response rejection, draft retention, selection validation, and list discoverability. Actual process-loss and reconnect behavior requires assembled browser verification.
