const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const asar = require('@electron/asar');
const engine = require('./localization_engine');
const maintainer = require('./auto-localization-maintainer');

async function createFixture(localized) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'antigravity-zh-tw-'));
    const source = path.join(root, 'source');
    const dist = path.join(source, 'dist');
    const archive = path.join(root, 'app.asar');
    fs.mkdirSync(dist, { recursive: true });
    fs.writeFileSync(path.join(source, 'package.json'), JSON.stringify({ version: '9.9.9' }));
    fs.writeFileSync(
        path.join(dist, 'preload.js'),
        `globalThis.fixture = true;${localized ? `\n${engine.generateJs()}` : ''}`
    );
    fs.writeFileSync(
        path.join(dist, 'menu.js'),
        'const electron_1 = { Menu: { setApplicationMenu() {} } }; const menu = { items: [] }; electron_1.Menu.setApplicationMenu(menu);'
    );
    fs.writeFileSync(
        path.join(dist, 'tray.js'),
        'function createTray(actions) { return actions; }'
    );
    await asar.createPackage(source, archive);
    return { root, archive };
}

test('辨識可相容但尚未翻譯的官方 ASAR', async (t) => {
    const fixture = await createFixture(false);
    t.after(() => fs.rmSync(fixture.root, { recursive: true, force: true }));
    const info = maintainer.inspectAsar(fixture.archive);

    assert.equal(info.version, '9.9.9');
    assert.equal(info.hasLocalization, false);
    assert.equal(info.localized, false);
    assert.equal(info.compatible, true);
});

test('辨識已套用且只有一份注入的 ASAR', async (t) => {
    const fixture = await createFixture(true);
    t.after(() => fs.rmSync(fixture.root, { recursive: true, force: true }));
    const info = maintainer.inspectAsar(fixture.archive);

    assert.equal(info.localized, true);
    assert.equal(info.hasLocalization, true);
    assert.equal(info.exactInjectionCount, 1);
});

test('解析維護器參數', () => {
    const options = maintainer.parseArgs([
        '--install-dir', 'C:\\Antigravity',
        '--state-dir', 'C:\\State',
        '--dry-run'
    ]);

    assert.equal(options.installDir, 'C:\\Antigravity');
    assert.equal(options.stateDir, 'C:\\State');
    assert.equal(options.dryRun, true);
});
