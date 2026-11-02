# Agent Note: man-roleplayer H2.8 production UI projection

Status: implemented

English | [中文](2026-09-06-man-roleplayer-h28-production-ui.zh.md)

## Problem

The product UI needs a durable, product-owned projection that remains isolated from ordinary DSH sessions while exposing enough operation and evidence references for recovery and verification.

## Decision

The client renders one Host projection store. Active turns carry an opaque dilemma handle and the real message, delivery, turn, and persona relation. State retry reuses the failed analysis input and stable retry operation. Deletion exposes checkpoint stage and resumes only the same operation after irreversibility. Archived projections remain readable and strictly read-only. Accepted text renders Host-validated Claim ranges and current evidence status; challenged or withdrawn references become stale while historical text remains.

## Consequences

The browser receives no raw DSH Session id, tool trace, or ordinary Session text. Evidence body and source are derived from the configured research index at read time; product events do not copy that material. Ordinary DSH profiles do not load this root surface.

Client-visible product types resolve Session identity through `@deepseek-ai/dsh-session/types`. The Host root also declares `ctx.sessions: SessionStore`; importing that root into browser types conflicts with the client runtime session service. The client-safe entry preserves the same branded identity and constructor without the Host augmentation.

## Alternatives considered

The retained implementation record does not identify a contemporaneous alternatives comparison. The documented client-safe Session type entry avoids importing Host service augmentation into the browser. The product-owned projection exposes operation references for recovery while withholding raw Session identity and ordinary Session text.

## Verification

Host and client TypeScript checks, package tests, production bundle builds, system-Chrome product-profile tests, H2.8 browser tests, H2.6 regression, ordinary-profile isolation, and `git diff --check` were run for the implementation.
