import { sql } from '../../../lib/db';

export const dynamic = 'force-dynamic';

const shuffle = (a) => {
  a = [...a];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// Ambil 20 soal acak. Jawaban benar tidak dikirim ke browser.
export async function GET() {
  const rows = await sql`select id, q, answer, wrong from questions order by random() limit 20`;
  return Response.json(
    rows.map((r) => ({ id: r.id, q: r.q, options: shuffle([r.answer, ...r.wrong]) }))
  );
}

// Nilai dihitung di server, lalu disimpan ke peringkat.
export async function POST(req) {
  const { name, seconds, answers } = await req.json();
  const n = String(name || '').trim().slice(0, 20);
  if (!n || !Array.isArray(answers) || answers.length === 0 || answers.length > 20) {
    return Response.json({ error: 'Data tidak valid' }, { status: 400 });
  }
  const picks = new Map(answers.map((a) => [Number(a.id), a.pick]));
  const rows = await sql`select id, q, answer from questions where id = any(${[...picks.keys()]})`;
  let ok = 0;
  const wrong = [];
  for (const r of rows) {
    const pick = picks.get(r.id) ?? null;
    if (pick === r.answer) ok++;
    else wrong.push({ q: r.q, answer: r.answer, pick });
  }
  const total = rows.length || 1;
  const score = Math.round((ok / total) * 100);
  const t = Math.min(600, Math.max(0, Math.floor(Number(seconds) || 0)));
  await sql`insert into scores(name, score, correct, total, seconds) values(${n}, ${score}, ${ok}, ${total}, ${t})`;
  const [{ c }] = await sql`select count(*)::int as c from scores where score > ${score} or (score = ${score} and seconds < ${t})`;
  return Response.json({ score, correct: ok, total, rank: c + 1, wrong });
}
