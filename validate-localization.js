const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { loadDictionary, generateJs, normalizeText } = require('./localization_engine');

const dictDir = path.join(__dirname, 'dicts');
const dictionaryFiles = fs.readdirSync(dictDir).filter((file) => file.endsWith('.json')).sort();
const normalizedEntries = new Map();
const caseFoldedKeys = new Map();

for (const file of dictionaryFiles) {
    const filePath = path.join(dictDir, file);
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
        throw new Error(`${file} 必須是 JSON 物件`);
    }
    for (const [key, value] of Object.entries(parsed)) {
        const normalized = normalizeText(key);
        if (!normalized) throw new Error(`${file} 含有空白字典鍵`);
        if (!normalizedEntries.has(normalized)) normalizedEntries.set(normalized, []);
        normalizedEntries.get(normalized).push({ file, key, value });
        const folded = normalized.toLocaleLowerCase('en-US');
        if (!caseFoldedKeys.has(folded)) caseFoldedKeys.set(folded, new Set());
        caseFoldedKeys.get(folded).add(normalized);
    }
}

const dictionary = loadDictionary();

const ambiguousCaseCollisions = [];
for (const keys of caseFoldedKeys.values()) {
    if (keys.size < 2) continue;
    const effectiveValues = new Set([...keys].map((key) => dictionary[key]));
    if (effectiveValues.size > 1) ambiguousCaseCollisions.push([...keys]);
}
if (ambiguousCaseCollisions.length) {
    throw new Error(`大小寫折疊後出現不同翻譯：${JSON.stringify(ambiguousCaseCollisions)}`);
}

const normalizedOverrideCount = [...normalizedEntries.values()].filter((entries) => entries.length > 1).length;
const skillDescriptionPath = path.join(dictDir, 'skill_descriptions.json');
const skillDescriptions = JSON.parse(fs.readFileSync(skillDescriptionPath, 'utf8'));
const skillDescriptionEntries = Object.entries(skillDescriptions);
if (skillDescriptionEntries.length < 50) {
    throw new Error(`技能與外掛程式說明翻譯不完整：預期至少 50 筆，實際為 ${skillDescriptionEntries.length} 筆`);
}
const invalidSkillDescriptions = skillDescriptionEntries.filter(([source, translation]) => (
    typeof translation !== 'string'
    || !/[\u3400-\u9fff]/u.test(translation)
    || normalizeText(source) === normalizeText(translation)
));
if (invalidSkillDescriptions.length) {
    throw new Error(`技能與外掛程式說明含未完整翻譯：${JSON.stringify(invalidSkillDescriptions.map(([source]) => source))}`);
}
const expected = {
    Antigravity: 'Antigravity',
    Projects: '專案',
    Submit: '送出',
    Skills: '技能',
    Subagents: '子代理',
    Models: '模型',
    System: '跟隨系統',
    'Install IDE': '安裝 IDE',
    'Inherit General': '沿用「一般」設定',
    'Inherits your General settings when working in this project.': '在此專案中工作時，沿用你的「一般」設定。',
    Rules: '規則',
    'Core tools and knowledge required to develop for Android': 'Android 開發所需的核心工具與知識',
    'Curated collection of agent skills for science tasks.': '精選的科學任務 Agent 技能集。',
    'Ask anything, @ to mention, / for actions': '輸入訊息；@ 可提及項目，/ 可選擇操作',
    Sidebar: '側邊欄',
    'Project options': '專案選項',
    'Message input': '訊息輸入框',
    'Add context': '加入參考內容',
    'Record voice memo': '錄製語音備忘錄',
    'Send message': '傳送訊息',
    'Typeahead menu': '自動完成選單',
    'Gemini Models': 'Gemini 模型',
    'Claude and GPT models': 'Claude 與 GPT 模型',
    'Configure allowed and denied URLs for browser actuation.': '設定瀏覽器操作的網址允許與封鎖規則。'
};

for (const [key, value] of Object.entries(expected)) {
    if (dictionary[key] !== value) {
        throw new Error(`台灣詞句覆寫不符：${key} 應為「${value}」，實際為「${dictionary[key]}」`);
    }
}

const forbidden = [
    '反重力', '瞭解', '優先級', '驅動模型', '技能預設', '始終',
    '提交', '反饋', '密鑰', '補全', '跳轉', '腳本', '上下文',
    '沙盒', '詳情', '查看', '命令'
];
const badValues = Object.entries(dictionary).filter(([, value]) => forbidden.some((term) => value.includes(term)));
if (badValues.length) {
    const sample = badValues.slice(0, 20).map(([key, value]) => `${key} => ${value}`).join('\n');
    throw new Error(`有效字典仍含非台灣慣用詞：\n${sample}`);
}

const generated = generateJs();
new vm.Script(generated, { filename: 'generated-antigravity-zh-tw.js' });
if (generated.includes('valNorm.includes(key)') || generated.includes('split(key).join(translated)')) {
    throw new Error('翻譯引擎不得對任意文字做全文片段取代');
}
if (!generated.includes('allowFormControlAttribute')) {
    throw new Error('翻譯引擎必須只允許輸入欄位的安全提示屬性翻譯');
}
if (!generated.includes('isDirectSafeAttributeTarget')) {
    throw new Error('可編輯元件只能放行目前元件的安全提示屬性');
}
for (const requiredDynamicRule of [
    'Select model, current:',
    'compactAgeMatch',
    'customizationBudgetMatch',
    'quotaRefreshMatch',
    'showBreakdownsMatch'
]) {
    if (!generated.includes(requiredDynamicRule)) {
        throw new Error(`缺少動態介面詞句規則：${requiredDynamicRule}`);
    }
}

console.log(`台灣繁中詞句驗證通過：${Object.keys(dictionary).length} 筆有效翻譯，${dictionaryFiles.length} 份字典，${normalizedOverrideCount} 組明確覆寫。`);
