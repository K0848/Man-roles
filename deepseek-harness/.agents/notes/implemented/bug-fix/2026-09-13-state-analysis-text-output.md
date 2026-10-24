# Agent Note: State analysis reserves output for structured text

Status: implemented

English | [中文](2026-09-13-state-analysis-text-output.zh.md)

## Problem

Real `deepseek-v4-flash` persona answers completed, but every detached state-analysis operation failed as a provider error. The product event did not retain the bounded underlying error, so retries could not distinguish transport failure from an empty or malformed model response. A diagnostic retry proved that the provider returned no text while the call still had a 2,048-token output ceiling and inherited the model's reasoning mode.

## Decision

State analysis resolves the selected model's capabilities before dispatch. When the model advertises the `off` reasoning effort, the state-only call explicitly selects it so its bounded output budget is reserved for the required JSON text. Models that do not advertise that effort keep their existing call configuration rather than receiving an unsupported override.

A failed internal `state-analysis` event may persist `failureDetail`, a maximum 300-character diagnostic containing only error name, primitive code/status fields, and a whitespace-normalized message. It never includes the request messages, prompt, credentials, user content, or Session identity, and the product Remote does not project it to the browser.

The existing detached operation, input watermark, revision checks, and explicit retry operation remain unchanged. A successful retry publishes state from the persisted authority input without regenerating the already accepted persona answer.

## Alternatives considered

**Treat reasoning deltas as the JSON answer.** Reasoning is not the model's final response contract and may contain partial, revised, or private intermediate content. Promoting it would violate both structured validation and reasoning boundaries.

**Increase the state-analysis token ceiling.** A larger shared reasoning-plus-text budget would increase cost without guaranteeing that final text appears. The operation needs structured text, not more hidden deliberation.

**Retry every provider failure automatically.** Blind retries can repeat charges and hide persistent configuration errors. The product keeps explicit retry semantics and first records a bounded cause.

## Consequences

The real fixed-port retry now completes state analysis and preserves the existing persona answer. Reasoning-capable persona turns are unaffected because only the detached state-analysis call requests `off`.

The diagnostic is durable internal data and must remain bounded and unprojected. Providers that cannot disable reasoning may still return no text; those failures remain visible through the same category and diagnostic without weakening the JSON schema.
