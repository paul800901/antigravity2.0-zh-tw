const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
const childProcess = require('child_process');
const asar = require('@electron/asar');
const localizationEngine = require('./localization_engine');

const DEFAULT_INSTALL_DIR = path.join(
    process.env.LOCALAPPDATA || '',
    'Programs',
    'antigravity'
);
const DEFAULT_STATE_DIR = path.join(
    process.env.LOCALAPPDATA || os.tmpdir(),
    'AntigravityZhTW'
);

function parseArgs(args) {
    const options = {
        installDir: DEFAULT_INSTALL_DIR,
        stateDir: DEFAULT_STATE_DIR,
        dryRun: false,
        statusOnly: false
    };

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--install-dir') {
            options.installDir = args[++i] || options.installDir;
        } else if (args[i] === '--state-dir') {
            options.stateDir = args[++i] || options.stateDir;
        } else if (args[i] === '--dry-run') {
            options.dryRun = true;
        } else if (args[i] === '--status') {
            options.statusOnly = true;
        }
    }

    return options;
}

function sha256(filePath) {
    return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function countOccurrences(text, needle) {
    if (!needle) return 0;
    return text.split(needle).length - 1;
}

function inspectAsar(asarPath) {
    const packageJson = JSON.parse(asar.extractFile(asarPath, 'package.json').toString('utf8'));
    const preload = asar.extractFile(asarPath, 'dist/preload.js').toString('utf8');
    const menu = asar.extractFile(asarPath, 'dist/menu.js').toString('utf8');
    const tray = asar.extractFile(asarPath, 'dist/tray.js').toString('utf8');
    const generatedTranslation = localizationEngine.generateJs();

    const hasLocalization = preload.includes(
        '/* --- ANTIGRAVITY ZH-HANT-TW LOCALIZATION START --- */'
    );

    return {
        version: packageJson.version || 'unknown',
        hash: sha256(asarPath),
        hasLocalization,
        localized: preload.endsWith(generatedTranslation),
        exactInjectionCount: countOccurrences(
            preload,
            '/* --- ANTIGRAVITY ZH-HANT-TW LOCALIZATION START --- */'
        ),
        menuLocalized: menu.includes('/* --- MENU TRANSLATION START --- */'),
        trayLocalized: tray.includes('/* --- TRAY TRANSLATION START --- */'),
        compatible:
            preload.length > 0 &&
            menu.includes('electron_1.Menu.setApplicationMenu(menu);') &&
            tray.includes('function createTray(actions) {')
    };
}

function inspectArchiveIdentity(asarPath) {
    let version = 'unknown';
    try {
        const packageJson = JSON.parse(asar.extractFile(asarPath, 'package.json').toString('utf8'));
        version = packageJson.version || version;
    } catch (_) {
        // 舊備份即使結構已無法辨識也要保留，不因讀取失敗而覆寫。
    }
    return { version, hash: sha256(asarPath) };
}

function isAntigravityRunning() {
    if (process.platform !== 'win32') return false;

    const result = childProcess.spawnSync(
        'tasklist.exe',
        ['/FI', 'IMAGENAME eq Antigravity.exe', '/FO', 'CSV', '/NH'],
        { encoding: 'utf8', windowsHide: true }
    );

    return result.status === 0 && /"Antigravity\.exe"/i.test(result.stdout || '');
}

function readState(statePath) {
    try {
        return JSON.parse(fs.readFileSync(statePath, 'utf8'));
    } catch (_) {
        return null;
    }
}

function createReporter(stateDir) {
    fs.mkdirSync(stateDir, { recursive: true });
    const statePath = path.join(stateDir, 'state.json');
    const logPath = path.join(stateDir, 'maintainer.log');

    return function report(status, details, alwaysLog = false) {
        const previous = readState(statePath);
        const state = {
            status,
            checkedAt: new Date().toISOString(),
            ...details
        };
        const unchanged =
            previous &&
            previous.status === state.status &&
            previous.version === state.version &&
            previous.sourceHash === state.sourceHash &&
            previous.message === state.message;

        fs.writeFileSync(`${statePath}.tmp`, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
        fs.renameSync(`${statePath}.tmp`, statePath);

        if (alwaysLog || !unchanged) {
            const line = `[${state.checkedAt}] ${status} ${state.version || ''} ${state.message || ''}`.trim();
            fs.appendFileSync(logPath, `${line}\n`, 'utf8');
            console.log(line);
        }

        return state;
    };
}

function archiveStaleBackup(backupPath, backupInfo, stateDir) {
    const archiveDir = path.join(stateDir, 'backups');
    fs.mkdirSync(archiveDir, { recursive: true });
    const safeVersion = String(backupInfo.version || 'unknown').replace(/[^0-9A-Za-z._-]/g, '_');
    const baseName = `app.asar.${safeVersion}.${backupInfo.hash.slice(0, 12)}.bak`;
    let destination = path.join(archiveDir, baseName);

    if (fs.existsSync(destination)) {
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        destination = path.join(archiveDir, `app.asar.${safeVersion}.${backupInfo.hash.slice(0, 12)}.${stamp}.bak`);
    }

    fs.renameSync(backupPath, destination);
    return destination;
}

function validateProject(projectDir) {
    const checks = [
        ['--check', path.join(projectDir, 'localization_engine.js')],
        [path.join(projectDir, 'validate-localization.js')]
    ];

    for (const args of checks) {
        const result = childProcess.spawnSync(process.execPath, args, {
            cwd: projectDir,
            encoding: 'utf8',
            windowsHide: true
        });
        if (result.status !== 0) {
            throw new Error((result.stderr || result.stdout || '本地驗證失敗').trim());
        }
    }
}

function verifyInstalledAsar(asarPath, backupPath, originalHash) {
    const installed = inspectAsar(asarPath);
    const backupHash = fs.existsSync(backupPath) ? sha256(backupPath) : '';
    const preload = asar.extractFile(asarPath, 'dist/preload.js').toString('utf8');
    const menu = asar.extractFile(asarPath, 'dist/menu.js').toString('utf8');
    const tray = asar.extractFile(asarPath, 'dist/tray.js').toString('utf8');

    new vm.Script(preload, { filename: 'preload.js' });
    new vm.Script(menu, { filename: 'menu.js' });
    new vm.Script(tray, { filename: 'tray.js' });

    return {
        ok:
            installed.localized &&
            installed.exactInjectionCount === 1 &&
            installed.menuLocalized &&
            installed.trayLocalized &&
            backupHash === originalHash,
        installed,
        backupHash
    };
}

function runMaintenance(options = parseArgs(process.argv.slice(2))) {
    const report = createReporter(options.stateDir);
    const resourcesDir = path.join(options.installDir, 'resources');
    const asarPath = path.join(resourcesDir, 'app.asar');
    const backupPath = path.join(resourcesDir, 'app.asar.bak');
    const projectDir = __dirname;

    try {
        if (!fs.existsSync(asarPath)) {
            report('not_installed', { message: `找不到 ${asarPath}` });
            return 0;
        }

        const current = inspectAsar(asarPath);
        let officialHash = current.hash;

        if (current.hasLocalization && !current.localized) {
            if (!fs.existsSync(backupPath)) {
                report('blocked_missing_official_backup', {
                    version: current.version,
                    sourceHash: current.hash,
                    message: '偵測到舊版繁中，但缺少官方備份；已停止自動更新以免建立錯誤備份。'
                });
                return 0;
            }
            officialHash = sha256(backupPath);
        }

        const common = { version: current.version, sourceHash: officialHash };

        if (current.localized) {
            report('already_localized', { ...common, message: '繁中已是最新套用狀態。' });
            return 0;
        }

        if (!current.compatible) {
            report('blocked_incompatible', {
                ...common,
                message: '新版結構與目前維護器不相容，已停止修改並保留官方英文版。'
            });
            return 0;
        }

        if (options.statusOnly || options.dryRun) {
            const status = isAntigravityRunning() ? 'would_defer' : 'ready_to_apply';
            report(status, { ...common, message: '偵測到可安全套用的官方新版。' }, true);
            return 0;
        }

        if (isAntigravityRunning()) {
            report('deferred_app_running', {
                ...common,
                message: 'Antigravity 使用中；關閉後會自動套用。'
            });
            return 0;
        }

        validateProject(projectDir);

        if (!current.hasLocalization && fs.existsSync(backupPath)) {
            const backupInfo = inspectArchiveIdentity(backupPath);
            if (backupInfo.hash !== current.hash) {
                const archived = archiveStaleBackup(backupPath, backupInfo, options.stateDir);
                report('archived_stale_backup', {
                    ...common,
                    message: `舊版官方備份已保留於 ${archived}`
                }, true);
            }
        }

        const result = childProcess.spawnSync(
            process.execPath,
            [path.join(projectDir, 'localization_engine.js'), '--install-dir', options.installDir],
            { cwd: projectDir, encoding: 'utf8', windowsHide: true }
        );

        if (result.status !== 0) {
            throw new Error((result.stderr || result.stdout || '繁中套用失敗').trim());
        }

        const verification = verifyInstalledAsar(asarPath, backupPath, officialHash);
        if (!verification.ok) {
            if (fs.existsSync(backupPath) && sha256(backupPath) === officialHash) {
                fs.copyFileSync(backupPath, asarPath);
            }
            throw new Error('套用後驗證失敗；已回復本次官方原檔。');
        }

        report('installed', {
            version: verification.installed.version,
            sourceHash: officialHash,
            installedHash: verification.installed.hash,
            message: '官方更新後的繁中已自動套用完成。'
        }, true);
        return 0;
    } catch (error) {
        report('error', { message: error.message }, true);
        return 1;
    }
}

module.exports = {
    parseArgs,
    sha256,
    inspectAsar,
    inspectArchiveIdentity,
    isAntigravityRunning,
    archiveStaleBackup,
    verifyInstalledAsar,
    runMaintenance
};

if (require.main === module) {
    process.exitCode = runMaintenance();
}
