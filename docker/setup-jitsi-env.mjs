#!/usr/bin/env node
/**
 * Creates docker/.env.jitsi from env.jitsi.example with random passwords.
 * Usage: node docker/setup-jitsi-env.mjs
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const target = path.join(root, 'docker', '.env.jitsi');
const example = path.join(root, 'docker', 'env.jitsi.example');

if (fs.existsSync(target)) {
  console.log('docker/.env.jitsi already exists — delete it first to regenerate.');
  process.exit(0);
}

const rand = () => crypto.randomBytes(16).toString('hex');
let text = fs.readFileSync(example, 'utf8');
const keys = [
  'JICOFO_AUTH_PASSWORD',
  'JVB_AUTH_PASSWORD',
  'JIGASI_XMPP_PASSWORD',
  'JIGASI_TRANSCRIBER_PASSWORD',
  'JIBRI_RECORDER_PASSWORD',
  'JIBRI_XMPP_PASSWORD',
];
for (const k of keys) {
  text = text.replace(new RegExp(`^${k}=.*$`, 'm'), `${k}=${rand()}`);
}
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, text);

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

console.log('Wrote docker/.env.jitsi with generated passwords and empty jitsi-config dirs.');
