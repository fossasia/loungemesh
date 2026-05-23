#!/usr/bin/env node
/**
 * Safe env setup: merges templates into `.env` without overwriting existing secrets.
 *
 * Usually invoked via scripts/flowspace.sh (npm run setup / npm run deploy), e.g.:
 *
 *   node scripts/setup-env.mjs development
 *   node scripts/setup-env.mjs production --app-host=... --jitsi-host=... --public-ip=...
 *   node scripts/setup-env.mjs production --from-env   # infer host + IP from existing .env (deploy)
 *   node scripts/setup-env.mjs development --rotate-passwords  # only placeholder Jitsi passwords
 *
 * Passwords (JICOFO_*, JVB_*, etc.) are NEVER rotated on re-run unless they are still
 * placeholders or you pass --rotate-passwords / --force-passwords.
 *
 *   --force            reset non-secret keys from template (passwords still kept)
 *   --force-passwords  rotate all Jitsi passwords (breaks running Prosody until redeploy)
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const target = path.join(root, '.env');

const PASSWORD_KEYS = new Set([
  'JICOFO_AUTH_PASSWORD',
  'JVB_AUTH_PASSWORD',
  'JIGASI_XMPP_PASSWORD',
  'JIGASI_TRANSCRIBER_PASSWORD',
  'JIBRI_RECORDER_PASSWORD',
  'JIBRI_XMPP_PASSWORD',
]);

const PRODUCTION_URL_KEYS = new Set([
  'PUBLIC_URL',
  'VITE_JITSI_PUBLIC_URL',
  'FLOWSPACE_PUBLIC_URL',
  'DOCKER_HOST_ADDRESS',
  'JVB_WS_DOMAIN',
  'JVB_WS_TLS',
]);

const PLACEHOLDER = /replace-me|^__\w+__$|^unused$/i;

function parseArgs(argv) {
  const out = {
    mode: 'development',
    rotateOnly: false,
    force: false,
    forcePasswords: false,
    fromEnv: false,
  };
  for (const arg of argv) {
    if (arg === '--rotate-passwords') out.rotateOnly = true;
    else if (arg === '--from-env') out.fromEnv = true;
    else if (arg === '--force') out.force = true;
    else if (arg === '--force-passwords') out.forcePasswords = true;
    else if (arg === 'production' || arg === 'development') out.mode = arg;
    else if (arg.startsWith('--app-host=')) out.appHost = arg.slice('--app-host='.length);
    else if (arg.startsWith('--jitsi-host=')) out.jitsiHost = arg.slice('--jitsi-host='.length);
    else if (arg.startsWith('--public-ip=')) out.publicIp = arg.slice('--public-ip='.length);
  }
  return out;
}

function rand() {
  return crypto.randomBytes(16).toString('hex');
}

function stripProtocol(host) {
  return host.replace(/^https?:\/\//i, '').replace(/\/$/, '');
}

/** @returns {Map<string, string>} */
function parseEnvLines(text) {
  const map = new Map();
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    map.set(key, value);
  }
  return map;
}

/** @param {Map<string, string>} map */
function serializeEnv(map, templateText) {
  const lines = [];
  const written = new Set();

  for (const line of templateText.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      lines.push(line);
      continue;
    }
    const eq = trimmed.indexOf('=');
    if (eq === -1) {
      lines.push(line);
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    if (map.has(key)) {
      lines.push(`${key}=${map.get(key)}`);
      written.add(key);
    } else {
      lines.push(line);
    }
  }

  for (const [key, value] of map) {
    if (!written.has(key)) {
      lines.push(`${key}=${value}`);
    }
  }

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}

function isPlaceholder(value) {
  if (value === undefined || value === '') return true;
  return PLACEHOLDER.test(value);
}

function applyProductionPlaceholders(text, { appHost, jitsiHost, publicIp }) {
  const app = appHost || jitsiHost;
  return text
    .replaceAll('__APP_HOST__', app)
    .replaceAll('__JITSI_HOST__', jitsiHost)
    .replaceAll('__PUBLIC_IP__', publicIp);
}

function passwordValue(key, current, templateValue, { forcePasswords }) {
  if (forcePasswords) return rand();
  if (!isPlaceholder(current) && current !== undefined) return current;
  if (isPlaceholder(templateValue)) return rand();
  return templateValue;
}

/**
 * @returns {{ merged: Map<string, string>, summary: { added: string[], updated: string[], preservedSecrets: string[], preserved: string[] } }}
 */
