const fs = require('fs');
const path = require('path');
const child_process = require('child_process');
const asar = require('@electron/asar');
const vm = require('vm');

const PROJECT_ID = 'antigravity2-zh-hant-tw';
const PROJECT_NAME = 'Antigravity 2.0 繁體中文套件';
const ENGINE_VERSION = '1.1.0';
const SIGNATURE = 'ZH-HANT-TW';

const SIGNATURE_START = '/* --- ANTIGRAVITY ZH-HANT-TW LOCALIZATION START --- */';
const SIGNATURE_END = '/* --- ANTIGRAVITY ZH-HANT-TW LOCALIZATION END --- */';

/**
 * 解析本地 @electron/asar CLI 路徑。
 * 優先使用 node_modules/@electron/asar/bin/asar.js，若不存在則提示使用者先執行 npm install。
 * @returns {string|null} asar CLI 的絕對路徑，若找不到則回傳 null。
 */
function resolveAsarCli() {
    const localAsarPath = path.join(__dirname, 'node_modules', '@electron', 'asar', 'bin', 'asar.js');
    if (fs.existsSync(localAsarPath)) {
        return localAsarPath;
    }
    return null;
}

/**
 * 使用本地 asar CLI 執行指令。
 * @param {string} action - asar 動作，例如 'extract' 或 'pack'
 * @param {string[]} args - 傳入 asar 的參數陣列
 * @returns {{success: boolean, stdout: string, stderr: string}}
 */
function runAsarCommand(action, args) {
    const asarCli = resolveAsarCli();
    if (!asarCli) {
        console.error('[錯誤] 找不到本地 @electron/asar CLI。');
        console.error('  請先在專案目錄執行 npm install，再重新執行安裝。');
        return { success: false, stdout: '', stderr: '本地 @electron/asar 未安裝' };
    }

    try {
        const stdout = child_process.execFileSync(process.execPath, [asarCli, action, ...args], {
            encoding: 'utf8', windowsHide: true
        });
        return { success: true, stdout, stderr: '' };
    } catch (error) {
        return { success: false, stdout: error.stdout || '', stderr: error.stderr || error.message };
    }
}

// 只清理本次建立的工作目錄。Windows 使用資源回收筒，失敗時保留檔案。
function recycleTemporaryDirectory(directory) {
    if (!fs.existsSync(directory)) return;
    const absolute = path.resolve(directory);
    if (path.basename(absolute).startsWith('.zh-tw-work-') === false &&
        path.basename(absolute).startsWith('_verify_asar-') === false) {
        throw new Error(`拒絕清理非本工具的工作目錄：${absolute}`);
    }
    if (process.platform === 'win32') {
        const literal = absolute.replace(/'/g, "''");
        child_process.execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
            `Add-Type -AssemblyName Microsoft.VisualBasic; ` +
            `[Microsoft.VisualBasic.FileIO.FileSystem]::DeleteDirectory('${literal}', ` +
            `[Microsoft.VisualBasic.FileIO.UIOption]::OnlyErrorDialogs, ` +
            `[Microsoft.VisualBasic.FileIO.RecycleOption]::SendToRecycleBin, ` +
            `[Microsoft.VisualBasic.FileIO.UICancelOption]::ThrowException)`
        ], { windowsHide: true, stdio: 'pipe' });
    } else if (process.platform === 'darwin') {
        fs.renameSync(absolute, path.join(process.env.HOME, '.Trash', `${path.basename(absolute)}-${Date.now()}`));
    } else {
        throw new Error(`無可用資源回收筒；工作目錄已保留：${absolute}`);
    }
    if (fs.existsSync(absolute)) throw new Error(`工作目錄尚未移至資源回收筒：${absolute}`);
}

/**
 * 環境檢查：確認必要工具是否存在。
 * @returns {boolean} 環境檢查是否通過
 */
function checkEnvironment() {
    // 檢查本地 @electron/asar CLI
    const asarCli = resolveAsarCli();
    if (!asarCli) {
        console.error('');
        console.error('╔══════════════════════════════════════════════════════════╗');
        console.error('║  [環境檢查] 找不到本地 @electron/asar CLI                ║');
        console.error('║                                                          ║');
        console.error('║  請先在專案根目錄執行：                                  ║');
        console.error('║    npm install                                            ║');
        console.error('║                                                          ║');
        console.error('║  完成後再重新執行安裝腳本。                              ║');
        console.error('╚══════════════════════════════════════════════════════════╝');
        console.error('');
        return false;
    }
    console.log(`[環境檢查] 本地 asar CLI 已就緒：${asarCli}`);
    return true;
}

function normalizeText(text) {
    if (!text) return '';
    return text
        .normalize('NFKC')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201C\u201D]/g, '"');
}

function loadDictionary() {
    const totalMap = {};
    const dictsDir = path.join(__dirname, 'dicts');

    if (!fs.existsSync(dictsDir)) {
        console.warn(`[警告] 找不到字典目錄：${dictsDir}`);
        return totalMap;
    }

    const files = fs.readdirSync(dictsDir).filter(file => file.endsWith('.json')).sort();

    for (const file of files) {
        try {
            const filePath = path.join(dictsDir, file);
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            const data = JSON.parse(fileContent);

            for (const [k, v] of Object.entries(data)) {
                const normK = normalizeText(k);
                if (normK) totalMap[normK] = v;
            }
        } catch (e) {
            console.warn(`[警告] 無法讀取字典檔：${file}`);
            console.warn(e.message);
        }
    }

    return totalMap;
}

