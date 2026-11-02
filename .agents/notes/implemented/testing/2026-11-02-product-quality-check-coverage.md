# Agent Note: Product contracts and compiler-face coverage

Status: implemented

English | [中文](2026-11-02-product-quality-check-coverage.zh.md)

## Problem

The product's Host APIs lack parameter and result contracts needed by the repository documentation generators. Product types and services have no subsystem owner, and a Host-composition browser test is excluded from the Client compiler without joining the Host compiler. This turns real type errors into cascaded error-typed lint diagnostics. A documentation publication test also requires file-symlink privileges unavailable to ordinary Windows users.

## Decision

Product APIs document their actual persistence, revision, replay and failure behavior at source. The [product reference](../../../../docs/subsystems/man-roleplayer.md) owns the related identity and RPC type families; generated service tables link there. The browser projection stays owned by its Client package rather than being misrepresented as a Host service. The Host service aliases the product's branded `MessageId` to `ProductMessageId`, keeping generated links distinct from the core LLM identity without changing either type.

The h26 composition test belongs to the Host compiler face and exercises the current single-persona creation followed by explicit invitation. It keeps stable dilemma identities and operation-ownership assertions. Pending persona switching follows the accepted product rule; tests do not reintroduce automatic cancellation during switching.

The documentation publication fixture uses a directory junction on Windows and a directory symlink elsewhere. Both resolve an image outside the repository and exercise the same rejection behavior without changing privilege settings or skipping the assertion.

## Alternatives considered

**Treat product types as generic framework primitives.** Their conversation, execution and evidence ownership differs from the core types; explicit documentation ownership preserves those distinctions.

**Keep legacy browser selectors and title-position assumptions.** The current product starts with one persona, and table ordering does not bind a record to a test. Explicit invitations and unique titles preserve the test's original isolation and lifecycle assertions.

**Require elevated file-symlink permissions for the publication fixture.** A directory junction preserves the real-path escape case using the permissions already available on Windows.

## Consequences

Compiler configuration, source contracts, subsystem ownership and generated catalogs move together. Quality checks retain their existing rules and assertions. Upstream CI references identify upstream provenance; this product source delivery does not imply that those workflows are enabled here. Local checks do not establish real-model quality, cross-platform behavior or production recovery.
