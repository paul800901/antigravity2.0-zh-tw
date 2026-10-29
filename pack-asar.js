// 一次性打包子程序，保留官方 ASAR 的 unpacked 檔案配置。
// 不建立排程、服務或常駐程序；只由使用者執行安裝時呼叫。
const asar = require('@electron/asar');
const path = require('path');
const { Filesystem } = require('@electron/asar/lib/filesystem');
const disk = require('@electron/asar/lib/disk');
const { crawl, determineFileType } = require('@electron/asar/lib/crawlfs');
const wrappedFs = require('@electron/asar/lib/wrapped-fs').default;

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
    const expectedSet = new Set(expected);

    sourceDir = path.normalize(sourceDir);
    output = path.normalize(output);

    const pattern = sourceDir.split(path.sep).join('/') + '/**/*';
    let [filenames, metadata] = await crawl(pattern, { dot: true });
    filenames = filenames.map((f) => path.normalize(f));

    const filesystem = new Filesystem(sourceDir);
    const files = [];
    const links = [];

    for (const filename of filenames) {
        if (!metadata[filename]) {
            const fileType = await determineFileType(filename);
            if (!fileType) throw new Error('Unknown file type for file: ' + filename);
            metadata[filename] = fileType;
        }
        const file = metadata[filename];
        const relativePath = path.relative(sourceDir, filename).split(path.sep).join('/');

        switch (file.type) {
            case 'directory':
                filesystem.insertDirectory(filename, false);
                break;
            case 'file': {
                const shouldUnpack = expectedSet.has(relativePath);
                files.push({ filename, unpack: shouldUnpack });
                await filesystem.insertFile(filename, () => wrappedFs.createReadStream(filename), shouldUnpack, file, {});
                break;
            }
            case 'link': {
                const shouldUnpack = expectedSet.has(relativePath);
                links.push({ filename, unpack: shouldUnpack });
                filesystem.insertLink(filename, shouldUnpack);
                break;
            }
        }
    }

    await wrappedFs.mkdirp(path.dirname(output));
    await disk.writeFilesystem(output, filesystem, { files, links }, metadata);

    asar.uncacheAll();
    const actual = unpackedFiles(asar.getRawHeader(output).header).sort();
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error('打包後的 unpacked 配置與官方原檔不同。');
    }
}

module.exports = { unpackedFiles, pack };
if (require.main === module) {
    pack(...process.argv.slice(2)).catch((error) => {
        console.error(error.message);
        process.exitCode = 1;
    });
}

