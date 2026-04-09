import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const manifestPath = path.join(rootDir, 'config', 'release-manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

function formatCommand(command, args) {
  return [command, ...args].join(' ');
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? rootDir,
    env: {
      ...process.env,
      ...(options.env ?? {}),
    },
    shell: options.shell ?? false,
    stdio: options.stdio ?? 'inherit',
  });

  if (result.status !== 0) {
    const detail = result.error ? ` [${result.error}]` : '';
    throw new Error(`Command failed (${result.status ?? 'unknown'}): ${formatCommand(command, args)}${detail}`);
  }
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function fileExists(targetPath) {
  return fs.existsSync(targetPath);
}

function replacePath(sourcePath, targetPath) {
  fs.rmSync(targetPath, { recursive: true, force: true });
  ensureDir(path.dirname(targetPath));
  fs.cpSync(sourcePath, targetPath, { recursive: true });
}

function resolveFirstExistingPath(candidates) {
  for (const candidate of candidates) {
    const fullPath = path.isAbsolute(candidate) ? candidate : path.join(rootDir, candidate);
    if (fileExists(fullPath)) {
      return fullPath;
    }
  }

  return null;
}

function stagePortableBundle() {
  const portableConfig = manifest.portablePackage;
  const stageDir = path.join(rootDir, portableConfig.stagingDir);
  fs.rmSync(stageDir, { recursive: true, force: true });
  ensureDir(stageDir);

  for (const entry of portableConfig.entries) {
    const sourcePath = path.join(rootDir, entry.source);
    const targetPath = path.join(stageDir, entry.target);

    if (!fileExists(sourcePath)) {
      throw new Error(`Portable package source missing: ${sourcePath}`);
    }

    replacePath(sourcePath, targetPath);
  }

  return stageDir;
}

function buildSfxConfig(portableConfig) {
  return [
    ';!@Install@!UTF-8!',
    `Title="${portableConfig.title}"`,
    'BeginPrompt="Extract and launch K_OS?"',
    'Progress="yes"',
    'OverwriteMode="2"',
    `InstallPath="${portableConfig.installPath}"`,
    `RunProgram="${portableConfig.runProgram}"`,
    ';!@InstallEnd@!',
    '',
  ].join('\n');
}

function packagePortableBundle(stageDir) {
  const portableConfig = manifest.portablePackage;
  const archivePath = path.join(rootDir, portableConfig.archivePath);
  const outputPath = path.join(rootDir, portableConfig.outputPath);
  const outputDir = path.dirname(outputPath);
  const configPath = path.join(outputDir, 'portable-sfx-config.txt');
  const sfxModulePath = resolveFirstExistingPath([
    ...(process.env.KOS_7Z_SFX ? [process.env.KOS_7Z_SFX] : []),
    ...(portableConfig.sfxModuleCandidates ?? []),
  ]);

  if (!sfxModulePath) {
    throw new Error('Unable to locate a 7-Zip SFX module. Set KOS_7Z_SFX or install 7-Zip.');
  }

  ensureDir(outputDir);
  fs.rmSync(archivePath, { force: true });
  fs.rmSync(outputPath, { force: true });
  fs.writeFileSync(configPath, buildSfxConfig(portableConfig), 'utf8');

  const sevenZip = process.env.KOS_7Z_PATH || '7z';
  run(sevenZip, [
    'a',
    '-t7z',
    archivePath,
    '.',
    `-mx=${portableConfig.compressionLevel ?? 1}`,
    '-mmt=on',
  ], { cwd: stageDir });

  const copyCommand = `copy /b "${sfxModulePath}"+"${configPath}"+"${archivePath}" "${outputPath}"`;
  run('cmd.exe', ['/d', '/c', copyCommand], { cwd: outputDir });

  run(sevenZip, ['t', outputPath], { cwd: outputDir });
}

function main() {
  if (process.platform !== 'win32') {
    throw new Error('Portable self-extracting packaging is Windows-only. Use the Linux release flow instead.');
  }
  console.log('[portable] Staging portable bundle...');
  const stageDir = stagePortableBundle();
  console.log('[portable] Building self-extracting executable...');
  packagePortableBundle(stageDir);
  console.log('[portable] Portable executable ready.');
}

main();