function generateJs() {
    const fullDict = loadDictionary();
    const dictJson = JSON.stringify(fullDict, null, 4);

    const jsSource = `${SIGNATURE_START}
(() => {
    if (window.__ANTIGRAVITY_ZH_TW_LOADED__) return;
    window.__ANTIGRAVITY_ZH_TW_LOADED__ = true;

    const injectStyle = () => {
        if (!document.getElementById('ag-zh-hant-tooltip-style')) {
            const style = document.createElement('style');
            style.id = 'ag-zh-hant-tooltip-style';
            style.textContent = \`
                .react-tooltip-content-wrapper:not([data-ag-tooltip-ready="true"]),
                [class*="react-tooltip" i]:not([data-ag-tooltip-ready="true"]) {
                    visibility: hidden !important;
                    opacity: 0 !important;
                }
            \`;
            const parent = document.head || document.documentElement;
            if (parent) parent.appendChild(style);
        }
    };
    injectStyle();

    const map = new Map(Object.entries(DICT_PLACEHOLDER));
    const lowerMap = new Map();
    for (const [k, v] of map.entries()) lowerMap.set(k.toLowerCase(), v);

    const done = new WeakSet();

    const tooltipPortalSelectors = [
        '.react-tooltip-content-wrapper', '[class*="react-tooltip" i]',
        '[role="tooltip"]', '[data-radix-popper-content-wrapper]',
        '[data-radix-tooltip-content]', '[data-slot="tooltip-content"]',
        '[data-side][data-align]', '.tooltip', '.Tooltip',
        '.tooltip-content', '.tooltipContent', '.popover',
        '.popover-content', '.PopoverContent'
    ];

    const BLOCKED_CLASSES = [
        'monaco-editor', 'editor-container', 'terminal', 'output-view',
        'debug-console', 'code-view', 'code-preview', 'font-mono', 'artifact-container', 'suggest-widget',
        'message-content', 'chat-message', 'user-message', 'assistant-message',
        'conversation-turn', 'rendered-markdown', 'markdown-body', 'prose'
    ];
    const BLOCKED_TAGS = ['SCRIPT', 'STYLE', 'CODE', 'PRE', 'INPUT', 'TEXTAREA', 'SVG', 'CANVAS', 'SYMBOL', 'PATH'];
    const FORM_CONTROL_TAGS = ['INPUT', 'TEXTAREA'];

    function norm(s) {
        if (!s) return '';
        return s.normalize('NFKC').replace(/\\s+/g, ' ').replace(/[\\u2018\\u2019]/g, "'").replace(/[\\u201C\\u201D]/g, '"').trim();
    }

    function isInBlockedZone(node, allowFormControlAttribute = false) {
        let curr = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
        let depth = 0;

        while (curr && depth < 12) {
            if (curr.nodeType === Node.ELEMENT_NODE) {
                const tag = curr.tagName.toUpperCase();
                const isDirectSafeAttributeTarget = allowFormControlAttribute && depth === 0 && (
                    FORM_CONTROL_TAGS.includes(tag) || curr.getAttribute('contenteditable') === 'true'
                );
                if (isDirectSafeAttributeTarget) return false;
                if (BLOCKED_TAGS.includes(tag)) return true;
                if (curr.getAttribute('contenteditable') === 'true') return true;

                const className = curr.className || '';
                if (typeof className === 'string' && BLOCKED_CLASSES.some(cls => className.toLowerCase().includes(cls))) {
                    return true;
                }

                const contentHint = [
                    curr.getAttribute('data-testid'),
                    curr.getAttribute('data-role'),
                    curr.getAttribute('data-message-id') ? 'message-id' : ''
                ].filter(Boolean).join(' ').toLowerCase();
                if (/(message-content|chat-message|user-message|assistant-message|conversation-turn|message-id)/.test(contentHint)) {
                    return true;
                }
            }

            curr = curr.parentElement || (curr.parentNode && curr.parentNode.host);
            depth++;
        }

        return false;
    }

    function translateString(originalVal) {
        if (!originalVal || typeof originalVal !== 'string') return originalVal;
        const valNorm = norm(originalVal);
        if (!valNorm) return originalVal;
        
        const valLower = valNorm.toLowerCase();
        let newVal = originalVal;

        if (map.has(valNorm)) {
            newVal = map.get(valNorm);
        } else if (lowerMap.has(valLower)) {
            newVal = lowerMap.get(valLower);
        }
        if (newVal === originalVal) {
            const deleteProjectMatch = valNorm.match(/^Permanently delete (.+?) including (\\d+) active conversations? and (\\d+) archived conversations?\\.$/);
            const thoughtDurationMatch = valNorm.match(/^Thought for (\\d+(?:\\.\\d+)?)s$/);
            const workedDurationMatch = valNorm.match(/^Worked for (\\d+(?:\\.\\d+)?)s$/);
            const currentModelMatch = valNorm.match(/^Select model, current: (.+)$/);
            const compactAgeMatch = valNorm.match(/^(\\d+)(mo|s|m|h|d|w|y)$/);
            const customizationBudgetMatch = valNorm.match(/^(\\d+(?:\\.\\d+)?)% of the customization budget is available\\.$/);
            const quotaRefreshMatch = valNorm.match(/^You have used some of your (weekly|5-hour) limit, it will fully refresh in (\\d+) (day|days|hour|hours|minute|minutes)(?:, (\\d+) (hour|hours|minute|minutes))?\\.$/);
            const showBreakdownsMatch = valNorm.match(/^Show (\\d+) breakdowns$/);
            const skillsTokensMatch = valNorm.match(/^Skills: ([\\d,]+) tokens$/);
            const modifiedProjectsMatch = valNorm.match(/^Modified in (\\d+) projects?$/);
            const baselineQuotaMatch = valNorm.match(/^Your plan's baseline quota will refresh on (.+)\\.$/);
            const exhaustedQuotaMatch = valNorm.match(/^You have hit your (weekly|5-hour) limit, it refreshes in (\\d+) (days?|hours?|minutes?)(?:, (\\d+) (hours?|minutes?))?\\. If on a supported paid plan, you can use AI credits in the interim or upgrade to a higher tier\\.$/);
            const compactResetMatch = valNorm.match(/^Resets in (\\d+)(d|h|m)(?: (\\d+)(h|m))?$/);
            const currentProjectMatch = valNorm.match(/^Select project, current: (.+)$/);
            const togglePluginMatch = valNorm.match(/^Toggle (android-cli-plugin|chrome-devtools-plugin|firebase|flutter|google-antigravity-sdk|modern-web-guidance-plugin|science|科學研究)$/);
            const clockMatch = valNorm.match(/^(\\d{1,2}:\\d{2}) (AM|PM)$/);
            const versionLabelMatch = valNorm.match(/^Version (\\d+(?:\\.\\d+)+(?:[-+][\\w.-]+)?)$/);
            if (deleteProjectMatch) {
                newVal = '永久刪除 ' + deleteProjectMatch[1] + '，包括 ' + deleteProjectMatch[2] + ' 個進行中對話以及 ' + deleteProjectMatch[3] + ' 個已封存對話。';
            } else if (thoughtDurationMatch) {
                newVal = '思考了 ' + thoughtDurationMatch[1] + ' 秒';
            } else if (workedDurationMatch) {
                newVal = '處理了 ' + workedDurationMatch[1] + ' 秒';
            } else if (currentModelMatch) {
                newVal = '選擇模型，目前使用：' + currentModelMatch[1];
            } else if (compactAgeMatch) {
                const ageUnits = { s: ' 秒', m: ' 分鐘', h: ' 小時', d: ' 天', w: ' 週', mo: ' 個月', y: ' 年' };
                newVal = compactAgeMatch[1] + ageUnits[compactAgeMatch[2]];
            } else if (customizationBudgetMatch) {
                newVal = '自訂項目預算尚餘 ' + customizationBudgetMatch[1] + '%。';
            } else if (quotaRefreshMatch) {
                const durationUnits = { day: '天', days: '天', hour: '小時', hours: '小時', minute: '分鐘', minutes: '分鐘' };
                const limitLabel = quotaRefreshMatch[1] === 'weekly' ? '每週額度' : '五小時額度';
                let duration = quotaRefreshMatch[2] + ' ' + durationUnits[quotaRefreshMatch[3]];
                if (quotaRefreshMatch[4]) duration += ' ' + quotaRefreshMatch[4] + ' ' + durationUnits[quotaRefreshMatch[5]];
                newVal = '已使用部分' + limitLabel + '；將在 ' + duration + '後全數恢復。';
            } else if (showBreakdownsMatch) {
                newVal = '顯示 ' + showBreakdownsMatch[1] + ' 項明細';
            } else if (skillsTokensMatch) {
                newVal = '技能：' + skillsTokensMatch[1] + ' 個 Token';
            } else if (modifiedProjectsMatch) {
                newVal = '已在 ' + modifiedProjectsMatch[1] + ' 個專案中修改';
            } else if (baselineQuotaMatch) {
                newVal = '你的方案基本配額將於 ' + baselineQuotaMatch[1] + ' 恢復。';
            } else if (exhaustedQuotaMatch) {
                const units = { day: '天', days: '天', hour: '小時', hours: '小時', minute: '分鐘', minutes: '分鐘' };
                let duration = exhaustedQuotaMatch[2] + ' ' + units[exhaustedQuotaMatch[3]];
                if (exhaustedQuotaMatch[4]) duration += ' ' + exhaustedQuotaMatch[4] + ' ' + units[exhaustedQuotaMatch[5]];
                const label = exhaustedQuotaMatch[1] === 'weekly' ? '每週' : '五小時';
                newVal = '你已用完' + label + '額度；將在 ' + duration + '後恢復。若你的付費方案支援，可在等待期間使用 AI 點數，或升級至更高方案。';
            } else if (compactResetMatch) {
                const units = { d: ' 天', h: ' 小時', m: ' 分鐘' };
                newVal = compactResetMatch[1] + units[compactResetMatch[2]];
                if (compactResetMatch[3]) newVal += ' ' + compactResetMatch[3] + units[compactResetMatch[4]];
                newVal += '後恢復';
            } else if (currentProjectMatch) {
                newVal = '選擇專案，目前使用：' + currentProjectMatch[1];
            } else if (togglePluginMatch) {
                newVal = '切換 ' + togglePluginMatch[1];
            } else if (clockMatch) {
                newVal = (clockMatch[2] === 'AM' ? '上午 ' : '下午 ') + clockMatch[1];
            } else if (versionLabelMatch) {
                newVal = '版本 ' + versionLabelMatch[1];
            } else {
                const deleteProjectPrefixMatch = valNorm.match(/^Permanently delete (.+)$/);
                const activeConversationsMatch = valNorm.match(/^(\\d+) active conversations?$/);
                const archivedConversationsMatch = valNorm.match(/^(\\d+) archived conversations?$/);

                if (deleteProjectPrefixMatch) {
                    newVal = '永久刪除 ' + deleteProjectPrefixMatch[1];
                } else if (activeConversationsMatch) {
                    newVal = activeConversationsMatch[1] + ' 個進行中對話';
                } else if (archivedConversationsMatch) {
                    newVal = archivedConversationsMatch[1] + ' 個已封存對話';
                }
            }
        }
        return newVal;
    }

    // 新版將說明拆成文字與內嵌指令；僅在整句吻合時翻譯文字節點，保留控制項。
    function translateUiFragments(node) {
        const fragments = {
            'Type / and select plan to have the agent generate a plan.': {
                'Type': '輸入', 'and select': '並選擇',
                'to have the agent generate a plan.': '，讓 Agent 產生計畫。'
            },
            'All scheduled tasks run as Flash.': {
                'All': '所有', 'scheduled task': '排程任務', 's run as Flash.': '都使用 Flash 執行。'
            }
        };
        let el = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
        for (let depth = 0; el && depth < 4; depth++, el = el.parentElement) {
            if (isInBlockedZone(el)) return;
            const replacements = fragments[norm(el.textContent)];
            if (!replacements) continue;
            const visit = child => {
                if (child.nodeType === Node.TEXT_NODE && !isInBlockedZone(child)) {
                    const replacement = replacements[norm(child.nodeValue)];
                    if (replacement) child.nodeValue = child.nodeValue.replace(child.nodeValue.trim(), replacement);
                } else {
                    for (const nested of child.childNodes || []) visit(nested);
                }
            };
            visit(el);
            return;
        }
    }

    function translateAttributes(el) {
        if (!el || el.nodeType !== Node.ELEMENT_NODE) return;
        if (isInBlockedZone(el, true)) return;

        for (const attr of ['placeholder', 'title', 'aria-label']) {
            const v = el.getAttribute(attr);
            if (!v) continue;
            const translated = translateString(v);
            if (translated !== v) el.setAttribute(attr, translated);
        }
    }

    function sweepAttributes(root) {
        if (!root || !root.querySelectorAll) return;
        const els = root.querySelectorAll('[title], [aria-label], [placeholder]');
        for (const el of els) {
            translateAttributes(el);
        }
    }

    function hasTranslatableEnglishText(node) {
        if (!node) return false;
        const text = norm(node.textContent || '');
        if (!text) return false;
        const translated = translateString(text);
        return typeof translated === 'string' && translated !== text;
    }

    function translateTooltipNodeWithReadyCheck(node, attempt = 1) {
        try {
            translateNode(node);
            translateAttributes(node);
            sweepAttributes(node);
        } finally {
            try {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    const checkAndSetReady = () => {
                        let hasEnglish = false;
                        if (node.matches && node.matches('.react-tooltip-content-wrapper, [class*="react-tooltip" i]')) {
                            if (hasTranslatableEnglishText(node)) hasEnglish = true;
                        } else {
                            const subTooltips = node.querySelectorAll('.react-tooltip-content-wrapper, [class*="react-tooltip" i]');
                            for (const t of subTooltips) {
                                if (hasTranslatableEnglishText(t)) hasEnglish = true;
                            }
                        }
                        
                        if (hasEnglish && attempt <= 5) {
                            requestAnimationFrame(() => {
                                translateTooltipNodeWithReadyCheck(node, attempt + 1);
                            });
                        } else {
                            if (node.matches && node.matches('.react-tooltip-content-wrapper, [class*="react-tooltip" i]')) {
                                node.setAttribute('data-ag-tooltip-ready', 'true');
                            }
                            const subTooltips = node.querySelectorAll('.react-tooltip-content-wrapper, [class*="react-tooltip" i]');
                            for (const t of subTooltips) {
                                t.setAttribute('data-ag-tooltip-ready', 'true');
                            }
                        }
                    };
                    checkAndSetReady();
                }
            } catch (e) {}
        }
    }

    function translateTooltipPortals() {
        try {
            const portals = document.querySelectorAll(tooltipPortalSelectors.join(', '));
            for (const portal of portals) {
                if (!isInBlockedZone(portal)) {
                    if (portal.matches('.react-tooltip-content-wrapper, [class*="react-tooltip" i]')) {
                        translateTooltipNodeWithReadyCheck(portal);
                    } else {
                        translateNode(portal);
                        translateAttributes(portal);
                        sweepAttributes(portal);
                    }
                }
            }
        } catch (e) {}
    }

    function translateAroundPointer(e) {
        try {
            let el = e.target;
            while (el && el !== document.body) {
                translateAttributes(el);
                el = el.parentElement;
            }

            if (e.clientX !== undefined && e.clientY !== undefined) {
                const elsUnderPointer = document.elementsFromPoint(e.clientX, e.clientY);
                for (const elem of elsUnderPointer) {
                    translateAttributes(elem);
                }
            }

            requestAnimationFrame(() => {
                sweepAttributes(document.body);
                translateTooltipPortals();
            });
            setTimeout(() => { sweepAttributes(document.body); translateTooltipPortals(); }, 0);
            setTimeout(() => { sweepAttributes(document.body); translateTooltipPortals(); }, 30);
            setTimeout(() => { sweepAttributes(document.body); translateTooltipPortals(); }, 80);
            setTimeout(() => { sweepAttributes(document.body); translateTooltipPortals(); }, 150);
            setTimeout(() => { sweepAttributes(document.body); translateTooltipPortals(); }, 300);
        } catch (err) {}
    }

    function translateNode(node) {
        try {
            if (!node || done.has(node)) return;
            translateUiFragments(node);

            if (node.nodeType === Node.ELEMENT_NODE) {
                translateAttributes(node);
                if (node.shadowRoot) translateNode(node.shadowRoot);
                for (const child of node.childNodes) translateNode(child);
                return;
            }

            if (node.nodeType === Node.TEXT_NODE) {
                const originalVal = node.nodeValue;
                if (!originalVal || originalVal.trim().length < 1) return;
                if (isInBlockedZone(node)) return;

                let newVal = translateString(originalVal);

                if (newVal !== originalVal) {
                    node.nodeValue = newVal;
                    done.add(node);
                    setTimeout(() => done.delete(node), 1000);
                }
            }
        } catch (e) {}
    }

    let portalDebounce = null;
    const observer = new MutationObserver(mutations => {
        let hasChildList = false;
        for (const m of mutations) {
            if (m.type === 'childList') {
                hasChildList = true;
                for (const n of m.addedNodes) {
                    translateNode(n);
                    if (n.nodeType === Node.ELEMENT_NODE) {
                        try {
                            if (n.matches && n.matches('.react-tooltip-content-wrapper, [class*="react-tooltip" i]')) {
                                n.removeAttribute('data-ag-tooltip-ready');
                                translateTooltipNodeWithReadyCheck(n);
                            } else if (n.querySelector && n.querySelector('.react-tooltip-content-wrapper, [class*="react-tooltip" i]')) {
                                const tooltips = n.querySelectorAll('.react-tooltip-content-wrapper, [class*="react-tooltip" i]');
                                for (const t of tooltips) {
                                    t.removeAttribute('data-ag-tooltip-ready');
                                    translateTooltipNodeWithReadyCheck(t);
                                }
                            }

                            if (n.matches && n.matches(tooltipPortalSelectors.join(', '))) {
                                translateNode(n);
                                sweepAttributes(n);
                            } else if (n.querySelector && n.querySelector(tooltipPortalSelectors.join(', '))) {
                                translateTooltipPortals();
                            }
                        } catch(e) {}
                    }
                }
            } else if (m.type === 'characterData') {
                translateNode(m.target);
            } else if (m.type === 'attributes') {
                const el = m.target;
                if (el && el.nodeType === Node.ELEMENT_NODE && !isInBlockedZone(el, true)) {
                    const attr = m.attributeName;
                    if (attr === 'title' || attr === 'aria-label' || attr === 'placeholder') {
                        const v = el.getAttribute(attr);
                        if (v) {
                            const translated = translateString(v);
                            if (translated !== v) {
                                el.setAttribute(attr, translated);
                            }
                        }
                    }
                }
            }
        }
        if (hasChildList) {
            if (!portalDebounce) {
                portalDebounce = setTimeout(() => {
                    translateTooltipPortals();
                    portalDebounce = null;
                }, 50);
            }
        }
    });

    const obsOpts = { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['title', 'aria-label', 'placeholder'] };

    const startEngine = () => {
        const target = document.body || document.documentElement;
        if (!target) return;

        try {
            observer.observe(target, obsOpts);
            translateNode(target);
            sweepAttributes(target);
        } catch (e) {}
    };

    const origAttachShadow = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function() {
        const sr = origAttachShadow.apply(this, arguments);
        try { observer.observe(sr, obsOpts); } catch (e) {}
        return sr;
    };

    const origSetAttribute = Element.prototype.setAttribute;
    Element.prototype.setAttribute = function(name, value) {
        if (typeof value === 'string' && (name === 'title' || name === 'aria-label' || name === 'placeholder')) {
            if (!isInBlockedZone(this, true)) {
                const translated = translateString(value);
                return origSetAttribute.call(this, name, translated);
            }
        }
        return origSetAttribute.call(this, name, value);
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startEngine);
    } else {
        startEngine();
    }

    window.addEventListener('load', startEngine);
    setTimeout(startEngine, 100);
    setTimeout(startEngine, 300);
    setTimeout(startEngine, 1000);
    setTimeout(startEngine, 3000);
    setTimeout(startEngine, 6000);

    document.addEventListener('pointerover', translateAroundPointer, true);
    document.addEventListener('mouseover', translateAroundPointer, true);
    document.addEventListener('focusin', translateAroundPointer, true);
})();
${SIGNATURE_END}`;

    return jsSource.replace('DICT_PLACEHOLDER', dictJson);
}

