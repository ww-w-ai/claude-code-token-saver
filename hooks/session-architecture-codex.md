## Codex Session Architecture

Keep the root session thin: cost grows with context size and repeated tool round-trips. User instructions and applicable repository rules override these defaults.

### Route work deliberately

- **Plan and design in the root session.** Keep scope, architecture decisions, integration, and completion claims with the root agent.
- **Delegate only when allowed and useful.** When the user or applicable instructions allow collaboration agents, use a purpose-fit explorer for bounded discovery and a worker for an explicitly owned implementation slice.
- **Keep reviews independent.** Use a fresh context for an independent review when the governing workflow requires one.
- **Keep delegation scoped.** Every delegated task needs a concrete goal, owned files or responsibility, evidence to return, and explicit exclusions.

### Minimize tool round-trips

Each round-trip carries the current conversation again. Reduce repeated context reads.

1. Bundle independent tool calls in one request.
2. Plan each batch before running it.
3. Search all likely targets first, then read only the relevant ranges.
4. Stop when the available evidence answers the question.
5. Let a delegated task absorb its own internal tool calls when delegation is authorized.

### Minimize context growth

Prefer the smallest source that can answer the question.

1. Use a code knowledge graph or symbol tools when the project provides them.
2. Use `rg` or targeted file discovery for strings, paths, and non-code files.
3. Read specific ranges or definitions before reading a full file.
4. Compare changes with `git diff` instead of rereading both versions.
5. Patch existing files with focused diffs. Create a whole file only when it is genuinely new.

### Shrink image files before attaching them

For most file-path image attachments, create a smaller copy first. Keep the original when small text or fine detail is required.

```
node __PLUGIN_ROOT__/scripts/shrink-img.js <src> [--scale 0.5] [--maxdim 1000] [--width <px>] [--height <px>] [--maxmp <mp>] [--quality 1-100]
```

The command writes `<name>-sm.<ext>`, preserves aspect ratio, and never upscales. With no sizing flag, the longest side defaults to 1000px.

### Communicate efficiently

- Match response length to task complexity.
- Lead with the outcome.
- Give brief progress updates during tool-heavy work.
- Include evidence, risks, and actionable choices.
- Cut narration that does not change the user's next action.
- Do not repeat a summary immediately after presenting the same result.

### After `/s-continue`

Restored content may include verbatim Codex rollout turns and a saved handoff. Treat the restored turns and repository state as evidence. Recheck live state before resuming mutations.

### When reasoning stalls

- **Dialectic:** explain why apparently conflicting evidence differs, then synthesize it.
- **Metacognition:** after three similar failures, reassess the approach instead of retrying it.
- **Plan-Monitor-Evaluate:** choose a strategy, monitor evidence during execution, and verify completeness afterward.
- **Shift direction:** abstract the core problem, invert the premise, use an analogy, or return to first principles.
