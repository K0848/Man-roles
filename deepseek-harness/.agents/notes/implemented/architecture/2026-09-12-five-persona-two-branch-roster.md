# Agent Note: Five-persona registry with two immutable branches

Status: implemented

English | [中文](2026-09-12-five-persona-two-branch-roster.zh.md)

## Problem

The first man-roleplayer release assumed one fixed Wang Yangming and Zeng Guofan pair. Expanding the product to Zhuangzi, Su Shi, and Zhu Xi exposed three coupled risks: roster facts could diverge between the server and client, a dilemma could accidentally grow from two perspectives to five concurrent sessions, and quotation trust could be mistaken for evidence provenance. Existing conversations also needed to remain readable without rewriting their stored shape.

## Decision

`PERSONA_REGISTRY` in `packages/extensions/man-roleplayer/src/types.ts` is the authoritative roster for the five audited personas. It owns stable persona IDs, display names, preset IDs, source-document bindings, and default relationship metadata. The product service exposes that roster through `listPersonas`; the client derives its selectors and labels from the remote result instead of carrying a second five-person list.

The earlier two-branch limit is superseded by [Variable persona branches with durable allocation and recovery](2026-09-23-variable-persona-branch-lifecycle.md). Existing persisted pairs remain immutable and readable; legacy omitted-persona creates and historical deletion stages retain their compatibility behavior. New dilemmas use the variable branch allocation and recovery contract described by the newer note.

Bundle configuration is generated from the registry-backed persona bindings. Each persona resolves to its own preset and audited Markdown source, while runtime identity lookup is keyed by persona ID. Adding another persona therefore requires an explicit registry entry, preset, audited source binding, and corresponding configuration coverage.

Evidence metadata keeps two independent dimensions. `evidenceKind` identifies provenance such as authorial text, disciple record, historical account, textual parable, another speaker, later evaluation, variant reading, contested attribution, or modern interpretation. `trust` records reliability separately. First-person delivery is allowed only where the evidence source actually supports the persona's own voice; the Host rejects any unquoted “I” narration in a Claim segment whose cited evidence has `firstPersonAllowed=false`. It also rejects first-person biographical experience hidden inside an uncited `modern-inference` segment. An annotated trust marker does not erase speaker or provenance information.

## Verification

Unit coverage pins registry completeness, pair validation, legacy defaults, immutable branch ownership, source parsing, evidence restrictions, startup configuration, remote contracts, and client selection behavior. Browser coverage exercises the five-person selectors, two-branch creation, profile launch, ordinary-session compatibility, and failure recovery through the built product.

## Alternatives considered

**Create all five persona sessions for every dilemma.** This would make comparison noisy, increase model cost, and break the product's deliberate two-perspective interaction contract.

**Keep the original fixed pair and pilot only one new persona.** This would postpone the roster and configuration contract that all three audited additions require, leaving each later addition to repeat the same cross-package work.

**Hardcode the roster in the client.** This would create two authorities and allow display names, preset bindings, or availability to drift from the service that creates sessions.

**Treat trust as the evidence type.** A reliable historical record is still not first-person authorial text. Collapsing those dimensions would let the model speak in a persona's voice from evidence that belongs to a biographer, disciple, editor, or quoted interlocutor.

## Consequences

The product gains one discoverable five-person roster while preserving the focused two-branch experience and old conversations. Persona expansion now has a visible cross-package checklist instead of scattered literals, and the evidence layer can enforce voice restrictions without discarding useful lower-confidence material.

The registry is intentionally a coordination point: a new persona is not complete until its preset, audited source, runtime binding, tests, and user-facing metadata agree. Persisted pairs also mean changing registry defaults affects only newly created dilemmas, not conversations already in progress.
