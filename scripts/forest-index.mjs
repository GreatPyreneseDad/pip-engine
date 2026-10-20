/* Writes forest/study/INDEX.md: one line per study note (title, what it becomes), for people and for the crew. */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
const dir = new URL('../forest/study/', import.meta.url).pathname;
const notes = readdirSync(dir).filter(f => f.endsWith('.md') && f !== 'INDEX.md').sort();
const rows = notes.map(f => { const md = readFileSync(dir + f, 'utf8'); const title = (md.match(/^#\s+(.*)/m) || [, f])[1].trim(); const why = (md.match(/##\s+Why[^\n]*\n+([^\n]+)/) || [, ''])[1].trim(); return `- [${title}](${f}) — ${why.slice(0, 220)}`; });
writeFileSync(dir + 'INDEX.md', `# The forest: study notes\n\nMechanisms learned from classic games (see ../STUDY.md). ${notes.length} notes. Each is also embedded in the factory's forest table, so the line is handed the relevant ones for a brief.\n\n${rows.join('\n')}\n`);
console.log(`${notes.length} notes indexed`);
