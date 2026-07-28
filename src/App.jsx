import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { supabase } from './supabase'

// ============================================================
// CONSTANTS
// ============================================================
const ADMIN_EMAIL = 'steven.sparacino@bol-agency.com'
const BUILD = 'v4.2' // bump on every deploy — shown in footer so we always know what's live
const MAX_TEAMS = 12
const CURRENT_SEASON = 2026
// ⚠️ REPLACE with your final GitHub Pages URL before committing
const APP_URL = 'https://stevensparacino-debug.github.io/bol-fantasy-football/'

const FANTASY_POSITIONS = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF']
const ROSTER_SLOTS = ['QB', 'RB1', 'RB2', 'WR1', 'WR2', 'TE', 'FLEX', 'K', 'DEF']
const BENCH_SLOTS = ['BN1', 'BN2', 'BN3', 'BN4', 'BN5', 'BN6', 'BN7']
const TOTAL_ROUNDS = 16 // 9 starters + 7 bench
const DRAFT_PICK_TIMER = 90 // seconds
const BOT_PICK_DELAY_MS = 1500

// League scoring — HALF PPR (0.5 per reception). Used by the Phase 4 engine
// and referenced anywhere points are computed or labeled.
export const SCORING = {
  pass_td: 4, pass_yd: 0.04, pass_int: -2,
  rush_td: 6, rush_yd: 0.1,
  rec_td: 6, rec_yd: 0.1, rec: 0.5, // ← half-PPR
  fum_lost: -2, two_pt: 2,
  fg_0_39: 3, fg_40_49: 4, fg_50p: 5, xp: 1,
  def_td: 6, def_sack: 1, def_int: 2, def_fum_rec: 2, def_safety: 2,
  def_pa_tiers: [
    [0, 0, 10], [1, 6, 7], [7, 13, 4], [14, 20, 1],
    [21, 27, 0], [28, 34, -1], [35, Infinity, -4],
  ],
}

// Which positions may occupy each lineup slot (bench takes anyone)
const SLOT_ELIG = {
  QB: ['QB'], RB1: ['RB'], RB2: ['RB'], WR1: ['WR'], WR2: ['WR'],
  TE: ['TE'], FLEX: ['RB', 'WR', 'TE'], K: ['K'], DEF: ['DEF'],
}
const slotAccepts = (position, slot) =>
  slot.startsWith('BN') ? true : (SLOT_ELIG[slot] || []).includes(position)

const BOT_NAMES = [
  'Gridiron Bots', 'Blitz Machine', 'End Zone AI', 'Pixel Pushers',
  'The Algorithms', 'Fourth & Bot', 'Circuit Breakers', 'Auto Draft FC',
  'Binary Blitzers', 'Robo Receivers', 'Silicon Squad',
]

// ============================================================
// STYLES
// ============================================================
const CSS = `
:root {
  --cream: #F6F1E3;
  --ink: #1E1B16;
  --orange: #E8622C;
  --orange-dark: #C74E1F;
  --turf: #2E5E3A;
  --chalk: #FFFFFF;
  --line: rgba(30,27,22,0.15);
  --mock: #6B4FA0;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { background: var(--cream); color: var(--ink); }
body { font-family: 'DM Sans', sans-serif; -webkit-font-smoothing: antialiased; }
.app { min-height: 100vh; display: flex; flex-direction: column; }
.display { font-family: 'Bebas Neue', sans-serif; letter-spacing: 0.02em; }

.header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 24px; border-bottom: 3px solid var(--ink);
}
.header .logo { font-size: 30px; line-height: 1; }
.header .logo span { color: var(--orange); }
.header .user { display: flex; align-items: center; gap: 12px; font-size: 14px; }

.main { flex: 1; width: 100%; max-width: 1100px; margin: 0 auto; padding: 32px 20px 64px; }

.login-hero { text-align: center; padding: 12vh 16px 0; }
.login-hero h1 { font-size: clamp(64px, 14vw, 140px); line-height: 0.9; }
.login-hero h1 .accent { color: var(--orange); }
.login-hero p { margin: 20px auto 32px; max-width: 420px; font-size: 17px; opacity: 0.8; }

.btn {
  font-family: 'DM Sans', sans-serif; font-weight: 700; font-size: 15px;
  padding: 12px 24px; border: 2px solid var(--ink); border-radius: 8px;
  background: var(--chalk); color: var(--ink); cursor: pointer;
  box-shadow: 3px 3px 0 var(--ink); transition: transform 0.08s, box-shadow 0.08s;
}
.btn:hover { transform: translate(-1px,-1px); box-shadow: 4px 4px 0 var(--ink); }
.btn:active { transform: translate(2px,2px); box-shadow: 1px 1px 0 var(--ink); }
.btn:disabled { opacity: 0.45; cursor: not-allowed; transform: none; box-shadow: 3px 3px 0 var(--ink); }
.btn:focus-visible { outline: 3px solid var(--orange); outline-offset: 2px; }
.btn-primary { background: var(--orange); color: var(--chalk); }
.btn-turf { background: var(--turf); color: var(--chalk); }
.btn-mock { background: var(--mock); color: var(--chalk); }
.btn-sm { padding: 8px 14px; font-size: 13px; }
.btn-xs { padding: 5px 10px; font-size: 12px; box-shadow: 2px 2px 0 var(--ink); }
.btn-ghost { background: transparent; box-shadow: none; border-color: var(--line); }
.btn-ghost:hover { box-shadow: none; transform: none; border-color: var(--ink); }

.card {
  background: var(--chalk); border: 2px solid var(--ink); border-radius: 12px;
  box-shadow: 4px 4px 0 var(--ink); padding: 24px; margin-bottom: 24px;
}
.card h2 { font-family: 'Bebas Neue', sans-serif; font-size: 28px; margin-bottom: 12px; }
.card p.sub { font-size: 14px; opacity: 0.75; margin-bottom: 16px; }

.field { display: flex; gap: 10px; flex-wrap: wrap; }
.input {
  flex: 1; min-width: 180px; font-family: 'DM Sans', sans-serif; font-size: 15px;
  padding: 12px 14px; border: 2px solid var(--ink); border-radius: 8px; background: var(--cream);
}
.input:focus-visible { outline: 3px solid var(--orange); outline-offset: 1px; }
.input.code { text-transform: uppercase; letter-spacing: 0.25em; font-weight: 700; }

.code-chip {
  display: inline-flex; align-items: center; gap: 10px;
  font-family: 'Bebas Neue', sans-serif; font-size: 32px; letter-spacing: 0.2em;
  background: var(--ink); color: var(--cream); padding: 8px 18px; border-radius: 8px;
}

.teams-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
.team-slot { border: 2px solid var(--ink); border-radius: 10px; padding: 14px; background: var(--cream); }
.team-slot .num { font-family: 'Bebas Neue', sans-serif; font-size: 14px; color: var(--orange); }
.team-slot .tname { font-weight: 700; font-size: 16px; margin: 2px 0; }
.team-slot .uname { font-size: 13px; opacity: 0.7; }
.team-slot.empty { border-style: dashed; border-color: var(--line); color: var(--line); display: flex; align-items: center; justify-content: center; min-height: 74px; font-size: 13px; }
.team-slot.mine { background: #FDEBDD; border-color: var(--orange); }

.pill {
  display: inline-block; font-size: 12px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.08em; padding: 4px 10px; border-radius: 999px; border: 2px solid var(--ink);
}
.pill.setup { background: #FCE9A8; }
.pill.locked { background: var(--orange); color: var(--chalk); }
.pill.drafting { background: var(--turf); color: var(--chalk); }
.pill.active { background: var(--turf); color: var(--chalk); }
.pill.mock { background: var(--mock); color: var(--chalk); }

.admin-card { border-color: var(--orange); }
.admin-card h2 { color: var(--orange-dark); }
.mock-card { border-color: var(--mock); }
.mock-card h2 { color: var(--mock); }
.admin-actions { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 8px; }

.msg { font-size: 14px; margin-top: 10px; font-weight: 500; }
.msg.err { color: #B3261E; }
.msg.ok { color: var(--turf); }
.divider { border: none; border-top: 2px dashed var(--line); margin: 24px 0; }
.footer { text-align: center; font-size: 12px; opacity: 0.5; padding: 20px; }

/* ---------- Draft room ---------- */
.mock-banner {
  background: var(--mock); color: var(--chalk); text-align: center;
  font-weight: 700; font-size: 14px; padding: 8px 16px; border-radius: 8px; margin-bottom: 16px;
}
.draft-topbar {
  display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap;
  background: var(--ink); color: var(--cream); border-radius: 12px; padding: 16px 20px; margin-bottom: 20px;
}
.draft-topbar .roundinfo { font-family: 'Bebas Neue', sans-serif; font-size: 22px; }
.draft-topbar .onclock { font-size: 14px; }
.draft-topbar .onclock b { color: var(--orange); font-size: 17px; }
.clock {
  font-family: 'Bebas Neue', sans-serif; font-size: 44px; line-height: 1; min-width: 90px; text-align: center;
  color: var(--cream);
}
.clock.warn { color: var(--orange); }
.clock.paused { opacity: 0.5; }

.draft-layout { display: grid; grid-template-columns: 1fr 320px; gap: 20px; }
@media (max-width: 860px) { .draft-layout { grid-template-columns: 1fr; } }

.pool-controls { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
.chip {
  font-size: 13px; font-weight: 700; padding: 6px 12px; border: 2px solid var(--ink);
  border-radius: 999px; background: var(--chalk); cursor: pointer;
}
.chip.on { background: var(--ink); color: var(--cream); }

.pool { max-height: 520px; overflow-y: auto; border: 2px solid var(--ink); border-radius: 10px; }
.pool-row {
  display: flex; align-items: center; gap: 10px; padding: 10px 14px;
  border-bottom: 1px solid var(--line); font-size: 14px; background: var(--chalk);
}
.pool-row:last-child { border-bottom: none; }
.pool-row .pname { font-weight: 700; flex: 1; }
.pool-row .pmeta { font-size: 12px; opacity: 0.65; min-width: 84px; }
.pool-row .prank { font-size: 12px; opacity: 0.5; min-width: 56px; text-align: right; }

.side-card { background: var(--chalk); border: 2px solid var(--ink); border-radius: 12px; padding: 16px; margin-bottom: 16px; }
.side-card h3 { font-family: 'Bebas Neue', sans-serif; font-size: 20px; margin-bottom: 10px; }
.feed { max-height: 260px; overflow-y: auto; font-size: 13px; }
.feed-row { padding: 6px 0; border-bottom: 1px dashed var(--line); }
.feed-row b { color: var(--orange-dark); }
.roster-row { display: flex; gap: 8px; font-size: 13px; padding: 4px 0; }
.roster-row .slot { font-weight: 700; min-width: 46px; color: var(--turf); }
.order-list { font-size: 14px; }
.order-list li { padding: 4px 0; }

/* ---------- Draft board ---------- */
.board-scroll { overflow-x: auto; margin-top: 16px; }
.board { border-collapse: collapse; width: 100%; min-width: 900px; font-size: 12px; }
.board th, .board td { border: 1px solid var(--line); padding: 6px 8px; text-align: left; vertical-align: top; }
.board th { font-family: 'Bebas Neue', sans-serif; font-size: 14px; letter-spacing: 0.04em; background: var(--ink); color: var(--cream); position: sticky; top: 0; }
.board .rnd { width: 34px; text-align: center; font-weight: 700; background: var(--cream); }
.board td.filled { background: var(--chalk); }
.board .bp-name { font-weight: 700; }
.board .bp-meta { opacity: 0.6; font-size: 11px; }
.board .bp-empty { opacity: 0.3; }

/* ---------- Tabs / Team page ---------- */
.tabs { display: flex; gap: 8px; margin-bottom: 20px; }
.tab {
  font-family: 'Bebas Neue', sans-serif; font-size: 18px; letter-spacing: 0.04em;
  padding: 8px 20px; border: 2px solid var(--ink); border-radius: 8px;
  background: var(--chalk); cursor: pointer;
}
.tab.on { background: var(--ink); color: var(--cream); }
.lineup-row {
  display: flex; align-items: center; gap: 12px; padding: 10px 12px;
  border: 2px solid var(--line); border-radius: 8px; margin-bottom: 6px;
  background: var(--chalk); font-size: 14px;
}
.lineup-row.tappable { cursor: pointer; }
.lineup-row.tappable:hover { border-color: var(--ink); }
.lineup-row.sel { border-color: var(--orange); background: #FDEBDD; }
.lineup-row.open { border-style: dashed; background: var(--cream); }
.lineup-row .lslot { font-family: 'Bebas Neue', sans-serif; font-size: 15px; min-width: 48px; color: var(--turf); }
.lineup-row .lname { font-weight: 700; flex: 1; }
.lineup-row .lmeta { font-size: 12px; opacity: 0.65; }
.lineup-row .lproj { font-size: 12px; font-weight: 700; min-width: 70px; text-align: right; }
.lock-banner {
  margin-top: 12px; padding: 10px 14px; border-radius: 8px;
  background: var(--orange); color: var(--chalk); font-weight: 700; font-size: 14px;
}

/* ---------- Draft advisor ---------- */
.advisor { border-color: var(--turf); }
.adv-ok { font-size: 13px; font-weight: 700; color: var(--turf); }
.adv-need { font-size: 13px; font-weight: 700; }
.adv-need.urgent { color: #B3261E; }
.adv-sub { font-weight: 400; opacity: 0.6; }
.adv-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; margin: 10px 0 6px; opacity: 0.6; }
.adv-row { display: flex; align-items: baseline; gap: 8px; font-size: 13px; padding: 4px 0; border-bottom: 1px dashed var(--line); }
.adv-row:last-child { border-bottom: none; }
.adv-name { font-weight: 700; flex: 1; }
.adv-meta { font-size: 11px; opacity: 0.6; }
.adv-why { font-size: 11px; color: var(--turf); font-weight: 700; }

/* ---------- Coach ---------- */
.coach { border-color: var(--orange); }
.coach-say {
  margin-top: 10px; padding: 10px 12px; border-radius: 8px;
  background: var(--cream); border: 2px dashed var(--orange);
  font-size: 13px; line-height: 1.5; white-space: pre-wrap;
}

/* ---------- Scoreboard ---------- */
.mu-row {
  display: flex; align-items: center; gap: 10px; padding: 10px 12px;
  border: 2px solid var(--line); border-radius: 8px; margin-bottom: 8px;
  background: var(--chalk); font-size: 14px;
}
.mu-row.mine { border-color: var(--orange); background: #FDEBDD; }
.mu-team { font-weight: 700; flex: 1; }
.mu-team.away { text-align: right; }
.mu-team.lead { color: var(--turf); }
.mu-score { font-family: 'Bebas Neue', sans-serif; font-size: 22px; min-width: 58px; text-align: center; }
.mu-vs { font-size: 11px; opacity: 0.5; }
.mu-final { font-size: 10px; font-weight: 700; letter-spacing: 0.08em; background: var(--ink); color: var(--cream); padding: 3px 7px; border-radius: 4px; }

@media (prefers-reduced-motion: reduce) { .btn { transition: none; } }
`

