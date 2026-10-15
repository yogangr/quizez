"use client";
import { useEffect, useRef, useState } from "react";

const T = 600; // 10 menit
const fmt = (s) => Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
const TABS = [
  ["daily", "Hari ini"],
  ["weekly", "Minggu ini"],
  ["all", "Sepanjang masa"],
];
const NOTE = {
  daily: "Nilai terbaik Kuis Harian hari ini.",
  weekly: "Jumlah nilai terbaik Kuis Harian tiap hari, Senin sampai Minggu.",
  all: "Nilai terbaik Kuis Acak.",
};

function Board({ list, kind, setKind }) {
  return (
    <div className="card">
      <h2>Peringkat</h2>
      <div className="tabs" role="tablist">
        {TABS.map(([k, t]) => (
          <button
            key={k}
            role="tab"
            aria-selected={kind === k}
            className={kind === k ? "on" : ""}
            onClick={() => setKind(k)}
          >
            {t}
          </button>
        ))}
      </div>
      <p className="mute" style={{ fontSize: 14, margin: "0 0 8px" }}>
        {NOTE[kind]}
      </p>
      <ol className="lb">
        {list.length === 0 && (
          <li className="mute" style={{ display: "block" }}>
            Belum ada skor. Jadilah yang pertama.
          </li>
        )}
        {list.map((e, i) => (
          <li key={i}>
            <span className="rk">{i + 1}</span>
            <span>{e.name}</span>
            <b>{e.score}</b>
            <span className="tt">
              {kind === "weekly" ? `${e.days} hari` : fmt(e.seconds)}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default function Page() {
  const [view, setView] = useState("home");
  const [name, setName] = useState("");
  const [mode, setMode] = useState("daily");
  const [qs, setQs] = useState([]);
  const [ans, setAns] = useState({});
  const [i, setI] = useState(0);
  const [left, setLeft] = useState(T);
  const [res, setRes] = useState(null);
  const [kind, setKind] = useState("daily");
  const [board, setBoard] = useState([]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [warn, setWarn] = useState(false);
  const [played, setPlayed] = useState(false);
  const [dayLabel, setDayLabel] = useState("");
  const end = useRef(0);
  const done = useRef(false);
  const day = useRef(null);
  const latest = useRef({});
  latest.current = { ans, qs, name, mode };

  const loadBoard = (k) =>
    fetch(`/api/leaderboard?kind=${k}`, { cache: "no-store" })
      .then((r) => r.json())
      .then(setBoard)
      .catch(() => {});

  useEffect(() => {
    setName(localStorage.getItem("kuis-name") || "");
    const d = new Date();
    setDayLabel(
      d.toLocaleDateString("id-ID", {
        weekday: "long",
        day: "numeric",
        month: "long",
        timeZone: "Asia/Jakarta",
      }),
    );
    setPlayed(
      localStorage.getItem("kuis-daily") ===
        d.toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" }),
    );
  }, []);

  useEffect(() => {
    loadBoard(kind);
  }, [kind]);

  useEffect(() => {
    if (view !== "quiz") return;
    const t = setInterval(() => {
      const l = Math.max(0, Math.ceil((end.current - Date.now()) / 1000));
      setLeft(l);
      if (l <= 0) {
        clearInterval(t);
        finish();
      }
    }, 250);
    return () => clearInterval(t);
  }, [view]);

  async function start(m) {
    const n = name.trim();
    if (!n) {
      setErr("Isi nama dulu sebelum mulai.");
      return;
    }
    setErr("");
    setBusy(true);
    try {
      const r = await fetch(`/api/quiz?mode=${m}`, { cache: "no-store" });
      const d = await r.json();
      if (!r.ok || !d.questions?.length) throw new Error();
      localStorage.setItem("kuis-name", n);
      day.current = d.day;
      setMode(m);
      setQs(d.questions);
      setAns({});
      setI(0);
      setWarn(false);
      setLeft(T);
      end.current = Date.now() + T * 1000;
      done.current = false;
      setView("quiz");
    } catch {
      setErr(
        "Soal belum bisa dimuat. Pastikan DATABASE_URL benar dan database sudah di-seed.",
      );
    }
    setBusy(false);
  }

  async function finish() {
    if (done.current) return;
    done.current = true;
    const { ans, qs, name, mode } = latest.current;
    const seconds =
      T - Math.max(0, Math.ceil((end.current - Date.now()) / 1000));
    setBusy(true);
    try {
      const r = await fetch("/api/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          seconds,
          mode,
          day: day.current,
          answers: qs.map((q) => ({ id: q.id, pick: ans[q.id] || null })),
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setRes({ ...d, seconds });
      if (mode === "daily") {
        localStorage.setItem("kuis-daily", day.current);
        setPlayed(true);
      }
      const k = mode === "daily" ? "daily" : "all";
      setKind(k);
      loadBoard(k);
      setView("result");
    } catch (e) {
      done.current = false;
      setErr(e.message || "Jawaban belum terkirim. Coba tekan Submit lagi.");
    }
    setBusy(false);
  }

  function submit() {
    const u = qs.filter((q) => !ans[q.id]).length;
    if (u && !warn) {
      setWarn(true);
      return;
    }
    finish();
  }

  const q = qs[i];
  const label = mode === "daily" ? "Kuis Harian" : "Kuis Acak";

  return (
    <main>
      {view === "home" && (
        <>
          <div className="card">
            <h1>Kuis Pengetahuan Umum</h1>
            <p className="mute">
              Dari sains, sejarah, dan budaya sampai olahraga, teknologi, dan
              peribahasa. Waktu 10 menit tiap kuis.
            </p>
          </div>
          <div className="two">
            <div className="card">
              <h2>Mulai bermain</h2>
              <label htmlFor="n">Nama kamu</label>
              <input
                id="n"
                maxLength={20}
                value={name}
                placeholder="Contoh: Dewi"
                onChange={(e) => setName(e.target.value)}
              />
              <p className="err">{err}</p>
              {dayLabel && <span className="date">{dayLabel}</span>}
              <button
                className="btn sun"
                style={{ marginTop: 10 }}
                onClick={() => start("daily")}
                disabled={busy}
              >
                {busy ? "Memuat soal..." : "Kuis Harian · 10 soal"}
              </button>
              <p className="hint">
                Soalnya sama untuk semua pemain hari ini.
                {played
                  ? " Kamu sudah memainkannya, hanya nilai terbaik yang dihitung."
                  : ""}
              </p>
              <button
                className="btn"
                onClick={() => start("acak")}
                disabled={busy}
              >
                Kuis Acak · 20 soal
              </button>
              <p className="hint">
                Soal berbeda setiap kali main, dengan topik yang beragam.
              </p>
            </div>
            <Board list={board} kind={kind} setKind={setKind} />
          </div>
        </>
      )}

      {view === "quiz" && q && (
        <>
          <div className="top">
            <span>
              {label} · Soal {i + 1} dari {qs.length}
            </span>
            <span className={"time" + (left <= 60 ? " low" : "")} role="timer">
              {fmt(left)}
            </span>
          </div>
          <div className="bar">
            <i style={{ width: ((i + 1) / qs.length) * 100 + "%" }} />
          </div>
          <div className="card">
            <p className="q">{q.q}</p>
            {q.options.map((o, k) => (
              <button
                key={o}
                className={"opt" + (ans[q.id] === o ? " on" : "")}
                onClick={() => {
                  setAns({ ...ans, [q.id]: o });
                  setWarn(false);
                }}
              >
                <b>{"ABCD"[k]}</b>
                {o}
              </button>
            ))}
            <div className="nav">
              <button
                className="btn alt"
                disabled={i === 0}
                onClick={() => setI(i - 1)}
              >
                Sebelumnya
              </button>
              <button
                className="btn"
                disabled={busy}
                onClick={() => (i === qs.length - 1 ? submit() : setI(i + 1))}
              >
                {i === qs.length - 1
                  ? busy
                    ? "Mengirim..."
                    : "Submit"
                  : "Berikutnya"}
              </button>
            </div>
            <p className="err">
              {err ||
                (warn
                  ? `${qs.filter((x) => !ans[x.id]).length} soal belum dijawab. Tekan Submit sekali lagi untuk mengumpulkan.`
                  : "")}
            </p>
          </div>
          <div className="card">
            <h2>Nomor soal</h2>
            <div className="dots">
              {qs.map((x, k) => (
                <button
                  key={x.id}
                  aria-label={"Soal " + (k + 1)}
                  className={(ans[x.id] ? "a " : "") + (k === i ? "c" : "")}
                  onClick={() => setI(k)}
                >
                  {k + 1}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {view === "result" && res && (
        <>
          <div className="card">
            <h2>
              Hasil {label} · {name}
            </h2>
            <div className="score">{res.score}</div>
            <div className="chips">
              <span className="chip">
                Benar {res.correct} dari {res.total}
              </span>
              <span className="chip">Waktu {fmt(res.seconds)}</span>
              {res.rank && (
                <span className="chip">
                  Peringkat {res.rank}
                  {mode === "daily" ? " hari ini" : ""}
                </span>
              )}
            </div>
            <button
              className="btn alt"
              style={{ marginTop: 0 }}
              onClick={() => setView("home")}
            >
              Kembali ke awal
            </button>
          </div>
          <div className="two">
            <div className="card">
              <h2>Pembahasan jawaban salah</h2>
              <ul className="rv">
                {res.wrong.length === 0 && (
                  <li>Semua jawaban benar. Sempurna!</li>
                )}
                {res.wrong.map((w, k) => (
                  <li key={k}>
                    <p>{w.q}</p>
                    <span className="bad">
                      Jawabanmu: {w.pick || "tidak dijawab"}
                    </span>
                    <span className="ok">Jawaban benar: {w.answer}</span>
                  </li>
                ))}
              </ul>
            </div>
            <Board list={board} kind={kind} setKind={setKind} />
          </div>
        </>
      )}
    </main>
  );
}
