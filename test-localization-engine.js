const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const childProcess = require('child_process');
const asar = require('@electron/asar');
const engine = require('./localization_engine');
const { unpackedFiles } = require('./pack-asar');

const root = fs.mkdtempSync(path.join(__dirname, '_verify_asar-'));
test.after(() => {
    try { engine.recycleTemporaryDirectory(root); }
    catch (error) { console.warn(`測試暫存保留，未永久刪除：${root}；${error.message}`); }
});

async function fixture(name, version = '2.18.1', options = {}) {
    const base = path.join(root, name);
    const source = path.join(base, 'source');
    const resources = path.join(base, 'resources');
    fs.mkdirSync(path.join(source, 'dist'), { recursive: true });
    fs.mkdirSync(resources, { recursive: true });
    fs.writeFileSync(path.join(source, 'package.json'), JSON.stringify({ version }));
    const files = {
        'preload.js': 'globalThis.fixture = true;',
        'menu.js': 'function setup() { const menu = { items: [] }; electron_1.Menu.setApplicationMenu(menu); }',
        'tray.js': 'function createTray(actions) { return actions; }',
        'loadingOverlay.js': 'const text = \'<div class="text">Loading Antigravity</div>\';',
        'provisionSplash.js': 'const text = `<div>Setting up WSL: ${escapeHtml(distro)}</div>`;',
        ...options.files
    };
    for (const [name, content] of Object.entries(files)) {
        fs.writeFileSync(path.join(source, 'dist', name), content);
    }
    fs.mkdirSync(path.join(source, 'vendor'), { recursive: true });
    fs.writeFileSync(path.join(source, 'vendor', 'unchanged.js'), 'module.exports = "official";');
    const archive = path.join(resources, 'app.asar');
    // 在子程序建立 fixture，確保 ASAR 寫入串流已關閉後再測試同步替換。
    childProcess.execFileSync(process.execPath, [
        require.resolve('@electron/asar/bin/asar.js'), 'pack', source, archive, '--unpack', '**/vendor/**'
    ], { windowsHide: true });
    return { resources, archive, backup: `${archive}.bak`, original: fs.readFileSync(archive) };
}

test('手動安裝、重複套用、官方更新備份及還原', async () => {
    const item = await fixture('正常流程');
    assert.equal(engine.install20(item.resources, { skipKill: true }), true);
    assert.deepEqual(fs.readFileSync(item.backup), item.original);
    assert.equal(asar.extractFile(item.archive, 'dist/preload.js').toString().endsWith(engine.generateJs()), true);
    assert.deepEqual(unpackedFiles(asar.getRawHeader(item.archive).header), ['vendor/unchanged.js']);
    assert.equal(asar.extractFile(item.archive, 'vendor/unchanged.js').toString(), 'module.exports = "official";');
    for (const file of ['preload', 'menu', 'tray', 'loadingOverlay', 'provisionSplash']) {
        new vm.Script(asar.extractFile(item.archive, `dist/${file}.js`).toString());
    }
    assert.match(asar.extractFile(item.archive, 'dist/provisionSplash.js').toString(), /正在設定 WSL/);

    assert.equal(engine.install20(item.resources, { skipKill: true }), true);
    assert.deepEqual(fs.readFileSync(item.backup), item.original);
    const menu = asar.extractFile(item.archive, 'dist/menu.js').toString();
    assert.equal(menu.split('MENU TRANSLATION START').length - 1, 1);
    assert.equal(menu.split('__antigravityZhPatched = true').length - 1, 1);

    const update = await fixture('官方更新', '2.19.0');
    fs.copyFileSync(update.archive, item.archive);
    assert.equal(engine.install20(item.resources, { skipKill: true }), true);
    assert.deepEqual(fs.readFileSync(item.backup), update.original);
    const archivedBackups = fs.readdirSync(item.resources).filter((file) => /^app\.asar\.[0-9]+\.bak$/.test(file));
    assert.equal(archivedBackups.length, 1);
    assert.deepEqual(fs.readFileSync(path.join(item.resources, archivedBackups[0])), item.original);
    assert.equal(engine.restore20(item.resources, { skipKill: true }), true);
    assert.deepEqual(fs.readFileSync(item.archive), update.original);
    assert.deepEqual(fs.readFileSync(item.backup), update.original);
});

test('缺少官方備份時，不把已修改程式當成官方原檔', async () => {
    const item = await fixture('缺少備份', '2.18.1', {
        files: { 'preload.js': `globalThis.fixture = true;\n${engine.generateJs()}` }
    });
    assert.equal(engine.install20(item.resources, { skipKill: true }), false);
    assert.deepEqual(fs.readFileSync(item.archive), item.original);
    assert.equal(fs.existsSync(item.backup), false);
});

test('未知插入點或無效程式碼，不覆寫目前程式', async () => {
    for (const [name, files] of [
        ['未知選單', { 'menu.js': 'const newMenuStructure = true;' }],
        ['無效程式碼', { 'preload.js': 'const broken = ;' }]
    ]) {
        const item = await fixture(name, '2.18.1', { files });
        assert.equal(engine.install20(item.resources, { skipKill: true }), false);
        assert.deepEqual(fs.readFileSync(item.archive), item.original);
    }
});

test('原子替換失敗時，保持原本 ASAR 與可還原備份', async () => {
    const item = await fixture('替換失敗');
    const originalRename = fs.renameSync;
    fs.renameSync = (source, destination) => {
        if (path.resolve(destination) === path.resolve(item.archive)) throw new Error('模擬檔案被占用');
        return originalRename(source, destination);
    };
    try {
        assert.equal(engine.install20(item.resources, { skipKill: true }), false);
        assert.deepEqual(fs.readFileSync(item.archive), item.original);
        assert.deepEqual(fs.readFileSync(item.backup), item.original);
    } finally {
        fs.renameSync = originalRename;
    }
});