// ============================================================
// HELPERS
// ============================================================
function makeJoinCode() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

// Next Sunday at 1:00 PM Eastern, DST-safe (17:00 UTC during EDT, 18:00 during EST)
function nextSunday1pmET(from = new Date()) {
  const nyHourOf = d => parseInt(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', hour: 'numeric', hour12: false,
  }).format(d), 10)
  const day = new Date(from)
  day.setUTCHours(0, 0, 0, 0)
  for (let i = 0; i < 15; i++) { // scan up to two weeks of days
    if (day.getUTCDay() === 0) {
      for (const h of [17, 18]) {
        const cand = new Date(day)
        cand.setUTCHours(h)
        if (cand > from && nyHourOf(cand) === 13) return cand
      }
    }
    day.setUTCDate(day.getUTCDate() + 1)
  }
  return day
}

// Snake draft: which slot in draft_order picks at overall pick n (0-indexed)
function slotForPick(n, numTeams) {
  const round = Math.floor(n / numTeams)
  const idx = n % numTeams
  return round % 2 === 0 ? idx : numTeams - 1 - idx
}

function bestAvailable(players, draftedSet, teamPicks) {
  const counts = {}
  teamPicks.forEach(p => { counts[p.position] = (counts[p.position] || 0) + 1 })
  const picksLeft = TOTAL_ROUNDS - teamPicks.length
  const avail = players.filter(p => !draftedSet.has(p.id))
  const bestAt = pos =>
    avail.find(p => p.position === pos && p.adp != null) ||
    avail.find(p => p.position === pos)

  // Required starters still unfilled (1 QB, 2 RB, 2 WR, 1 TE, 1 K, 1 DEF)
  const reqGaps = []
  ;[['QB', 1], ['RB', 2], ['WR', 2], ['TE', 1], ['K', 1], ['DEF', 1]].forEach(([pos, n]) => {
    for (let i = counts[pos] || 0; i < n; i++) reqGaps.push(pos)
  })

  // URGENT: remaining picks barely cover required slots — fill them now
  if (reqGaps.length >= picksLeft && reqGaps.length > 0) {
    const order = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF']
    for (const pos of order) {
      if (reqGaps.includes(pos)) {
        const pick = bestAt(pos)
        if (pick) return pick
      }
    }
  }

  // Otherwise: best available within positional caps (never 3 QBs before a K)
  const caps = { QB: 2, RB: 6, WR: 6, TE: 2, K: 1, DEF: 1 }
  const need = pos => (counts[pos] || 0) < (caps[pos] ?? 2)
  const ranked = avail.filter(p => p.adp != null)
  return ranked.find(p => need(p.position)) ||
    avail.find(p => need(p.position)) ||
    ranked[0] || avail[0]
}

function autoAssignSlots(teamPlayers) {
  // teamPlayers sorted by adp. Returns [{player_id, slot}]
  const byPos = pos => teamPlayers.filter(p => p.position === pos)
  const used = new Set()
  const out = []
  const take = (pool, slot) => {
    const p = pool.find(x => !used.has(x.id))
    if (p) { used.add(p.id); out.push({ player_id: p.id, slot }) }
  }
  take(byPos('QB'), 'QB')
  take(byPos('RB'), 'RB1'); take(byPos('RB'), 'RB2')
  take(byPos('WR'), 'WR1'); take(byPos('WR'), 'WR2')
  take(byPos('TE'), 'TE')
  take(teamPlayers.filter(p => ['RB', 'WR', 'TE'].includes(p.position)), 'FLEX')
  take(byPos('K'), 'K')
  take(byPos('DEF'), 'DEF')
  let bn = 0
  teamPlayers.forEach(p => {
    if (!used.has(p.id) && bn < BENCH_SLOTS.length) {
      used.add(p.id); out.push({ player_id: p.id, slot: BENCH_SLOTS[bn++] })
    }
  })
  return out
}

// Compute fantasy points for one player's stat line (half-PPR + DEF tiers)
function fantasyPoints(s, position) {
  if (!s) return 0
  let pts = 0
  pts += (s.pass_yd || 0) * SCORING.pass_yd
  pts += (s.pass_td || 0) * SCORING.pass_td
  pts += (s.pass_int || 0) * SCORING.pass_int
  pts += (s.rush_yd || 0) * SCORING.rush_yd
  pts += (s.rush_td || 0) * SCORING.rush_td
  pts += (s.rec || 0) * SCORING.rec
  pts += (s.rec_yd || 0) * SCORING.rec_yd
  pts += (s.rec_td || 0) * SCORING.rec_td
  pts += (s.fum_lost || 0) * SCORING.fum_lost
  pts += ((s.pass_2pt || 0) + (s.rush_2pt || 0) + (s.rec_2pt || 0)) * SCORING.two_pt
  // Kickers
  pts += ((s.fgm_0_19 || 0) + (s.fgm_20_29 || 0) + (s.fgm_30_39 || 0)) * SCORING.fg_0_39
  pts += (s.fgm_40_49 || 0) * SCORING.fg_40_49
  pts += (s.fgm_50p || 0) * SCORING.fg_50p
  pts += (s.xpm || 0) * SCORING.xp
  // Team defense
  if (position === 'DEF') {
    pts += (s.def_td || 0) * SCORING.def_td
    pts += (s.sack || 0) * SCORING.def_sack
    pts += (s.int || 0) * SCORING.def_int
    pts += (s.fum_rec || 0) * SCORING.def_fum_rec
    pts += (s.safe || 0) * SCORING.def_safety
    const pa = s.pts_allow
    if (typeof pa === 'number') {
      for (const [lo, hi, tier] of SCORING.def_pa_tiers) {
        if (pa >= lo && pa <= hi) { pts += tier; break }
      }
    }
  }
  return Math.round(pts * 100) / 100
}

// Round-robin schedule: every team plays every week, opponents rotate.
// 12 teams -> 11 unique rounds; weeks 12-13 repeat rounds 1-2.
function roundRobin(teamIds, weeks) {
  const arr = [...teamIds]
  if (arr.length % 2 !== 0) arr.push(null)
  const n = arr.length
  const rounds = []
  for (let r = 0; r < n - 1; r++) {
    const pairs = []
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i], b = arr[n - 1 - i]
      if (a != null && b != null) pairs.push([a, b])
    }
    rounds.push(pairs)
    arr.splice(1, 0, arr.pop())
  }
  const schedule = []
  for (let w = 1; w <= weeks; w++) {
    schedule.push({ week: w, pairs: rounds[(w - 1) % rounds.length] })
  }
  return schedule
}

// Normalize a Sleeper stats/projections response (object or array) into { id -> stats }
function normalizeSleeperStats(raw) {
  const pairs = Array.isArray(raw)
    ? raw.map(r => [String(r.player_id ?? r.player?.player_id ?? ''), r.stats ?? r])
    : Object.entries(raw).map(([pid, s]) => [String(pid), s])
  const map = {}
  pairs.forEach(([pid, s]) => { if (pid && s && typeof s === 'object') map[pid] = s })
  return map
}

// Scale a stat line by fraction f (0..1) - used by simulated-live replay
function scaleStats(s, f) {
  if (!s || f >= 1) return s
  const out = {}
  Object.entries(s).forEach(([k, v]) => {
    out[k] = typeof v === 'number' ? v * f : v
  })
  return out
}

