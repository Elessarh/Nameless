import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, '..');
const base = process.env.AUDIT_BASE_URL || 'http://127.0.0.1:4173';
const output = path.join(root, 'docs/performance/lighthouse');
fs.mkdirSync(output,{recursive:true});
const cli = path.join(path.dirname(require.resolve('lighthouse/package.json')), 'cli/index.js');
for (const [name,route] of [['home','/'],['wiki','/wiki/'],['map','/carte/'],['bestiary','/bestiaire/'],['items','/items/'],['quests','/quetes/'],['login','/connexion/']]) {
    const file = path.join(output,name+'.json');
    await new Promise((resolve,reject) => {
        const child = spawn(process.execPath,[cli,base+route,'--chrome-flags=--headless=new --no-sandbox','--only-categories=performance,accessibility,best-practices,seo','--output=json','--output-path='+file,'--quiet'],{stdio:'inherit'});
        child.on('exit',code=>code===0?resolve():reject(new Error(name+' audit failed: '+code)));
    });
    const report = JSON.parse(fs.readFileSync(file,'utf8'));
    console.log(name,Object.fromEntries(Object.entries(report.categories).map(([k,v])=>[k,Math.round(v.score*100)])));
}
