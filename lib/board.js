import { sql } from './db';

// kind: 'daily' (hari ini), 'weekly' (Senin-Minggu), 'all' (Kuis Acak sepanjang masa)
// Setiap pemain (berdasarkan nama) hanya dihitung nilai terbaiknya.
export async function board(kind, limit = 10) {
  if (kind === 'weekly') {
    return sql`select max(name) as name, sum(score)::int as score, sum(seconds)::int as seconds, count(*)::int as days
      from (
        select distinct on (lower(name), day) name, day, score, seconds
        from scores
        where mode = 'daily' and day >= date_trunc('week', now() at time zone 'Asia/Jakarta')::date
        order by lower(name), day, score desc, seconds asc
      ) t
      group by lower(name)
      order by score desc, seconds asc
      limit ${limit}`;
  }
  if (kind === 'daily') {
    return sql`select name, score, seconds from (
        select distinct on (lower(name)) name, score, seconds
        from scores
        where mode = 'daily' and day = (now() at time zone 'Asia/Jakarta')::date
        order by lower(name), score desc, seconds asc
      ) t
      order by score desc, seconds asc
      limit ${limit}`;
  }
  return sql`select name, score, seconds from (
      select distinct on (lower(name)) name, score, seconds
      from scores
      where mode = 'acak'
      order by lower(name), score desc, seconds asc
    ) t
    order by score desc, seconds asc
    limit ${limit}`;
}
