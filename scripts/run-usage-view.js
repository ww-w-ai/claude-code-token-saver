#!/usr/bin/env node
/**
 * Deterministic pipeline runner for usage-view skill.
 * Consolidates all non-LLM steps so the agent only needs 4 tool calls.
 *
 * Modes:
 *   --prepare [--days N] [--current]  → analyze + build REPORT_DATA + export prompt
 *   --finalize --report-data <path> --ai-data <path> --output <path>  → build HTML + open browser
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const SCRIPTS_DIR = __dirname;
const PLUGIN_ROOT = path.join(SCRIPTS_DIR, '..');
const tmpDir = os.tmpdir();
const pid = process.pid;

// ── Parse args ─────────────────────────────────────────────────
const args = process.argv.slice(2);
let mode = null;
let days = null, current = false, locale = null;
let reportDataPath = null, aiDataPath = null, outputPath = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--prepare') mode = 'prepare';
  else if (args[i] === '--finalize') mode = 'finalize';
  else if (args[i] === '--gen-agent-prompt') mode = 'gen-agent-prompt';
  else if (args[i] === '--days' && args[i + 1]) days = args[++i];
  else if (args[i] === '--current') current = true;
  else if (args[i] === '--locale' && args[i + 1]) locale = args[++i];
  else if (args[i] === '--report-data' && args[i + 1]) reportDataPath = args[++i];
  else if (args[i] === '--ai-data' && args[i + 1]) aiDataPath = args[++i];
  else if (args[i] === '--output' && args[i + 1]) outputPath = args[++i];
}

if (!mode) {
  console.error('Usage:\n  node run-usage-view.js --prepare [--days N] [--current]\n  node run-usage-view.js --finalize --report-data <path> --ai-data <path> --output <path>\n  node run-usage-view.js --gen-agent-prompt [--days N] [--current] [--locale XX]');
  process.exit(1);
}

// ── Generate agent prompt mode ────────────────────────────────
if (mode === 'gen-agent-prompt') {
  const templatePath = path.join(PLUGIN_ROOT, 'skills', 'usage-view', 'agent-prompt-template.txt');
  let template = fs.readFileSync(templatePath, 'utf8');

  // Build flags string
  const flags = [];
  if (days) flags.push('--days', days);
  if (current) flags.push('--current');
  if (locale) flags.push('--locale', locale);

  // Resolve locale
  const SUPPORTED_LOCALES = ['en','ko','ja','zh','es','fr','de','pt','it','ru','ar','hi','bn','id','ms','th','vi','tr','pl','nl','he','sv','no'];
  const envLang = (process.env.LANG || '').split(/[_.]/)[0];
  const resolvedLocale = locale && SUPPORTED_LOCALES.includes(locale) ? locale
    : SUPPORTED_LOCALES.includes(envLang) ? envLang : 'en';

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

  execFileSync('node', buildArgs, {
    stdio: ['pipe', 'pipe', 'pipe'],
    maxBuffer: 100 * 1024 * 1024,
  });

  // Resolve locale (same logic as build-report.js)
  const SUPPORTED_LOCALES = ['en','ko','ja','zh','es','fr','de','pt','it','ru','ar','hi','bn','id','ms','th','vi','tr','pl','nl','he','sv','no'];
  const envLang = (process.env.LANG || '').split(/[_.]/)[0];
  const resolvedLocale = locale && SUPPORTED_LOCALES.includes(locale) ? locale
    : SUPPORTED_LOCALES.includes(envLang) ? envLang : 'en';

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