function cleanJsContent(content) {
    const regex = new RegExp(escapeRegExp(SIGNATURE_START) + '[\\s\\S]*?' + escapeRegExp(SIGNATURE_END), 'g');
    return content.replace(regex, '');
}

function cleanMenuJsContent(content) {
    const startMarks = [
        '/* --- MENU TRANSLATION START --- */',
        '// =========================================='
    ];
    const endMarks = [
        '/* --- MENU TRANSLATION END --- */',
        'translateMenu(menu.items);'
    ];

    let cleaned = content;

    for (const startMark of startMarks) {
        const startIdx = cleaned.indexOf(startMark);
        if (startIdx === -1) continue;

        let endIdx = -1;
        let endMarkUsed = '';

        if (startMark === '/* --- MENU TRANSLATION START --- */') {
            const endSign = '/* --- MENU TRANSLATION END --- */';
            const idx = cleaned.indexOf(endSign, startIdx);
            if (idx !== -1) {
                endIdx = idx;
                endMarkUsed = endSign;
            }
        }

        if (endIdx === -1) {
            for (const endMark of endMarks) {
                const idx = cleaned.indexOf(endMark, startIdx);
                if (idx !== -1 && (endIdx === -1 || idx < endIdx)) {
                    endIdx = idx;
                    endMarkUsed = endMark;
                }
            }
        }

        if (endIdx !== -1 && startIdx < endIdx) {
            cleaned = cleaned.substring(0, startIdx) + cleaned.substring(endIdx + endMarkUsed.length);
        }
    }

    return cleaned;
}

