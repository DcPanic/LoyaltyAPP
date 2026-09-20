/**
 * First-time setup, for someone who does not want to think about databases.
 *
 *   npm run setup
 *
 * Asks for a database address, writes apps/api/.env with a freshly generated
 * signing secret, creates the tables and offers to fill in demo data. Nothing
 * here needs PostgreSQL installed locally: a free cloud database works, and is
 * the easier path on Windows.
 */
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const ENV_PATH = path.join('apps', 'api', '.env');

/**
 * Everything can also be passed as flags, so the same script works unattended:
 *   npm run setup -- --database-url postgresql://… --seed --force
 */
const argv = process.argv.slice(2);
const flag = (name) => {
  const index = argv.indexOf(`--${name}`);
  return index === -1 ? undefined : (argv[index + 1] ?? '');
};
const has = (name) => argv.includes(`--${name}`);
const nonInteractive = Boolean(flag('database-url'));

function run(command, extraEnv = {}) {
  const result = spawnSync(command, {
    shell: true,
    stdio: 'inherit',
    env: { ...process.env, ...extraEnv },
  });
  return result.status === 0;
}

const rl = nonInteractive ? null : readline.createInterface({ input, output });
const ask = async (question) => (rl ? (await rl.question(question)).trim() : '');

console.log('\nLoyaltyApp — setup\n');

if (fs.existsSync(ENV_PATH) && !has('force')) {
  const answer = await ask(`${ENV_PATH} already exists. Replace it? (y/N) `);
  if (answer.toLowerCase() !== 'y') {
    console.log('Keeping the existing settings. Nothing changed.');
    rl?.close();
    process.exit(0);
  }
}

if (!nonInteractive) {
  console.log('The platform needs a PostgreSQL database.');
  console.log('The easiest free option is https://neon.tech — create a project and');
  console.log('copy its connection string (it starts with postgresql://).');
  console.log('Leave the answer empty to use a database running on this computer.\n');
}

const answer = flag('database-url') ?? (await ask('Database connection string: '));
const databaseUrl = answer || 'postgresql://postgres:postgres@localhost:5432/loyaltyapp';

if (!/^postgres(ql)?:\/\//.test(databaseUrl)) {
  console.error('\nThat does not look like a PostgreSQL connection string. Setup stopped.');
  rl?.close();
  process.exit(1);
}

const env = `# Written by "npm run setup". Keep this file private — it holds the key that
# signs every session. It is already excluded from git.
NODE_ENV=development
PORT=4000
DATABASE_URL=${databaseUrl}
APP_URL=http://localhost:3000
API_URL=http://localhost:4000
CORS_ORIGINS=http://localhost:3000
JWT_SECRET=${crypto.randomBytes(48).toString('base64')}
LOG_LEVEL=info
`;

fs.mkdirSync(path.dirname(ENV_PATH), { recursive: true });
fs.writeFileSync(ENV_PATH, env);
console.log(`\n✓ Settings written to ${ENV_PATH}`);

console.log('\n→ Creating the tables…');
if (!run('npm run db:deploy -w @loyaltyapp/api', { DATABASE_URL: databaseUrl })) {
  console.error(
    '\nCould not reach the database. Check the connection string and run "npm run setup" again.',
  );
  rl?.close();
  process.exit(1);
}
console.log('✓ Database ready');

const seed = nonInteractive
  ? (has('seed') ? 'y' : 'n')
  : await ask('\nAdd a demo café with sample customers? (Y/n) ');
if (seed.toLowerCase() !== 'n') {
  if (run('npm run db:seed -w @loyaltyapp/api', { DATABASE_URL: databaseUrl })) {
    console.log('\n✓ Demo data added');
    console.log('  Owner:   owner@coffeehouse.cy / CoffeeHouse123!');
    console.log('  Barista: barista@coffeehouse.cy / CoffeeHouse123!');
  }
}

rl?.close();

console.log(`
Setup finished. Two ways to use it:

  npm run preview      the app on your phone through Expo Go, from anywhere
  npm run dev:api      the API, with the web app next to it:
  npm run dev:web      http://localhost:3000
`);
