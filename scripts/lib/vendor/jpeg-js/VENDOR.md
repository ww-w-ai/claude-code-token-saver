# Vendored: jpeg-js

- **Library:** jpeg-js
- **Version:** 0.4.4
- **Upstream:** https://github.com/jpeg-js/jpeg-js
- **License:** BSD-3-Clause (see `LICENSE` in this directory)
- **Why vendored:** the super-token-saver plugin is git-cloned into the Claude
  Code cache with NO `npm install` step (no `package.json` / `node_modules` at
  runtime), so npm dependencies cannot be resolved at a user's machine. jpeg-js is
  pure-JS with ZERO dependencies, so vendoring it verbatim makes JPEG decode/encode
  available offline on every platform — without ffmpeg or ImageMagick.
- **Used by:** `scripts/shrink-img.js` (non-macOS JPEG downscale path), via the
  entry point `index.js` (`decode` / `encode`).
- **Modifications:** none. Files copied verbatim from the npm tarball `jpeg-js@0.4.4`.

License attribution is also recorded in the repo root `THIRD-PARTY-NOTICES.md`.
