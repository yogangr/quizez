import { sql } from "../../../lib/db";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const k = new URL(req.url).searchParams.get("kind");
  const kind = k === "weekly" || k === "all" ? k : "daily";
  return Response.json(await board(kind, 10));
}
