import { board } from "../../../lib/board";

export const dynamic = "force-dynamic";

const LEVELS = ["mudah", "sedang", "sulit", "olimpiade"];

export async function GET(req) {
  try {
    const p = new URL(req.url).searchParams;
    const k = p.get("kind");
    const kind = k === "weekly" || k === "all" ? k : "daily";
    const level = LEVELS.includes(p.get("level")) ? p.get("level") : "mudah";
    return Response.json(await board(kind, level, 10));
  } catch (e) {
    console.error(e);
    return Response.json({ error: String(e.message || e) }, { status: 500 });
  }
}