function mergeMaps(existing, template, { force, forcePasswords, mode, appHost, jitsiHost, publicIp }) {
  const out = new Map(existing);
  const summary = { added: [], updated: [], preservedSecrets: [], preserved: [] };
  const jitsiUrl = jitsiHost ? `https://${stripProtocol(jitsiHost)}` : '';
  const appUrl = appHost ? `https://${stripProtocol(appHost)}` : jitsiUrl;
  const cliUrls = Boolean(jitsiHost && publicIp);

  for (const [key, templateValue] of template) {
    const current = out.get(key);
    const hadKey = current !== undefined;

    if (PASSWORD_KEYS.has(key)) {
      const next = passwordValue(key, current, templateValue, { forcePasswords });
      if (!hadKey) {
        out.set(key, next);
        summary.added.push(key);
      } else if (next !== current) {
        out.set(key, next);
        summary.updated.push(`${key} (generated)`);
      } else {
        summary.preservedSecrets.push(key);
      }
      continue;
    }

    if (mode === 'production' && PRODUCTION_URL_KEYS.has(key) && cliUrls) {
      let next = current;
      if (key === 'DOCKER_HOST_ADDRESS') next = publicIp;
      else if (key === 'PUBLIC_URL') next = jitsiUrl;
      else if (key === 'VITE_JITSI_PUBLIC_URL' || key === 'FLOWSPACE_PUBLIC_URL') next = appUrl;
      else if (key === 'JVB_WS_DOMAIN') next = jitsiHost;
      else if (key === 'JVB_WS_TLS') next = '1';

      if (!hadKey) {
        out.set(key, next);
        summary.added.push(key);
      } else if (next !== current) {
        out.set(key, next);
        summary.updated.push(key);
      } else {
        summary.preserved.push(key);
      }
      continue;
    }

    if (force) {
      if (!hadKey) {
        out.set(key, templateValue);
        summary.added.push(key);
      } else if (templateValue !== current) {
        out.set(key, templateValue);
        summary.updated.push(key);
      } else {
        summary.preserved.push(key);
      }
      continue;
    }

    if (!hadKey || isPlaceholder(current)) {
      out.set(key, templateValue);
      if (!hadKey) summary.added.push(key);
      else summary.updated.push(key);
    } else {
      summary.preserved.push(key);
    }
  }

  return { merged: out, summary };
}

function secureEnvFilePermissions() {
  if (process.platform !== 'win32') {
    try {
      fs.chmodSync(target, 0o600);
    } catch {
      /* best effort */
    }
  }
}

function ensureJitsiDirs() {
  const cfgRoot = path.join(root, 'docker', 'jitsi-config');
  for (const d of [
    'web/crontabs',
    'transcripts',
    'prosody/config',
    'prosody/prosody-plugins-custom',
    'jicofo',
    'jvb',
  ]) {
    fs.mkdirSync(path.join(cfgRoot, d), { recursive: true });
  }
}

function writeEnv(text) {
  fs.writeFileSync(target, text.endsWith('\n') ? text : `${text}\n`);
  secureEnvFilePermissions();
}

function printSummary(action, mode, summary) {
  console.log(`${action} .env (${mode} merge)`);
  if (summary.preservedSecrets.length) {
    console.log(`  Kept passwords (${summary.preservedSecrets.length}): not rotated`);
  }
  if (summary.added.length) {
    console.log(`  Added: ${summary.added.join(', ')}`);
  }
  if (summary.updated.length) {
    console.log(`  Updated: ${summary.updated.join(', ')}`);
  }
  if (summary.preserved.length && summary.preserved.length <= 8) {
    console.log(`  Unchanged: ${summary.preserved.join(', ')}`);
  } else if (summary.preserved.length) {
    console.log(`  Unchanged: ${summary.preserved.length} other keys`);
  }
  console.log('  Custom keys in .env are always kept.');
}

const args = parseArgs(process.argv.slice(2));

if (args.rotateOnly) {
  if (!fs.existsSync(target)) {
    console.error('No .env found. Run: npm run setup');
    process.exit(1);
  }
  const map = parseEnvLines(fs.readFileSync(target, 'utf8'));
  let rotated = 0;
  for (const key of PASSWORD_KEYS) {
    if (isPlaceholder(map.get(key))) {
      map.set(key, rand());
      rotated += 1;
    }
  }
  const templatePath = fs.existsSync(path.join(root, 'env.example'))
    ? path.join(root, 'env.example')
    : fs.existsSync(path.join(root, 'env.production.example'))
    ? path.join(root, 'env.production.example')
    : path.join(root, 'env.development.example');
  const template = fs.readFileSync(templatePath, 'utf8');
  writeEnv(serializeEnv(map, template));
  if (rotated === 0) {
    console.log('Jitsi passwords already set — not rotated');
    console.log('  Use --force-passwords only if you intend to reset Prosody secrets');
  } else {
    console.log(`Rotated ${rotated} placeholder Jitsi password(s); existing passwords untouched`);
  }
  ensureJitsiDirs();
  process.exit(0);
}