function cleanTrayJsContent(content) {
    const startMark = '/* --- TRAY TRANSLATION START --- */';
    const endMark = '/* --- TRAY TRANSLATION END --- */';
    const startIdx = content.indexOf(startMark);
    const endIdx = content.indexOf(endMark);

    if (startIdx !== -1 && endIdx !== -1 && startIdx < endIdx) {
        return content.substring(0, startIdx) + content.substring(endIdx + endMark.length);
    }

    return content;
}

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function closeAntigravityProcesses(options = {}) {
    if (options && (options.skipKill || options.noKill)) {
        console.log('[略過] 已指定略過關閉程序，不中斷 Antigravity。');
        return;
    }

    if (process.env.ANTIGRAVITY_AGENT || process.env.ANTIGRAVITY_LS_ADDRESS) {
        console.log('[跳過] 偵測到正在 Antigravity Agent 環境中執行，略過關閉程序以保持連線。');
        return;
    }

    console.log('[1] 正在關閉 Antigravity，以避免檔案被占用...');

    try {
        if (process.platform === 'win32') {
            child_process.execSync('taskkill /f /im Antigravity.exe /t >nul 2>nul');
        } else {
            child_process.execSync('pkill -f Antigravity > /dev/null 2>&1');
        }
    } catch (e) {}

    const start = Date.now();
    while (Date.now() - start < 1500) {}
}

