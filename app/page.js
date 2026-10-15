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
const LEVELS = [
  ["mudah", "Mudah", "Pengetahuan dasar"],
  ["sedang", "Sedang", "Setara SMP–SMA"],
  ["sulit", "Sulit", "Menuntut penalaran"],
  ["olimpiade", "WNI", "Soal seleksi menjadi WNI"],
];
const LNAME = Object.fromEntries(LEVELS.map(([k, n]) => [k, n]));

const MEDAL = {
  1: ["#FFC83D", "#E09A00"],
  2: ["#C9D3E3", "#8D9AB3"],
  3: ["#E0955A", "#B0652A"],
};

function Medal({ n, size = 30 }) {
  const [a, b] = MEDAL[n];
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      role="img"
      aria-label={`Peringkat ${n}`}
    >
      <path d="M14 2h9l5 16h-9z" fill="#3D6BFF" />
      <path d="M34 2h-9l-5 16h9z" fill="#2F55D4" />
      <circle cx="24" cy="30" r="15" fill={a} stroke={b} strokeWidth="3" />
      <text
        x="24"
        y="36"
        textAnchor="middle"
        fontSize="18"
        fontWeight="800"
        fill="#fff"
        stroke={b}
        strokeWidth=".6"
      >
        {n}
      </text>
    </svg>
  );
}

function Trophy() {
  return (
    <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true">
      <path d="M9 4h14v8a7 7 0 0 1-14 0z" fill="#FFB020" />
      <path
        d="M9 7H4v2a5 5 0 0 0 5 5M23 7h5v2a5 5 0 0 1-5 5"
        fill="none"
        stroke="#FFB020"
        strokeWidth="2"
      />
      <rect x="14" y="19" width="4" height="5" fill="#E09A00" />
      <rect x="10" y="24" width="12" height="4" rx="1.5" fill="#E09A00" />
    </svg>
  );
}

