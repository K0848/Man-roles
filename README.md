# Man-roles · 向古人问惑

English | [中文](README.zh.md)

A local historical-persona conversation prototype built on DeepSeek Harness. Discuss a personal dilemma with Wang Yangming, Zeng Guofan, Zhuangzi, Su Shi or Zhu Xi. Research files and persona presets shape their expression. Answers are model-generated, and are not historical quotations or professional advice.

This repository is the unified engineering root. Continue development directly here; run installation, builds and tests from this directory.

## Product source

| Path | Responsibility |
| --- | --- |
| `packages/extensions/man-roleplayer/` | Product domain, conversation lifecycle and persona presets |
| `packages/client/ui-man-roleplayer/` | Browser UI and interaction controls |
| `packages/bundle/man-roleplayer-app/` | Product profile and module assembly |
| `research/调研成果-*.md` | Research for the five personas |
| `apps/`, other `packages/`, `scripts/` | Shared DSH runtime, tooling and tests |
| `start-man-roles.ps1` / `.cmd` | Windows local launcher |

## Install and build

Use Windows PowerShell, Node.js `^22.19.0 || >=24.0.0` and pnpm `11.7.0`, as specified in the root `package.json`. Dependency installation needs network access. Run at the repository root and wait for each command to succeed:

```powershell
pnpm install --frozen-lockfile
pnpm run build
```

Resolve installation or build errors before starting. The lockfile fixes dependency resolution; platform and native dependency support still need verification on your machine.

## Run

Set your own API key in the current PowerShell process:

```powershell
$env:DEEPSEEK_API_KEY = '<YOUR_DEEPSEEK_API_KEY>'
.\start-man-roles.ps1
```

`start-man-roles.cmd` also works from a shell that already has the environment variable. Never commit real keys. The default provider is `deepseek-official` and model is `deepseek-v4-flash`; the account must support the model, and API calls may incur charges. Use `-Model` for another supported model. The provider adapter also reads optional `DEEPSEEK_BASE_URL`.

The launcher binds to `http://127.0.0.1:3085/` and runs in the foreground. Press Ctrl+C to stop. An occupied port produces an error; the launcher does not stop another process.

```powershell
.\start-man-roles.ps1 -NoOpen
.\start-man-roles.ps1 -Port 3086 -Model 'deepseek-v4-flash'
```

Source, presets and research are resolved relative to this root. On first launch, DSH creates the `man-roles-mvp-web` profile and assembles base, web-app and man-roleplayer-app. Start with an empty data directory and your own credentials; no original user profiles, settings, conversations or runtime database are shipped.

## Local data and privacy

The default data directory is `.local/dsh-home/`, containing generated profiles, sessions and settings. Keep `.local/` ignored by Git. `-DshHome 'another local directory'` selects a separate location; ensure your custom directory is also excluded from version control. The launcher does not persist the API key, but runtime credential/settings features and files you create require your own care.

Conversation text and required persona context are sent to the configured model service. Exclude sensitive information you should not share with that service. `.gitignore` protects matching untracked paths, not tracked contents or past commits. Review new fixtures and screenshots for private content. Original credentials, browser state, backups and private working notes are not included.

## Checks and development

A configuration check does not listen on a port or call the model, but initializes a profile in the chosen data directory:

```powershell
.\start-man-roles.ps1 -DumpConfig -DshHome "$env:TEMP\man-roles-config-check"
```

This establishes configuration assembly only. Review output before sharing because later personal settings may appear in it. After changing product or runtime code, rebuild at this root and restart the same acceptance port.

Run relevant tests at this root; see [testing guidance](docs/testing.md) and `apps/web/tests/man-roleplayer-*.e2e.ts`. `pnpm test` runs the unit-test suite; browser tests have separate configuration and prerequisites described in that guidance. After equivalent edits to both README languages, run `pnpm run verify-translation-pairing --write README.md`.

Installation, real-provider calls, browser flows and long-running behavior need verification in the user's environment. This source delivery does not establish production deployment, old-data migration or complete cross-platform acceptance.

## Origin and license

Before committing changes to repository layout or `.gitignore`, run `node scripts/verify-publish-ignore.mjs`. It checks excluded and publishable paths and reports any tracked files that conflict with the ignore rules; review actual staged content separately for private information.

The runtime comes from [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness). Source provenance and maintenance boundaries are in [SOURCE.md](SOURCE.md). Original copyright notices and the [MIT license](LICENSE) are retained, as are [vendor notices](vendor/README.md) and applicable third-party licenses. Research documents are project-curated material; quoted material remains subject to its original rights.
