import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const IGNORED_PATHS = ['.git', 'node_modules', 'dist', '.vscode'];
const DEBOUNCE_MS = 3000;

let debounceTimer = null;
let isSyncing = false;

function log(msg) {
  const time = new Date().toLocaleTimeString();
  console.log(`[Auto-Sync ${time}] ${msg}`);
}

function runGit(args) {
  return spawnSync('git', args, { cwd: rootDir, encoding: 'utf-8', stdio: 'pipe' });
}

function syncToGitHub() {
  if (isSyncing) return;
  isSyncing = true;

  try {
    const status = runGit(['status', '--porcelain']);
    if (!status.stdout || status.stdout.trim().length === 0) {
      log('No changes detected to push.');
      isSyncing = false;
      return;
    }

    log('Changes detected. Staging changes...');
    runGit(['add', '-A']);

    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const commitMsg = `Auto-sync: update files [${timestamp}]`;

    log(`Committing: "${commitMsg}"...`);
    const commitRes = runGit(['commit', '-m', commitMsg]);
    if (commitRes.status !== 0 && !commitRes.stdout.includes('nothing to commit')) {
      console.error(commitRes.stderr || commitRes.stdout);
    }

    log('Pushing to origin main...');
    const pushRes = runGit(['push', 'origin', 'main']);
    if (pushRes.status === 0) {
      log('✅ Successfully pushed updates to GitHub (origin/main)!');
    } else {
      log(`⚠️ Push error: ${pushRes.stderr || pushRes.stdout}`);
    }
  } catch (err) {
    console.error('Auto-sync execution error:', err);
  } finally {
    isSyncing = false;
  }
}

function triggerDebouncedSync() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    syncToGitHub();
  }, DEBOUNCE_MS);
}

log(`Watching for changes in ${rootDir}...`);
log('Any file changes will be automatically committed and pushed to GitHub.');

// Perform initial check on startup
syncToGitHub();

fs.watch(rootDir, { recursive: true }, (eventType, filename) => {
  if (!filename) return;

  const normalized = filename.replace(/\\/g, '/');
  const shouldIgnore = IGNORED_PATHS.some((p) => normalized === p || normalized.startsWith(`${p}/`));
  if (shouldIgnore) return;

  log(`Change detected in ${normalized} (${eventType})`);
  triggerDebouncedSync();
});
