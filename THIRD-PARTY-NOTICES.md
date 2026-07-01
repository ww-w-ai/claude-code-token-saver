# Third-Party Notices

This project vendors third-party open-source code. Each entry below lists the
component, its upstream source, license type, and the full license text as
required by that license.

---

## pngjs

- **Component:** pngjs
- **Version:** 7.0.0
- **Upstream:** https://github.com/pngjs/pngjs
- **License:** MIT
- **Vendored at:** `scripts/lib/vendor/pngjs/` (copied verbatim from npm tarball `pngjs@7.0.0`; no modifications)
- **Used by:** `scripts/shrink-img.js` (pure-JS PNG decode/encode on non-macOS; box downscale done by shrink-img itself)
- **Why vendored:** the plugin is git-cloned into the Claude Code cache with no `npm install` step, so npm dependencies are unavailable at runtime. pngjs is pure-JS with zero dependencies and uses Node's built-in `zlib`.

### MIT License

```
pngjs original work Copyright (c) 2015 Luke Page & Original Contributors
pngjs derived work Copyright (c) 2012 Kuba Niegowski

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```

---

## jpeg-js

- **Component:** jpeg-js
- **Version:** 0.4.4
- **Upstream:** https://github.com/jpeg-js/jpeg-js
- **License:** BSD-3-Clause
- **Vendored at:** `scripts/lib/vendor/jpeg-js/` (copied verbatim from npm tarball `jpeg-js@0.4.4`; no modifications)
- **Used by:** `scripts/shrink-img.js` (pure-JS JPEG decode/encode on non-macOS; box downscale done by shrink-img itself)
- **Why vendored:** the plugin is git-cloned into the Claude Code cache with no `npm install` step, so npm dependencies are unavailable at runtime. jpeg-js is pure-JS with zero dependencies, so JPEG works everywhere without ffmpeg/ImageMagick.

### BSD-3-Clause License

```
Copyright (c) 2014, Eugene Ware
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright
   notice, this list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright
   notice, this list of conditions and the following disclaimer in the
   documentation and/or other materials provided with the distribution.
3. Neither the name of Eugene Ware nor the names of its contributors
   may be used to endorse or promote products derived from this software
   without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY EUGENE WARE ''AS IS'' AND ANY
EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL EUGENE WARE BE LIABLE FOR ANY
DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```
