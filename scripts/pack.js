import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import archiver from 'archiver';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 读取 package.json 获取版本号
const pkgPath = path.join(__dirname, '../package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
const version = pkg.version;

const DIST_DIR = path.join(__dirname, '../dist');
const OUT_DIR = path.join(__dirname, '../release');
const OUT_FILE = path.join(OUT_DIR, `dylive-danmaku-v${version}.zip`);

// 确保 release 目录存在
if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR);
}

console.log(`📦 正在打包版本 v${version}...`);

const output = fs.createWriteStream(OUT_FILE);
const archive = archiver('zip', {
    zlib: { level: 9 } // 最高压缩级别
});

output.on('close', () => {
    console.log(`✅ 打包完成！文件大小: ${(archive.pointer() / 1024 / 1024).toFixed(2)} MB`);
    console.log(`📂 输出路径: ${OUT_FILE}`);
});

archive.on('error', (err) => {
    throw err;
});

archive.pipe(output);

// 将整个 dist 目录的内容打包进 zip 的根目录
archive.directory(DIST_DIR, false);

archive.finalize();