function Board({ list, kind, setKind, level, error, me }) {
  return (
    <div className="card">
      <h2 className="ttl">
        <Trophy /> Peringkat · {LNAME[level]}
      </h2>
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
      {error && <p className="err">{error}</p>}
      <ol className="lb">
        {!error && list.length === 0 && (
          <li className="mute" style={{ display: "block" }}>
            Belum ada skor. Jadilah yang pertama.
          </li>
        )}
        {list.map((e, i) => (
          <li
            key={i}
            className={
              me && e.name.toLowerCase() === me.toLowerCase() ? "me" : ""
            }
          >
            {i < 3 ? <Medal n={i + 1} /> : <span className="rk">{i + 1}</span>}
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
  const [level, setLevel] = useState("mudah");
  const [qs, setQs] = useState([]);
  const [ans, setAns] = useState({});
  const [i, setI] = useState(0);
  const [left, setLeft] = useState(T);
  const [res, setRes] = useState(null);
  const [kind, setKind] = useState("daily");
  const [board, setBoard] = useState([]);
  const [boardErr, setBoardErr] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [warn, setWarn] = useState(false);
  const [played, setPlayed] = useState(false);
  const [dayLabel, setDayLabel] = useState("");
  const [party, setParty] = useState(null);
  const end = useRef(0);
  const done = useRef(false);
  const day = useRef(null);
  const latest = useRef({});
  latest.current = { ans, qs, name, mode, level };

  const todayKey = () =>
    new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });

  const loadBoard = (k, l) =>
    fetch(`/api/leaderboard?kind=${k}&level=${l}`, { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok || !Array.isArray(d)) throw new Error();
        setBoard(d);
        setBoardErr("");
      })
      .catch(() => {
        setBoard([]);
        setBoardErr(
          "Peringkat belum bisa dimuat. Cek database dan migrasinya.",
        );
      });

  useEffect(() => {
    setName(localStorage.getItem("kuis-name") || "");
    const l = localStorage.getItem("kuis-level");
    if (LNAME[l]) setLevel(l);
    setDayLabel(
      new Date().toLocaleDateString("id-ID", {
        weekday: "long",
        day: "numeric",
        month: "long",
        timeZone: "Asia/Jakarta",
      }),
    );
  }, []);

  useEffect(() => {
    setPlayed(localStorage.getItem("kuis-daily-" + level) === todayKey());
  }, [level]);

  useEffect(() => {
    loadBoard(kind, level);
  }, [kind, level]);

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
      const r = await fetch(`/api/quiz?mode=${m}&level=${level}`, {
        cache: "no-store",
      });
      const d = await r.json();
      if (!r.ok || !d.questions?.length) throw new Error();
      localStorage.setItem("kuis-name", n);
      localStorage.setItem("kuis-level", level);
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
        "Soal belum bisa dimuat. Pastikan database sudah di-seed untuk tingkat ini.",
      );
    }
    setBusy(false);
  }

  async function finish() {
    if (done.current) return;
    done.current = true;
    const { ans, qs, name, mode, level } = latest.current;
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
          level,
          day: day.current,
          answers: qs.map((q) => ({ id: q.id, pick: ans[q.id] || null })),
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setRes({ ...d, seconds });
      if (d.rank && d.rank <= 3 && d.score > 0 && d.players >= 3) {
        const cols = [
          "#2F6BFF",
          "#FFB020",
          "#FF6B9A",
          "#3DD68C",
          "#7C3AED",
          "#22C1E8",
        ];
        setParty({
          rank: d.rank,
          text: `Selamat, ${name}! Kamu masuk 3 besar ${LNAME[level]}.`,
          pieces: Array.from({ length: 56 }, (_, k) => ({
            l: Math.random() * 100,
            c: cols[k % cols.length],
            d: Math.random() * 0.9,
            t: 2.6 + Math.random() * 1.8,
            s: 6 + Math.random() * 7,
            r: 360 + Math.random() * 540,
          })),
        });
        setTimeout(() => setParty(null), 5200);
      }
      if (mode === "daily") {
        localStorage.setItem("kuis-daily-" + level, day.current);
        setPlayed(true);
      }
      const k = mode === "daily" ? "daily" : "all";
      setKind(k);
      loadBoard(k, level);
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
              Dari sains, sejarah, dan budaya sampai logika dan matematika
              tingkat WNI. Waktu 10 menit tiap kuis.
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
              <label style={{ marginTop: 14 }}>Tingkat kesulitan</label>
              <div
                className="lv"
                role="radiogroup"
                aria-label="Tingkat kesulitan"
              >
                {LEVELS.map(([k, t, d]) => (
                  <button
                    key={k}
                    data-l={k}
                    role="radio"
                    aria-checked={level === k}
                    className={level === k ? "on" : ""}
                    onClick={() => setLevel(k)}
                  >
                    <b>{t}</b>
                    <small>{d}</small>
                  </button>
                ))}
              </div>
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
                Soalnya sama untuk semua pemain di tingkat ini hari ini.
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
            <Board
              list={board}
              kind={kind}
              setKind={setKind}
              level={level}
              error={boardErr}
            />
          </div>
        </>
      )}

      {view === "quiz" && q && (
        <>
          <div className="top">
            <span>
              {LNAME[level]} · {label} · Soal {i + 1} dari {qs.length}
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
              Hasil {LNAME[level]} · {label} · {name}
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
                  {mode === "daily" ? " hari ini" : ""} ({LNAME[level]})
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
            <Board
              list={board}
              kind={kind}
              setKind={setKind}
              level={level}
              error={boardErr}
              me={name}
            />
          </div>
        </>
      )}

      {party && (
        <div className="party" role="status">
          {party.pieces.map((p, k) => (
            <i
              key={k}
              style={{
                left: p.l + "%",
                width: p.s,
                height: p.s * 1.6,
                background: p.c,
                "--t": p.t + "s",
                "--d": p.d + "s",
                "--r2": p.r + "deg",
              }}
            />
          ))}
          <div className="pop">
            <Medal n={party.rank} size={96} />
            <b>{party.rank === 1 ? "Juara 1!" : `Peringkat ${party.rank}!`}</b>
            <span className="mute">{party.text}</span>
          </div>
        </div>
      )}
    </main>
  );
}