const templatePath = (() => {
  const unified = path.join(root, 'env.example');
  if (fs.existsSync(unified)) return unified;
  // Legacy fallbacks (kept for backward compat during transition)
  const legacy =
    args.mode === 'production'
      ? path.join(root, 'env.production.example')
      : path.join(root, 'env.development.example');
  return legacy;
})();

if (!fs.existsSync(templatePath)) {
  console.error(`Missing template: ${templatePath}`);
  console.error('Expected env.example at repo root — run: git pull');
  process.exit(1);
}

let templateText = fs.readFileSync(templatePath, 'utf8');

if (args.mode === 'production') {
  let jitsiHost = args.jitsiHost ? stripProtocol(args.jitsiHost) : '';
  let publicIp = args.publicIp?.trim() ?? '';

  const prior = fs.existsSync(target) ? parseEnvLines(fs.readFileSync(target, 'utf8')) : new Map();
  if (args.fromEnv && (!jitsiHost || !publicIp)) {
    if (!jitsiHost) {
      jitsiHost = stripProtocol(prior.get('PUBLIC_URL') || prior.get('VITE_JITSI_PUBLIC_URL') || '');
    }
    if (!publicIp) {
      publicIp = (prior.get('DOCKER_HOST_ADDRESS') || '').trim();
    }
  }

  if (!jitsiHost || !publicIp || isPlaceholder(jitsiHost) || isPlaceholder(publicIp)) {
    console.error(
      'Production setup requires jitsi host and public IP.\n' +
        '  First time: ./scripts/flowspace.sh bootstrap --app-host=... --jitsi-host=... --email=...\n' +
        '  Or re-run deploy after bootstrap (npm run deploy merges .env from your existing values)',
    );
    process.exit(1);
  }

  args.jitsiHost = jitsiHost;
  args.publicIp = publicIp;
  if (!args.appHost) {
    args.appHost = stripProtocol(
      prior.get('FLOWSPACE_APP_HOST') || prior.get('FLOWSPACE_PUBLIC_URL') || '',
    );
  }
  templateText = applyProductionPlaceholders(templateText, {
    appHost: args.appHost || jitsiHost,
    jitsiHost,
    publicIp,
  });
}

const templateMap = parseEnvLines(templateText);
const existingMap = fs.existsSync(target) ? parseEnvLines(fs.readFileSync(target, 'utf8')) : new Map();

const hadExisting = existingMap.size > 0;
const { merged, summary } = mergeMaps(existingMap, templateMap, {
  force: args.force,
  forcePasswords: args.forcePasswords,
  mode: args.mode,
  appHost: args.appHost ? stripProtocol(args.appHost) : '',
  jitsiHost: args.jitsiHost ? stripProtocol(args.jitsiHost) : '',
  publicIp: args.publicIp?.trim() ?? '',
});

if (args.mode === 'production' && args.appHost) {
  const app = stripProtocol(args.appHost);
  merged.set('FLOWSPACE_PUBLIC_URL', `https://${app}`);
  merged.set('FLOWSPACE_APP_HOST', app);
  merged.set('VITE_JITSI_PUBLIC_URL', `https://${app}`);
}

if (args.mode === 'development') {
  const localUrlKeys = ['PUBLIC_URL', 'VITE_JITSI_PUBLIC_URL'];
  for (const key of localUrlKeys) {
    if (merged.get(key) === 'http://localhost:8001') {
      merged.set(key, 'http://127.0.0.1:8001');
    }
  }
  if (merged.get('JVB_WS_DOMAIN') === 'localhost:8001') {
    merged.set('JVB_WS_DOMAIN', '127.0.0.1:8001');
  }
  if (!merged.has('VITE_DISABLE_STUN_TURN_DISCOVERY')) {
    merged.set('VITE_DISABLE_STUN_TURN_DISCOVERY', 'true');
  }
}

writeEnv(serializeEnv(merged, templateText));
ensureJitsiDirs();

printSummary(hadExisting ? 'Updated' : 'Created', args.mode, summary);

if (args.mode === 'development') {
  console.log('  npm run dev          → http://localhost:5173');
  console.log('  npm run docker:up    → http://127.0.0.1:8780');
} else {
  console.log('  npm run deploy       → rebuild Docker stack');
}
if (hadExisting && !args.force) {
  console.log('  Tip: --force resets non-secret keys from template; passwords still kept');
}
