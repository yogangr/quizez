import { sql } from "../../../lib/db";
import { board } from "../../../lib/board";

export const dynamic = "force-dynamic";

const DAILY = 10;
const RANDOM = 20;
const LEVELS = ["mudah", "sedang", "sulit", "olimpiade"];
const lv = (v) => (LEVELS.includes(v) ? v : "mudah");

const shuffle = (a) => {
  a = [...a];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const out = (rows) =>
  rows.map((r) => ({
    id: r.id,
    q: r.q,
    options: shuffle([r.answer, ...r.wrong]),
  }));
const bad = (msg) => Response.json({ error: msg }, { status: 400 });

async function today() {
  const [{ d }] =
    await sql`select (now() at time zone 'Asia/Jakarta')::date::text as d`;
  return d;
}

// Soal harian: urutannya ditentukan oleh tanggal + tingkat, jadi sama untuk semua pemain
// di tingkat itu. Diambil bergiliran per kategori supaya variatif.
function dailySet(day, level) {
  return sql`select id, q, answer, wrong from (
      select *, row_number() over (partition by cat order by md5(id::text || ${day})) rn
      from questions where level = ${level}
    ) t order by rn, md5(id::text || ${day}) limit ${DAILY}`;
}

export async function GET(req) {
  try {
    const p = new URL(req.url).searchParams;
    const mode = p.get("mode") === "daily" ? "daily" : "acak";
    const level = lv(p.get("level"));
    if (mode === "daily") {
      const day = await today();
      return Response.json({
        mode,
        level,
        day,
        questions: out(await dailySet(day, level)),
      });
    }
    const rows = await sql`select id, q, answer, wrong from (
        select *, row_number() over (partition by cat order by random()) rn
        from questions where level = ${level}
      ) t order by rn, random() limit ${RANDOM}`;
    return Response.json({ mode, level, day: null, questions: out(rows) });
  } catch (e) {
    console.error(e);
    return Response.json({ error: String(e.message || e) }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const b = await req.json();
    const n = String(b.name || "")
      .trim()
      .slice(0, 20);
    const mode = b.mode === "daily" ? "daily" : "acak";
    const level = lv(b.level);
    if (
      !n ||
      !Array.isArray(b.answers) ||
      b.answers.length === 0 ||
      b.answers.length > RANDOM
    )
      return bad("Data tidak valid");
    const picks = new Map(b.answers.map((a) => [Number(a.id), a.pick]));

    let set,
      total,
      day = null;
    if (mode === "daily") {
      day = String(b.day || "");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return bad("Tanggal tidak valid");
      const [{ valid }] =
        await sql`select (${day}::date between (now() at time zone 'Asia/Jakarta')::date - 1 and (now() at time zone 'Asia/Jakarta')::date) as valid`;
      if (!valid) return bad("Kuis harian sudah berganti, muat ulang halaman.");
      set = await dailySet(day, level);
      total = set.length;
    } else {
      set =
        await sql`select id, q, answer from questions where level = ${level} and id = any(${[...picks.keys()].slice(0, RANDOM)})`;
      const [{ c }] =
        await sql`select count(*)::int as c from questions where level = ${level}`;
      total = Math.min(RANDOM, c); // soal yang tidak dikirim dihitung salah
    }
    if (!set.length) return bad("Soal tidak ditemukan");

    let ok = 0;
    const wrong = [];
    for (const r of set) {
      const pick = picks.get(r.id) ?? null;
      if (pick === r.answer) ok++;
      else wrong.push({ q: r.q, answer: r.answer, pick });
    }
    const score = Math.round((ok / total) * 100);
    const t = Math.min(600, Math.max(0, Math.floor(Number(b.seconds) || 0)));

    await sql`insert into scores(name, score, correct, total, seconds, mode, day, level)
      values(${n}, ${score}, ${ok}, ${total}, ${t}, ${mode}, ${day}::date, ${level})`;

    const list = await board(mode === "daily" ? "daily" : "all", level, 100);
    const idx = list.findIndex((e) => e.name.toLowerCase() === n.toLowerCase());
    return Response.json({
      mode,
      level,
      score,
      correct: ok,
      total,
      rank: idx < 0 ? null : idx + 1,
      players: list.length,
      wrong,
    });
  } catch (e) {
    console.error(e);
    return Response.json({
      mode,
      level,
      score,
      correct: ok,
      total,
      rank: idx < 0 ? null : idx + 1,
      players: list.length,
      wrong,
    });
  }
}
