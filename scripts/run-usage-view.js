#!/usr/bin/env node
/**
 * run-usage-view.js — Orchestrator for /usage-view skill
 *
 * Consolidates the deterministic pipeline (analyze → build → open) so the
 * LLM agent needs minimal tool calls. The agent should NEVER call
 * analyze-usage.js or build-report.js directly — always go through this runner.
 *
 * Modes:
 *   --gen-agent-prompt [--days N] [--current] [--locale XX] [--plan <plan>] [--project <name>] [--all] [--no-ai|--ai]
 *
 * Note: --current implies --no-ai by default (fast rendering for quick check).
 *       Pass --ai to re-enable AI analysis in current mode.
 *     → Run full pipeline: analyze → build REPORT_DATA → export AI prompt → write agent instructions
 *     → Outputs JSON: { agentPromptFile: "/tmp/..." }
 *     → Agent reads that file and follows instructions (AI analysis → finalize)
 *
 *   --prepare [--days N] [--current] [--locale XX] [--plan <plan>] [--project <name>] [--all]
 *     → analyze-usage.js + build-report.js --export-data + --export-prompt
 *     → Outputs JSON: { reportDataFile, promptFile, outputFile }
 *
 *   --finalize --report-data <path> --ai-data <path> --output <path> [--locale XX] [--plan <plan>] [--project <name>]
 *     → build-report.js --import-data + --ai-data → final HTML + open browser
 *
 * Project scoping:
 *   --project <name>  Scope to a single project (hashed CWD, e.g. -Users-foo-myproject)
 *   --all             Analyze all projects (ignore CWD-based default)
 *   (default)         Derive project from current working directory via projectNameFromCwd()
 *
 * Cache structure: ~/.claude/claude-code-token-saver-data/{projectName}/{sessionId}/
 *
 * Pipeline:
 *   /usage-view skill
 *     → Agent calls: run-usage-view.js --gen-agent-prompt
 *       → analyze-usage.js (transcript → JSON + timeline CSVs)
 *       → build-report.js --export-data --export-prompt (REPORT_DATA + AI prompt)
 *       → writes agent prompt file
 *     → Agent reads prompt, generates AI analysis
 *     → Agent calls: run-usage-view.js --finalize (inject AI → HTML → open browser)
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { SUPPORTED_LOCALES, resolveLocale } = require('./lib/locale');
const { projectNameFromCwd } = require('./lib/cache-paths');

const SCRIPTS_DIR = __dirname;
const PLUGIN_ROOT = path.join(SCRIPTS_DIR, '..');
const tmpDir = os.tmpdir();
const pid = process.pid;

// ── Parse args ─────────────────────────────────────────────────
const args = process.argv.slice(2);
let mode = null;
let days = null, current = false, locale = null, plan = null;
let reportDataPath = null, aiDataPath = null, outputPath = null;
let projectArg = null, allProjects = false, noAi = false, forceAi = false, privateMode = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--prepare') mode = 'prepare';
  else if (args[i] === '--finalize') mode = 'finalize';
  else if (args[i] === '--gen-agent-prompt') mode = 'gen-agent-prompt';
  else if (args[i] === '--days' && args[i + 1]) { days = args[++i]; if (days === 'all') days = '0'; }
  else if (args[i] === '--current') current = true;
  else if (args[i] === '--locale' && args[i + 1]) locale = args[++i];
  else if (args[i] === '--report-data' && args[i + 1]) reportDataPath = args[++i];
  else if (args[i] === '--ai-data' && args[i + 1]) aiDataPath = args[++i];
  else if (args[i] === '--output' && args[i + 1]) outputPath = args[++i];
  else if (args[i] === '--plan' && args[i + 1]) plan = args[++i];
  else if (args[i] === '--project' && args[i + 1]) projectArg = args[++i];
  else if (args[i] === '--all') allProjects = true;
  else if (args[i] === '--no-ai') noAi = true;
  else if (args[i] === '--ai') forceAi = true;
  else if (args[i] === '--private') privateMode = true;
}

// --current defaults to --no-ai for fast rendering. Opt in with --ai.
if (current && !forceAi) noAi = true;

// Resolve project: --project > default (all projects)
const resolvedProject = projectArg || null;

if (!mode) {
  console.error('Usage:\n  node run-usage-view.js --prepare [--days N] [--current]\n  node run-usage-view.js --finalize --report-data <path> --ai-data <path> --output <path>\n  node run-usage-view.js --gen-agent-prompt [--days N] [--current] [--locale XX]');
  process.exit(1);
}

// ── Generate agent prompt mode ────────────────────────────────
if (mode === 'gen-agent-prompt') {
  // --no-ai: run entire pipeline directly (no LLM needed), output same format as finalize
  if (noAi) {
    // 1. Prepare (analyze + build-report → JSON)
    const resultsFile = path.join(tmpDir, `cc-usage-data-${pid}.json`);
    const analyzeArgs = [path.join(SCRIPTS_DIR, 'analyze-usage.js')];
    if (days) analyzeArgs.push('--days', days);
    if (resolvedProject) analyzeArgs.push('--project', resolvedProject);
    const analyzeOutput = execFileSync('node', analyzeArgs, {
      stdio: ['pipe', 'pipe', 'inherit'],
      maxBuffer: 100 * 1024 * 1024,
    });
    fs.writeFileSync(resultsFile, analyzeOutput);

    const reportDataFile = path.join(tmpDir, `cc-report-data-${pid}.json`);
    const outputFile = path.join(tmpDir, `cc-usage-report-${Math.floor(Date.now() / 1000)}.html`);
    const buildArgs = [
      path.join(SCRIPTS_DIR, 'build-report.js'),
      '--data', resultsFile,
      '--export-data', reportDataFile,
      '--output', outputFile,
    ];
    if (current) buildArgs.push('--current');
    if (locale) buildArgs.push('--locale', locale);
    if (plan) buildArgs.push('--plan', plan);
    if (resolvedProject) buildArgs.push('--project', resolvedProject);
    if (privateMode) buildArgs.push('--private');
    execFileSync('node', buildArgs, {
      stdio: ['pipe', 'pipe', 'pipe'],
      maxBuffer: 100 * 1024 * 1024,
    });

    // 2. Open browser
    try { execFileSync('open', [outputFile]); } catch (_) {}

    // 3. Output summary (same as finalize)
    const data = JSON.parse(fs.readFileSync(reportDataFile, 'utf8'));
    const s = data.summary;
    console.log(JSON.stringify({
      outputFile,
      sessions: `${s.sessionCount} main + ${s.subtaskCount || 0} subtasks`,
      dateRange: `${s.dateFrom} ~ ${s.dateTo}`,
      totalCost: `$${s.totalCost}`,
    }));
    process.exit(0);
  }

  const templatePath = path.join(PLUGIN_ROOT, 'skills', 'usage-view', 'agent-prompt-template.txt');
  let template = fs.readFileSync(templatePath, 'utf8');

  // Build flags string
  const flags = [];
  if (days) flags.push('--days', days);
  if (current) flags.push('--current');
  if (locale) flags.push('--locale', locale);
  if (plan) flags.push('--plan', plan);
  if (resolvedProject) flags.push('--project', resolvedProject);
  else if (allProjects) flags.push('--all');
  if (privateMode) flags.push('--private');

  // Resolve locale
  const resolvedLocale = resolveLocale(locale);

  template = template.replace(/\{\{PLUGIN_ROOT\}\}/g, PLUGIN_ROOT);
  template = template.replace(/\{\{FLAGS\}\}/g, flags.join(' '));
  template = template.replace(/\{\{LOCALE\}\}/g, resolvedLocale);
  template = template.replace(/\{\{TMPDIR\}\}/g, tmpDir);

  const promptFile = path.join(tmpDir, `cc-agent-prompt-${pid}.txt`);
  fs.writeFileSync(promptFile, template);

  console.log(JSON.stringify({ agentPromptFile: promptFile }));
  process.exit(0);
}

// ── Prepare mode ───────────────────────────────────────────────
if (mode === 'prepare') {
  const resultsFile = path.join(tmpDir, `cc-usage-data-${pid}.json`);
  const analyzeArgs = [path.join(SCRIPTS_DIR, 'analyze-usage.js')];
  if (days) analyzeArgs.push('--days', days);
  if (resolvedProject) analyzeArgs.push('--project', resolvedProject);

  const analyzeOutput = execFileSync('node', analyzeArgs, {
    stdio: ['pipe', 'pipe', 'inherit'],
    maxBuffer: 100 * 1024 * 1024,
  });
  fs.writeFileSync(resultsFile, analyzeOutput);

  const promptFile = path.join(tmpDir, `cc-ai-prompt-${pid}.txt`);
  const reportDataFile = path.join(tmpDir, `cc-report-data-${pid}.json`);

  const buildArgs = [
    path.join(SCRIPTS_DIR, 'build-report.js'),
    '--data', resultsFile,
    '--output', '/dev/null',
    '--export-prompt', promptFile,
    '--export-data', reportDataFile,
  ];
  if (current) buildArgs.push('--current');
  if (locale) buildArgs.push('--locale', locale);
  if (plan) buildArgs.push('--plan', plan);
  if (resolvedProject) buildArgs.push('--project', resolvedProject);
  if (privateMode) buildArgs.push('--private');

  execFileSync('node', buildArgs, {
    stdio: ['pipe', 'pipe', 'pipe'],
    maxBuffer: 100 * 1024 * 1024,
  });

  // Resolve locale (same logic as build-report.js)
  const resolvedLocale = resolveLocale(locale);

  const result = {
    promptFile,
    reportDataFile,
    resultsFile,
    locale: resolvedLocale,
  };
  console.log(JSON.stringify(result));
  process.exit(0);
}

// ── Finalize mode ──────────────────────────────────────────────
if (mode === 'finalize') {
  if (!reportDataPath || !outputPath) {
    console.error('--finalize requires --report-data and --output');
    process.exit(1);
  }

  const buildArgs = [
    path.join(SCRIPTS_DIR, 'build-report.js'),
    '--import-data', reportDataPath,
    '--output', outputPath,
  ];
  if (aiDataPath && fs.existsSync(aiDataPath)) {
    buildArgs.push('--ai-data', aiDataPath);
  }
  if (locale) buildArgs.push('--locale', locale);
  if (plan) buildArgs.push('--plan', plan);
  if (resolvedProject) buildArgs.push('--project', resolvedProject);
  if (privateMode) buildArgs.push('--private');

  execFileSync('node', buildArgs, {
    stdio: ['pipe', 'pipe', 'pipe'],
    maxBuffer: 100 * 1024 * 1024,
  });

  const platform = os.platform();
  try {
    if (platform === 'darwin') {
      execFileSync('open', [outputPath]);
    } else {
      execFileSync('xdg-open', [outputPath]);
    }
  } catch (e) {
    // Ignore open errors (headless environments)
  }

  let summary = {};
  try {
    const data = JSON.parse(fs.readFileSync(reportDataPath, 'utf8'));
    summary = data.summary || {};
  } catch (e) {}

  const result = {
    outputFile: outputPath,
    sessions: `${summary.sessionCount || '?'} main + ${summary.subtaskCount || '?'} subtasks`,
    dateRange: `${summary.dateFrom || '?'} ~ ${summary.dateTo || '?'}`,
    totalCost: summary.totalCost ? `$${summary.totalCost.toLocaleString()}` : '?',
  };
  console.log(JSON.stringify(result));
  process.exit(0);
}
