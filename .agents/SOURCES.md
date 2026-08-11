# Project-local Skill sources

Installed locally: 2026-08-11. Paths are relative to the repository root. Revisions are immutable commit SHAs checked from the upstream repositories before installation. `.agents/skills/` is intentionally ignored by Git: several upstream repositories have no explicit license, and these copies are agent tooling rather than application runtime dependencies.

| Skills | Upstream | Local path | Revision | License at revision |
| --- | --- | --- | --- | --- |
| `emil-design-eng`, `animate`, `find-animation-opportunities`, `improve-animations`, `review-animations` | [emilkowalski/skills](https://github.com/emilkowalski/skills) | `.agents/skills/<skill>` | `78761e1b57f97dce65b983d640c70a68f39e8163` | MIT |
| `sasha`, `serega-gentle`, `serega-emotional` | [mishanaer/deslop](https://github.com/mishanaer/deslop) | `.agents/skills/<skill>` | `9d92c7fe18ef962b4c717055e723210f5ed258da` | No repository-level license found; do not publish this vendored copy until clarified |
| `sound` | [mishanaer/sound](https://github.com/mishanaer/sound) | `.agents/skills/sound` | `5642f509b8cf20176c25f0d237db79f45ebad182` | No license file found; do not publish this vendored copy until clarified |
| `nodumb`, `ask-nodumb`, `system-feedback`, `changelog-discipline` | [hanumatori/nodumbmode](https://github.com/hanumatori/nodumbmode) | `.agents/skills/<skill>` | `44849e0a6895b1f037867413bf54b65d40b78665` | No license file found; do not publish this vendored copy until clarified |

## Installation method

The bundled `skill-installer` helper copied only the selected upstream skill directories into `.agents/skills/`, pinned with `--ref <commit-sha>`. No wrapper Skills were created.

## Update procedure

Skill updates are a separate maintenance task:

1. Fetch the upstream repository and select an explicit commit SHA.
2. Inspect release/history and license changes.
3. Install selected paths into a temporary destination with the bundled `skill-installer` and `--ref <sha>`.
4. Review a recursive diff against `.agents/skills/<skill>`.
5. Replace only approved skill directories, update this file, and validate every `SKILL.md` frontmatter.

Do not auto-update Skills during ordinary product work. Do not stage or publish local copies without separately reviewing the applicable upstream license.
