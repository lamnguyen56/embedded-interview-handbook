const fs=require('fs'),vm=require('vm'),path=require('path');
const d=process.argv[2];
const html=fs.readFileSync(path.join(d,'index.html'),'utf8');
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
scripts.forEach(s=>new Function(s[1]));
const data=vm.runInNewContext(fs.readFileSync(path.join(d,'data.js'),'utf8')+'; DATA');
if(data.items.length!==20)throw Error('Missing topics');
for(let i=1;i<=19;i++)if(!data.items.find(t=>t.id===String(i)))throw Error('Missing '+i);
for(const t of data.items){if(!t.diagram||!t.body||!t.note)throw Error('Empty '+t.id)}
for(const f of ['mermaid.min.js','marked.min.js','data.js'])if(!fs.existsSync(path.join(d,f)))throw Error(f);
console.log('PASS: JavaScript syntax, 19 questions + initramfs, diagrams and offline dependencies.');