function detectInstallationDir(manualDir) {
    if (manualDir) {
        if (fs.existsSync(manualDir)) {
            return path.resolve(manualDir);
        }

        console.error(`[錯誤] 指定的安裝路徑不存在：${manualDir}`);
        process.exit(1);
    }

    const candidates = [];

    if (process.platform === 'win32') {
        const localAppdata = process.env.LOCALAPPDATA;
        if (localAppdata) {
            candidates.push(path.join(localAppdata, 'Programs', 'antigravity'));
        }

        candidates.push('D:\\Antigravity');
        candidates.push('C:\\Program Files\\Antigravity');
    } else if (process.platform === 'darwin') {
        candidates.push('/Applications/Antigravity.app');
        candidates.push(path.join(process.env.HOME || '', 'Applications', 'Antigravity.app'));
    }

    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
            console.log(`[偵測] 找到 Antigravity 安裝目錄：${candidate}`);
            return path.resolve(candidate);
        }
    }

    console.error('[錯誤] 找不到 Antigravity 安裝目錄。請使用 --install-dir 指定路徑。');
    process.exit(1);
}

function runCommandSync(cmd) {
    try {
        const out = child_process.execSync(cmd, { encoding: 'utf-8', stdio: 'pipe' });
        return { success: true, stdout: out, stderr: '' };
    } catch (e) {
        return { success: false, stdout: e.stdout || '', stderr: e.stderr || e.message };
    }
}

