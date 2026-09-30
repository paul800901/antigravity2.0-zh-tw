// 一次性打包子程序，保留官方 ASAR 的 unpacked 檔案配置。
// 不建立排程、服務或常駐程序；只由使用者執行安裝時呼叫。
const asar = require('@electron/asar');
const path = require('path');

function unpackedFiles(header, prefix = '') {
    const files = [];
    for (const [name, entry] of Object.entries(header.files || {})) {
        const relative = prefix ? `${prefix}/${name}` : name;
        if (entry.files) files.push(...unpackedFiles(entry, relative));
        else if (entry.unpacked) files.push(relative);
    }
    return files;
}

async function pack(sourceDir, output, template) {
    const expected = unpackedFiles(asar.getRawHeader(template).header).sort();
    const absoluteFiles = expected.map((file) => path.join(sourceDir, file).replace(/\\/g, '/'));
    // 路徑中的 glob 特殊字元使用字元集合跳脫，僅匹配原本 unpacked 的檔案。
    const patterns = absoluteFiles.map((file) => file.replace(/[?*\[\]{}(),!]/g, (char) => `[${char}]`));
    const unpack = patterns.length > 1 ? `{${patterns.join(',')}}` : patterns[0];
    await asar.createPackageWithOptions(sourceDir, output, { unpack });
    asar.uncacheAll();
    const actual = unpackedFiles(asar.getRawHeader(output).header).sort();
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error('打包後的 unpacked 配置與官方原檔不同。');
    }
}

module.exports = { unpackedFiles };
if (require.main === module) {
    pack(...process.argv.slice(2)).catch((error) => {
        console.error(error.message);
        process.exitCode = 1;
    });
}
