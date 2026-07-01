# Vendored: pngjs

- **Library:** pngjs
- **Version:** 7.0.0
- **Upstream:** https://github.com/pngjs/pngjs
- **License:** MIT (see `LICENSE` in this directory)
- **Why vendored:** the claude-code-token-saver plugin is git-cloned into the Claude
  Code cache with NO `npm install` step (no `package.json` / `node_modules` at
  runtime), so npm dependencies cannot be resolved at a user's machine. pngjs is
  pure-JS, has ZERO dependencies, and decodes/encodes PNG using Node's built-in
  `zlib` — so vendoring its `lib/` folder verbatim makes it available offline.
- **Used by:** `scripts/shrink-img.js` (non-macOS PNG downscale path), via the
  synchronous entry point `lib/png-sync.js` (`read` / `write`).
- **Modifications:** none. Files copied verbatim from the npm tarball `pngjs@7.0.0`.

License attribution is also recorded in the repo root `THIRD-PARTY-NOTICES.md`.
