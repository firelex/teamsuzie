/**
 * Translates common postgres / redis connection failures into actionable
 * messages aimed at a first-time admin user. Prints to stderr and
 * does not throw — callers should exit after this returns.
 */
export function printStartupError(err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  const code =
    err && typeof err === 'object' && 'code' in err ? String((err as { code: unknown }).code) : undefined;

  const lines: string[] = [];
  lines.push('');
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push('  admin failed to start');
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push('');

  if (code === 'ECONNREFUSED' || /ECONNREFUSED/.test(message)) {
    lines.push('  Postgres or Redis is not reachable.');
    lines.push('');
    lines.push('  Fix: from the repo root, run');
    lines.push('    pnpm docker:up');
    lines.push('');
    lines.push('  If you already have postgres/redis running locally, make sure they\'re');
    lines.push('  on the default ports (5432 / 6379) and accept the credentials in .env.');
  } else if (/role .* does not exist/i.test(message)) {
    lines.push('  Postgres is reachable, but the expected role (user) does not exist.');
    lines.push('');
    lines.push('  Fix (option A — create the role once):');
    lines.push('    psql -U $(whoami) -d postgres -c "CREATE ROLE teamsuzie WITH LOGIN PASSWORD \'teamsuzie\' SUPERUSER;"');
    lines.push('    psql -U $(whoami) -d postgres -c "CREATE DATABASE teamsuzie OWNER teamsuzie;"');
    lines.push('');
    lines.push('  Fix (option B — point admin at your own postgres):');
    lines.push('    Edit POSTGRES_URI in apps/platform/admin/.env');
  } else if (/database .* does not exist/i.test(message)) {
    lines.push('  The target database does not exist.');
    lines.push('');
    lines.push('  Fix: either run `pnpm docker:up` (creates it), or');
    lines.push('    psql -U teamsuzie -d postgres -c "CREATE DATABASE teamsuzie OWNER teamsuzie;"');
  } else if (/password authentication failed/i.test(message)) {
    lines.push('  Postgres rejected the connection credentials.');
    lines.push('');
    lines.push('  Fix: verify POSTGRES_URI in .env matches your postgres setup.');
  } else {
    lines.push('  Unexpected error:');
    lines.push(`    ${message}`);
    if (code) lines.push(`    code: ${code}`);
  }

  lines.push('');
  lines.push('  Full troubleshooting: apps/platform/admin/README.md');
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push('');

  console.error(lines.join('\n'));
}
