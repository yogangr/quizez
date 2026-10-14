import { sql } from '../../../lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const rows = await sql`select name, score, seconds from scores order by score desc, seconds asc limit 10`;
  return Response.json(rows);
}
