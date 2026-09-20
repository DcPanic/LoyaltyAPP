/**
 * One command to see the app on a phone that is NOT on your Wi-Fi.
 *
 *   npm run preview
 *
 * Expo's own tunnel already lets a phone anywhere load the app from this
 * computer. The part it does not cover is the API: the app would open and then
 * fail to sign in, because `localhost:4000` means nothing to a phone on mobile
 * data. So this script also puts the API behind a public address and hands that
 * address to the app before starting Expo.
 *
 *   npm run preview -- --api https://my-hosted-api
 *
 * skips the local API and its tunnel, and points the app at an already hosted
 * one — then this computer only serves the app's code.
 */
import { spawn, spawnSync } from 'node:child_process';
import process from 'node:process';

const isWindows = process.platform === 'win32';

const args = process.argv.slice(2);
const apiFlag = args.indexOf('--api');
const hostedApi = apiFlag !== -1 ? args[apiFlag + 1] : undefined;
const API_PORT = process.env.API_PORT ?? '4000';

const children = [];
let shuttingDown = false;

function run(command, { cwd, env, name, onLine } = {}) {
  const child = spawn(command, {
    cwd,
    shell: true,
    env: { ...process.env, ...env },
    stdio: onLine ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  });
  children.push(child);

  if (onLine) {
    const handle = (chunk) => {
      const text = chunk.toString();
      for (const line of text.split('\n')) if (line.trim()) onLine(line);
    };
    child.stdout?.on('data', handle);
    child.stderr?.on('data', handle);
  }

  child.on('exit', (code) => {
    if (!shuttingDown && code !== 0 && code !== null) {
      console.error(`\n[${name ?? command}] stopped with code ${code}`);
    }
  });
  return child;
}

function stopAll() {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of children) {
    try {
      // On Windows a signal only reaches the shell, leaving the API and Metro
      // running and port 4000 busy next time. Kill the whole tree instead.
      if (isWindows && child.pid) {
        spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
      } else {
        child.kill('SIGTERM');
      }
    } catch {
      /* already gone */
    }
  }
}

for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(signal, () => {
    console.log('\nStopping…');
    stopAll();
    process.exit(0);
  });
}
process.on('exit', stopAll);

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForApi(timeoutMs = 90_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(`http://localhost:${API_PORT}/health`, {
        signal: AbortSignal.timeout(2000),
      });
      if (res.ok) return true;
    } catch {
      /* not up yet */
    }
    await delay(1500);
  }
  return false;
}

/** Puts the local API on a public https address, so any phone can reach it. */
function openTunnel() {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (url) => {
      if (!settled) {
        settled = true;
        resolve(url);
      }
    };

    console.log('→ Opening a public address for the API…');
    run(`npx --yes cloudflared tunnel --url http://localhost:${API_PORT}`, {
      name: 'tunnel',
      onLine: (line) => {
        const match = line.match(/https:\/\/[-a-z0-9]+\.trycloudflare\.com/i);
        if (match) finish(match[0]);
      },
    });

    // If cloudflared cannot start (no binary, blocked download), fall back.
    setTimeout(() => {
      if (settled) return;
      console.log('→ Trying a second tunnel provider…');
      run(`npx --yes localtunnel --port ${API_PORT}`, {
        name: 'tunnel',
        onLine: (line) => {
          const match = line.match(/https:\/\/[-a-z0-9.]+\.loca\.lt/i);
          if (match) finish(match[0]);
        },
      });
    }, 25_000);

    setTimeout(() => finish(null), 70_000);
  });
}

async function main() {
  let apiUrl = hostedApi;

  if (!apiUrl) {
    // Reuse an API that is already running rather than fighting over the port.
    if (await waitForApi(3000)) {
      console.log('✓ Using the API already running on this computer');
    } else {
      console.log('→ Starting the API…');
      run('npm run dev:api', { name: 'api' });
    }

    if (!(await waitForApi())) {
      console.error(
        '\nThe API did not start.\n' +
          'Run "npm run setup" first — it prepares the database and the settings file.\n',
      );
      process.exit(1);
    }
    console.log('✓ API is running');

    apiUrl = await openTunnel();
    if (!apiUrl) {
      console.error(
        '\nCould not open a public address for the API.\n' +
          'Your phone will be able to load the app but not sign in.\n' +
          'Host the API instead (see docs/DEPLOY.md) and run:\n' +
          '  npm run preview -- --api https://your-api-address\n',
      );
      process.exit(1);
    }
    console.log(`✓ API is reachable at ${apiUrl}`);
  } else {
    console.log(`→ Using the hosted API at ${apiUrl}`);
  }

  console.log('\n→ Starting Expo. Scan the QR code below with Expo Go.');
  console.log('  Your phone does NOT need to be on this Wi-Fi.\n');

  run('npx expo start --tunnel', {
    cwd: 'apps/mobile',
    name: 'expo',
    env: { EXPO_PUBLIC_API_URL: apiUrl },
  });
}

main().catch((err) => {
  console.error(err);
  stopAll();
  process.exit(1);
});
