import { mkdir, copyFile, cp } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
await mkdir(`${root}/dist`, { recursive: true });
for (const file of ['index.html', 'favicon.svg']) await copyFile(`${root}/${file}`, `${root}/dist/${file}`);
await cp(`${root}/src`, `${root}/dist/src`, { recursive: true });
console.log('Built static site in dist/ (relative paths support /maple-mvp/).');
