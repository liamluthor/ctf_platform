#!/usr/bin/env node
import 'dotenv/config';
import { spawn } from 'child_process';

// Get the command and arguments from process.argv
// argv[0] is node, argv[1] is this script, rest are the actual command
const [,, ...args] = process.argv;

if (args.length === 0) {
  console.error('Usage: node scripts/load-env.js <command> [args...]');
  process.exit(1);
}

// Spawn the command with inherited stdio and environment
const child = spawn(args[0], args.slice(1), {
  stdio: 'inherit',
  env: process.env,
  shell: true
});

child.on('exit', (code) => {
  process.exit(code || 0);
});
