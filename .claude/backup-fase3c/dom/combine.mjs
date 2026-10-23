// Writes the SQL that builds a test database as supabase/tests/run.sh does: the Supabase stub, the
// migrations before 20261017000001, the legacy seed, then the rest (3c included).
//   node combine.mjs <repo> <out.sql>
import fs from 'node:fs';
import path from 'node:path';

const [repo, out] = process.argv.slice(2);
const mig = path.join(repo, 'supabase/migrations');
const files = fs.readdirSync(mig).filter((f) => f.endsWith('.sql')).sort();
const early = files.filter((f) => f.split('_')[0] < '20261017000001');
const late = files.filter((f) => f.split('_')[0] >= '20261017000001');
const parts = [
  path.join(repo, 'supabase/tests/00_supabase_stub.sql'),
  ...early.map((f) => path.join(mig, f)),
  path.join(repo, 'supabase/tests/10_seed_legacy.sql'),
  ...late.map((f) => path.join(mig, f)),
];
fs.writeFileSync(out, parts.map((p) => `-- ${path.basename(p)}\n${fs.readFileSync(p, 'utf8')}\n;\n`).join('\n'));
console.log(parts.length, 'files;', late.slice(-3).join(' '));
