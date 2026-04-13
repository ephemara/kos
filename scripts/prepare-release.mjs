import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const manifestPath = path.join(rootDir, 'config', 'release-manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const isWindows = process.platform === 'win32';

function formatCommand(command, args) {
  return [command, ...args].join(' ');
}

function resolveCommand(command) {
  return command;
}

function run(command, args, options = {}) {
  const useShell = process.platform === 'win32' && (command === 'npm' || command === 'npx');
  const resolvedCommand = resolveCommand(command);
  const result = spawnSync(resolvedCommand, args, {
    cwd: options.cwd ?? rootDir,
    env: {
      ...process.env,
      ...(options.env ?? {}),
    },
    shell: useShell,
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    const detail = result.error ? ` [${result.error}]` : '';
    throw new Error(`Command failed (${result.status ?? 'unknown'}): ${formatCommand(command, args)}${detail}`);
  }
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function replacePath(sourcePath, targetPath) {
  fs.rmSync(targetPath, { recursive: true, force: true });
  ensureDir(path.dirname(targetPath));
  fs.cpSync(sourcePath, targetPath, { recursive: true });
}

function copyDirectoryContents(sourceDir, targetDir) {
  fs.rmSync(targetDir, { recursive: true, force: true });
  ensureDir(targetDir);

  for (const entry of fs.readdirSync(sourceDir)) {
    const sourcePath = path.join(sourceDir, entry);
    const targetPath = path.join(targetDir, entry);
    fs.cpSync(sourcePath, targetPath, { recursive: true });
  }
}

function fileExists(targetPath) {
  return fs.existsSync(targetPath);
}

function normalizeExecutablePath(relativePath) {
  return isWindows ? relativePath : relativePath.replace(/\.exe$/g, '');
}

function resolveArtifactPath(relativePath) {
  const normalizedPath = path.join(rootDir, normalizeExecutablePath(relativePath));
  if (fileExists(normalizedPath)) {
    return normalizedPath;
  }

  return path.join(rootDir, relativePath);
}

function ensureLegacyDependencies(legacyWorkingDir) {
  const nodeModulesDir = path.join(legacyWorkingDir, 'node_modules');
  if (fileExists(nodeModulesDir)) {
    return;
  }

  console.log('[release] Installing oldkos dependencies...');
  run('npm', ['ci', '--no-audit', '--no-fund'], { cwd: legacyWorkingDir });
}

function buildLegacyBundle() {
  const legacyConfig = manifest.legacyBundle;
  const legacyWorkingDir = path.join(rootDir, legacyConfig.workingDir);
  const legacyDistDir = path.join(legacyWorkingDir, legacyConfig.distDir);
  const legacyStageDir = path.join(rootDir, legacyConfig.stageDir);

  if (!fileExists(legacyWorkingDir)) {
    console.warn(`[release] Skipping legacy bundle staging because ${legacyWorkingDir} is missing.`);
    return false;
  }

  ensureLegacyDependencies(legacyWorkingDir);

  console.log('[release] Building legacy oldkos bundle...');
  run('npm', ['run', 'build'], { cwd: legacyWorkingDir });

  if (!fileExists(legacyDistDir)) {
    throw new Error(`Legacy build output missing: ${legacyDistDir}`);
  }

  copyDirectoryContents(legacyDistDir, legacyStageDir);

  for (const extraFile of legacyConfig.extraFiles ?? []) {
    const sourcePath = path.join(legacyWorkingDir, extraFile);
    if (!fileExists(sourcePath)) {
      continue;
    }

    const targetPath = path.join(legacyStageDir, path.basename(extraFile));
    fs.copyFileSync(sourcePath, targetPath);
  }

  return true;
}

function stageRuntimeResources() {
  console.log('[release] Staging runtime resources...');
  for (const copy of manifest.resourceCopies ?? []) {
    const sourcePath = path.join(rootDir, copy.source);
    const targetPath = path.join(rootDir, copy.target);

    if (!fileExists(sourcePath)) {
      throw new Error(`Missing resource source: ${sourcePath}`);
    }

    replacePath(sourcePath, targetPath);
  }
}

function stageNativeLaunchers() {
  const launchers = manifest.nativeLaunchers ?? [];
  if (process.env.KOS_SKIP_NATIVE_LAUNCHERS === '1') {
    console.warn('[release] Skipping native launcher staging because KOS_SKIP_NATIVE_LAUNCHERS=1');
    return;
  }

  for (const launcher of launchers) {
    if (launcher.enabledByDefault === false && process.env.KOS_INCLUDE_NATIVE_LAUNCHERS !== '1') {
      continue;
    }

    console.log(`[release] Building native launcher '${launcher.id}'...`);
    run(launcher.build.command, launcher.build.args ?? [], { cwd: rootDir });

    const binaryPath = resolveArtifactPath(launcher.binary);
    const bundleTargetPath = path.join(rootDir, normalizeExecutablePath(launcher.bundleTarget));
    if (!fileExists(binaryPath)) {
      throw new Error(`Native launcher binary missing: ${binaryPath}`);
    }
    replacePath(binaryPath, bundleTargetPath);

    for (const copy of launcher.resourceCopies ?? []) {
      const sourcePath = path.join(rootDir, copy.source);
      const targetPath = path.join(rootDir, copy.target);

      if (!fileExists(sourcePath)) {
        throw new Error(`Missing native launcher resource: ${sourcePath}`);
      }

      replacePath(sourcePath, targetPath);
    }
  }
}

function canBuildPythonSidecar() {
  const result = spawnSync('python', ['-c', 'import PyInstaller'], {
    cwd: rootDir,
    stdio: 'ignore',
  });
  return result.status === 0;
}

function stagePythonSidecar() {
  const pythonConfig = manifest.pythonSidecar;
  const artifactPath = path.join(rootDir, pythonConfig.artifact);
  const bundleTargetPath = path.join(rootDir, pythonConfig.bundleTarget);
  const legacySingleFileTargetPath = path.join(
    rootDir,
    'apps',
    'tauri',
    'resources',
    'bin',
    isWindows ? 'kos_python.exe' : 'kos_python'
  );
  const entryPointPath = path.join(artifactPath, normalizeExecutablePath(pythonConfig.entryPoint));
  const pythonSidecarEnabled =
    process.env.KOS_INCLUDE_PYTHON_SIDECAR === '1' ||
    pythonConfig.enabledByDefault !== false;

  if (!pythonSidecarEnabled || process.env.KOS_SKIP_PYTHON_SIDECAR === '1') {
    const reason = !pythonSidecarEnabled
      ? 'python sidecar is disabled for the default release profile'
      : 'KOS_SKIP_PYTHON_SIDECAR=1';
    console.warn(`[release] Skipping Python sidecar build because ${reason}`);
    fs.rmSync(bundleTargetPath, { recursive: true, force: true });
    fs.rmSync(legacySingleFileTargetPath, { force: true });
    return;
  }

  if (!canBuildPythonSidecar()) {
    throw new Error('PyInstaller is not available for the Python sidecar build. Set KOS_SKIP_PYTHON_SIDECAR=1 to skip or install PyInstaller.');
  }

  console.log('[release] Building Python sidecar...');
  run('python', [path.join(rootDir, pythonConfig.buildScript)], { cwd: rootDir });

  if (!fileExists(artifactPath) || !fileExists(entryPointPath)) {
    throw new Error(`Python sidecar artifact missing: ${entryPointPath}`);
  }

  replacePath(artifactPath, bundleTargetPath);
  fs.rmSync(legacySingleFileTargetPath, { force: true });
}

function verifyMainFrontendDist() {
  const distDir = path.join(rootDir, 'dist');
  const requiredFiles = ['index.html', 'mocap-window.html', 'webcam-window.html'];

  const legacyEntryPoint = manifest.legacyBundle?.entryPoint;
  if (legacyEntryPoint && fileExists(path.join(distDir, legacyEntryPoint))) {
    requiredFiles.push(legacyEntryPoint);
  }

  for (const relativePath of requiredFiles) {
    const fullPath = path.join(distDir, relativePath);
    if (!fileExists(fullPath)) {
      throw new Error(`Release artifact missing: ${fullPath}`);
    }
  }
}

function main() {
  buildLegacyBundle();
  stageRuntimeResources();
  stageNativeLaunchers();
  stagePythonSidecar();
  verifyMainFrontendDist();
  console.log('[release] Release staging complete.');
}

main();
