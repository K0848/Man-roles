# Source and maintenance

This repository includes the working DeepSeek Harness source based on upstream commit `8fcdee854e9a27d9e2060abd127445769bff3cc2`, plus the Man-roles product modules and required local integration changes. Upstream: https://github.com/deepseek-ai/deepseek-harness . Copyright notices, MIT license and third-party notices are retained. This repository starts with a new source commit; upstream Git history is not bundled.

Develop directly at this repository root as one pnpm workspace. Source, package manifest, lockfile, build configuration and launchers share this root; there is no nested source checkout. The launcher reads the five research files from `research/`. Commit source, lockfiles, required tests and product assets. Do not commit user data, credentials, generated screenshots, private working notes or local acceptance configuration. Tests contain regression fixtures; no product demo conversation database is shipped.

Before publishing an update, inspect `git status --short` and `git diff --cached`, run relevant tests and `pnpm run build` at the repository root, and check files for private content. `.gitignore` excludes matching untracked local state; it cannot redact tracked file contents or previous commits. A newly added fixture or screenshot needs content review even when its path is not ignored.

CI workflows are not enabled in this source delivery. Runtime configuration is created on first launch under the ignored `.local/` directory. The build and targeted tests can be run locally without publishing anything.

The product domain is `packages/extensions/man-roleplayer/`, the browser UI is `packages/client/ui-man-roleplayer/`, and product assembly is `packages/bundle/man-roleplayer-app/`. Existing package names and dependency identities are retained for workspace compatibility. Start with an empty data directory and your own credentials; no original user profiles, conversations, settings or runtime database are shipped. A custom `-DshHome` requires its own version-control exclusion. Original copyright notices, the root MIT `LICENSE`, and `vendor/` notices remain applicable.
