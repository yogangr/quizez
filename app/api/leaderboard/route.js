import { sql } from "../../../lib/db";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    const { board } = await import("../../../lib/board");
    const k = new URL(req.url).searchParams.get("kind");
    const kind = k === "weekly" || k === "all" ? k : "daily";
    return Response.json(await board(kind, 10));
  } catch (e) {
    console.error(e);
    return Response.json({ error: String(e.message || e) }, { status: 500 });
  }
}
