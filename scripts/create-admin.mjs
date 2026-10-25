import {createInterface} from 'node:readline/promises';
import {randomBytes} from 'node:crypto';
import {hashPassword} from '../vercel-runtime/auth.mjs';

async function hiddenQuestion(prompt) {
  if (!process.stdin.isTTY) throw new Error('Run this command in your own interactive terminal.');
  process.stdout.write(prompt);
  process.stdin.setRawMode(true); process.stdin.resume(); process.stdin.setEncoding('utf8');
  return new Promise((resolve, reject) => {
    let value = '';
    const finish = (error) => {process.stdin.off('data', onData); process.stdin.setRawMode(false); process.stdin.pause(); process.stdout.write('\n'); error ? reject(error) : resolve(value);};
    function onData(chunk) {
      for (const char of chunk) {
        if (char === '\u0003') {finish(new Error('Cancelled.')); return;}
        if (char === '\r' || char === '\n') {finish(); return;}
        if (char === '\u007f' || char === '\b') value = value.slice(0, -1);
        else if (char >= ' ') value += char;
      }
    }
    process.stdin.on('data', onData);
  });
}
try {
  if (!process.stdin.isTTY) throw new Error('Open a terminal in the extracted ZIP folder and run: node scripts/create-admin.mjs');
  const prompt = createInterface({input: process.stdin, output: process.stdout});
  const email = (await prompt.question('Administrator email: ')).trim().toLowerCase();
  prompt.close();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid administrator email.');
  const password = await hiddenQuestion('Choose an admin password (14–256 characters; hidden): ');
  if (password.length < 14 || password.length > 256) throw new Error('Use a password between 14 and 256 characters.');
  const confirm = await hiddenQuestion('Repeat password (hidden): ');
  if (confirm !== password) throw new Error('Passwords do not match. Run the command again.');
  console.log('\nAdd these three values to the ADMIN Vercel project only:\n');
  console.log('ADMIN_EMAIL=' + email);
  console.log('ADMIN_PASSWORD_HASH=' + await hashPassword(password));
  console.log('SESSION_SECRET=' + randomBytes(48).toString('base64url'));
  console.log('\nKeep these settings private. Sign in using your email and the password you chose.\nNo password or configuration file was saved.');
} catch (error) { console.error(error.message); process.exitCode = 1; }
