# `@deepseek-ai/dsh-client-ui-man-roleplayer`

English | [中文](README.zh.md)

The browser projection client for the variable-persona dilemma product. One
`RoleplayerProjectionStore` owns the Host projection, selection, reload, and
versioned lifecycle operations. Its sidebar, conversation, and details
selectors are derived from the same immutable snapshot; no component keeps a
second business cache and no wire response exposes a DSH Session id.

The plugin consumes the versioned `manRoleplayerRemote` namespace, registers the
product root entry through the existing root slot, and mounts the same store for
its sidebar, conversation, details, and service faces. Host mutations carry the
opaque dilemma handle, request id, and expected lifecycle revision. Carrier or
business failures remain observable to the store; a deleted dilemma is removed
only after the Host's explicit deleted acknowledgement.

The details selector also renders the latest state-analysis status, persona
snapshot, and shared-state items. State items remain candidates until the user
explicitly confirms, modifies, rejects, withdraws, or resolves them; each
mutation is versioned and retriable through the Host Remote.

Evidence details are read-only, derived metadata from the Host's configured
research index. The view shows the safe title, bounded text, source, type, and
trust status, along with redacted lookup activity. Challenge, manual review,
and withdrawal are sent through versioned Remote mutations; no Session id,
fingerprint, tool name, or internal error is rendered.

## Interface and persona assets

Page actions use the public ui-primitives Button, Input, Menu, Pill, and StateDot. Primary, outline, and ghost variants distinguish submissions, supporting actions, and low-frequency actions. Dilemma menus use portals to avoid sidebar clipping. Persona identity, discussion status, shared information, and evidence compose distinct cards from the authoritative projection; page styles own layout and public primitives own control states.

The root owns collapsible dilemma navigation, a centered conversation, and state, perspective, and evidence tabs. The private `manRoleplayer.personaDeck` child slot renders only the Host roster. Flipping and selecting a card do not mutate the dilemma; explicit confirmation creates one initial branch or invokes the existing switch operation. Failure retains selection, offline state disables confirmation, and an active or unsettled turn prevents persona switching. Portraits are original artistic interpretations served from `/man-roleplayer/portraits/<persona-id>.png`; the Web frontend ships them from its public directory rather than embedding image bytes in the client JavaScript.

Reply controls target only a completed answer from the selected dilemma's current persona. The client submits its stable timeline id through the existing `replyToTimelineEventId` field; Host projection preserves that association on reload. Switching persona clears the reply target while preserving the dilemma draft. State and evidence actions wait for Host acknowledgement; the interface does not simulate inverse state changes with local snapshots. Structured choices come from the Host, not from demonstration questions.

The product root presents the approved light palette through the existing theme tokens and restores the prior document appearance when it unmounts. It does not persist a change to the ordinary DSH appearance preference.

## Model Experience

### Projection and lifecycle controls

#### What the model sees

Nothing. This is a browser-only projection package and does not participate in
model prompt assembly or Agent execution.

#### Token effect

None.

#### KV Cache effect

None.

## Profile boundary

- The product bundle disables the generic layout/sidebar/composer rows and owns
  the root surface. Ordinary Web and headless profiles never load this package
 unless an operator explicitly composes the product bundle.

H3 keeps sent-message acknowledgement separate from the next editable draft. Progress comes from product-owned facts, while raw reasoning is derived read-only from the matching persona Session and product turn: it updates while running, remains collapsed by default, and retains an explicit completed, cancelled, or failed posture. Providers that emit no reasoning produce no synthetic row. Prompt text, tool parameters, credentials, Session identifiers, and the other persona's private content are never rendered; accepted answer text still appears only after structured Claim and evidence validation.

## H2.8 production behavior

The single projection store keeps active-turn operations under their originating opaque dilemma handle and persona for polling, cancellation, choice answers, and reload recovery. The Host projection distinguishes a running turn from stopping or unknown execution, so the UI never treats a cancel request as permission to switch early. State retry reuses the failed operation's persisted input with one stable retry operation. Deletion resumes only the same irreversible operation, while archived projections remain browseable without write controls. Accepted messages render Host-validated Claim ranges and derived evidence status; stale references remain visible as history. The product root remains isolated from ordinary DSH UI and Session routes.

The projection owner observes the existing connection Host-description source. Connection loss freezes activity time and disables remote actions while retaining drafts; reconnect reloads authoritative Host projections before controls become ready. Responses from an obsolete connection generation cannot replace that reload. The browser stores the selected opaque dilemma handle locally, validates it against each list, and falls back safely when it no longer exists. Storage denial leaves the in-memory conversation usable. New and recently selected dilemmas appear first. Evidence type and trust metadata use Chinese display labels; source content remains unchanged.

Pending structured choices remain attached to their Host operation id. The browser keeps selected options and custom text as an operation-scoped draft, requires every question to contain a selected option or non-blank custom text before normal submission, and sends an explicit per-question skip marker only from the skip action. While the Host turn waits for a choice, the header and details identify that wait and the conversation does not present the turn as actively thinking.

For single-select questions, custom text and a radio option are alternative answers: entering custom text clears the radio selection, while returning to the option answer retains the text locally but omits it from the submitted answer. Multi-select questions can submit selected options with custom text together.
