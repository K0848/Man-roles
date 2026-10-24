# Agent Note: Advice answers require a usefulness floor

Status: implemented

English | [中文](2026-09-13-advice-answer-usefulness-floor.zh.md)

## Problem

The accepted-only gate proved that an answer's claims were structurally valid and supported by compatible evidence, but it did not prove that the answer addressed the user's request. In a real Zhuangzi run, repeated incompatible claim attempts ended with one valid 35-character historical attribution. The Host accepted that sentence as the complete answer even though the user had asked how to decide and act.

## Decision

The Host applies a narrow deterministic usefulness floor when the current user message contains explicit advice wording such as “how,” “what should I do,” or “should I.” The submitted answer must contain at least 80 non-whitespace Unicode graphemes and at least one `modern-inference` claim segment with no evidence IDs. That guidance segment must share a non-generic topic term with the user's message. Historical and quotation segments retain their existing provenance validation, but cannot complete an advice turn by themselves.

The numeric threshold is an internal floor and is not exposed in the model-facing policy or repair error. Submissions containing validation-oriented filler such as “placeholder,” “submission pipeline,” or “pass the character limit” are rejected before completion.

Identity questions, low-information openings, and factual questions keep their existing specialized behavior. The minimum is enforced after the ordinary segment and evidence checks, inside the same live turn submission lease, so an invalid attempt remains private and the model can correct it without creating another product turn.

The model-facing submission description also states the mapping from research provenance to Claim kinds. Reliable first-person authorial text can use `reliable-quote`; reliable historical accounts can use `historical-fact`; textual parables, disciple records, other speakers, later evaluations, variants, and contested attributions use `attribution`; modern advice uses `modern-inference` without evidence IDs.

## Alternatives considered

**Prompt-only guidance.** The failed real run already had instructions to submit a complete answer. A probabilistic instruction could not protect a deterministic product completion state.

**Apply one minimum length to every turn.** This would force greetings, identity replies, and concise factual answers to become padded prose, reducing usefulness instead of protecting it.

**Use length alone for advice turns.** A real regression immediately produced explicit validation filler to reach the disclosed threshold. Length remains one private signal, paired with topic overlap and a ban on validation-oriented prose.

**Use another model to score answer relevance.** A semantic judge would add latency, cost, and a second probabilistic completion gate. The observed failure has a smaller deterministic signature that the Host can verify.

## Consequences

An advice turn can no longer complete with only a short citation or historical aside. Failed submissions remain available to the same model turn as repair feedback, preserving the existing accepted-only and idempotency boundaries.

The trigger is intentionally conservative and will miss some implicitly advice-seeking messages. Topic overlap can prove connection, not sound judgment, and the private 80-character threshold is still only a floor. Real-persona evaluation remains responsible for judging tone, relevance, distinctiveness, latency, and value.
