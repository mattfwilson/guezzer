// ── Gizz With Friends — multi-user spike ────────────────────────────────────
// Covers three spike questions in one demo:
//   002 auth-identity     → log in as 1 of 5 pre-made accounts; session persists
//   003 synced-progress   → bump "songs caught"; friends see it live (postgres_changes)
//   004 presence-and-ping → live "who's online" + a broadcast wave
//
// Throwaway. Uses the vendored global `supabase` from supabase.umd.js.

const $ = (id) => document.getElementById(id);
const show = (id) => $(id).classList.remove("hidden");
const hide = (id) => $(id).classList.add("hidden");

// The 5 pre-made spike accounts (match seed/seed-users.mjs).
const KNOWN = [
  { name: "Matt", email: "matt@fov.gizz" },
  { name: "Max", email: "max@fov.gizz" },
  { name: "Tim", email: "tim@fov.gizz" },
  { name: "Shawn", email: "shawn@fov.gizz" },
  { name: "Brian", email: "brian@fov.gizz" },
];

// ── Config ──────────────────────────────────────────────────────────────────
let cfg;
try {
  cfg = await import("./config.local.js");
  if (!cfg.SUPABASE_URL || cfg.SUPABASE_URL.includes("YOUR-PROJECT")) throw new Error("unfilled");
} catch {
  show("setup");
  throw new Error("Missing/unfilled config.local.js — see setup card.");
}

const sb = supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);

// ── Network indicator (helps eyeball the offline-boot test) ─────────────────
function paintNet() {
  const el = $("net");
  const on = navigator.onLine;
  el.textContent = on ? "online" : "offline";
  el.className = "net " + (on ? "online" : "offline");
}
addEventListener("online", paintNet);
addEventListener("offline", paintNet);
paintNet();

// ── State ───────────────────────────────────────────────────────────────────
let me = null; // { id, name }
let presenceChannel = null;
let progressChannel = null;

// ── 002: AUTH / IDENTITY ────────────────────────────────────────────────────
function displayName(user) {
  return user?.user_metadata?.display_name || user?.email?.split("@")[0] || "friend";
}

function renderQuickPick() {
  const wrap = $("quickPick");
  wrap.innerHTML = "";
  KNOWN.forEach(({ name, email }) => {
    const b = document.createElement("button");
    b.textContent = name;
    b.onclick = () => {
      $("email").value = email;
      $("password").value = ""; // you still type the password
      $("password").focus();
    };
    wrap.appendChild(b);
  });
}

$("loginBtn").onclick = async () => {
  const email = $("email").value.trim();
  const password = $("password").value;
  $("loginStatus").textContent = "Signing in…";
  $("loginStatus").className = "status";
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) {
    $("loginStatus").textContent = error.message;
    $("loginStatus").className = "status err";
  }
};

$("logoutBtn").onclick = async () => {
  await sb.auth.signOut();
};

// React to every auth transition (initial restore, login, logout, token refresh).
sb.auth.onAuthStateChange((_event, session) => {
  if (session?.user) enterApp(session.user);
  else leaveApp();
});

// Restore an existing session on boot — works offline for an unexpired token,
// because supabase-js reads it synchronously from localStorage.
{
  const { data } = await sb.auth.getSession();
  if (data.session?.user) enterApp(data.session.user);
  else {
    renderQuickPick();
    show("login");
  }
}

// ── App lifecycle ───────────────────────────────────────────────────────────
async function enterApp(user) {
  me = { id: user.id, name: displayName(user) };
  hide("login");
  hide("setup");
  show("app");
  $("meName").textContent = me.name;

  await ensureMyRow();
  await refreshFriends();
  subscribeProgress(); // 003
  joinPresence(); // 004
}

function leaveApp() {
  me = null;
  progressChannel?.unsubscribe();
  presenceChannel?.unsubscribe();
  progressChannel = presenceChannel = null;
  hide("app");
  renderQuickPick();
  show("login");
}

// ── 003: SYNCED PROGRESS ────────────────────────────────────────────────────
let myCount = 0;

async function ensureMyRow() {
  // Upsert only identity columns so an existing songs_caught is preserved.
  await sb.from("progress").upsert(
    { user_id: me.id, display_name: me.name },
    { onConflict: "user_id" }
  );
}

$("catchBtn").onclick = async () => {
  myCount += 1;
  $("myCount").textContent = myCount; // optimistic
  const { error } = await sb
    .from("progress")
    .update({ songs_caught: myCount, updated_at: new Date().toISOString() })
    .eq("user_id", me.id);
  if (error) toast("⚠ save failed (offline?)");
};

async function refreshFriends() {
  const { data, error } = await sb
    .from("progress")
    .select("user_id, display_name, songs_caught")
    .order("songs_caught", { ascending: false });
  if (error) return;
  const mine = data.find((r) => r.user_id === me.id);
  if (mine) {
    myCount = mine.songs_caught;
    $("myCount").textContent = myCount;
  }
  renderFriends(data);
}

// Live updates: any row change re-pulls the small table (5 rows — cheap).
function subscribeProgress() {
  progressChannel = sb
    .channel("progress-feed")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "progress" },
      () => refreshFriends()
    )
    .subscribe();
}

// ── 004: PRESENCE + WAVE ────────────────────────────────────────────────────
let onlineIds = new Set();

function joinPresence() {
  presenceChannel = sb.channel("gizz-room", {
    config: { presence: { key: me.id } },
  });

  presenceChannel
    .on("presence", { event: "sync" }, () => {
      const state = presenceChannel.presenceState();
      onlineIds = new Set(Object.keys(state));
      paintPresence();
    })
    .on("broadcast", { event: "wave" }, ({ payload }) => {
      if (payload.to && payload.to !== me.id) return; // targeted wave for someone else
      toast(`👋 ${payload.from} waved${payload.to ? " at you" : ""}`);
    })
    .subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await presenceChannel.track({ name: me.name, at: Date.now() });
      }
    });
}

function sendWave(toId) {
  presenceChannel?.send({
    type: "broadcast",
    event: "wave",
    payload: { from: me.name, to: toId || null },
  });
  toast(toId ? "👋 wave sent" : "👋 waved at everyone");
}

// ── Combined friends render (progress + online + wave) ──────────────────────
let lastRows = [];
function renderFriends(rows) {
  lastRows = rows;
  paintFriends();
}
function paintPresence() {
  paintFriends();
}
function paintFriends() {
  const el = $("friends");
  el.innerHTML = "";
  for (const r of lastRows) {
    const isMe = r.user_id === me.id;
    const online = onlineIds.has(r.user_id);
    const div = document.createElement("div");
    div.className = "who";

    const left = document.createElement("div");
    left.className = "name";
    left.innerHTML = `<span class="dot ${online ? "on" : ""}"></span>
      <span class="${isMe ? "me" : ""}">${r.display_name}${isMe ? " (you)" : ""}</span>`;

    const right = document.createElement("div");
    right.className = "row";
    const count = document.createElement("span");
    count.className = "count";
    count.textContent = r.songs_caught;
    right.appendChild(count);
    if (!isMe && online) {
      const w = document.createElement("button");
      w.className = "wave";
      w.textContent = "👋";
      w.onclick = () => sendWave(r.user_id);
      right.appendChild(w);
    }

    div.appendChild(left);
    div.appendChild(right);
    el.appendChild(div);
  }
}

// ── Toasts ──────────────────────────────────────────────────────────────────
function toast(text) {
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = text;
  $("toasts").appendChild(t);
  setTimeout(() => t.remove(), 2600);
}
