# Agent Note: Persona turn communication respects the current request

Status: implemented

English | [中文](2026-10-24-man-roleplayer-turn-communication.zh.md)

## Problem

Persona composition describes a characteristic path from historical perspective to action. A user asking only for a brief sourced example or for listening can receive unsolicited advice, and an analogy can present unknown motives as facts. Evidence attribution alone does not determine whether modern interpretations are warranted.

## Decision

The product injects a logged communication policy before each admitted user message. Explicit response scope, style, and length guide the answer without flattening persona voices. The policy separates user-stated facts, source-backed history, and tentative interpretations; it prohibits asserting unknown motives, character, or circumstances as facts. Advice-shaped wording receives a conditional reminder to respect the current request. A requested single short text ends without count reports, explanation, historical backing, or extra advice. Lookup supports historical claims actually needed in this turn; persona identity alone does not justify adding research.

Preset composition bytes, digest comparisons, stored branch identities, remain unchanged. Submission admission is described by the [concise-advice decision](2026-10-24-man-roleplayer-concise-advice.md). Existing branches receive the policy on their next turn through the ordinary Session input path.

## Alternatives considered

**Edit the persona presets.** Changing composition bytes changes their identities and prevents existing branches from resuming under the configured preset; this communication correction does not justify migrating conversation data.

**Parse length requests or reject motive phrases.** Pattern rules cannot establish the intended scope or whether an interpretation is supported, and they risk erasing legitimate persona expression.

**Remove deterministic advice checks.** The observed brief-example request does not activate them. Removing the checks would independently weaken protection against empty advice and requires separate evidence and a deliberate tradeoff.

## Consequences

The real Loader regression covers a persisted preset branch receiving the policy after restart, valid short listening output, and continued rejection of an uncited quote. Policy text is logged and visible in model requests. These checks prove integration and compatibility; actual compliance with length and restraint still requires model-backed conversation review. Advice requests remain subject to modern-inference, topic, filler, and evidence checks; a [separate decision](2026-10-24-man-roleplayer-concise-advice.md) removes the fixed minimum length after a real conflict with a short-opening request.