// ============================================================
// APP
// ============================================================
export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [realTeam, setRealTeam] = useState(null)
  const [realLeague, setRealLeague] = useState(null)
  const [mockTeam, setMockTeam] = useState(null)
  const [mockLeague, setMockLeague] = useState(null)
  const [view, setView] = useState('home') // 'home' | 'mock'

  useEffect(() => {
    const tag = document.createElement('style')
    tag.textContent = CSS
    document.head.appendChild(tag)
    return () => tag.remove()
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  const loadMyLeagues = useCallback(async () => {
    if (!session) return
    const { data: myTeams } = await supabase
      .from('teams')
      .select('*, leagues(*)')
      .eq('user_id', session.user.id)
    let real = null, mock = null
    ;(myTeams || []).forEach(t => {
      if (t.leagues?.is_mock) mock = t
      else real = t
    })
    setRealTeam(real); setRealLeague(real?.leagues || null)
    setMockTeam(mock); setMockLeague(mock?.leagues || null)
    if (!mock && view === 'mock') setView('home')
    // A mock draft mid-flight needs this (admin) client driving the bots —
    // route straight back into it after any refresh so it never silently stalls.
    if (mock?.leagues?.status === 'drafting') setView('mock')
  }, [session]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadMyLeagues() }, [loadMyLeagues])

  const handleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: APP_URL },
    })
  }
  const handleLogout = async () => {
    await supabase.auth.signOut()
    setRealTeam(null); setRealLeague(null); setMockTeam(null); setMockLeague(null)
  }

  if (loading) return <div className="app"><div className="main">Loading…</div></div>

  const isAdmin = session?.user?.email === ADMIN_EMAIL

  return (
    <div className="app">
      {session && (
        <header className="header">
          <div className="display logo">BOL <span>FANTASY</span> FOOTBALL</div>
          <div className="user">
            {mockLeague && (
              <button className="btn btn-sm btn-ghost" onClick={() => setView(view === 'mock' ? 'home' : 'mock')}>
                {view === 'mock' ? '← Back to league' : 'Mock draft →'}
              </button>
            )}
            <span>{session.user.user_metadata?.full_name?.split(' ')[0] || session.user.email}</span>
            <button className="btn btn-sm btn-ghost" onClick={handleLogout}>Sign out</button>
          </div>
        </header>
      )}

      <div className="main">
        {!session && <LoginScreen onLogin={handleLogin} />}

        {session && view === 'mock' && mockLeague && (
          <LeagueView
            key={mockLeague.id}
            session={session}
            leagueId={mockLeague.id}
            initialLeague={mockLeague}
            myTeamId={mockTeam?.id}
            isAdmin={isAdmin}
            isMock
            onExitMock={async () => { setView('home'); await loadMyLeagues() }}
            reloadTop={loadMyLeagues}
          />
        )}

        {session && view === 'home' && !realTeam && (
          <Lobby session={session} isAdmin={isAdmin} onDone={loadMyLeagues} />
        )}
        {session && view === 'home' && realTeam && realLeague && (
          <LeagueView
            key={realLeague.id}
            session={session}
            leagueId={realLeague.id}
            initialLeague={realLeague}
            myTeamId={realTeam.id}
            isAdmin={isAdmin}
            isMock={false}
            onEnterMock={() => setView('mock')}
            reloadTop={loadMyLeagues}
          />
        )}
      </div>

      <div className="footer">BOL Agency · {CURRENT_SEASON} Season · {BUILD}</div>
    </div>
  )
}

// ============================================================
// LOGIN
// ============================================================
function LoginScreen({ onLogin }) {
  return (
    <div className="login-hero">
      <h1 className="display">BOL<br /><span className="accent">FANTASY</span><br />FOOTBALL</h1>
      <p>12 teams. Half-PPR scoring. One office champion. Sign in with Google to claim your spot.</p>
      <button className="btn btn-primary" onClick={onLogin}>Sign in with Google</button>
    </div>
  )
}

// ============================================================
// LOBBY
// ============================================================
function Lobby({ session, isAdmin, onDone }) {
  const [joinCode, setJoinCode] = useState('')
  const [teamName, setTeamName] = useState('')
  const [leagueName, setLeagueName] = useState('BOL Fantasy Football')
  const [adminTeamName, setAdminTeamName] = useState('')
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)

  const displayName =
    session.user.user_metadata?.full_name?.split(' ')[0] || session.user.email

  const createLeague = async () => {
    if (!adminTeamName.trim()) { setMsg({ t: 'err', v: 'Name your team first.' }); return }
    setBusy(true); setMsg(null)
    const { data: lg, error } = await supabase
      .from('leagues')
      .insert({
        name: leagueName.trim() || 'BOL Fantasy Football',
        join_code: makeJoinCode(),
        admin_id: session.user.id,
        season: CURRENT_SEASON,
        status: 'setup',
      })
      .select().single()
    if (error) { setMsg({ t: 'err', v: error.message }); setBusy(false); return }
    const { error: tErr } = await supabase.from('teams').insert({
      league_id: lg.id, user_id: session.user.id,
      user_name: displayName, team_name: adminTeamName.trim(),
    })
    if (tErr) { setMsg({ t: 'err', v: tErr.message }); setBusy(false); return }
    setBusy(false); onDone()
  }

  const joinLeague = async () => {
    const code = joinCode.trim().toUpperCase()
    if (code.length !== 6) { setMsg({ t: 'err', v: 'Join codes are 6 characters.' }); return }
    if (!teamName.trim()) { setMsg({ t: 'err', v: 'Name your team first.' }); return }
    setBusy(true); setMsg(null)
    const { data: lg } = await supabase
      .from('leagues').select('*')
      .eq('join_code', code).eq('is_mock', false)
      .maybeSingle()
    if (!lg) { setMsg({ t: 'err', v: 'No league found with that code.' }); setBusy(false); return }
    if (lg.status !== 'setup') { setMsg({ t: 'err', v: 'This league is locked — joining is closed.' }); setBusy(false); return }
    const { count } = await supabase
      .from('teams').select('id', { count: 'exact', head: true })
      .eq('league_id', lg.id)
    if ((count || 0) >= MAX_TEAMS) { setMsg({ t: 'err', v: 'League is full (12 teams).' }); setBusy(false); return }
    const { error: tErr } = await supabase.from('teams').insert({
      league_id: lg.id, user_id: session.user.id,
      user_name: displayName, team_name: teamName.trim(),
    })
    if (tErr) {
      setMsg({ t: 'err', v: tErr.message.includes('duplicate') ? 'You already have a team in this league.' : tErr.message })
      setBusy(false); return
    }
    setBusy(false); onDone()
  }

  return (
    <>
      <div className="card">
        <h2>Join the League</h2>
        <p className="sub">Got a join code from the commissioner? Enter it and name your team.</p>
        <div className="field" style={{ marginBottom: 10 }}>
          <input className="input code" placeholder="JOIN CODE" maxLength={6}
            value={joinCode} onChange={e => setJoinCode(e.target.value)} />
        </div>
        <div className="field">
          <input className="input" placeholder="Your team name" maxLength={40}
            value={teamName} onChange={e => setTeamName(e.target.value)} />
          <button className="btn btn-primary" disabled={busy} onClick={joinLeague}>Join league</button>
        </div>
      </div>

      {isAdmin && (
        <div className="card admin-card">
          <h2>Commissioner: Create the League</h2>
          <p className="sub">Creates the league and generates a join code to share with the office.</p>
          <div className="field" style={{ marginBottom: 10 }}>
            <input className="input" placeholder="League name" maxLength={60}
              value={leagueName} onChange={e => setLeagueName(e.target.value)} />
          </div>
          <div className="field">
            <input className="input" placeholder="Your team name" maxLength={40}
              value={adminTeamName} onChange={e => setAdminTeamName(e.target.value)} />
            <button className="btn btn-turf" disabled={busy} onClick={createLeague}>Create league</button>
          </div>
        </div>
      )}

      {msg && <p className={`msg ${msg.t}`}>{msg.v}</p>}
    </>
  )
}

