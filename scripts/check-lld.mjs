// Compiles and runs every LLD case's Java blocks as one Main.java, and checks that the
// output matches `test.output` and the solution stays interview-sized (80-150 lines).
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = new URL('../src/data/lld/', import.meta.url);
const only = process.argv[2];
const files = readdirSync(dir).filter((f) => f.endsWith('.js') && f !== 'index.js' && (!only || f === `${only}.js`));

let failed = 0;
for (const file of files) {
  const c = (await import(pathToFileURL(join(dir.pathname, file)))).default;
  const source = c.blocks.map((b) => b.code).join('\n');
  const lines = source.split('\n').filter((l) => l.trim()).length;
  const work = mkdtempSync(join(tmpdir(), `lld-${c.id}-`));
  writeFileSync(join(work, 'Main.java'), source);
  const problems = [];
  try {
    execFileSync('javac', ['-d', work, join(work, 'Main.java')], { stdio: 'pipe' });
    const out = execFileSync('java', ['-cp', work, 'Main'], { encoding: 'utf8' }).trim();
    if (out !== c.test.output.trim()) problems.push(`output differs:\n--- expected\n${c.test.output.trim()}\n--- actual\n${out}`);
  } catch (e) {
    problems.push(String(e.stderr || e.message));
  }
  if (lines < 80 || lines > 150) problems.push(`${lines} non-blank lines (want 80-150)`);
  if (problems.length) failed++;
  console.log(`${problems.length ? 'FAIL' : 'ok  '} ${c.id.padEnd(14)} ${lines} lines`);
  for (const p of problems) console.log(`     ${p.replace(/\n/g, '\n     ')}`);
}
process.exit(failed ? 1 : 0);