test('CLI 與 Windows 一鍵工具失敗時回傳非零，不誤報完成', async () => {
    const item = await fixture('CLI失敗', '2.18.1', { files: { 'menu.js': 'const incompatible = true;' } });
    const result = childProcess.spawnSync(process.execPath, [
        path.join(__dirname, 'localization_engine.js'), '--install-dir', item.resources, '--skip-kill'
    ], { encoding: 'utf8', windowsHide: true });
    assert.equal(result.status, 1);
    if (process.platform === 'win32') {
        const run = childProcess.spawnSync('cmd.exe', ['/d', '/c',
            `"${path.join(__dirname, 'install-win.bat')}" --skip-kill --install-dir "${item.resources}"`
        ], { input: '\n\n', encoding: 'utf8', windowsHide: true });
        assert.equal(run.status, 1, run.stdout + run.stderr);
        assert.equal(run.stdout.includes('[3/3]'), false);
    }
});

test('非同步加入的 WSL 選單與未知英文，不影響使用者內容', () => {
    const context = {
        menu: { items: [{ label: 'File' }] },
        electron_1: { Menu: { setApplicationMenu(menu) { return menu; } } }
    };
    vm.runInNewContext(engine.createMenuTranslationPatch(), context);
    const newMenu = { items: [{ label: 'Connect to WSL' }, { label: 'Unknown New Feature' }, { label: 'Version 2.18.1' }] };
    context.electron_1.Menu.setApplicationMenu(newMenu);
    assert.equal(newMenu.items[0].label, '連線至 WSL');
    assert.equal(newMenu.items[1].label, 'Unknown New Feature');
    assert.equal(newMenu.items[2].label, '版本 2.18.1');
});

test('UI 實際發現的配額、拆分說明與程式預覽回歸', () => {
    class Element {
        constructor(tagName = 'DIV', children = [], className = '') {
            this.nodeType = 1;
            this.tagName = tagName;
            this.className = className;
            this.childNodes = children;
            this.attributes = {};
            for (const child of children) child.parentElement = this;
        }
        get textContent() { return this.childNodes.map(child => child.textContent).join(''); }
        getAttribute(name) { return this.attributes[name] || null; }
        setAttribute(name, value) { this.attributes[name] = value; }
        attachShadow() { return {}; }
    }
    const text = nodeValue => ({ nodeType: 3, nodeValue, get textContent() { return this.nodeValue; } });
    const window = { addEventListener() {} };
    const context = {
        window, Element, Node: { ELEMENT_NODE: 1, TEXT_NODE: 3 },
        MutationObserver: class { observe() {} }, setTimeout() {},
        document: { readyState: 'loading', getElementById() { return {}; }, addEventListener() {} }
    };
    const source = engine.generateJs().replace("window.addEventListener('load', startEngine);",
        "window.testApi = { translateString, translateNode, translateAttributes }; window.addEventListener('load', startEngine);");
    vm.runInNewContext(source, context);
    const { translateString, translateNode, translateAttributes } = window.testApi;
    assert.equal(translateString("Your plan's baseline quota will refresh on 2026/10/7 下午12:44:30."),
        '你的方案基本配額將於 2026/10/7 下午12:44:30 恢復。');
    assert.equal(translateString('Resets in 2d 13h'), '2 天 13 小時後恢復');
    assert.match(translateString('You have hit your weekly limit, it refreshes in 2 days, 13 hours. If on a supported paid plan, you can use AI credits in the interim or upgrade to a higher tier.'),
        /^你已用完每週額度；將在 2 天 13 小時後恢復。/);
    assert.equal(translateString('Select project, current: My English Project'), '選擇專案，目前使用：My English Project');
    assert.equal(translateString('9:00 AM'), '上午 9:00');
    assert.equal(translateString('Version 2.18.1'), '版本 2.18.1');
    assert.equal(translateString('Toggle Science'), '切換科學研究');
    for (const unknown of ['Unknown New Feature', 'Toggle Unknown New Feature', 'User quoted Name in a sentence']) {
        assert.equal(translateString(unknown), unknown);
    }

    const planCommand = new Element('CODE', [text('plan')]);
    const plan = new Element('P', [text('Type '), new Element('CODE', [text('/')]), text(' and select '),
        planCommand, text(' to have the agent generate a plan.')]);
    translateNode(plan);
    assert.equal(plan.textContent, '輸入 / 並選擇 plan ，讓 Agent 產生計畫。');
    assert.equal(planCommand.textContent, 'plan');
    const flash = new Element('P', [text('All '), new Element('SPAN', [text('scheduled task')]), text('s run as Flash.')]);
    translateNode(flash);
    assert.equal(flash.textContent, '所有 排程任務都使用 Flash 執行。');

    for (const container of [new Element('DIV', [text('name')], 'font-mono'),
        new Element('CODE', [text('Name')]), new Element('DIV', [text('Name')], 'chat-message')]) {
        const original = container.textContent;
        translateNode(container);
        assert.equal(container.textContent, original);
    }
    const input = new Element('INPUT', [text('Name')]);
    input.setAttribute('placeholder', 'Enter scheduled task name...');
    translateNode(input);
    translateAttributes(input);
    assert.equal(input.textContent, 'Name');
    assert.equal(input.getAttribute('placeholder'), '輸入排程任務名稱…');
});