function createMenuTranslationPatch() {
    return `
    /* --- MENU TRANSLATION START --- */
    const translations = {
        'File': '檔案',
        'Edit': '編輯',
        'View': '檢視',
        'Window': '視窗',
        'Help': '說明',
        'New Window': '新增視窗',
        'Create Project': '建立專案',
        'Command Palette': '指令選擇區',
        'Docs': '使用說明',
        'Check for Updates': '檢查更新',
        'Toggle Developer Tools': '切換開發者工具',
        'Undo': '復原',
        'Redo': '重做',
        'Cut': '剪下',
        'Copy': '複製',
        'Paste': '貼上',
        'Select All': '全選',
        'Minimize': '最小化',
        'Maximize': '最大化',
        'Close': '關閉',
        'Zoom': '縮放',
        'Reset Zoom': '重設縮放',
        'Zoom In': '放大',
        'Zoom Out': '縮小',
        'Toggle Full Screen': '切換全螢幕',
        'Bring All to Front': '將所有視窗移至最前',
        'Reload': '重新載入',
        'Force Reload': '強制重新載入',
        'Actual Size': '實際大小',
        'Paste and Match Style': '貼上並符合樣式',
        'Delete': '刪除',
        'Substitutions': '替換',
        'Show Substitutions': '顯示替換',
        'Smart Quotes': '智慧引號',
        'Smart Dashes': '智慧破折號',
        'Text Replacement': '文字替換',
        'Speech': '語音',
        'Start Speaking': '開始朗讀',
        'Stop Speaking': '停止朗讀',
        'Close Window': '關閉視窗',
        'Connect to WSL': '連線至 WSL',
        'Reopen Locally': '在本地端重新開啟'
    };

    function translateMenu(items) {
        if (!items) return;
        for (const item of items) {
            const label = item.label || '';
            let cleanLabel = label;
            let mnemonic = '';

            const match = label.match(/&([a-zA-Z])/);
            if (match) {
                mnemonic = '(&' + match[1] + ')';
                cleanLabel = label.replace('&', '');
            }

            if (translations[cleanLabel]) {
                item.label = translations[cleanLabel] + mnemonic;
            } else if (translations[label]) {
                item.label = translations[label];
            } else if (/^Version \\d+(?:\\.\\d+)+(?:[-+][\\w.-]+)?$/.test(cleanLabel)) {
                item.label = cleanLabel.replace(/^Version /, '版本 ') + mnemonic;
            }

            if (item.submenu && item.submenu.items) {
                translateMenu(item.submenu.items);
            }
        }
    }

    translateMenu(menu.items);

    if (!electron_1.Menu.__antigravityZhPatched) {
        electron_1.Menu.__antigravityZhPatched = true;
        const _origSetApplicationMenu = electron_1.Menu.setApplicationMenu;
        electron_1.Menu.setApplicationMenu = function(m) {
            if (m && m.items) {
                translateMenu(m.items);
            }
            return _origSetApplicationMenu.call(this, m);
        };
    }
    /* --- MENU TRANSLATION END --- */
    `;
}

function createTrayCreatePatch(signature = 'function createTray(actions) {') {
    return `${signature}
    /* --- TRAY TRANSLATION START --- */
    const translations = {
        'No agents running': '目前沒有執行中的 Agent',
        'Open Antigravity': '開啟 Antigravity',
        'Quit': '結束'
    };

    for (const item of actions) {
        if (translations[item.label]) {
            item.label = translations[item.label];
        }
    }
    /* --- TRAY TRANSLATION END --- */`;
}

