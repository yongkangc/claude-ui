#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Use current working directory instead of problematic temp path
const tempDir = "/non/"
console.log('📁 Using current working directory:', tempDir);

console.log('🚀 Starting Claude CLI test...');
console.log('Command: claude -p hello --output-format stream-json --verbose --max-turns 0 --add-dir', tempDir);
console.log('=' .repeat(80));

const args = [
  '-p',
  'hello',
  '--output-format',
  'stream-json',
  '--verbose',
  '--add-dir',
  tempDir
];

// Try with inherit to see if it outputs to our console
const claudeProcess = spawn('claude', args, {
  stdio: ['inherit', 'pipe', 'pipe']
});

console.log(`📋 Process spawned - trying with inherit stdio`);
console.log(`📋 Process PID: ${claudeProcess.pid}`);
console.log('📡 Streaming output in real-time:');
console.log('-'.repeat(80));

// Note: stdout and stderr are piped and can be captured with event handlers

// Add timeout to prevent hanging and capture output
const timeout = setTimeout(() => {
  console.log('⏰ Timeout reached - killing process');
  claudeProcess.kill('SIGTERM');
  
  // Force kill if still running after 2 seconds
  setTimeout(() => {
    if (!claudeProcess.killed) {
      console.log('🔪 Force killing process');
      claudeProcess.kill('SIGKILL');
    }
  }, 2000);
}, 10000); // 10 second timeout

// Handle process exit
claudeProcess.on('exit', (code, signal) => {
  clearTimeout(timeout);
  console.log('-'.repeat(80));
  console.log(`🏁 Process exited with code: ${code}, signal: ${signal}`);
});

// Handle process errors
claudeProcess.on('error', (error) => {
  clearTimeout(timeout);
  console.error('❌ Process error:', error);
});

// Handle process close
claudeProcess.on('close', (code, signal) => {
  clearTimeout(timeout);
  console.log(`🔒 Process closed with code: ${code}, signal: ${signal}`);
});

// Logging functions
function logOutput(data) {
  console.log('📤 STDOUT:', data.toString().trim());
}

function logError(data) {
  console.log('❌ STDERR:', data.toString().trim());
}

// Set encoding for piped streams
if (claudeProcess.stdout) {
  claudeProcess.stdout.setEncoding('utf8');
  claudeProcess.stdout.on('data', logOutput);
}

if (claudeProcess.stderr) {
  claudeProcess.stderr.setEncoding('utf8');
  claudeProcess.stderr.on('data', logError);
}

console.log('⏳ Waiting for Claude CLI output...');