// ============================================================
// LEAGUE VIEW — loads live league + teams, routes to home or draft
// ============================================================
function LeagueView({ session, leagueId, initialLeague, myTeamId, isAdmin, isMock, onEnterMock, onExitMock, reloadTop }) {
  const [league, setLeague] = useState(initialLeague)
  const [teams, setTeams] = useState([])
  const [tab, setTab] = useState('home')
  const finalizedRef = useRef(false)

  // Self-healing roster finalizer: whenever the admin loads an ACTIVE league
  // whose week-1 rosters are missing, rebuild them from the draft picks.
  // (Lives here — not in DraftRoom — because DraftRoom unmounts the instant
  // the final pick flips the league to 'active'.)
  useEffect(() => {
    if (!league || league.status !== 'active' || teams.length === 0) return
    const amAdmin = isAdmin || league.admin_id === session.user.id
    if (!amAdmin || finalizedRef.current) return
    ;(async () => {
      const { count } = await supabase
        .from('rosters').select('id', { count: 'exact', head: true })
        .eq('league_id', league.id).eq('week', 1)
      if ((count || 0) > 0) { finalizedRef.current = true; return }
      const { data: picks } = await supabase
        .from('draft_picks').select('*').eq('league_id', league.id)
      if (!picks || picks.length === 0) return
      finalizedRef.current = true
      // fetch drafted players (in chunks — .in() has practical size limits)
      const ids = [...new Set(picks.map(p => p.player_id))]
      const playersById = {}
      for (let i = 0; i < ids.length; i += 300) {
        const { data: ps } = await supabase
          .from('players').select('*').in('id', ids.slice(i, i + 300))
        ;(ps || []).forEach(p => { playersById[p.id] = p })
      }
      const rows = []
      teams.forEach(team => {
        const teamPlayers = picks
          .filter(p => p.team_id === team.id)
          .map(p => playersById[p.player_id])
          .filter(Boolean)
          .sort((a, b) => (a.adp ?? 1e9) - (b.adp ?? 1e9))
        autoAssignSlots(teamPlayers).forEach(({ player_id, slot }) => {
          rows.push({ league_id: league.id, team_id: team.id, player_id, slot, week: 1 })
        })
      })
      for (let i = 0; i < rows.length; i += 200) {
        await supabase.from('rosters').insert(rows.slice(i, i + 200))
      }
    })()
  }, [league?.status, league?.id, teams.length]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let mounted = true
    const loadLeague = async () => {
      const { data } = await supabase.from('leagues').select('*').eq('id', leagueId).maybeSingle()
      if (mounted && data) setLeague(data)
    }
    const loadTeams = async () => {
      const { data } = await supabase
        .from('teams').select('*')
        .eq('league_id', leagueId)
        .order('created_at', { ascending: true })
      if (mounted) setTeams(data || [])
    }
    loadLeague(); loadTeams()
    const channel = supabase
      .channel(`league-${leagueId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'leagues', filter: `id=eq.${leagueId}` }, loadLeague)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'teams', filter: `league_id=eq.${leagueId}` }, loadTeams)
      .subscribe()
    return () => { mounted = false; supabase.removeChannel(channel) }
  }, [leagueId])

  if (!league) return <p>Loading league…</p>

  const isLeagueAdmin = isAdmin || league.admin_id === session.user.id
  const drafting = league.status === 'drafting'
  const active = league.status === 'active'

  return (
    <>
      {isMock && (
        <div className="mock-banner">
          MOCK DRAFT MODE — practice league, only visible to the commissioner. Nothing here touches the real league.
        </div>
      )}

      {active && (
        <div className="tabs">
          <button className={`tab ${tab === 'home' ? 'on' : ''}`} onClick={() => setTab('home')}>League</button>
          <button className={`tab ${tab === 'team' ? 'on' : ''}`} onClick={() => setTab('team')}>My Team</button>
          <button className={`tab ${tab === 'scores' ? 'on' : ''}`} onClick={() => setTab('scores')}>Scoreboard</button>
          <button className={`tab ${tab === 'standings' ? 'on' : ''}`} onClick={() => setTab('standings')}>Standings</button>
        </div>
      )}

      {drafting ? (
        <DraftRoom
          session={session}
          league={league}
          teams={teams}
          myTeamId={myTeamId}
          isLeagueAdmin={isLeagueAdmin}
          isMock={isMock}
        />
      ) : active && tab === 'team' ? (
        <TeamPage
          league={league}
          teams={teams}
          myTeamId={myTeamId}
          isLeagueAdmin={isLeagueAdmin}
        />
      ) : active && tab === 'scores' ? (
        <Scoreboard
          league={league}
          teams={teams}
          myTeamId={myTeamId}
          isLeagueAdmin={isLeagueAdmin}
        />
      ) : active && tab === 'standings' ? (
        <Standings league={league} teams={teams} myTeamId={myTeamId} />
      ) : (
        <LeagueHome
          league={league}
          teams={teams}
          myTeamId={myTeamId}
          isLeagueAdmin={isLeagueAdmin}
          isMock={isMock}
          session={session}
          onEnterMock={onEnterMock}
          onExitMock={onExitMock}
          reloadTop={reloadTop}
        />
      )}
    </>
  )
}

// ============================================================
// LEAGUE HOME
// ============================================================
function LeagueHome({ league, teams, myTeamId, isLeagueAdmin, isMock, session, onEnterMock, onExitMock, reloadTop }) {
  return (
    <>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2 style={{ fontSize: 36 }}>{league.name}</h2>
            <span className={`pill ${isMock ? 'mock' : league.status}`}>{isMock ? `mock · ${league.status}` : league.status}</span>
          </div>
          {isLeagueAdmin && !isMock && (
            <div style={{ textAlign: 'right' }}>
              <p className="sub" style={{ marginBottom: 6 }}>Share this code:</p>
              <div className="code-chip">{league.join_code}</div>
            </div>
          )}
        </div>
        <hr className="divider" />
        <p className="sub">{teams.length} of {MAX_TEAMS} teams in</p>
        <div className="teams-grid">
          {teams.map((t, i) => (
            <div key={t.id} className={`team-slot ${t.id === myTeamId ? 'mine' : ''}`}>
              <div className="num">TEAM {String(i + 1).padStart(2, '0')}</div>
              <div className="tname">{t.team_name}</div>
              <div className="uname">{t.user_name}</div>
            </div>
          ))}
          {Array.from({ length: Math.max(0, MAX_TEAMS - teams.length) }).map((_, i) => (
            <div key={`e-${i}`} className="team-slot empty">Open slot</div>
          ))}
        </div>
        {league.status === 'active' && (
          <>
            <hr className="divider" />
            <p className="sub">Draft complete — rosters are set. Weekly lineups and scoring arrive in Phase 3/4.</p>
          </>
        )}
      </div>

      {isLeagueAdmin && (
        <AdminPanel
          league={league}
          teams={teams}
          isMock={isMock}
          session={session}
          onEnterMock={onEnterMock}
          onExitMock={onExitMock}
          reloadTop={reloadTop}
        />
      )}
    </>
  )
}

// ============================================================
// ADMIN PANEL
// ============================================================
function AdminPanel({ league, teams, isMock, session, onEnterMock, onExitMock, reloadTop }) {
  const [seedMsg, setSeedMsg] = useState(null)
  const [seeding, setSeeding] = useState(false)
  const [busy, setBusy] = useState(false)
  const [playerCount, setPlayerCount] = useState(null)
  const [mockMsg, setMockMsg] = useState(null)

  useEffect(() => {
    supabase.from('players').select('id', { count: 'exact', head: true })
      .then(({ count }) => setPlayerCount(count ?? 0))
  }, [seeding])

  const toggleLock = async () => {
    setBusy(true)
    const next = league.status === 'setup' ? 'locked' : 'setup'
    await supabase.from('leagues').update({ status: next }).eq('id', league.id)
    setBusy(false)
  }

  const randomizeOrder = async () => {
    setBusy(true)
    const ids = teams.map(t => t.id)
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[ids[i], ids[j]] = [ids[j], ids[i]]
    }
    await supabase.from('leagues').update({ draft_order: ids, current_pick: 0 }).eq('id', league.id)
    setBusy(false)
  }

  const startDraft = async () => {
    setBusy(true)
    const deadline = new Date(Date.now() + DRAFT_PICK_TIMER * 1000).toISOString()
    await supabase.from('leagues').update({
      status: 'drafting', current_pick: 0, paused: false, pick_deadline: deadline,
    }).eq('id', league.id)
    setBusy(false)
  }

  const seedPlayers = async () => {
    setSeeding(true)
    setSeedMsg({ t: 'ok', v: 'Fetching player database from Sleeper… (~2MB, may take a moment)' })
    try {
      const res = await fetch('https://api.sleeper.app/v1/players/nfl')
      if (!res.ok) throw new Error(`Sleeper API returned ${res.status}`)
      const all = await res.json()
      const rows = Object.values(all)
        .filter(p => FANTASY_POSITIONS.includes(p.position) && (p.position === 'DEF' || p.active === true))
        .map(p => ({
          id: String(p.player_id),
          name: p.position === 'DEF'
            ? `${p.first_name || ''} ${p.last_name || ''}`.trim() || String(p.player_id)
            : p.full_name || `${p.first_name || ''} ${p.last_name || ''}`.trim(),
          position: p.position,
          nfl_team: p.team || null,
          // DEF entries have no search_rank — give them a synthetic rank so
          // they sort (bottom of board) and are draftable by autopick/bots.
          adp: p.position === 'DEF'
            ? 7000
            : (typeof p.search_rank === 'number' && p.search_rank < 9999999 ? p.search_rank : null),
          status: p.injury_status || (p.active ? 'active' : 'inactive'),
        }))
      const CHUNK = 500
      for (let i = 0; i < rows.length; i += CHUNK) {
        const { error } = await supabase.from('players').upsert(rows.slice(i, i + CHUNK))
        if (error) throw error
        setSeedMsg({ t: 'ok', v: `Upserting… ${Math.min(i + CHUNK, rows.length)} / ${rows.length}` })
      }
      setSeedMsg({ t: 'ok', v: `Done — ${rows.length} players seeded.` })
    } catch (err) {
      setSeedMsg({ t: 'err', v: `Seed failed: ${err.message}` })
    }
    setSeeding(false)
  }

  // ---------- 2025 SEASON DATA ----------
  const import2025 = async () => {
    setSeeding(true)
    setSeedMsg({ t: 'ok', v: 'Fetching 2025 season stats from Sleeper…' })
    try {
      const res = await fetch('https://api.sleeper.app/v1/stats/nfl/regular/2025')
      if (!res.ok) throw new Error(`Sleeper API returned ${res.status}`)
      const raw = await res.json()

      // Normalize: endpoint may return an object keyed by player_id OR an array of stat rows
      const statPairs = Array.isArray(raw)
        ? raw.map(r => [String(r.player_id ?? r.player?.player_id ?? ''), r.stats ?? r])
        : Object.entries(raw).map(([pid, s]) => [String(pid), s])
      const ptsById = new Map()
      statPairs.forEach(([pid, s]) => {
        // Half-PPR to match league scoring (fall back to standard if absent)
        const pts = s?.pts_half_ppr ?? s?.pts_std
        if (pid && typeof pts === 'number' && pts !== 0) {
          const gp = typeof s?.gp === 'number' && s.gp > 0 ? s.gp : null
          ptsById.set(pid, {
            pts: Math.round(pts * 10) / 10,
            avg: gp ? Math.round((pts / gp) * 10) / 10 : null,
          })
        }
      })
      if (ptsById.size === 0) throw new Error('No usable 2025 stats found in the response.')

      // Postgres checks NOT NULL on the incoming row BEFORE resolving the conflict,
      // so partial-column upserts ({id, pts}) always fail on this table.
      // Instead: read full player rows page by page, merge the 2025 numbers on,
      // and upsert the complete rows.
      let updated = 0
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase
          .from('players').select('*')
          .order('id', { ascending: true })
          .range(from, from + 999)
        if (error) throw error
        if (!data || data.length === 0) break
        const merged = data
          .filter(p => ptsById.has(String(p.id)))
          .map(p => ({
            ...p,
            last_season_pts: ptsById.get(String(p.id)).pts,
            last_season_avg: ptsById.get(String(p.id)).avg,
          }))
        if (merged.length > 0) {
          const { error: upErr } = await supabase
            .from('players').upsert(merged, { onConflict: 'id' })
          if (upErr) throw upErr
          updated += merged.length
        }
        setSeedMsg({ t: 'ok', v: `Updating… ${updated} players so far` })
        if (data.length < 1000) break
      }
      setSeedMsg({ t: 'ok', v: `Done — 2025 season points imported for ${updated} players.` })
    } catch (err) {
      setSeedMsg({ t: 'err', v: `2025 import failed: ${err.message}` })
    }
    setSeeding(false)
  }

  // ---------- MOCK DRAFT ----------
  const createMock = async () => {
    setBusy(true); setMockMsg({ t: 'ok', v: 'Building mock league…' })
    try {
      const { data: lg, error } = await supabase.from('leagues').insert({
        name: 'MOCK DRAFT (practice)',
        join_code: makeJoinCode(),
        admin_id: session.user.id,
        season: CURRENT_SEASON,
        status: 'setup',
        is_mock: true,
      }).select().single()
      if (error) throw error
      const displayName = session.user.user_metadata?.full_name?.split(' ')[0] || 'Commish'
      const rows = [{
        league_id: lg.id, user_id: session.user.id,
        user_name: displayName, team_name: 'My Mock Team',
      }]
      BOT_NAMES.forEach((bn, i) => {
        rows.push({
          league_id: lg.id,
          user_id: crypto.randomUUID(), // bot identity — never signs in
          user_name: `Bot ${String(i + 2).padStart(2, '0')}`,
          team_name: bn,
        })
      })
      const { error: tErr } = await supabase.from('teams').insert(rows)
      if (tErr) throw tErr
      setMockMsg({ t: 'ok', v: 'Mock league ready — 12 teams (you + 11 bots).' })
      await reloadTop()
      onEnterMock && onEnterMock()
    } catch (err) {
      setMockMsg({ t: 'err', v: `Mock setup failed: ${err.message}` })
    }
    setBusy(false)
  }

  const resetMock = async () => {
    if (!window.confirm('Delete the mock league and all its picks? The real league is untouched.')) return
    setBusy(true)
    try {
      // cascades remove teams/picks/rosters via FK on delete cascade
      const { error } = await supabase.from('leagues').delete().eq('id', league.id).eq('is_mock', true)
      if (error) throw error
      await reloadTop()
      onExitMock && onExitMock()
    } catch (err) {
      setMockMsg({ t: 'err', v: `Reset failed: ${err.message}` })
    }
    setBusy(false)
  }

  const orderNames = useMemo(() => {
    if (!league.draft_order) return null
    const byId = Object.fromEntries(teams.map(t => [t.id, t]))
    return league.draft_order.map(id => byId[id]?.team_name || '?')
  }, [league.draft_order, teams])

  // ---------- WEEK & LINEUP LOCK (active season) ----------
  const [weekMsg, setWeekMsg] = useState(null)

  const setLockNextSunday = async () => {
    const at = nextSunday1pmET()
    await supabase.from('leagues').update({ lineup_lock_at: at.toISOString() }).eq('id', league.id)
    setWeekMsg({ t: 'ok', v: `Lineups lock ${at.toLocaleString()} (your local time).` })
  }
  const clearLock = async () => {
    await supabase.from('leagues').update({ lineup_lock_at: null }).eq('id', league.id)
    setWeekMsg({ t: 'ok', v: 'Lineup lock cleared — lineups are editable.' })
  }
  const advanceWeek = async () => {
    setBusy(true)
    try {
      const cur = league.current_week || 1
      const next = cur + 1
      // Copy this week's rosters forward (skip if already copied)
      const { count } = await supabase
        .from('rosters').select('id', { count: 'exact', head: true })
        .eq('league_id', league.id).eq('week', next)
      if ((count || 0) === 0) {
        const { data: prev, error } = await supabase
          .from('rosters').select('*')
          .eq('league_id', league.id).eq('week', cur)
        if (error) throw error
        const rows = (prev || []).map(r => ({
          league_id: r.league_id, team_id: r.team_id,
          player_id: r.player_id, slot: r.slot, week: next,
        }))
        for (let i = 0; i < rows.length; i += 200) {
          const { error: insErr } = await supabase.from('rosters').insert(rows.slice(i, i + 200))
          if (insErr) throw insErr
        }
      }
      await supabase.from('leagues')
        .update({ current_week: next, lineup_lock_at: null })
        .eq('id', league.id)
      setWeekMsg({ t: 'ok', v: `Advanced to week ${next} — rosters carried over, lock cleared.` })
    } catch (err) {
      setWeekMsg({ t: 'err', v: `Advance failed: ${err.message}` })
    }
    setBusy(false)
  }

  const [scheduleMsg, setScheduleMsg] = useState(null)
  const [mockWeekInput, setMockWeekInput] = useState('5')

  const generateSchedule = async () => {
    setBusy(true)
    try {
      const { count } = await supabase
        .from('matchups').select('id', { count: 'exact', head: true })
        .eq('league_id', league.id)
      if ((count || 0) > 0) {
        setScheduleMsg({ t: 'err', v: 'Schedule already exists. Delete matchups in Supabase to regenerate.' })
      } else {
        const schedule = roundRobin(teams.map(t => t.id), 13)
        const rows = []
        schedule.forEach(({ week, pairs }) => {
          pairs.forEach(([home, away]) => {
            rows.push({ league_id: league.id, week, home_team_id: home, away_team_id: away })
          })
        })
        const { error } = await supabase.from('matchups').insert(rows)
        if (error) throw error
        setScheduleMsg({ t: 'ok', v: `Season schedule generated — ${rows.length} matchups across 13 weeks.` })
      }
    } catch (err) {
      setScheduleMsg({ t: 'err', v: `Schedule failed: ${err.message}` })
    }
    setBusy(false)
  }

  const setStatsSource = async (src) => {
    await supabase.from('leagues').update({ stats_source: src }).eq('id', league.id)
    setWeekMsg({ t: 'ok', v: src === 'live' ? 'Stats source: LIVE (current season).' : `Stats source: 2025 week ${src.split(':')[1]} (mock).` })
  }

  const canStart = league.draft_order && teams.length >= 2 &&
    (isMock || league.status === 'locked')

  return (
    <div className={`card ${isMock ? 'mock-card' : 'admin-card'}`}>
      <h2>{isMock ? 'Mock Draft Controls' : 'Commissioner Controls'}</h2>

      {!isMock && (
        <p className="sub">
          {playerCount === null ? 'Checking player database…'
            : playerCount > 0 ? `Player database: ${playerCount} players loaded.`
            : 'Player database is empty — run the seed before drafting.'}
        </p>
      )}

      <div className="admin-actions">
        {!isMock && (
          <>
            <button className="btn" disabled={seeding} onClick={seedPlayers}>
              {seeding ? 'Seeding…' : playerCount > 0 ? 'Re-seed players (Sleeper)' : 'Seed players (Sleeper)'}
            </button>
            <button className="btn" disabled={seeding || playerCount === 0} onClick={import2025}>
              Import 2025 season points
            </button>
            <button className="btn" disabled={busy} onClick={toggleLock}>
              {league.status === 'setup' ? 'Lock league (close joins)' : 'Unlock league (reopen joins)'}
            </button>
          </>
        )}
        <button className="btn" disabled={busy || (!isMock && league.status === 'setup')} onClick={randomizeOrder}>
          {league.draft_order ? 'Re-randomize draft order' : 'Randomize draft order'}
        </button>
        <button className="btn btn-primary" disabled={busy || !canStart} onClick={startDraft}>
          Start draft ({teams.length}/{MAX_TEAMS} teams)
        </button>
        {isMock && (
          <button className="btn" disabled={busy} onClick={resetMock}>Reset mock (delete + start over)</button>
        )}
      </div>

      {!isMock && league.status === 'setup' && (
        <p className="msg">Lock the league before randomizing the order and starting the draft.</p>
      )}

      {orderNames && (
        <>
          <hr className="divider" />
          <h3 className="display" style={{ fontSize: 20, marginBottom: 8 }}>Draft order (round 1)</h3>
          <ol className="order-list" style={{ paddingLeft: 20 }}>
            {orderNames.map((n, i) => <li key={i}>{n}</li>)}
          </ol>
        </>
      )}

      {league.status === 'active' && (
        <>
          <hr className="divider" />
          <h3 className="display" style={{ fontSize: 20, marginBottom: 8 }}>Week & lineup lock</h3>
          <p className="sub">
            Week {league.current_week || 1} ·{' '}
            {league.lineup_lock_at
              ? `lineups lock ${new Date(league.lineup_lock_at).toLocaleString()}`
              : 'no lineup lock set'}
          </p>
          <div className="admin-actions">
            <button className="btn" disabled={busy} onClick={setLockNextSunday}>Lock at Sunday 1pm ET</button>
            <button className="btn" disabled={busy || !league.lineup_lock_at} onClick={clearLock}>Clear lock</button>
            <button className="btn btn-turf" disabled={busy} onClick={advanceWeek}>
              Advance to week {(league.current_week || 1) + 1}
            </button>
          </div>
          {weekMsg && <p className={`msg ${weekMsg.t}`}>{weekMsg.v}</p>}

          <hr className="divider" />
          <h3 className="display" style={{ fontSize: 20, marginBottom: 8 }}>Season schedule & stats source</h3>
          <p className="sub">
            Stats source: <b>{(league.stats_source || 'live') === 'live'
              ? `LIVE — ${league.season || CURRENT_SEASON} week ${league.current_week || 1}`
              : `MOCK — 2025 week ${(league.stats_source || '').split(':')[1]}`}</b>
          </p>
          <div className="admin-actions">
            <button className="btn" disabled={busy} onClick={generateSchedule}>Generate season schedule (13 wks)</button>
            <button className="btn" disabled={busy} onClick={() => setStatsSource('live')}>Use live stats</button>
            <input
              className="input" style={{ maxWidth: 80, flex: 'none', padding: '8px 10px' }}
              type="number" min="1" max="18" value={mockWeekInput}
              onChange={e => setMockWeekInput(e.target.value)}
              aria-label="2025 week number"
            />
            <button className="btn btn-mock" disabled={busy}
              onClick={() => setStatsSource(`2025:${Math.min(18, Math.max(1, parseInt(mockWeekInput) || 1))}`)}>
              Use 2025 week (mock)
            </button>
          </div>
          {scheduleMsg && <p className={`msg ${scheduleMsg.t}`}>{scheduleMsg.v}</p>}
        </>
      )}

      {seedMsg && <p className={`msg ${seedMsg.t}`}>{seedMsg.v}</p>}

      {!isMock && (
        <>
          <hr className="divider" />
          <h3 className="display" style={{ fontSize: 20, marginBottom: 8, color: 'var(--mock)' }}>Mock Draft (practice)</h3>
          <p className="sub">
            Spin up a private practice league — you + 11 autopicking bots — to test the full draft
            end to end. Only you can see it. Reset and re-run as many times as you like.
          </p>
          <div className="admin-actions">
            {onEnterMock && !busy && (
              <button className="btn btn-mock" onClick={createMock} disabled={busy}>
                Start a mock draft
              </button>
            )}
          </div>
          {mockMsg && <p className={`msg ${mockMsg.t}`}>{mockMsg.v}</p>}
        </>
      )}
    </div>
  )
}

// ============================================================
// DRAFT ROOM
// ============================================================
function DraftRoom({ session, league, teams, myTeamId, isLeagueAdmin, isMock }) {
  const [players, setPlayers] = useState([])
  const [picks, setPicks] = useState([])
  const [search, setSearch] = useState('')
  const [posFilter, setPosFilter] = useState('ALL')
  const [now, setNow] = useState(Date.now())
  const [busyPick, setBusyPick] = useState(false)
  const [fastBots, setFastBotsState] = useState(() => {
    try { return localStorage.getItem('bolff_fast_bots') === '1' } catch { return false }
  }) // mock-only: bots pick every 200ms; remembered across refreshes
  const setFastBots = (v) => {
    setFastBotsState(v)
    try { localStorage.setItem('bolff_fast_bots', v ? '1' : '0') } catch { /* ignore */ }
  }
  const firedForPick = useRef({ pick: -1, at: 0 }) // guards duplicate autopick/bot fires per pick number

  const numTeams = league.draft_order?.length || teams.length
  const totalPicks = TOTAL_ROUNDS * numTeams
  const currentPick = league.current_pick ?? 0
  const draftDone = currentPick >= totalPicks

  const teamsById = useMemo(() => Object.fromEntries(teams.map(t => [t.id, t])), [teams])
  const onClockTeamId = !draftDone && league.draft_order
    ? league.draft_order[slotForPick(currentPick, numTeams)]
    : null
  const onClockTeam = onClockTeamId ? teamsById[onClockTeamId] : null
  const onClockIsMe = onClockTeamId === myTeamId
  const onClockIsBot = isMock && onClockTeam && onClockTeam.user_id !== session.user.id

  // ---- data loads ----
  useEffect(() => {
    let mounted = true
    ;(async () => {
      // Page through ALL players (Supabase caps responses at 1,000 rows)
      const all = []
      for (let from = 0; ; from += 1000) {
        const { data } = await supabase.from('players').select('*')
          .order('adp', { ascending: true, nullsFirst: false })
          .order('id', { ascending: true })
          .range(from, from + 999)
        if (!data || data.length === 0) break
        all.push(...data)
        if (data.length < 1000) break
      }
      if (mounted) setPlayers(all)
    })()
    return () => { mounted = false }
  }, [])

  const loadPicks = useCallback(async () => {
    const { data } = await supabase
      .from('draft_picks').select('*')
      .eq('league_id', league.id)
      .order('pick_number', { ascending: true })
    setPicks(data || [])
  }, [league.id])

  useEffect(() => {
    loadPicks()
    const channel = supabase
      .channel(`picks-${league.id}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'draft_picks', filter: `league_id=eq.${league.id}` },
        loadPicks)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [league.id, loadPicks])

  // ---- clock tick ----
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 400)
    return () => clearInterval(t)
  }, [])

  const deadlineMs = league.pick_deadline ? new Date(league.pick_deadline).getTime() : null
  const secondsLeft = deadlineMs && !league.paused
    ? Math.max(0, Math.ceil((deadlineMs - now) / 1000))
    : null

  const draftedSet = useMemo(() => new Set(picks.map(p => p.player_id)), [picks])
  const playersById = useMemo(() => Object.fromEntries(players.map(p => [p.id, p])), [players])

  // ---- make a pick (shared by manual, autopick, bots) ----
  const makePick = useCallback(async (teamId, playerId, pickNo) => {
    const round = Math.floor(pickNo / numTeams) + 1
    const { error } = await supabase.from('draft_picks').insert({
      league_id: league.id, team_id: teamId, player_id: playerId,
      round, pick_number: pickNo + 1, // 1-indexed for humans
    })
    if (error) return false // unique constraint = someone beat us to it; realtime will catch us up
    const nextPick = pickNo + 1
    const done = nextPick >= totalPicks
    await supabase.from('leagues').update({
      current_pick: nextPick,
      pick_deadline: done ? null : new Date(Date.now() + DRAFT_PICK_TIMER * 1000).toISOString(),
      ...(done ? { status: 'active' } : {}),
    }).eq('id', league.id)
    return true
  }, [league.id, numTeams, totalPicks])

  const manualPick = async (playerId) => {
    if (busyPick || draftDone) return
    const allowed = onClockIsMe || (isLeagueAdmin && (isMock || true)) // admin can pick on behalf
    if (!allowed) return
    setBusyPick(true)
    await makePick(onClockTeamId, playerId, currentPick)
    setBusyPick(false)
  }

  const doAutoPick = useCallback(async () => {
    if (draftDone || !onClockTeamId) return
    const teamPicks = picks
      .filter(p => p.team_id === onClockTeamId)
      .map(p => playersById[p.player_id])
      .filter(Boolean)
    const choice = bestAvailable(players, draftedSet, teamPicks)
    if (choice) await makePick(onClockTeamId, choice.id, currentPick)
  }, [draftDone, onClockTeamId, picks, playersById, players, draftedSet, makePick, currentPick])

  // ---- unified pick driver (bots + expired clock), driven by the ticking `now` ----
  // Fires when: a bot's short delay elapses (mock), or the 60s clock expires (any draft).
  // The "handled" flag is set only at the moment of firing, and retries every 3s,
  // so a cleaned-up render can never strand a pick at 0:00.
  useEffect(() => {
    if (draftDone || league.paused || !deadlineMs || !onClockTeamId) return
    if (players.length === 0 || busyPick) return
    const iDrive = isLeagueAdmin || onClockIsMe
    if (!iDrive) return
    const pickStartMs = deadlineMs - DRAFT_PICK_TIMER * 1000
    const botDelay = fastBots ? 200 : BOT_PICK_DELAY_MS
    const botDueMs = isMock && onClockIsBot ? pickStartMs + botDelay : Infinity
    const expired = now >= deadlineMs + 500
    if (!expired && now < botDueMs) return
    // fire at most once per pick per 3s window (retry if the pick didn't advance)
    const f = firedForPick.current
    if (f.pick === currentPick && now - f.at < 3000) return
    firedForPick.current = { pick: currentPick, at: now }
    doAutoPick()
  }, [now, deadlineMs, draftDone, league.paused, onClockTeamId, players.length, busyPick,
      isLeagueAdmin, onClockIsMe, onClockIsBot, isMock, currentPick, doAutoPick, fastBots])

  // ---- pause / resume (admin) ----
  const togglePause = async () => {
    if (league.paused) {
      await supabase.from('leagues').update({
        paused: false,
        pick_deadline: new Date(Date.now() + DRAFT_PICK_TIMER * 1000).toISOString(),
      }).eq('id', league.id)
    } else {
      await supabase.from('leagues').update({ paused: true, pick_deadline: null }).eq('id', league.id)
    }
  }

  // (Roster finalization moved to LeagueView — it must survive this
  //  component unmounting when the league flips to 'active'.)

  // ---- pool filtering ----
  const pool = useMemo(() => {
    const q = search.trim().toLowerCase()
    return players
      .filter(p => !draftedSet.has(p.id))
      .filter(p => posFilter === 'ALL' || p.position === posFilter)
      .filter(p => !q || p.name.toLowerCase().includes(q))
      .slice(0, 120)
  }, [players, draftedSet, posFilter, search])

  const myPicks = useMemo(() =>
    picks.filter(p => p.team_id === myTeamId).map(p => playersById[p.player_id]).filter(Boolean),
    [picks, myTeamId, playersById])

  const round = Math.min(TOTAL_ROUNDS, Math.floor(currentPick / numTeams) + 1)
  const pickInRound = (currentPick % numTeams) + 1
  const canDraftNow = !draftDone && !league.paused && (onClockIsMe || isLeagueAdmin)

  return (
    <>
      {isMock && (
        <div className="mock-banner" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <span>MOCK DRAFT — bots autopick their turns. You're {teamsById[myTeamId]?.team_name}.</span>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontWeight: 700 }}>
            <input type="checkbox" checked={fastBots} onChange={e => setFastBots(e.target.checked)} />
            Fast-forward bots
          </label>
        </div>
      )}

      <div className="draft-topbar">
        <div>
          <div className="roundinfo">
            {draftDone ? 'DRAFT COMPLETE' : `ROUND ${round} · PICK ${pickInRound} (${currentPick + 1}/${totalPicks})`}
          </div>
          {!draftDone && onClockTeam && (
            <div className="onclock">
              ON THE CLOCK: <b>{onClockTeam.team_name}</b>
              {onClockIsMe && ' — that\u2019s you!'}
              {league.paused && ' · PAUSED'}
            </div>
          )}
          {draftDone && <div className="onclock">Rosters are being finalized — head back to the league page.</div>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {!draftDone && (
            <div className={`clock ${league.paused ? 'paused' : ''} ${secondsLeft != null && secondsLeft <= 10 ? 'warn' : ''}`}>
              {league.paused ? '⏸' : secondsLeft != null ? `:${String(secondsLeft).padStart(2, '0')}` : '--'}
            </div>
          )}
          {isLeagueAdmin && !draftDone && (
            <button className="btn btn-sm" onClick={togglePause}>
              {league.paused ? 'Resume draft' : 'Pause draft'}
            </button>
          )}
        </div>
      </div>

      <div className="draft-layout">
        <div>
          <div className="pool-controls">
            <input className="input" style={{ minWidth: 220 }} placeholder="Search players…"
              value={search} onChange={e => setSearch(e.target.value)} />
            {['ALL', ...FANTASY_POSITIONS].map(pos => (
              <button key={pos} className={`chip ${posFilter === pos ? 'on' : ''}`}
                onClick={() => setPosFilter(pos)}>{pos}</button>
            ))}
          </div>
          <div className="pool">
            {pool.map(p => (
              <div key={p.id} className="pool-row">
                <span className="pname">{p.name}</span>
                <span className="pmeta">{p.position} · {p.nfl_team || 'FA'}</span>
                <span className="prank" title="2025 avg points/game (half-PPR)">
                  {p.last_season_avg != null ? `${p.last_season_avg} avg` : '—'}
                </span>
                <span className="prank" title="2025 total fantasy points (half-PPR)">
                  {p.last_season_pts != null ? `${p.last_season_pts} pts` : '—'}
                </span>
                <span className="prank">#{p.adp ?? '—'}</span>
                <button className="btn btn-xs btn-primary" disabled={!canDraftNow || busyPick}
                  onClick={() => manualPick(p.id)}>
                  Draft
                </button>
              </div>
            ))}
            {pool.length === 0 && <div className="pool-row">No players match.</div>}
          </div>
          {isLeagueAdmin && !draftDone && !onClockIsMe && (
            <p className="msg">Commish: drafting now picks on behalf of <b>{onClockTeam?.team_name}</b>.</p>
          )}
        </div>

        <div>
          <DraftAdvisor
            myPicks={myPicks}
            players={players}
            draftedSet={draftedSet}
            picksRemaining={TOTAL_ROUNDS - myPicks.length}
          />
          <CoachCard buildContext={() => {
            const myByPos = {}
            myPicks.forEach(p => { myByPos[p.position] = [...(myByPos[p.position] || []), p.name] })
            const rosterStr = FANTASY_POSITIONS
              .map(pos => `${pos}: ${(myByPos[pos] || []).join(', ') || 'none'}`).join('\n')
            const avail = players.filter(p => !draftedSet.has(p.id) && p.adp != null).slice(0, 15)
            const availStr = avail.map(p =>
              `${p.name} (${p.position} ${p.nfl_team || 'FA'}, rank #${p.adp}` +
              `${p.last_season_avg != null ? `, 2025 avg ${p.last_season_avg}` : ''})`
            ).join('\n')
            const recent = [...picks].slice(-6).map(p =>
              `#${p.pick_number} ${teamsById[p.team_id]?.team_name}: ` +
              `${playersById[p.player_id]?.name || '?'} (${playersById[p.player_id]?.position || '?'})`
            ).join('\n')
            return `Round ${round} of ${TOTAL_ROUNDS}, overall pick ${currentPick + 1}/${totalPicks}. ` +
              `My picks remaining: ${TOTAL_ROUNDS - myPicks.length}.\n` +
              `${onClockIsMe ? 'I AM ON THE CLOCK RIGHT NOW.' : `On the clock: ${onClockTeam?.team_name || 'n/a'}`}\n\n` +
              `MY ROSTER SO FAR:\n${rosterStr}\n\n` +
              `TOP AVAILABLE PLAYERS (by rank):\n${availStr}\n\n` +
              `LAST FEW PICKS:\n${recent || 'none yet'}`
          }} />
          <div className="side-card">
            <h3>Recent picks</h3>
            <div className="feed">
              {[...picks].reverse().slice(0, 30).map(p => (
                <div key={p.id} className="feed-row">
                  <b>#{p.pick_number}</b> {teamsById[p.team_id]?.team_name}: {playersById[p.player_id]?.name || p.player_id}
                  <span style={{ opacity: 0.6 }}> ({playersById[p.player_id]?.position})</span>
                </div>
              ))}
              {picks.length === 0 && <div className="feed-row">No picks yet — draft is live!</div>}
            </div>
          </div>
          <div className="side-card">
            <h3>My picks ({myPicks.length}/{TOTAL_ROUNDS})</h3>
            {myPicks.map(p => (
              <div key={p.id} className="roster-row">
                <span className="slot">{p.position}</span>
                <span>{p.name} · {p.nfl_team || 'FA'}</span>
              </div>
            ))}
            {myPicks.length === 0 && <p className="sub">Your picks will appear here.</p>}
          </div>
        </div>
      </div>

      <DraftBoard league={league} teams={teams} picks={picks} playersById={playersById} numTeams={numTeams} />
    </>
  )
}

