#!/usr/bin/env node
/**
 * Regenerates Jitsi auth passwords in the root `.env` (used by docker compose).
 * Optional — a working dev `.env` is already committed.
 *
 * Usage: npm run docker:jitsi-env
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const target = path.join(root, '.env');
const example = path.join(root, 'docker', 'env.jitsi.example');

const rand = () => crypto.randomBytes(16).toString('hex');
const keys = [
  'JICOFO_AUTH_PASSWORD',
  'JVB_AUTH_PASSWORD',
  'JIGASI_XMPP_PASSWORD',
  'JIGASI_TRANSCRIBER_PASSWORD',
  'JIBRI_RECORDER_PASSWORD',
  'JIBRI_XMPP_PASSWORD',
];

let text = fs.existsSync(target)
  ? fs.readFileSync(target, 'utf8')
  : fs.readFileSync(example, 'utf8');

for (const k of keys) {
  if (text.match(new RegExp(`^${k}=`, 'm'))) {
    text = text.replace(new RegExp(`^${k}=.*$`, 'm'), `${k}=${rand()}`);
  } else {
    text += `\n${k}=${rand()}`;
  }
}

if (!text.includes('FLOWSPACE_PORT=')) {
  text += '\nFLOWSPACE_PORT=8780\n';
}

fs.writeFileSync(target, text.endsWith('\n') ? text : `${text}\n`);

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

console.log('Updated Jitsi passwords in .env and ensured docker/jitsi-config/ dirs exist.');
console.log('If Jitsi was already running, recreate the stack: docker compose up -d --build');