function install20(resourcesDir, options = {}) {
    const asarPath = path.join(resourcesDir, 'app.asar');
    const bakPath = path.join(resourcesDir, 'app.asar.bak');

    if (!fs.existsSync(asarPath)) {
        console.error(`[錯誤] 在 resources 目錄中找不到 app.asar：${resourcesDir}`);
        return false;
    }

    // 環境檢查：在執行任何破壞性操作前，先確認 asar CLI 可用
    if (!checkEnvironment()) {
        return false;
    }

    let tempDir;
    try {
    asar.uncacheAll();
    const installedPreload = asar.extractFile(asarPath, 'dist/preload.js').toString('utf8');
    const isOfficial = !installedPreload.includes(SIGNATURE_START);
    if (!isOfficial) {
        if (!fs.existsSync(bakPath)) throw new Error('目前已是修改版，但缺少官方備份。請先重新安裝官方程式，不能將修改版備份成官方原檔。');
        const backupPreload = asar.extractFile(bakPath, 'dist/preload.js').toString('utf8');
        const version = JSON.parse(asar.extractFile(asarPath, 'package.json')).version;
        const backupVersion = JSON.parse(asar.extractFile(bakPath, 'package.json')).version;
        if (backupPreload.includes(SIGNATURE_START) || version !== backupVersion) {
            throw new Error('官方備份不是目前版本的原檔，已停止修改。');
        }
    }

    closeAntigravityProcesses(options);

    if (!fs.existsSync(bakPath) || (isOfficial && !fs.readFileSync(asarPath).equals(fs.readFileSync(bakPath)))) {
        console.log(fs.existsSync(bakPath) ? '[備份] 偵測到官方更新版本，更新官方 app.asar 備份...' : '[備份] 正在建立官方 app.asar 備份...');
        if (fs.existsSync(bakPath)) {
            const oldBackup = path.join(resourcesDir, `app.asar.${Date.now()}.bak`);
            fs.renameSync(bakPath, oldBackup);
            console.log(`[備份] 舊版原檔已保留：${oldBackup}`);
        }
        let backupOk = false;
        try {
            fs.copyFileSync(asarPath, bakPath);
            backupOk = true;
        } catch (copyErr) {
            if ((copyErr.code === 'EPERM' || copyErr.code === 'EACCES') && process.platform !== 'win32') {
                console.warn(`[備份] fs.copyFileSync 失敗 (${copyErr.code})，嘗試以 /bin/cp -p 建立備份...`);
                const cpResult = runCommandSync(`/bin/cp -p "${asarPath}" "${bakPath}"`);
                if (cpResult.success && fs.existsSync(bakPath)) {
                    backupOk = true;
                    console.log('[備份] 以 /bin/cp -p 建立備份成功。');
                } else {
                    console.error('[錯誤] 備份失敗：無法建立 app.asar.bak。');
                    console.error('  可能原因：macOS 權限限制或 .app 目錄權限不足。');
                    console.error('  建議：');
                    console.error('    1. 嘗試以具備權限的終端機執行本腳本');
                    console.error('    2. 或手動建立備份：');
                    console.error(`       cp "${asarPath}" "${bakPath}"`);
                    return false;
                }
            } else {
                console.error(`[錯誤] 備份失敗：${copyErr.message}`);
                return false;
            }
        }
        if (backupOk) {
            console.log('[備份] 備份完成。');
        }
    } else {
        console.log('[備份] 已存在官方 app.asar.bak，本次沿用既有備份。');
    }

    // 與目標同磁碟，避免跨磁碟 rename 失敗；不刪除前次未知暫存。
    tempDir = fs.mkdtempSync(path.join(resourcesDir, '.zh-tw-work-'));
    const sourceDir = path.join(tempDir, 'source');

    console.log('[解包] 正在解包 app.asar...');
    const extractRes = runAsarCommand('extract', [asarPath, sourceDir]);
    if (!extractRes.success || !fs.existsSync(sourceDir)) {
        console.error('[錯誤] 解包失敗，請確認已執行 npm install 並確認 Node.js 可正常使用。');
        console.error(`詳情：${extractRes.stderr}\n${extractRes.stdout}`);
        return false;
    }

    const preloadPath = path.join(sourceDir, 'dist', 'preload.js');
    if (!fs.existsSync(preloadPath)) {
        console.error(`[錯誤] 解包後找不到 preload.js：${preloadPath}`);
        return false;
    }

    console.log('[修改] 正在注入繁體中文台灣用語字典...');
    const preloadContent = fs.readFileSync(preloadPath, 'utf-8');
    const cleanedPreload = cleanJsContent(preloadContent);
    const translationJs = generateJs();
    fs.writeFileSync(preloadPath, cleanedPreload + '\n' + translationJs, 'utf-8');
    console.log('[修改] preload.js 注入完成。');

    const menuPath = path.join(sourceDir, 'dist', 'menu.js');
    if (fs.existsSync(menuPath)) {
        console.log('[修改] 正在注入系統選單文字...');
        const menuContent = fs.readFileSync(menuPath, 'utf-8');
        const menuCleaned = cleanMenuJsContent(menuContent);
        const menuTranslationJs = createMenuTranslationPatch();

        const targetStr = 'electron_1.Menu.setApplicationMenu(menu);';
        const idx = menuCleaned.indexOf(targetStr);

        if (idx !== -1) {
            const patchedMenuContent = menuCleaned.substring(0, idx) + menuTranslationJs + '\n    ' + menuCleaned.substring(idx);
            fs.writeFileSync(menuPath, patchedMenuContent, 'utf-8');
            console.log('[修改] 系統選單文字注入完成。');
        } else {
            throw new Error('找不到 menu.js 插入點，已停止修改官方檔案。');
        }
    }

    const trayPath = path.join(sourceDir, 'dist', 'tray.js');
    if (fs.existsSync(trayPath)) {
        console.log('[修改] 正在注入工作列選單文字...');
        const trayContent = fs.readFileSync(trayPath, 'utf-8');
        const trayCleaned = cleanTrayJsContent(trayContent);

        // 2.19 新增 onClick 回呼，保留官方函式參數及原本的點擊處理。
        const targetCreate = ['function createTray(actions) {', 'function createTray(actions, onClick) {']
            .find(signature => trayCleaned.includes(signature));
        if (!targetCreate) throw new Error('找不到 tray.js 插入點，已停止修改官方檔案。');
        const replacementCreate = createTrayCreatePatch(targetCreate);

        let trayPatched = trayCleaned.replace(targetCreate, replacementCreate);

        const countRegex = /countItem\.label\s*=\s*\([\s\S]*?' running';/g;
        const replacementCount = "countItem.label = count > 0 ? `${count} 個 Agent 執行中` : '目前沒有執行中的 Agent';";
        trayPatched = trayPatched.replace(countRegex, replacementCount);

        fs.writeFileSync(trayPath, trayPatched, 'utf-8');
        console.log('[修改] 工作列選單文字注入完成。');
    }

    const loadingPath = path.join(sourceDir, 'dist', 'loadingOverlay.js');
    if (fs.existsSync(loadingPath)) {
        let loadingContent = fs.readFileSync(loadingPath, 'utf-8');
        const targetText = '<div class="text">Loading Antigravity</div>';
        if (loadingContent.includes(targetText)) {
            console.log('[修改] 正在調整啟動畫面文字...');
            const replacementText = '<div class="text">正在啟動 Antigravity...</div>';
            loadingContent = loadingContent.replace(targetText, replacementText);
            fs.writeFileSync(loadingPath, loadingContent, 'utf-8');
            console.log('[修改] 啟動畫面文字調整完成。');
        }
    }

    const provisionPath = path.join(sourceDir, 'dist', 'provisionSplash.js');
    if (fs.existsSync(provisionPath)) {
        let provisionContent = fs.readFileSync(provisionPath, 'utf-8');
        const targetSplash = '<div>Setting up WSL: ${escapeHtml(distro)}</div>';
        if (provisionContent.includes(targetSplash)) {
            console.log('[修改] 正在調整 WSL 設定畫面文字...');
            const replacementSplash = '<div>正在設定 WSL：${escapeHtml(distro)}</div>';
            provisionContent = provisionContent.replace(targetSplash, replacementSplash);
            fs.writeFileSync(provisionPath, provisionContent, 'utf-8');
            console.log('[修改] WSL 設定畫面文字調整完成。');
        }
    }

    console.log('[打包] 正在重新打包 app.asar...');
    const tempAsarPath = path.join(tempDir, 'app.asar');
    child_process.execFileSync(process.execPath, [path.join(__dirname, 'pack-asar.js'), sourceDir, tempAsarPath, bakPath], {
        encoding: 'utf8', windowsHide: true
    });
    asar.uncacheAll();
    for (const file of ['preload.js', 'menu.js', 'tray.js', 'loadingOverlay.js', 'provisionSplash.js']) {
        if (fs.existsSync(path.join(sourceDir, 'dist', file))) {
            new vm.Script(asar.extractFile(tempAsarPath, `dist/${file}`).toString('utf8'), { filename: file });
        }
    }
    const packedPreload = asar.extractFile(tempAsarPath, 'dist/preload.js').toString('utf8');
    if (!packedPreload.endsWith(translationJs) || packedPreload.split(SIGNATURE_START).length !== 2) {
        throw new Error('打包後的繁中注入不正確，已保留原本的 app.asar。');
    }
    // 同磁碟 rename 真正替換檔案；失敗時不會截斷原檔。
    fs.renameSync(tempAsarPath, asarPath);

    console.log(`[完成] ${PROJECT_NAME} 已套用完成。`);
    return true;
    } catch (error) {
        console.error(`[錯誤] 套用失敗：${error.message}`);
        return false;
    } finally {
        if (tempDir) {
            try { recycleTemporaryDirectory(tempDir); }
            catch (error) { console.warn(`[警告] ${error.message}。未永久刪除暫存。`); }
        }
        asar.uncacheAll();
    }
}

function restore20(resourcesDir, options = {}) {
    const asarPath = path.join(resourcesDir, 'app.asar');
    const bakPath = path.join(resourcesDir, 'app.asar.bak');

    if (!fs.existsSync(bakPath)) {
        console.log('[提示] 找不到 app.asar.bak，可能尚未套用過本工具，或備份已被移除。');
        return false;
    }

    let tempDir;
    try {
        asar.uncacheAll();
        const backupPreload = asar.extractFile(bakPath, 'dist/preload.js').toString('utf8');
        if (backupPreload.includes(SIGNATURE_START)) throw new Error('備份包含繁中修改，不能當成官方原版還原。');
        if (fs.existsSync(asarPath)) {
            const version = JSON.parse(asar.extractFile(asarPath, 'package.json')).version;
            const backupVersion = JSON.parse(asar.extractFile(bakPath, 'package.json')).version;
            if (version !== backupVersion) throw new Error('備份版本與目前程式不符，已停止還原。');
        }
        closeAntigravityProcesses(options);
        console.log('[還原] 正在還原官方 app.asar...');
        tempDir = fs.mkdtempSync(path.join(resourcesDir, '.zh-tw-work-'));
        const prepared = path.join(tempDir, 'app.asar');
        fs.copyFileSync(bakPath, prepared);
        fs.renameSync(prepared, asarPath);
        console.log('[完成] 官方 app.asar 已還原，官方備份繼續保留。');
        return true;
    } catch (error) {
        console.error(`[錯誤] 還原失敗：${error.message}`);
        return false;
    } finally {
        if (tempDir) {
            try { recycleTemporaryDirectory(tempDir); }
            catch (error) { console.warn(`[警告] ${error.message}。未永久刪除暫存。`); }
        }
        asar.uncacheAll();
    }
}

function locateResourcesDir(installDir) {
    const candidates = [
        path.join(installDir, 'resources'),
        path.join(installDir, 'Contents', 'Resources'),
        installDir
    ];

    for (const candidate of candidates) {
        if (fs.existsSync(path.join(candidate, 'app.asar'))) {
            return candidate;
        }
    }

    const normalized = installDir.replace(/\\/g, '/').replace(/\/$/, '');
    if (normalized.endsWith('/resources') && fs.existsSync(installDir)) {
        return installDir;
    }

    return path.join(installDir, 'resources');
}

function printVersion() {
    console.log(`${PROJECT_NAME}`);
    console.log(`Project ID: ${PROJECT_ID}`);
    console.log(`Engine version: ${ENGINE_VERSION}`);
    console.log(`Signature: ${SIGNATURE}`);
}

function main() {
    let restore = false;
    let manualDir = '';
    let skipKill = false;

    const args = process.argv.slice(2);

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--huifu' || args[i] === '--restore') {
            restore = true;
        } else if (args[i] === '--install-dir') {
            manualDir = args[i + 1] || '';
            i++;
        } else if (args[i] === '--skip-kill' || args[i] === '--no-kill') {
            skipKill = true;
        } else if (args[i] === '--version' || args[i] === '-v') {
            printVersion();
            return;
        }
    }

    const installDir = detectInstallationDir(manualDir);
    const resourcesDir = locateResourcesDir(installDir);

    if (!fs.existsSync(resourcesDir)) {
        console.error(`[錯誤] 無法定位有效的 resources 目錄：${resourcesDir}`);
        process.exit(1);
    }

    const asarPath = path.join(resourcesDir, 'app.asar');
    const bakPath = path.join(resourcesDir, 'app.asar.bak');

    if (!fs.existsSync(asarPath) && !(restore && fs.existsSync(bakPath))) {
        console.error('[錯誤] 找不到 app.asar。本工具僅支援 Antigravity 2.0。');
        process.exit(1);
    }

    if (restore) {
        console.log(`====== 正在還原 ${PROJECT_NAME} ======`);
        process.exitCode = restore20(resourcesDir, { skipKill }) ? 0 : 1;
    } else {
        console.log(`====== 正在套用 ${PROJECT_NAME} ======`);
        process.exitCode = install20(resourcesDir, { skipKill }) ? 0 : 1;
    }
}

module.exports = {
    normalizeText,
    loadDictionary,
    generateJs,
    cleanJsContent,
    cleanMenuJsContent,
    cleanTrayJsContent,
    createMenuTranslationPatch,
    createTrayCreatePatch,
    install20,
    restore20,
    recycleTemporaryDirectory
};

if (require.main === module) {
    main();
}

