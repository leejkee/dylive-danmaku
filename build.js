import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as esbuild from 'esbuild';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DIST_DIR = path.join(__dirname, 'dist');
const PUBLIC_DIR = path.join(__dirname, 'public');

console.log("1. 正在清理旧的 dist 文件夹...");
if (fs.existsSync(DIST_DIR)) {
    fs.rmSync(DIST_DIR, { recursive: true, force: true });
}
fs.mkdirSync(DIST_DIR);

console.log("2. 正在拷贝静态资源...");
if (fs.existsSync(PUBLIC_DIR)) {
    fs.cpSync(PUBLIC_DIR, DIST_DIR, { recursive: true });
}

console.log("️3. 正在使用 esbuild 编译打包 TypeScript 代码...");
try {
    await esbuild.build({
        entryPoints: [
            'src/content-scripts/content.ts',
            'src/inject-scripts/inject.ts',
            'src/popup/popup.ts',
            'src/background/background.ts'
        ],
        outdir: 'dist',
        outbase: 'src',
        bundle: true, 
        format: 'iife', 
        minify: false,
    });
    console.log("构建成功！请在 Chrome 扩展程序页面加载 【dist】 文件夹。");
} catch (error) {
    console.error("编译失败: ", error);
    process.exit(1);
}