// ============================================================
// DRAFT BOARD — full rounds × teams grid
// ============================================================
function DraftBoard({ league, teams, picks, playersById, numTeams }) {
  const [open, setOpen] = useState(true)
  const teamsById = useMemo(() => Object.fromEntries(teams.map(t => [t.id, t])), [teams])
  const order = league.draft_order || teams.map(t => t.id)
  const picksByNumber = useMemo(
    () => Object.fromEntries(picks.map(p => [p.pick_number, p])),
    [picks]
  )

  return (
    <div className="card" style={{ marginTop: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ marginBottom: 0 }}>Draft board</h2>
        <button className="btn btn-sm btn-ghost" onClick={() => setOpen(!open)}>
          {open ? 'Hide' : 'Show'}
        </button>
      </div>
      {open && (
        <div className="board-scroll">
          <table className="board">
            <thead>
              <tr>
                <th className="rnd">RD</th>
                {order.map(id => (
                  <th key={id}>{teamsById[id]?.team_name || '?'}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: TOTAL_ROUNDS }).map((_, r) => (
                <tr key={r}>
                  <td className="rnd">{r + 1}</td>
                  {order.map((teamId, col) => {
                    // snake: even rounds left→right, odd rounds right→left
                    const idxInRound = r % 2 === 0 ? col : numTeams - 1 - col
                    const overall = r * numTeams + idxInRound + 1 // 1-indexed pick_number
                    const pick = picksByNumber[overall]
                    const player = pick ? playersById[pick.player_id] : null
                    return (
                      <td key={teamId} className={player ? 'filled' : ''}>
                        {player ? (
                          <>
                            <div className="bp-name">{player.name}</div>
                            <div className="bp-meta">{player.position} · {player.nfl_team || 'FA'} · #{overall}</div>
                          </>
                        ) : (
                          <span className="bp-empty">#{overall}</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ============================================================
// TEAM PAGE — weekly lineup with tap-to-swap, lock, projections
// ============================================================
function TeamPage({ league, teams, myTeamId, isLeagueAdmin }) {
  const [roster, setRoster] = useState([])       // my roster rows for the current week
  const [playersById, setPlayersById] = useState({})
  const [proj, setProj] = useState({})           // player_id -> projected pts (half-PPR)
  const [selectedId, setSelectedId] = useState(null) // roster row id
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)

  const week = league.current_week || 1
  const lockMs = league.lineup_lock_at ? new Date(league.lineup_lock_at).getTime() : null
  const locked = lockMs != null && Date.now() >= lockMs
  const canEdit = !locked || isLeagueAdmin
  const myTeam = teams.find(t => t.id === myTeamId)

  const loadRoster = useCallback(async () => {
    const { data } = await supabase
      .from('rosters').select('*')
      .eq('league_id', league.id).eq('team_id', myTeamId).eq('week', week)
    const rows = data || []
    setRoster(rows)
    const ids = rows.map(r => r.player_id)
    if (ids.length) {
      const { data: ps } = await supabase.from('players').select('*').in('id', ids)
      setPlayersById(Object.fromEntries((ps || []).map(p => [p.id, p])))
    }
  }, [league.id, myTeamId, week])

  useEffect(() => { loadRoster() }, [loadRoster])

  // If the roster is empty, the finalizer may still be writing — retry briefly.
  useEffect(() => {
    if (roster.length > 0) return
    let tries = 0
    const t = setInterval(() => {
      tries += 1
      if (tries > 6) { clearInterval(t); return }
      loadRoster()
    }, 2000)
    return () => clearInterval(t)
  }, [roster.length, loadRoster])

  // Projections for this week (fetched live from Sleeper, half-PPR)
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const res = await fetch(`https://api.sleeper.app/v1/projections/nfl/regular/${league.season || CURRENT_SEASON}/${week}`)
        if (!res.ok) return
        const raw = await res.json()
        const pairs = Array.isArray(raw)
          ? raw.map(r => [String(r.player_id ?? r.player?.player_id ?? ''), r.stats ?? r])
          : Object.entries(raw).map(([pid, s]) => [String(pid), s])
        const map = {}
        pairs.forEach(([pid, s]) => {
          const pts = s?.pts_half_ppr ?? s?.pts_std
          if (pid && typeof pts === 'number') map[pid] = Math.round(pts * 10) / 10
        })
        if (mounted) setProj(map)
      } catch { /* projections are decorative — fail quietly */ }
    })()
    return () => { mounted = false }
  }, [league.season, week])

  const rowBySlot = useMemo(() => Object.fromEntries(roster.map(r => [r.slot, r])), [roster])

  const handleTap = async (target) => {
    // target: { row } for an occupied slot, or { emptySlot } for an open starter slot
    if (!canEdit || busy) return
    setMsg(null)

    // First tap: select a player
    if (!selectedId) {
      if (target.row) setSelectedId(target.row.id)
      return
    }
    const a = roster.find(r => r.id === selectedId)
    if (!a) { setSelectedId(null); return }

    // Tap self: deselect
    if (target.row && target.row.id === a.id) { setSelectedId(null); return }

    const pa = playersById[a.player_id]
    setBusy(true)
    try {
      if (target.emptySlot) {
        // Move into an open slot
        if (!slotAccepts(pa?.position, target.emptySlot)) {
          setMsg({ t: 'err', v: `${pa?.name || 'That player'} can't go in ${target.emptySlot}.` })
        } else {
          const { error } = await supabase.from('rosters')
            .update({ slot: target.emptySlot }).eq('id', a.id)
          if (error) throw error
          await loadRoster()
        }
      } else {
        // Swap two players
        const b = target.row
        const pb = playersById[b.player_id]
        if (!slotAccepts(pa?.position, b.slot) || !slotAccepts(pb?.position, a.slot)) {
          setMsg({ t: 'err', v: `That swap isn't position-legal (${pa?.position} ↔ ${pb?.position}).` })
        } else {
          // Delete both, reinsert with swapped slots (unique constraints prevent partial states)
          const core = r => ({ league_id: r.league_id, team_id: r.team_id, player_id: r.player_id, week: r.week })
          const { error: delErr } = await supabase.from('rosters').delete().in('id', [a.id, b.id])
          if (delErr) throw delErr
          const { error: insErr } = await supabase.from('rosters').insert([
            { ...core(a), slot: b.slot },
            { ...core(b), slot: a.slot },
          ])
          if (insErr) {
            // restore originals if the swap insert failed
            await supabase.from('rosters').insert([
              { ...core(a), slot: a.slot },
              { ...core(b), slot: b.slot },
            ])
            throw insErr
          }
          await loadRoster()
        }
      }
    } catch (err) {
      setMsg({ t: 'err', v: `Move failed: ${err.message}` })
      await loadRoster()
    }
    setSelectedId(null)
    setBusy(false)
  }

  const renderRow = (slot) => {
    const row = rowBySlot[slot]
    const p = row ? playersById[row.player_id] : null
    const isSel = row && row.id === selectedId
    return (
      <div
        key={slot}
        className={`lineup-row ${isSel ? 'sel' : ''} ${!row ? 'open' : ''} ${canEdit ? 'tappable' : ''}`}
        onClick={() => row ? handleTap({ row }) : handleTap({ emptySlot: slot })}
      >
        <span className="lslot">{slot}</span>
        {p ? (
          <>
            <span className="lname">{p.name}</span>
            <span className="lmeta">{p.position} · {p.nfl_team || 'FA'}</span>
            <span className="lproj">{proj[p.id] != null ? `${proj[p.id]} proj` : '—'}</span>
          </>
        ) : (
          <span className="lmeta">Empty — tap a player, then tap here</span>
        )}
      </div>
    )
  }

  const starterProj = ROSTER_SLOTS.reduce((sum, slot) => {
    const row = rowBySlot[slot]
    return sum + (row && proj[row.player_id] != null ? proj[row.player_id] : 0)
  }, 0)

  return (
    <>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2 style={{ fontSize: 32 }}>{myTeam?.team_name || 'My Team'}</h2>
            <span className="pill active">Week {week}</span>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p className="sub" style={{ marginBottom: 2 }}>Projected starters total</p>
            <div className="display" style={{ fontSize: 34 }}>{Math.round(starterProj * 10) / 10}</div>
          </div>
        </div>

        {locked && (
          <div className="lock-banner">
            Lineups are locked for week {week}
            {isLeagueAdmin ? ' — commissioner override active, edits still allowed.' : '.'}
          </div>
        )}
        {!locked && lockMs && (
          <p className="sub" style={{ marginTop: 8 }}>
            Lineups lock {new Date(lockMs).toLocaleString()}.
          </p>
        )}

        <hr className="divider" />
        <h3 className="display" style={{ fontSize: 20, marginBottom: 8 }}>Starters</h3>
        {ROSTER_SLOTS.map(renderRow)}

        <h3 className="display" style={{ fontSize: 20, margin: '18px 0 8px' }}>Bench</h3>
        {BENCH_SLOTS.map(renderRow)}

        {canEdit && (
          <p className="sub" style={{ marginTop: 12 }}>
            Tap a player, then tap another player (or an empty slot) to swap. Position rules apply.
          </p>
        )}
        {msg && <p className={`msg ${msg.t}`}>{msg.v}</p>}
      </div>
    </>
  )
}

// ============================================================
// DRAFT ADVISOR — flags roster gaps and recommends picks
// ============================================================
function DraftAdvisor({ myPicks, players, draftedSet, picksRemaining }) {
  const counts = {}
  myPicks.forEach(p => { counts[p.position] = (counts[p.position] || 0) + 1 })

  // Required starters: 1 QB, 2 RB, 2 WR, 1 TE, 1 K, 1 DEF (+1 FLEX from RB/WR/TE)
  const REQ = { QB: 1, RB: 2, WR: 2, TE: 1, K: 1, DEF: 1 }
  const missing = []
  Object.entries(REQ).forEach(([pos, n]) => {
    const gap = n - (counts[pos] || 0)
    for (let i = 0; i < gap; i++) missing.push(pos)
  })
  const skillCount = (counts.RB || 0) + (counts.WR || 0) + (counts.TE || 0)
  const skillReqMet = (counts.RB || 0) >= 2 && (counts.WR || 0) >= 2 && (counts.TE || 0) >= 1
  if (skillReqMet && skillCount < 6) missing.push('FLEX')

  const urgent = missing.length >= picksRemaining && missing.length > 0
  const distinctNeeds = [...new Set(missing.map(m => m === 'FLEX' ? null : m).filter(Boolean))]

  // Best available: at needed positions first, otherwise overall
  const availAll = players.filter(p => !draftedSet.has(p.id))
  const avail = availAll.filter(p => p.adp != null)
  const suggestions = []
  distinctNeeds.slice(0, 3).forEach(pos => {
    const best = avail.find(p => p.position === pos) || availAll.find(p => p.position === pos)
    if (best) suggestions.push({ ...best, why: `fills ${pos}` })
  })
  if (suggestions.length < 3) {
    for (const p of avail) {
      if (suggestions.length >= 3) break
      if (!suggestions.some(s => s.id === p.id)) {
        suggestions.push({ ...p, why: 'best available' })
      }
    }
  }

  // Summarize needs like "RB ×2, TE, K"
  const needSummary = Object.entries(
    missing.reduce((acc, m) => ({ ...acc, [m]: (acc[m] || 0) + 1 }), {})
  ).map(([pos, n]) => n > 1 ? `${pos} ×${n}` : pos).join(', ')

  return (
    <div className="side-card advisor">
      <h3>Draft advisor</h3>
      {missing.length === 0 ? (
        <p className="adv-ok">✓ All starting slots covered — draft best available for depth.</p>
      ) : (
        <p className={`adv-need ${urgent ? 'urgent' : ''}`}>
          {urgent ? '⚠ MUST FILL: ' : 'Still needed: '}{needSummary}
          <span className="adv-sub"> · {picksRemaining} pick{picksRemaining === 1 ? '' : 's'} left</span>
        </p>
      )}
      {suggestions.length > 0 && (
        <>
          <p className="adv-label">Suggested picks</p>
          {suggestions.map(s => (
            <div key={s.id} className="adv-row">
              <span className="adv-name">{s.name}</span>
              <span className="adv-meta">{s.position} · {s.nfl_team || 'FA'}</span>
              <span className="adv-why">{s.why}</span>
            </div>
          ))}
        </>
      )}
    </div>
  )
}

// ============================================================
// COACH SUNDAY — Claude-powered draft guru (via Supabase Edge Function)
// ============================================================
function CoachCard({ buildContext }) {
  const [q, setQ] = useState('')
  const [resp, setResp] = useState(null)
  const [err, setErr] = useState(null)
  const [loading, setLoading] = useState(false)

  const ask = async () => {
    if (loading) return
    setLoading(true); setErr(null)
    try {
      const { data, error } = await supabase.functions.invoke('draft-guru', {
        body: { context: buildContext(), question: q },
      })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      setResp(data?.text || 'Coach went quiet — try again.')
    } catch (e) {
      setErr(`Coach is off the air: ${e.message}`)
    }
    setLoading(false)
  }

  return (
    <div className="side-card coach">
      <h3>🏈 Coach Sunday</h3>
      <p className="sub" style={{ marginBottom: 8 }}>Your AI draft guru. He reads the board — ask him anything.</p>
      <div className="field" style={{ marginBottom: 8 }}>
        <input
          className="input" style={{ minWidth: 0, fontSize: 13, padding: '8px 10px' }}
          placeholder="Optional question… (or just ask for the call)"
          maxLength={300}
          value={q} onChange={e => setQ(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') ask() }}
        />
      </div>
      <button className="btn btn-sm btn-turf" disabled={loading} onClick={ask}>
        {loading ? 'Coach is thinking…' : "What's the call, Coach?"}
      </button>
      {resp && <div className="coach-say">{resp}</div>}
      {err && <p className="msg err">{err}</p>}
    </div>
  )
}

// ============================================================
// SCOREBOARD — live matchup scoring (polls Sleeper every 60s)
// ============================================================
function Scoreboard({ league, teams, myTeamId, isLeagueAdmin }) {
  const week = league.current_week || 1
  const source = league.stats_source || 'live'
  const [rosters, setRosters] = useState([])
  const [playersById, setPlayersById] = useState({})
  const [stats, setStats] = useState({})
  const [matchups, setMatchups] = useState([])
  const [lastFetch, setLastFetch] = useState(null)
  const [sim, setSim] = useState(false)
  const [simF, setSimF] = useState(1)
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)

  const { statsYear, statsWeek } = useMemo(() => {
    if (source.startsWith('2025:')) {
      return { statsYear: 2025, statsWeek: parseInt(source.split(':')[1], 10) || 1 }
    }
    return { statsYear: league.season || CURRENT_SEASON, statsWeek: week }
  }, [source, week, league.season])

  const teamsById = useMemo(() => Object.fromEntries(teams.map(t => [t.id, t])), [teams])

  // Load rosters (league-wide, this week) + player records + matchups
  useEffect(() => {
    let mounted = true
    ;(async () => {
      const { data: ro } = await supabase
        .from('rosters').select('*')
        .eq('league_id', league.id).eq('week', week)
      if (!mounted) return
      setRosters(ro || [])
      const ids = [...new Set((ro || []).map(r => r.player_id))]
      const byId = {}
      for (let i = 0; i < ids.length; i += 300) {
        const { data: ps } = await supabase
          .from('players').select('*').in('id', ids.slice(i, i + 300))
        ;(ps || []).forEach(p => { byId[p.id] = p })
      }
      if (mounted) setPlayersById(byId)
      const { data: mu } = await supabase
        .from('matchups').select('*')
        .eq('league_id', league.id).eq('week', week)
      if (mounted) setMatchups(mu || [])
    })()
    return () => { mounted = false }
  }, [league.id, week])

  // Poll Sleeper stats every 60s while this tab is open
  useEffect(() => {
    let mounted = true
    const fetchStats = async () => {
      try {
        const res = await fetch(`https://api.sleeper.app/v1/stats/nfl/regular/${statsYear}/${statsWeek}`)
        if (!res.ok) return
        const raw = await res.json()
        if (mounted) { setStats(normalizeSleeperStats(raw)); setLastFetch(new Date()) }
      } catch { /* transient network issues — next poll retries */ }
    }
    fetchStats()
    const t = setInterval(fetchStats, 60000)
    return () => { mounted = false; clearInterval(t) }
  }, [statsYear, statsWeek])

  // Simulated-live replay: reveal 0% -> 100% of the week's stats over ~3 min
  useEffect(() => {
    if (!sim) { setSimF(1); return }
    setSimF(0)
    const t = setInterval(() => {
      setSimF(f => {
        const next = Math.min(1, f + 0.028) // ~36 steps × 5s ≈ 3 min
        if (next >= 1) clearInterval(t)
        return next
      })
    }, 5000)
    return () => clearInterval(t)
  }, [sim])

  const starterRows = useMemo(
    () => rosters.filter(r => ROSTER_SLOTS.includes(r.slot)),
    [rosters]
  )

  const playerPts = useCallback((playerId) => {
    const p = playersById[playerId]
    return fantasyPoints(scaleStats(stats[playerId], simF), p?.position)
  }, [playersById, stats, simF])

  const teamScore = useCallback((teamId) => {
    const total = starterRows
      .filter(r => r.team_id === teamId)
      .reduce((sum, r) => sum + playerPts(r.player_id), 0)
    return Math.round(total * 100) / 100
  }, [starterRows, playerPts])

  const myMatchup = matchups.find(m => m.home_team_id === myTeamId || m.away_team_id === myTeamId)

  const finalizeWeek = async () => {
    if (!window.confirm(`Finalize week ${week} scores? This writes results and marks matchups complete.`)) return
    setBusy(true)
    try {
      // 1. per-player scores for all starters
      const scoreRows = starterRows.map(r => ({
        league_id: league.id, team_id: r.team_id, player_id: r.player_id,
        week, fantasy_points: playerPts(r.player_id),
        stats: stats[r.player_id] || null,
      }))
      for (let i = 0; i < scoreRows.length; i += 200) {
        const { error } = await supabase.from('scores')
          .upsert(scoreRows.slice(i, i + 200), { onConflict: 'league_id,team_id,player_id,week' })
        if (error) throw error
      }
      // 2. matchup results
      for (const m of matchups) {
        const { error } = await supabase.from('matchups').update({
          home_score: teamScore(m.home_team_id),
          away_score: teamScore(m.away_team_id),
          completed: true,
        }).eq('id', m.id)
        if (error) throw error
      }
      const { data: mu } = await supabase
        .from('matchups').select('*')
        .eq('league_id', league.id).eq('week', week)
      setMatchups(mu || [])
      setMsg({ t: 'ok', v: `Week ${week} finalized — standings updated.` })
    } catch (err) {
      setMsg({ t: 'err', v: `Finalize failed: ${err.message}` })
    }
    setBusy(false)
  }

  const renderMatchupRow = (m) => {
    const mine = m.home_team_id === myTeamId || m.away_team_id === myTeamId
    const hs = m.completed ? m.home_score : teamScore(m.home_team_id)
    const as = m.completed ? m.away_score : teamScore(m.away_team_id)
    return (
      <div key={m.id} className={`mu-row ${mine ? 'mine' : ''}`}>
        <span className={`mu-team ${hs > as ? 'lead' : ''}`}>{teamsById[m.home_team_id]?.team_name || '?'}</span>
        <span className="mu-score">{hs.toFixed(1)}</span>
        <span className="mu-vs">vs</span>
        <span className="mu-score">{as.toFixed(1)}</span>
        <span className={`mu-team away ${as > hs ? 'lead' : ''}`}>{teamsById[m.away_team_id]?.team_name || '?'}</span>
        {m.completed && <span className="mu-final">FINAL</span>}
      </div>
    )
  }

  const myStarters = starterRows.filter(r => r.team_id === myTeamId)

  return (
    <>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2 style={{ fontSize: 32 }}>Week {week} Scoreboard</h2>
            <span className={`pill ${source === 'live' ? 'active' : 'mock'}`}>
              {source === 'live' ? `live · ${statsYear}` : `mock · 2025 wk ${statsWeek}`}
            </span>
          </div>
          <div style={{ textAlign: 'right', fontSize: 12, opacity: 0.6 }}>
            {lastFetch ? `Stats updated ${lastFetch.toLocaleTimeString()}` : 'Fetching stats…'}
            <br />auto-refreshes every 60s
            {sim && simF < 1 && <><br /><b>SIMULATING: {Math.round(simF * 100)}% of game time</b></>}
          </div>
        </div>

        {matchups.length === 0 ? (
          <>
            <hr className="divider" />
            <p className="sub">No matchups for week {week} yet — the commissioner needs to generate the season schedule (Commissioner Controls → Generate season schedule).</p>
          </>
        ) : (
          <>
            <hr className="divider" />
            {matchups.map(renderMatchupRow)}
          </>
        )}

        {isLeagueAdmin && matchups.length > 0 && (
          <div className="admin-actions" style={{ marginTop: 14 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700 }}>
              <input type="checkbox" checked={sim} onChange={e => setSim(e.target.checked)} />
              Simulate live game (3-min replay)
            </label>
            <button className="btn btn-sm btn-primary" disabled={busy} onClick={finalizeWeek}>
              Finalize week {week}
            </button>
          </div>
        )}
        {msg && <p className={`msg ${msg.t}`}>{msg.v}</p>}
      </div>

      {myMatchup && (
        <div className="card">
          <h2>My starters</h2>
          {myStarters
            .sort((a, b) => ROSTER_SLOTS.indexOf(a.slot) - ROSTER_SLOTS.indexOf(b.slot))
            .map(r => {
              const p = playersById[r.player_id]
              return (
                <div key={r.id} className="lineup-row">
                  <span className="lslot">{r.slot}</span>
                  <span className="lname">{p?.name || r.player_id}</span>
                  <span className="lmeta">{p?.position} · {p?.nfl_team || 'FA'}</span>
                  <span className="lproj">{playerPts(r.player_id).toFixed(1)} pts</span>
                </div>
              )
            })}
        </div>
      )}
    </>
  )
}

// ============================================================
// STANDINGS — computed from completed matchups
// ============================================================
function Standings({ league, teams, myTeamId }) {
  const [matchups, setMatchups] = useState([])

  useEffect(() => {
    let mounted = true
    supabase.from('matchups').select('*')
      .eq('league_id', league.id).eq('completed', true)
      .then(({ data }) => { if (mounted) setMatchups(data || []) })
    return () => { mounted = false }
  }, [league.id])

  const rows = useMemo(() => {
    const rec = {}
    teams.forEach(t => { rec[t.id] = { team: t, w: 0, l: 0, t: 0, pf: 0, pa: 0 } })
    matchups.forEach(m => {
      const h = rec[m.home_team_id], a = rec[m.away_team_id]
      if (!h || !a) return
      h.pf += m.home_score; h.pa += m.away_score
      a.pf += m.away_score; a.pa += m.home_score
      if (m.home_score > m.away_score) { h.w++; a.l++ }
      else if (m.away_score > m.home_score) { a.w++; h.l++ }
      else { h.t++; a.t++ }
    })
    return Object.values(rec).sort((x, y) =>
      (y.w - x.w) || (y.pf - x.pf) // wins, then points-for (league tiebreaker)
    )
  }, [teams, matchups])

  return (
    <div className="card">
      <h2>Standings</h2>
      <p className="sub">Ranked by record, ties broken by points for. Top 6 make the playoffs (weeks 14-17).</p>
      <div className="board-scroll">
        <table className="board" style={{ minWidth: 560 }}>
          <thead>
            <tr><th>#</th><th>Team</th><th>W</th><th>L</th><th>T</th><th>PF</th><th>PA</th></tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.team.id} style={r.team.id === myTeamId ? { background: '#FDEBDD' } : undefined}>
                <td className="rnd">{i + 1}</td>
                <td className="filled"><span className="bp-name">{r.team.team_name}</span>
                  <div className="bp-meta">{r.team.user_name}{i < 6 ? ' · playoff spot' : ''}</div></td>
                <td>{r.w}</td><td>{r.l}</td><td>{r.t}</td>
                <td>{Math.round(r.pf * 10) / 10}</td><td>{Math.round(r.pa * 10) / 10}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
