const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PROJECT_ROOT = process.cwd();
const AUTH_DIR = path.join(PROJECT_ROOT, '.wwebjs_auth');
const SESSION_DIR = path.join(AUTH_DIR, 'session');
const CACHE_DIR = path.join(PROJECT_ROOT, '.wwebjs_cache');

const STALE_LOCK_FILES = [
  'lockfile',
  'DevToolsActivePort',
  'SingletonLock',
  'SingletonCookie',
  'SingletonSocket',
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stopBotProcesses() {
  const projectPath = PROJECT_ROOT.replace(/'/g, "''");

  const ps = `
    $project = '${projectPath}'
    Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
      Where-Object { $_.CommandLine -like "*$project*" -and $_.CommandLine -like "*index.js*" } |
      ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
    Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" -ErrorAction SilentlyContinue |
      Where-Object { $_.CommandLine -like "*wwebjs_auth*" } |
      ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  `;

  try {
    execSync(`powershell -NoProfile -Command "${ps.replace(/\n/g, ' ')}"`, {
      stdio: 'ignore',
      windowsHide: true,
    });
  } catch {
    // No matching processes — that's fine
  }
}

function removeStaleBrowserLocks() {
  if (!fs.existsSync(SESSION_DIR)) return;

  for (const file of STALE_LOCK_FILES) {
    const filePath = path.join(SESSION_DIR, file);
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`Removed stale lock: ${file}`);
      }
    } catch {
      // Will retry during folder removal
    }
  }
}

async function removeDir(dirPath, label, { retries = 8, delayMs = 1500 } = {}) {
  if (!fs.existsSync(dirPath)) return true;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      fs.rmSync(dirPath, {
        recursive: true,
        force: true,
        maxRetries: 5,
        retryDelay: 500,
      });
      console.log(`Removed ${label}/`);
      return true;
    } catch (err) {
      if (attempt === retries) {
        console.error(`Could not remove ${label}/: ${err.message}`);
        return false;
      }
      console.log(`Waiting for ${label} to unlock (attempt ${attempt}/${retries})...`);
      stopBotProcesses();
      removeStaleBrowserLocks();
      await sleep(delayMs);
    }
  }

  return false;
}

async function resetSession() {
  console.log('Stopping any running bot processes...');
  stopBotProcesses();
  await sleep(2000);

  removeStaleBrowserLocks();

  const authOk = await removeDir(AUTH_DIR, '.wwebjs_auth');
  const cacheOk = await removeDir(CACHE_DIR, '.wwebjs_cache');

  if (!authOk || !cacheOk) {
    console.error('\nSession reset incomplete.');
    console.error('Close any terminal running "npm start", then run:');
    console.error('  npm run reset-session\n');
    process.exit(1);
  }

  console.log('\nSession reset complete. Run npm start and scan the QR code again.\n');
}

module.exports = {
  AUTH_DIR,
  SESSION_DIR,
  CACHE_DIR,
  stopBotProcesses,
  removeStaleBrowserLocks,
  resetSession,
};

if (require.main === module) {
  resetSession();
}
