# Agent Note: Two-session ownership for the dilemma product Host

Status: implemented

English | [中文](2026-09-02-man-roleplayer-two-session-ownership.zh.md)

## Problem

The dilemma product requires one visible conversation while its 王阳明 and 曾国藩 turns remain in isolated DSH Session histories. A product-level deletion spans both histories and an independent product event stream. Treating either store as the other store's owner would make restart, retries, and partial deletion ambiguous.

## Decision

`@deepseek-ai/dsh-man-roleplayer` owns the product event domain and exposes `ctx.manRoleplayer`. It creates or resumes exactly two AgentHandle owners per product conversation and keeps their DSH `SessionId` values in the immutable `created` fact. The product projection stores stable Session-event references only; it never copies model-visible answer text.

The service serializes operations per dilemma. Deletion first persists `requested`, then waits for both owned handles to dispose within a finite local deadline. A timeout fails at the reversible stopping checkpoint. After both handles settle, the service records the irreversible Session-deletion checkpoint, removes the Wang history, removes the Zeng history, and finally removes the product record. A retry uses the persisted operation id and failed resume stage. The final product removal cannot append a completed event to the deleted stream, so the preceding `deleting-product` checkpoint is the last durable proof.

## Alternatives considered

**One shared DSH Session** — would put both persona histories into a model-visible transcript and violate the product's isolation requirement.

**Direct JSONL or SQLite removal** — bypasses SessionPersistence coordination with live sessions, write-behind work, and unpublished preparations.

**A database transaction across all three stores** — is unavailable across interchangeable DSH Session providers and storage-domain media; persisted checkpoints provide recoverable sequencing instead.

## Consequences

The product Host has a real Loader composition test that creates both agents, materializes their JSONL histories, restarts, resumes both owners, and verifies removal of both histories and the product record. Persona preset composition, user/response event bridging, Remote APIs, and browser slots remain separate consumers; they must not bypass this ownership and deletion path.
