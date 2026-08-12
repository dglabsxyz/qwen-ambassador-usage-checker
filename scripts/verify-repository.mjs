import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const REQUIRED_FILES = [
  '.replit',
  'package.json',
  'src/config.js',
  'src/quota.js',
  'src/modelscope-client.js',
  'src/quota-service.js',
  'src/http-app.js',
  'src/server.js',
  'public/index.html',
  'public/styles.css',
  'public/history.js',
  'public/app.js'
];

const CONTENT_RULES = [
  { name: 'bearer-token-pattern', pattern: /Bearer\s+[A-Za-z0-9._-]{16,}/ },
  { name: 'modelscope-token-pattern', pattern: /ms-[0-9a-f-]{20,}/i }
];

const SECRET_FILE_PATTERN = /(^|\/)(?:\.env(?:\.|$)|\.dev\.vars(?:\.|$))/i;

export function scanContent(file, content) {
  return CONTENT_RULES
    .filter(({ pattern }) => pattern.test(content))
    .map(({ name }) => ({ file, rule: name }));
}

export function scanTrackedFileNames(files) {
  return files
    .map((file) => file.replaceAll('\\', '/'))
    .filter((file) => SECRET_FILE_PATTERN.test(file))
    .map((file) => ({ file, rule: 'tracked-secret-file' }));
}

export function verifyRepository(root = process.cwd()) {
  const trackedOutput = execFileSync('git', ['ls-files', '-z'], {
    cwd: root,
    encoding: 'utf8'
  });
  const trackedFiles = trackedOutput.split('\0').filter(Boolean);
  const findings = scanTrackedFileNames(trackedFiles);

  for (const file of trackedFiles) {
    const absolutePath = resolve(root, file);
    const content = readFileSync(absolutePath);
    if (content.includes(0)) continue;
    findings.push(...scanContent(file, content.toString('utf8')));
  }

  for (const file of REQUIRED_FILES) {
    if (!existsSync(resolve(root, file))) {
      findings.push({ file, rule: 'missing-required-file' });
    }
  }

  return findings;
}

function run() {
  const findings = verifyRepository();
  if (findings.length > 0) {
    console.error('Repository verification failed:');
    for (const finding of findings) {
      console.error(`- ${finding.file}: ${finding.rule}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log('Repository verification passed: required files present; no tracked secret patterns detected.');
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  run();
}
