# Agent Note: Independent product profile for man-roleplayer

Status: implemented

English | [中文](2026-09-04-man-roleplayer-independent-product-profile.zh.md)

## Problem

The product needs a browser entry that cannot silently become part of ordinary DSH Web. Generic session UI and product persona capabilities have different ownership, projection, and failure boundaries.

## Decision

The two-person dilemma UI is an opt-in profile bundle, not an extra row in the ordinary Web roster. `@deepseek-ai/dsh-man-roleplayer-app` overlays the shipped Web composition, disables the generic layout/sidebar/composer/tool surfaces, and mounts `@deepseek-ai/dsh-client-ui-man-roleplayer` as the product root. Host configuration supplies the two research paths, preset root, and model/provider references explicitly.

The product Remote creates one Host-owned dilemma and two private Agent sessions, then exposes only an opaque handle and redacted projection. The client keeps one immutable projection store and uses selectors for the sidebar, conversation, and details views. Product tools are registered in each exact Agent context and disappear with its AgentHandle; the ordinary global tool catalog remains unchanged.

An Agent without an active product capability receives a typed unauthorized evidence-lookup result with an empty evidence list. The refusal contains no body or source and creates no product claim/activity, so ordinary Sessions cannot create an unowned product association.

After a validated persona turn, the product profile starts at most one detached state-analysis operation for that turn. A strict structured result persists candidate state items and a persona-bound snapshot sourced only from the completed turn and allowed product projection. Candidates stay pending until an explicit versioned Remote action confirms, modifies, rejects, withdraws, or resolves them; CAS and request ids make those actions safe to retry, while failed or stale analysis never replays the persona turn.

Evidence details are derived at read time from the two configured formal research indexes. The product wire exposes only stable evidence metadata, bounded title/text/source fields, lifecycle status, and redacted lookup activity; product events do not store a second research body. Challenge, explicit review, and withdrawal use versioned Remote mutations, with challenged and withdrawn rows removed from the current allow-list according to their durable lifecycle.

`profile-boot` retains the shipped preset-root overlay only for the built-in `web` and `headless` profile names. A custom product profile therefore owns its explicit preset root without changing the precedence of ordinary profiles.

## Verification

The Loader composition regression creates a blank dilemma through the versioned Remote, observes two live private agents, confirms product tools are absent from the global schema but present in the exact product Agent scope, and submits a structured answer that is returned in the accepted projection without a Session id. The client plugin regression confirms the same store is injected through the root slot. Ordinary Web config assertions confirm the product Host/client rows are absent.

No Agent Loop or external dependency was added; the bundle depends only on existing workspace packages.

## Alternatives considered

Keeping the product row in the shipped Web roster would expose product controls and persona capabilities to ordinary sessions. Reusing the generic conversation composer would also bypass the opaque product Remote and its two-session ownership boundary.

## Consequences

Operators must explicitly compose the product bundle and provide its absolute preset/research bindings. Ordinary Web remains unchanged; product browser tests use a fake Provider and isolated temporary roots.
