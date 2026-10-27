import fs from 'node:fs/promises';
await fs.mkdir('dist/server',{recursive:true});await fs.mkdir('dist/.openai',{recursive:true});
await fs.copyFile('worker/index.js','dist/server/index.js');await fs.copyFile('.openai/hosting.json','dist/.openai/hosting.json');
console.log('Worker build complete');
await fs.copyFile('reminder-api.mjs','dist/reminder-api.mjs');await fs.copyFile('reminders.mjs','dist/reminders.mjs');
