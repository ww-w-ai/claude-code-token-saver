# Contributing to super-token-saver

Thanks for your interest in contributing! This project helps Claude Code users track and reduce token usage.

## Getting Started

1. Fork the repo and clone it locally
2. No `npm install` needed — this project has **zero dependencies**
3. Open the project in your editor of choice

## Testing Changes

There are no automated tests. Test your changes manually:

- **Skills**: Run `/usage-view`, `/s-continue`, `/setup-statusline`, or `/report-limit` inside Claude Code to verify skills work correctly
- **Scripts**: Run the JS scripts in `scripts/` with Node.js against sample JSONL data from `~/.claude/projects/`
- **Translations**: Open the relevant `README.xx.md` file and verify formatting renders correctly

## Submitting a Pull Request

1. Fork the repository
2. Create a feature branch (`git checkout -b my-change`)
3. Make your changes
4. Push to your fork and open a Pull Request against `main`

Keep PRs focused. One feature or fix per PR.

## Translation Contributions

We support 23 languages. All translations are AI-generated and would benefit from native speaker review.

Translation files: `README.xx.md` (e.g., `README.ja.md`, `README.ko.md`) and `locales/xx.json`.

If you're a native speaker and spot awkward phrasing or errors, a PR with corrections is very welcome.

## Code Style

No linter is configured. Follow the patterns you see in existing code. Keep things simple and readable.

## Reporting Bugs

Open a [GitHub Issue](../../issues) with:

- Your Claude Code version
- Your OS
- Steps to reproduce
- Expected vs actual behavior
- Any relevant error output

## Questions?

Open an issue. We're happy to help.
