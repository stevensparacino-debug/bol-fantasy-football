import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { supabase } from './supabase'

// ============================================================
// CONSTANTS
// ============================================================
const ADMIN_EMAIL = 'steven.sparacino@bol-agency.com'
const LOGO_URL = 'https://8835713.fs1.hubspotusercontent-na2.net/hubfs/8835713/BOL%20Branding/BOL%20Logos/BOL_Orange-Navy.png'
const BUILD = 'v7.3' // bump on every deploy — shown in footer so we always know what's live
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
  --bg: #0E121A;
  --surface: #151A25;
  --card: #1B2130;
  --raise: #232B3E;
  --text: #E7E7E9;
  --muted: #8B8586;
  --faint: #5D6577;
  --line: rgba(231,231,233,0.10);
  --line-strong: rgba(231,231,233,0.22);
  --orange: #F85E32;
  --cyan: #7BEDF8;
  --lime: #B0F436;
  --magenta: #DC2BDC;
  --red: #FF5A5A;
  --yellow: #EEFF41;
  --orange-soft: #FFB49C;
  --magenta-soft: #F2A9F2;
  --red-soft: #FFB1B1;
  --on-accent: #0E121A;
  /* legacy aliases used by inline styles */
  --ink: #E7E7E9;
  --cream: #0E121A;
  --chalk: #1B2130;
  --turf: #B0F436;
  --mock: #DC2BDC;
  --orange-dark: #F85E32;
}
[data-theme="light"] {
  --bg: #F5F6F8;
  --surface: #FFFFFF;
  --card: #FFFFFF;
  --raise: #E4E7EE;
  --text: #1B2130;
  --muted: #5D6577;
  --faint: #8B8F9C;
  --line: rgba(27,33,48,0.12);
  --line-strong: rgba(27,33,48,0.28);
  --orange: #E04B1D;
  --cyan: #0B8CA8;
  --lime: #5E9C0F;
  --magenta: #B21CB2;
  --red: #D53030;
  --yellow: #A38F00;
  --orange-soft: #9A3412;
  --magenta-soft: #8E1B8E;
  --red-soft: #B3261E;
  --on-accent: #FFFFFF;
  --ink: #1B2130;
  --cream: #F5F6F8;
  --chalk: #FFFFFF;
  --turf: #5E9C0F;
  --mock: #B21CB2;
  --orange-dark: #C23E14;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { background: var(--bg); color: var(--text); }
body { font-family: 'Archivo', sans-serif; -webkit-font-smoothing: antialiased; }
.app { min-height: 100vh; display: flex; flex-direction: column; }
::selection { background: var(--orange); color: var(--on-accent); }

.display {
  font-family: 'Archivo Narrow', 'Archivo', sans-serif;
  font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;
}

/* Header */
.header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 24px; background: var(--surface);
  border-bottom: 1px solid var(--line);
  position: sticky; top: 0; z-index: 20;
}
.header .logo { font-size: 22px; line-height: 1; letter-spacing: 0.08em; }
.header .logo span { color: var(--orange); }
.header .user { display: flex; align-items: center; gap: 12px; font-size: 13px; color: var(--muted); }

/* Layout */
.main { flex: 1; width: 100%; max-width: 1100px; margin: 0 auto; padding: 32px 20px 64px; }

/* Login */
.login-hero { text-align: center; padding: 10vh 16px 0; }
.login-hero h1 {
  font-size: clamp(56px, 13vw, 130px); line-height: 0.92;
  font-weight: 700; letter-spacing: 0.02em;
}
.login-hero h1 .accent { color: var(--orange); }
.login-hero p { margin: 22px auto 32px; max-width: 430px; font-size: 16px; color: var(--muted); }

/* Buttons */
.btn {
  font-family: 'Archivo', sans-serif; font-weight: 700; font-size: 13px;
  text-transform: uppercase; letter-spacing: 0.06em;
  padding: 11px 20px; border: 1px solid var(--line-strong); border-radius: 6px;
  background: transparent; color: var(--text); cursor: pointer;
  transition: border-color 0.12s, background 0.12s, color 0.12s;
}
.btn:hover { border-color: var(--orange); color: var(--orange); }
.btn:disabled { opacity: 0.35; cursor: not-allowed; }
.btn:disabled:hover { border-color: var(--line-strong); color: var(--text); }
.btn:focus-visible { outline: 2px solid var(--cyan); outline-offset: 2px; }
.btn-primary { background: var(--orange); border-color: var(--orange); color: var(--on-accent); }
.btn-primary:hover { filter: brightness(1.1); color: var(--on-accent); }
.btn-turf { background: var(--lime); border-color: var(--lime); color: var(--on-accent); }
.btn-turf:hover { filter: brightness(1.1); color: var(--on-accent); }
.btn-mock { background: var(--magenta); border-color: var(--magenta); color: #fff; }
.btn-mock:hover { background: #EE4BEE; border-color: #EE4BEE; color: #fff; }
.btn-sm { padding: 8px 14px; font-size: 12px; }
.btn-xs { padding: 5px 10px; font-size: 11px; }
.btn-ghost { border-color: transparent; color: var(--muted); }
.btn-ghost:hover { border-color: var(--line-strong); color: var(--text); }

/* Cards */
.card {
  background: var(--card); border: 1px solid var(--line); border-radius: 10px;
  padding: 24px; margin-bottom: 20px;
}
.card h2 {
  font-family: 'Archivo Narrow', sans-serif; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.05em; font-size: 24px; margin-bottom: 12px;
}
.card p.sub { font-size: 13px; color: var(--muted); margin-bottom: 16px; }
.admin-card { border-color: rgba(248,94,50,0.45); }
.admin-card h2 { color: var(--orange); }
.mock-card { border-color: rgba(220,43,220,0.5); }
.mock-card h2 { color: var(--magenta); }

/* Forms */
.field { display: flex; gap: 10px; flex-wrap: wrap; }
.input {
  flex: 1; min-width: 180px; font-family: 'Archivo', sans-serif; font-size: 14px;
  padding: 11px 14px; border: 1px solid var(--line-strong); border-radius: 6px;
  background: var(--surface); color: var(--text);
}
.input::placeholder { color: var(--faint); }
.input:focus-visible { outline: 2px solid var(--cyan); outline-offset: 1px; }
.input.code { text-transform: uppercase; letter-spacing: 0.3em; font-weight: 700; }
select.input { appearance: none; }

/* Join code chip */
.code-chip {
  display: inline-flex; align-items: center;
  font-family: 'Archivo Narrow', sans-serif; font-weight: 700;
  font-size: 28px; letter-spacing: 0.25em;
  background: var(--orange); color: var(--on-accent); padding: 8px 16px 8px 20px; border-radius: 6px;
}

/* Teams grid */
.teams-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; }
.team-slot {
  border: 1px solid var(--line); border-radius: 8px; padding: 14px;
  background: var(--surface);
}
.team-slot .num {
  font-family: 'Archivo Narrow', sans-serif; font-weight: 700;
  font-size: 11px; letter-spacing: 0.14em; color: var(--cyan);
}
.team-slot .tname { font-weight: 700; font-size: 15px; margin: 3px 0 1px; }
.team-slot .uname { font-size: 12px; color: var(--muted); }
.team-slot.empty {
  border-style: dashed; color: var(--faint); display: flex;
  align-items: center; justify-content: center; min-height: 74px; font-size: 12px;
  background: transparent;
}
.team-slot.mine { border-color: var(--orange); background: rgba(248,94,50,0.08); }

/* Status pills */
.pill {
  display: inline-block; font-size: 10px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.14em; padding: 4px 10px; border-radius: 999px;
}
.pill.setup { background: var(--yellow); color: var(--on-accent); }
.pill.locked { background: var(--orange); color: var(--on-accent); }
.pill.drafting { background: var(--cyan); color: var(--on-accent); }
.pill.active { background: var(--lime); color: var(--on-accent); }
.pill.mock { background: var(--magenta); color: #fff; }

.admin-actions { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 8px; align-items: center; }
.seed-status { font-size: 13px; margin-top: 10px; font-weight: 500; }
.msg { font-size: 13px; margin-top: 10px; font-weight: 600; }
.msg.err { color: var(--red); }
.msg.ok { color: var(--lime); }
.divider { border: none; border-top: 1px solid var(--line); margin: 22px 0; }
.footer { text-align: center; font-size: 11px; color: var(--faint); padding: 20px; letter-spacing: 0.08em; text-transform: uppercase; }

/* Tabs */
.tabs { display: flex; gap: 6px; margin-bottom: 20px; flex-wrap: wrap; }
.tab {
  font-family: 'Archivo Narrow', sans-serif; font-weight: 700; text-transform: uppercase;
  font-size: 14px; letter-spacing: 0.08em;
  padding: 9px 18px; border: 1px solid var(--line-strong); border-radius: 6px;
  background: transparent; color: var(--muted); cursor: pointer;
}
.tab:hover { color: var(--text); border-color: var(--text); }
.tab.on { background: var(--orange); border-color: var(--orange); color: var(--on-accent); }

/* Mock banner */
.mock-banner {
  background: rgba(220,43,220,0.14); border: 1px solid var(--magenta); color: var(--magenta-soft);
  text-align: center; font-weight: 600; font-size: 12px; letter-spacing: 0.04em;
  padding: 9px 16px; border-radius: 8px; margin-bottom: 16px;
}
.mock-banner .btn { color: var(--text); }

/* Draft topbar */
.draft-topbar {
  display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap;
  background: var(--surface); border: 1px solid var(--line);
  border-left: 4px solid var(--orange);
  border-radius: 10px; padding: 16px 20px; margin-bottom: 20px;
}
.draft-topbar .roundinfo {
  font-family: 'Archivo Narrow', sans-serif; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.08em; font-size: 18px;
}
.draft-topbar .onclock { font-size: 13px; color: var(--muted); margin-top: 3px; }
.draft-topbar .onclock b { color: var(--orange); font-size: 15px; }
.clock {
  font-family: 'Archivo Narrow', sans-serif; font-weight: 700;
  font-size: 42px; line-height: 1; min-width: 84px; text-align: center;
  color: var(--cyan); font-variant-numeric: tabular-nums;
}
.clock.warn { color: var(--red); }
.clock.paused { opacity: 0.4; }

/* Draft layout */
.draft-layout { display: grid; grid-template-columns: 1fr 320px; gap: 20px; }
@media (max-width: 860px) { .draft-layout { grid-template-columns: 1fr; } }

.pool-controls { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
.chip {
  font-size: 11px; font-weight: 700; letter-spacing: 0.08em;
  padding: 7px 13px; border: 1px solid var(--line-strong);
  border-radius: 999px; background: transparent; color: var(--muted); cursor: pointer;
}
.chip:hover { color: var(--text); border-color: var(--text); }
.chip.on { background: var(--text); border-color: var(--text); color: var(--surface); }

.pool { max-height: 520px; overflow-y: auto; border: 1px solid var(--line); border-radius: 8px; background: var(--surface); }
.pool-row {
  display: flex; align-items: center; gap: 10px; padding: 10px 14px;
  border-bottom: 1px solid var(--line); font-size: 13px;
  border-left: 3px solid transparent;
}
.pool-row:last-child { border-bottom: none; }
.pool-row .pname { font-weight: 700; flex: 1; }
.pool-row .pmeta { font-size: 11px; color: var(--muted); min-width: 82px; }
.pool-row .prank { font-size: 11px; color: var(--faint); min-width: 60px; text-align: right; font-variant-numeric: tabular-nums; }

/* Position color coding (matches UI kit draft board) */
.pos-QB { border-left-color: var(--orange) !important; }
.pos-RB { border-left-color: var(--cyan) !important; }
.pos-WR { border-left-color: var(--lime) !important; }
.pos-TE { border-left-color: var(--magenta) !important; }
.pos-K { border-left-color: var(--yellow) !important; }
.pos-DEF { border-left-color: var(--faint) !important; }

/* Sidebar cards */
.side-card {
  background: var(--card); border: 1px solid var(--line);
  border-radius: 10px; padding: 16px; margin-bottom: 16px;
}
.side-card h3 {
  font-family: 'Archivo Narrow', sans-serif; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.08em; font-size: 15px; margin-bottom: 10px;
}
.feed { max-height: 260px; overflow-y: auto; font-size: 12px; }
.feed-row { padding: 6px 0; border-bottom: 1px solid var(--line); color: var(--muted); }
.feed-row b { color: var(--orange); }
.roster-row { display: flex; gap: 8px; font-size: 12px; padding: 4px 0; }
.roster-row .slot { font-weight: 700; min-width: 42px; color: var(--cyan); }
.order-list { font-size: 13px; color: var(--muted); }
.order-list li { padding: 4px 0; }

/* Draft board table */
.board-scroll { overflow-x: auto; margin-top: 16px; }
.board { border-collapse: collapse; width: 100%; min-width: 900px; font-size: 11px; }
.board th, .board td { border: 1px solid var(--line); padding: 6px 8px; text-align: left; vertical-align: top; }
.board th {
  font-family: 'Archivo Narrow', sans-serif; font-weight: 700; text-transform: uppercase;
  font-size: 11px; letter-spacing: 0.08em;
  background: var(--surface); color: var(--muted); position: sticky; top: 0;
}
.board .rnd { width: 34px; text-align: center; font-weight: 700; background: var(--surface); color: var(--faint); }
.board td { background: var(--surface); border-left: 3px solid transparent; }
.board td.filled { background: var(--card); }
.board .bp-name { font-weight: 700; }
.board .bp-meta { color: var(--faint); font-size: 10px; }
.board .bp-empty { color: var(--faint); opacity: 0.5; }

/* Lineup rows */
.lineup-row {
  display: flex; align-items: center; gap: 12px; padding: 10px 12px;
  border: 1px solid var(--line); border-left: 3px solid transparent;
  border-radius: 6px; margin-bottom: 6px;
  background: var(--surface); font-size: 13px;
}
.lineup-row.tappable { cursor: pointer; }
.lineup-row.tappable:hover { border-color: var(--line-strong); }
.lineup-row.sel { border-color: var(--orange); background: rgba(248,94,50,0.10); }
.lineup-row.open { border-style: dashed; background: transparent; }
.lineup-row .lslot {
  font-family: 'Archivo Narrow', sans-serif; font-weight: 700;
  font-size: 12px; letter-spacing: 0.06em; min-width: 44px; color: var(--cyan);
}
.lineup-row .lname { font-weight: 700; flex: 1; }
.lineup-row .lmeta { font-size: 11px; color: var(--muted); }
.lineup-row .lproj { font-size: 12px; font-weight: 700; min-width: 70px; text-align: right; color: var(--cyan); font-variant-numeric: tabular-nums; }

.lock-banner {
  margin-top: 12px; padding: 10px 14px; border-radius: 6px;
  background: rgba(248,94,50,0.14); border: 1px solid var(--orange);
  color: var(--orange-soft); font-weight: 600; font-size: 13px;
}

/* Draft advisor */
.advisor { border-color: rgba(176,244,54,0.4); }
.adv-ok { font-size: 12px; font-weight: 700; color: var(--lime); }
.adv-need { font-size: 12px; font-weight: 700; }
.adv-need.urgent { color: var(--red); }
.adv-sub { font-weight: 400; color: var(--faint); }
.adv-label {
  font-size: 10px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.14em; margin: 10px 0 6px; color: var(--faint);
}
.adv-row { display: flex; align-items: baseline; gap: 8px; font-size: 12px; padding: 4px 0; border-bottom: 1px solid var(--line); }
.adv-row:last-child { border-bottom: none; }
.adv-name { font-weight: 700; flex: 1; }
.adv-meta { font-size: 10px; color: var(--muted); }
.adv-why { font-size: 10px; color: var(--lime); font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; }

/* Coach */
.coach { border-color: rgba(248,94,50,0.4); }
.coach-say {
  margin-top: 10px; padding: 10px 12px; border-radius: 6px;
  background: var(--surface); border-left: 3px solid var(--orange);
  font-size: 13px; line-height: 1.55; white-space: pre-wrap; color: var(--text);
}

/* Scoreboard */
.mu-row {
  display: flex; align-items: center; gap: 10px; padding: 12px;
  border: 1px solid var(--line); border-radius: 8px; margin-bottom: 8px;
  background: var(--surface); font-size: 13px;
}
.mu-row.mine { border-color: var(--orange); background: rgba(248,94,50,0.08); }
.mu-team { font-weight: 700; flex: 1; }
.mu-team.away { text-align: right; }
.mu-team.lead { color: var(--lime); }
.mu-score {
  font-family: 'Archivo Narrow', sans-serif; font-weight: 700;
  font-size: 24px; min-width: 62px; text-align: center; color: var(--cyan);
  font-variant-numeric: tabular-nums;
}
.mu-vs { font-size: 10px; color: var(--faint); }
.mu-final {
  font-size: 9px; font-weight: 700; letter-spacing: 0.14em;
  background: var(--lime); color: var(--on-accent); padding: 3px 7px; border-radius: 4px;
}

/* Trades / transactions */
.trade-row {
  display: flex; align-items: center; gap: 12px; padding: 10px 12px;
  border: 1px solid var(--line); border-radius: 8px; margin-bottom: 8px;
  background: var(--surface); font-size: 13px; flex-wrap: wrap;
}
.trade-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
@media (max-width: 700px) { .trade-grid { grid-template-columns: 1fr; } }
.txn-row { font-size: 13px; padding: 7px 0; border-bottom: 1px solid var(--line); color: var(--muted); }
.txn-row:last-child { border-bottom: none; }
.txn-row .when { font-size: 11px; color: var(--faint); }
.drop-picker { margin-top: 14px; padding-top: 6px; border-top: 1px dashed var(--line-strong); }

/* Scrollbars */
::-webkit-scrollbar { width: 10px; height: 10px; }
::-webkit-scrollbar-track { background: var(--surface); }
::-webkit-scrollbar-thumb { background: var(--raise); border-radius: 5px; }
::-webkit-scrollbar-thumb:hover { background: var(--faint); }

/* ---------- Kit: draft command bar ---------- */
.dt-cell { display: flex; flex-direction: column; gap: 2px; min-width: 90px; }
.dt-grow { flex: 1; min-width: 160px; }
.dt-label {
  font-size: 9px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.16em; color: var(--faint);
}
.dt-big {
  font-family: 'Archivo Narrow', sans-serif; font-weight: 700;
  font-size: 34px; line-height: 1; color: var(--orange); font-variant-numeric: tabular-nums;
}
.dt-team { font-weight: 700; font-size: 16px; }
.dt-sub { font-size: 11px; color: var(--muted); }
.dt-upnext { min-width: 150px; }

/* ---------- Kit: draft board card grid ---------- */
.bb-legend { display: flex; gap: 12px; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; color: var(--muted); margin-top: 4px; }
.bb-legend span { display: inline-flex; align-items: center; gap: 4px; }
.sw { display: inline-block; width: 8px; height: 8px; border-radius: 2px; }
.pos-sw-QB { background: var(--orange); } .pos-sw-RB { background: var(--cyan); }
.pos-sw-WR { background: var(--lime); } .pos-sw-TE { background: var(--magenta); }
.pos-sw-K { background: var(--yellow); } .pos-sw-DEF { background: var(--faint); }
.bb-grid { display: grid; gap: 4px; margin-top: 14px; min-width: 1200px; }
.bb-head {
  font-family: 'Archivo Narrow', sans-serif; font-weight: 700; text-transform: uppercase;
  font-size: 10px; letter-spacing: 0.08em; color: var(--muted);
  padding: 6px 4px; text-align: center; line-height: 1.25;
  border-bottom: 1px solid var(--line-strong);
}
.bb-rnd {
  display: flex; align-items: center; justify-content: center;
  font-family: 'Archivo Narrow', sans-serif; font-weight: 700; font-size: 12px; color: var(--faint);
}
.bb-cell {
  background: var(--surface); border: 1px solid var(--line); border-radius: 6px;
  border-top: 3px solid transparent; padding: 7px 8px; min-height: 52px;
}
.bb-cell.bb-filled.pos-QB { border-top-color: var(--orange); border-left-color: var(--line); }
.bb-cell.bb-filled.pos-RB { border-top-color: var(--cyan); border-left-color: var(--line); }
.bb-cell.bb-filled.pos-WR { border-top-color: var(--lime); border-left-color: var(--line); }
.bb-cell.bb-filled.pos-TE { border-top-color: var(--magenta); border-left-color: var(--line); }
.bb-cell.bb-filled.pos-K { border-top-color: var(--yellow); border-left-color: var(--line); }
.bb-cell.bb-filled.pos-DEF { border-top-color: var(--faint); border-left-color: var(--line); }
.bb-cell.bb-filled { background: var(--card); }
.bb-cell.bb-live { border-color: var(--orange); background: rgba(248,94,50,0.10); }
.bb-name { font-weight: 700; font-size: 11px; line-height: 1.25; }
.bb-meta { font-size: 9px; color: var(--faint); margin-top: 2px; letter-spacing: 0.02em; }

/* ---------- Kit: dashboard hero ---------- */
.hero-card { border-left: 4px solid var(--orange); }
.hero-top { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 12px; }
.hero-grid { display: grid; grid-template-columns: 1fr auto 1fr; gap: 14px; align-items: center; }
.hero-side.away { text-align: right; }
.hero-team { font-weight: 700; font-size: 16px; }
.hero-mgr { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.06em; }
.hero-score {
  font-family: 'Archivo Narrow', sans-serif; font-weight: 700;
  font-size: 44px; line-height: 1.05; color: var(--cyan); font-variant-numeric: tabular-nums;
}
.hero-proj { font-size: 11px; color: var(--faint); font-weight: 700; letter-spacing: 0.06em; }
.hero-mid { display: flex; flex-direction: column; align-items: center; gap: 6px; min-width: 90px; }
.winbar { width: 90px; height: 6px; border-radius: 3px; background: var(--raise); overflow: hidden; }
.winbar-fill { height: 100%; background: var(--lime); }
.hero-win { font-size: 10px; font-weight: 700; color: var(--lime); letter-spacing: 0.1em; }

.alert-banner {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  margin-top: 14px; padding: 10px 12px; border-radius: 6px; font-size: 12px;
  background: rgba(248,94,50,0.12); border: 1px solid var(--orange); color: var(--orange-soft);
}
.alert-banner b { letter-spacing: 0.1em; }

.stat-strip {
  display: flex; gap: 0; margin-top: 14px;
  border: 1px solid var(--line); border-radius: 8px; overflow: hidden;
}
.stat-strip > div {
  flex: 1; display: flex; flex-direction: column; gap: 2px;
  padding: 10px 12px; background: var(--surface);
  border-right: 1px solid var(--line);
}
.stat-strip > div:last-child { border-right: none; }
.stat-strip b {
  font-family: 'Archivo Narrow', sans-serif; font-size: 18px;
  font-variant-numeric: tabular-nums;
}

/* ---------- Kit: team page table ---------- */
.tp-header { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px; }
.tp-thead {
  display: flex; align-items: center; gap: 12px; padding: 4px 12px 8px;
  font-size: 9px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.14em; color: var(--faint);
}
.tp-col { font-size: 12px; min-width: 44px; text-align: right; color: var(--muted); font-variant-numeric: tabular-nums; }
.tp-pts { color: var(--cyan); font-weight: 700; }

/* ---------- Kit: bottom navigation (mobile) ---------- */
.bottom-nav {
  display: none;
  position: fixed; left: 0; right: 0; bottom: 0; z-index: 40;
  background: var(--surface); border-top: 1px solid var(--line-strong);
  padding: 6px 4px calc(6px + env(safe-area-inset-bottom));
}
.bn-item {
  flex: 1; background: transparent; border: none; cursor: pointer;
  font-family: 'Archivo Narrow', sans-serif; font-weight: 700; text-transform: uppercase;
  font-size: 11px; letter-spacing: 0.1em; color: var(--faint);
  padding: 10px 2px; border-radius: 6px;
}
.bn-item.on { color: var(--orange); }
@media (max-width: 860px) {
  .bottom-nav { display: flex; }
  .top-tabs { display: none; }
  .main { padding-bottom: 110px; }
  .footer { padding-bottom: 70px; }
}
.strip-link { cursor: pointer; }
.strip-link:hover b { color: var(--orange); }

/* ---------- Kit: feed ---------- */
.feed-post {
  border: 1px solid var(--line); border-radius: 8px; background: var(--surface);
  padding: 12px 14px; margin-bottom: 8px;
}
.feed-post.move { border-left: 3px solid var(--cyan); }
.fp-head { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
.fp-head b { font-size: 13px; }
.fp-meta { font-size: 10px; color: var(--faint); letter-spacing: 0.08em; }
.fp-body { font-size: 13px; margin-top: 4px; color: var(--text); line-height: 1.45; }

/* ---------- Kit: draft countdown ---------- */
.cd-grid { display: flex; gap: 10px; margin-top: 6px; }
.cd-cell {
  flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px;
  background: var(--surface); border: 1px solid var(--line); border-radius: 8px;
  padding: 14px 8px;
}
.cd-num {
  font-family: 'Archivo Narrow', sans-serif; font-weight: 700;
  font-size: clamp(32px, 8vw, 52px); line-height: 1; color: var(--orange);
  font-variant-numeric: tabular-nums;
}
.cd-tbd { font-size: 14px; color: var(--muted); }
.cd-live {
  font-family: 'Archivo Narrow', sans-serif; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.06em; font-size: 22px; color: var(--lime);
}

/* ---------- Logo ---------- */
.logo-wrap { display: flex; align-items: center; gap: 12px; }
.logo-badge {
  display: inline-flex; align-items: center; justify-content: center;
  background: #FFFFFF; border-radius: 6px; padding: 5px 9px;
}
.logo-img { height: 24px; display: block; }
.login-logo { margin-bottom: 24px; padding: 8px 14px; }

@media (prefers-reduced-motion: reduce) { .btn, .tab, .chip { transition: none; } }
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
  const avail = players.filter(p =>
    !draftedSet.has(p.id) && (p.nfl_team != null || p.adp != null))
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

// Load every player row (paginated past the 1,000-row cap)
async function loadAllPlayers() {
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
  return all
}

// Auto-complete an entire draft (mock testing): fills every remaining pick
// with the same bestAvailable logic autopick uses, then activates the league.
async function runInstantDraft(league, teams) {
  let order = league.draft_order
  if (!order || order.length === 0) {
    order = teams.map(t => t.id)
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[order[i], order[j]] = [order[j], order[i]]
    }
    const { error } = await supabase.from('leagues')
      .update({ draft_order: order }).eq('id', league.id)
    if (error) throw error
  }
  const players = await loadAllPlayers()
  const pById = Object.fromEntries(players.map(p => [p.id, p]))
  const { data: existing, error: exErr } = await supabase
    .from('draft_picks').select('*').eq('league_id', league.id)
  if (exErr) throw exErr
  const drafted = new Set((existing || []).map(p => p.player_id))
  const byTeam = {}
  ;(existing || []).forEach(p => {
    const pl = pById[p.player_id]
    if (pl) (byTeam[p.team_id] = byTeam[p.team_id] || []).push(pl)
  })
  const numTeams = order.length
  const total = TOTAL_ROUNDS * numTeams
  const rows = []
  for (let n = (existing || []).length; n < total; n++) {
    const teamId = order[slotForPick(n, numTeams)]
    const teamPicks = byTeam[teamId] = byTeam[teamId] || []
    const choice = bestAvailable(players, drafted, teamPicks)
    if (!choice) break
    drafted.add(choice.id)
    teamPicks.push(choice)
    rows.push({
      league_id: league.id, team_id: teamId, player_id: choice.id,
      round: Math.floor(n / numTeams) + 1, pick_number: n + 1,
    })
  }
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await supabase.from('draft_picks').insert(rows.slice(i, i + 200))
    if (error) throw error
  }
  const { error: upErr } = await supabase.from('leagues').update({
    current_pick: total, status: 'active', pick_deadline: null, paused: false,
  }).eq('id', league.id)
  if (upErr) throw upErr
  return rows.length
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
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('bolff_theme') || 'dark' } catch { return 'dark' }
  })

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try { localStorage.setItem('bolff_theme', theme) } catch { /* ignore */ }
  }, [theme])
  const toggleTheme = () => setTheme(t => (t === 'dark' ? 'light' : 'dark'))

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
          <div className="logo-wrap">
            <span className="logo-badge"><img className="logo-img" src={LOGO_URL} alt="BOL Agency" /></span>
            <span className="display logo"><span>FANTASY</span> FOOTBALL</span>
          </div>
          <div className="user">
            <button className="btn btn-sm btn-ghost" onClick={toggleTheme}
              title="Toggle light/dark" aria-label="Toggle light/dark mode">
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
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
        {!session && (
          <>
            <button className="btn btn-sm btn-ghost" onClick={toggleTheme}
              style={{ position: 'fixed', top: 14, right: 16, zIndex: 30 }}
              title="Toggle light/dark" aria-label="Toggle light/dark mode">
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <LoginScreen onLogin={handleLogin} />
          </>
        )}

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
      <span className="logo-badge login-logo"><img className="logo-img" src={LOGO_URL} alt="BOL Agency" style={{ height: 40 }} /></span>
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

  // Trade processor: accepted trades are executed by the admin's client
  // (RLS only lets the admin write both teams' rosters). Runs on load and
  // whenever a trade row changes.
  const [tradeTick, setTradeTick] = useState(0)
  useEffect(() => {
    const channel = supabase
      .channel(`trades-${leagueId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'trades', filter: `league_id=eq.${leagueId}` },
        () => setTradeTick(t => t + 1))
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [leagueId])

  useEffect(() => {
    if (!league || league.status !== 'active') return
    const amAdmin = isAdmin || league.admin_id === session.user.id
    if (!amAdmin) return
    ;(async () => {
      const { data: accepted } = await supabase
        .from('trades').select('*')
        .eq('league_id', league.id).eq('status', 'accepted')
      for (const tr of (accepted || [])) {
        try {
          const week = league.current_week || 1
          const give = tr.from_player_ids || []   // proposer sends these
          const get = tr.to_player_ids || []      // proposer receives these
          const involved = [...give, ...get]
          const { data: rows } = await supabase
            .from('rosters').select('*')
            .eq('league_id', league.id).eq('week', week)
            .in('player_id', involved)
          const fromRows = (rows || []).filter(r => r.team_id === tr.from_team_id && give.includes(r.player_id))
          const toRows = (rows || []).filter(r => r.team_id === tr.to_team_id && get.includes(r.player_id))
          if (fromRows.length !== give.length || toRows.length !== get.length) {
            await supabase.from('trades').update({ status: 'rejected' }).eq('id', tr.id)
            continue // rosters changed since acceptance — void the trade
          }
          const { data: ps } = await supabase.from('players').select('*').in('id', involved)
          const pById = Object.fromEntries((ps || []).map(p => [p.id, p]))
          const assign = (incomingIds, vacatedSlots) => {
            const slots = [...vacatedSlots]
            const out = []
            const remaining = [...incomingIds]
            // legal-first greedy, then force into whatever's left
            for (const slot of [...slots]) {
              const idx = remaining.findIndex(pid => slotAccepts(pById[pid]?.position, slot))
              if (idx >= 0) {
                out.push({ player_id: remaining.splice(idx, 1)[0], slot })
                slots.splice(slots.indexOf(slot), 1)
              }
            }
            remaining.forEach((pid, i) => out.push({ player_id: pid, slot: slots[i] }))
            return out
          }
          const fromSlots = fromRows.map(r => r.slot)
          const toSlots = toRows.map(r => r.slot)
          const ids = [...fromRows, ...toRows].map(r => r.id)
          await supabase.from('rosters').delete().in('id', ids)
          const inserts = [
            ...assign(get, fromSlots).map(a => ({
              league_id: league.id, team_id: tr.from_team_id, player_id: a.player_id, slot: a.slot, week,
            })),
            ...assign(give, toSlots).map(a => ({
              league_id: league.id, team_id: tr.to_team_id, player_id: a.player_id, slot: a.slot, week,
            })),
          ]
          const { error: insErr } = await supabase.from('rosters').insert(inserts)
          if (insErr) throw insErr
          await supabase.from('trades').update({ status: 'processed' }).eq('id', tr.id)
          const nameOf = pid => pById[pid]?.name || pid
          await supabase.from('transactions').insert({
            league_id: league.id, team_id: tr.from_team_id, type: 'trade',
            detail: {
              summary: `${teams.find(t => t.id === tr.from_team_id)?.team_name || '?'} traded ` +
                `${give.map(nameOf).join(', ')} to ` +
                `${teams.find(t => t.id === tr.to_team_id)?.team_name || '?'} for ${get.map(nameOf).join(', ')}`,
            },
          })
        } catch (e) { console.error('trade processing failed', e) }
      }
    })()
  }, [league?.status, league?.id, league?.current_week, tradeTick, teams]) // eslint-disable-line react-hooks/exhaustive-deps

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
  const preDraft = league.status === 'setup' || league.status === 'locked'

  return (
    <>
      {isMock && (
        <div className="mock-banner">
          MOCK DRAFT MODE — practice league, only visible to the commissioner. Nothing here touches the real league.
        </div>
      )}

      {(active || preDraft) && (
        <div className="tabs top-tabs">
          <button className={`tab ${tab === 'home' ? 'on' : ''}`} onClick={() => setTab('home')}>League</button>
          <button className={`tab ${tab === 'team' ? 'on' : ''}`} onClick={() => setTab('team')}>Team</button>
          <button className={`tab ${tab === 'scores' ? 'on' : ''}`} onClick={() => setTab('scores')}>Matchup</button>
          <button className={`tab ${tab === 'players' ? 'on' : ''}`} onClick={() => setTab('players')}>Players</button>
          <button className={`tab ${tab === 'standings' ? 'on' : ''}`} onClick={() => setTab('standings')}>Standings</button>
          <button className={`tab ${tab === 'feed' ? 'on' : ''}`} onClick={() => setTab('feed')}>Feed</button>
        </div>
      )}

      {(active || preDraft) && (
        <nav className="bottom-nav">
          {[
            ['home', 'League'], ['team', 'Team'], ['scores', 'Matchup'],
            ['players', 'Players'], ['feed', 'Feed'],
          ].map(([key, label]) => (
            <button key={key} className={`bn-item ${tab === key ? 'on' : ''}`} onClick={() => setTab(key)}>
              {label}
            </button>
          ))}
        </nav>
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
        <TeamPage2
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
      ) : active && tab === 'players' ? (
        <FreeAgents
          league={league}
          teams={teams}
          myTeamId={myTeamId}
          isLeagueAdmin={isLeagueAdmin}
        />
      ) : active && tab === 'standings' ? (
        <Standings league={league} teams={teams} myTeamId={myTeamId} isLeagueAdmin={isLeagueAdmin} />
      ) : (active || preDraft) && tab === 'feed' ? (
        <FeedScreen league={league} teams={teams} myTeamId={myTeamId} session={session} />
      ) : preDraft && tab !== 'home' ? (
        <ComingSoon tab={tab} league={league} onHome={() => setTab('home')} />
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
          setTab={setTab}
        />
      )}
    </>
  )
}

// ============================================================
// LEAGUE HOME
// ============================================================
function LeagueHome({ league, teams, myTeamId, isLeagueAdmin, isMock, session, onEnterMock, onExitMock, reloadTop, setTab }) {
  return (
    <>
      {league.status === 'active' && (
        <DashboardHero league={league} teams={teams} myTeamId={myTeamId} onFix={() => setTab && setTab('team')} onStandings={() => setTab && setTab('standings')} />
      )}
      {(league.status === 'setup' || league.status === 'locked') && !isMock && (
        <DraftCountdown league={league} teams={teams} />
      )}
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
        {league.status === 'active' && <TransactionsFeed league={league} />}
      </div>

      {(league.status === 'setup' || league.status === 'locked') && !isMock && (
        <PreDraftCoach league={league} teams={teams} myTeamId={myTeamId} />
      )}

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

  const [draftAtInput, setDraftAtInput] = useState(() => {
    if (!league.draft_at) return ''
    const d = new Date(league.draft_at)
    const pad = n => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  })
  const saveDraftAt = async () => {
    if (!draftAtInput) return
    await supabase.from('leagues')
      .update({ draft_at: new Date(draftAtInput).toISOString() }).eq('id', league.id)
  }
  const clearDraftAt = async () => {
    await supabase.from('leagues').update({ draft_at: null }).eq('id', league.id)
    setDraftAtInput('')
  }

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
        .filter(p =>
          FANTASY_POSITIONS.includes(p.position) &&
          (p.position === 'DEF' ||
            (p.active === true &&
              (p.team != null ||
                (typeof p.search_rank === 'number' && p.search_rank < 9999999)))))
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
      // If we're on a mock (2025) stat source, advance it in lockstep so each
      // league week scores against a fresh 2025 week instead of repeating.
      const src = league.stats_source || 'live'
      let nextSource = src
      if (src.startsWith('2025:')) {
        const w = parseInt(src.split(':')[1], 10) || 1
        nextSource = `2025:${Math.min(18, w + 1)}`
      }
      await supabase.from('leagues')
        .update({ current_week: next, lineup_lock_at: null, stats_source: nextSource })
        .eq('id', league.id)
      setWeekMsg({
        t: 'ok',
        v: `Advanced to week ${next} — rosters carried over, lock cleared` +
          (nextSource !== src ? `, mock stats now 2025 week ${nextSource.split(':')[1]}.` : '.'),
      })
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
            {(league.status === 'setup' || league.status === 'locked') && (
              <>
                <input
                  className="input" type="datetime-local"
                  style={{ maxWidth: 210, flex: 'none', padding: '8px 10px' }}
                  value={draftAtInput}
                  onChange={e => setDraftAtInput(e.target.value)}
                  aria-label="Draft date and time"
                />
                <button className="btn" disabled={busy || !draftAtInput} onClick={saveDraftAt}>
                  Set draft day
                </button>
                {league.draft_at && (
                  <button className="btn btn-ghost btn-sm" disabled={busy} onClick={clearDraftAt}>Clear date</button>
                )}
              </>
            )}
          </>
        )}
        <button className="btn" disabled={busy || (!isMock && league.status === 'setup')} onClick={randomizeOrder}>
          {league.draft_order ? 'Re-randomize draft order' : 'Randomize draft order'}
        </button>
        <button className="btn btn-primary" disabled={busy || !canStart} onClick={startDraft}>
          Start draft ({teams.length}/{MAX_TEAMS} teams)
        </button>
        {isMock && league.status !== 'active' && (
          <button className="btn btn-mock" disabled={busy} onClick={async () => {
            setBusy(true)
            try {
              const n = await runInstantDraft(league, teams)
              setMockMsg({ t: 'ok', v: `⚡ Instant draft complete — ${n} picks made. Rosters are being written.` })
            } catch (err) {
              setMockMsg({ t: 'err', v: `Instant draft failed: ${err.message}` })
            }
            setBusy(false)
          }}>
            ⚡ Instant draft (skip to finished)
          </button>
        )}
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
      // Sleeper's 'active' flag is unreliable for retirees — a real draftable
      // player has an NFL team and/or a draft rank. Ghosts have neither.
      .filter(p => p.nfl_team != null || p.adp != null)
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
          {isLeagueAdmin && (
            <button className="btn btn-xs" disabled={busyPick} onClick={async () => {
              if (!window.confirm('Auto-complete every remaining pick and finish the draft?')) return
              setBusyPick(true)
              try { await runInstantDraft(league, teams) } catch (e) { console.error(e) }
              setBusyPick(false)
            }}>
              ⚡ Finish draft instantly
            </button>
          )}
        </div>
      )}

      <div className="draft-topbar">
        <div className="dt-cell">
          <span className="dt-label">Pick</span>
          <span className="dt-big">{draftDone ? '—' : `${round}.${String(pickInRound).padStart(2, '0')}`}</span>
        </div>
        <div className="dt-cell dt-grow">
          <span className="dt-label">On the clock</span>
          {draftDone ? (
            <span className="dt-team">Draft complete</span>
          ) : (
            <>
              <span className="dt-team">{onClockTeam?.team_name || '—'}{onClockIsMe && ' · YOU'}</span>
              <span className="dt-sub">
                {onClockTeam?.user_name}{league.paused ? ' · PAUSED' : ''}
              </span>
            </>
          )}
        </div>
        <div className="dt-cell">
          <span className="dt-label">Time remaining</span>
          {!draftDone && (
            <div className={`clock ${league.paused ? 'paused' : ''} ${secondsLeft != null && secondsLeft <= 10 ? 'warn' : ''}`}>
              {league.paused ? '⏸' : secondsLeft != null ? `:${String(secondsLeft).padStart(2, '0')}` : '--'}
            </div>
          )}
          {!draftDone && <span className="dt-sub">of 1:{String(DRAFT_PICK_TIMER % 60).padStart(2, '0')}</span>}
        </div>
        <div className="dt-cell dt-upnext">
          <span className="dt-label">Up next</span>
          {!draftDone && Array.from({ length: 3 }).map((_, i) => {
            const n = currentPick + 1 + i
            if (n >= totalPicks) return null
            const tid = league.draft_order[slotForPick(n, numTeams)]
            const r = Math.floor(n / numTeams) + 1
            const pr = (n % numTeams) + 1
            return (
              <span key={n} className="dt-sub">
                {r}.{String(pr).padStart(2, '0')} {teamsById[tid]?.team_name}{tid === myTeamId ? ' · your turn' : ''}
              </span>
            )
          })}
          {draftDone && <span className="dt-sub">Rosters finalizing…</span>}
        </div>
        {isLeagueAdmin && !draftDone && (
          <button className="btn btn-sm" onClick={togglePause}>
            {league.paused ? 'Resume draft' : 'Pause draft'}
          </button>
        )}
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
              <div key={p.id} className={`pool-row pos-${p.position}`}>
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

      <DraftBoardGrid
        league={league} teams={teams} picks={picks} playersById={playersById}
        numTeams={numTeams} currentPick={currentPick} secondsLeft={secondsLeft} draftDone={draftDone}
      />
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
                      <td key={teamId} className={player ? `filled pos-${player.position}` : ''}>
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
        {roster.some(r => {
          const p = playersById[r.player_id]
          return p && !slotAccepts(p.position, r.slot)
        }) && (
          <div className="lock-banner" style={{ background: 'rgba(255,90,90,0.14)', borderColor: 'var(--red)', color: 'var(--red-soft)' }}>
            Illegal lineup — a player is in a slot their position doesn't allow
            (this can happen after a trade or add). Tap-swap to fix it before kickoff.
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

      <TradesPanel league={league} teams={teams} myTeamId={myTeamId} />
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
  const availAll = players.filter(p =>
    !draftedSet.has(p.id) && (p.nfl_team != null || p.adp != null))
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
            {lastFetch
              ? `Stats updated ${lastFetch.toLocaleTimeString()} · ${Object.keys(stats).length} stat lines`
              : 'Fetching stats…'}
            <br />auto-refreshes every 60s
            {sim && simF < 1 && <><br /><b>SIMULATING: {Math.round(simF * 100)}% of game time</b></>}
          </div>
        </div>

        {Object.keys(stats).length === 0 && lastFetch && (
          <div className="lock-banner" style={{ background: 'rgba(220,43,220,0.14)', borderColor: 'var(--magenta)', color: 'var(--magenta-soft)' }}>
            No stats exist for {statsYear} week {statsWeek} — {statsYear >= CURRENT_SEASON
              ? 'that week hasn\u2019t been played yet. Set a 2025 mock week in Commissioner Controls to test with real data.'
              : 'check the week number.'}
          </div>
        )}

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
function Standings({ league, teams, myTeamId, isLeagueAdmin }) {
  const [matchups, setMatchups] = useState([])
  const [playoffGames, setPlayoffGames] = useState([])
  const [poMsg, setPoMsg] = useState(null)
  const [busy, setBusy] = useState(false)

  const reload = useCallback(async () => {
    const { data } = await supabase.from('matchups').select('*')
      .eq('league_id', league.id).eq('completed', true).eq('is_playoff', false)
    setMatchups(data || [])
    const { data: po } = await supabase.from('matchups').select('*')
      .eq('league_id', league.id).eq('is_playoff', true)
      .order('week', { ascending: true })
    setPlayoffGames(po || [])
  }, [league.id])

  useEffect(() => { reload() }, [reload])

  const rows = useMemo(() => {
    const rec = {}
    teams.forEach(t => { rec[t.id] = { team: t, w: 0, l: 0, t: 0, pf: 0, pa: 0, seq: [] } })
    ;[...matchups].sort((a, b) => a.week - b.week).forEach(m => {
      const h = rec[m.home_team_id], a = rec[m.away_team_id]
      if (!h || !a) return
      h.pf += m.home_score; h.pa += m.away_score
      a.pf += m.away_score; a.pa += m.home_score
      if (m.home_score > m.away_score) { h.w++; a.l++; h.seq.push('W'); a.seq.push('L') }
      else if (m.away_score > m.home_score) { a.w++; h.l++; a.seq.push('W'); h.seq.push('L') }
      else { h.t++; a.t++; h.seq.push('T'); a.seq.push('T') }
    })
    const streak = seq => {
      if (!seq.length) return '—'
      const last = seq[seq.length - 1]
      let n = 0
      for (let i = seq.length - 1; i >= 0 && seq[i] === last; i--) n++
      return `${last}${n}`
    }
    return Object.values(rec)
      .map(r => ({ ...r, stk: streak(r.seq) }))
      .sort((x, y) => (y.w - x.w) || (y.pf - x.pf)) // wins, then points-for (league tiebreaker)
  }, [teams, matchups])

  return (
    <div className="card">
      <h2>Standings</h2>
      <p className="sub">Ranked by record, ties broken by points for. Top 6 make the playoffs (weeks 14-17).</p>
      <p className="adv-label" style={{ marginTop: 4 }}>Playoff seeds 1–6</p>
      <div className="board-scroll">
        <table className="board" style={{ minWidth: 560 }}>
          <thead>
            <tr><th>#</th><th>Team</th><th>W-L</th><th>PF</th><th>PA</th><th>STK</th></tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <React.Fragment key={r.team.id}>
                {i === 6 && (
                  <tr><td colSpan={6} style={{ padding: '8px', border: 'none' }}>
                    <span className="adv-label" style={{ margin: 0 }}>In the hunt</span>
                  </td></tr>
                )}
                <tr style={r.team.id === myTeamId ? { background: 'rgba(248,94,50,0.10)' } : undefined}>
                  <td className="rnd">{i + 1}</td>
                  <td className="filled"><span className="bp-name">{r.team.team_name}</span>
                    <div className="bp-meta">{(r.team.user_name || '').toUpperCase()}{r.team.id === myTeamId ? ' · YOUR TEAM' : ''}</div></td>
                  <td>{r.w}-{r.l}{r.t > 0 ? `-${r.t}` : ''}</td>
                  <td>{(Math.round(r.pf * 10) / 10).toFixed(1)}</td>
                  <td>{(Math.round(r.pa * 10) / 10).toFixed(1)}</td>
                  <td>{r.stk}</td>
                </tr>
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <hr className="divider" />
      <h3 className="display" style={{ fontSize: 20, marginBottom: 8 }}>Playoffs</h3>
      {playoffGames.length === 0 ? (
        <p className="sub">Bracket appears when the commissioner generates round 1 (top 6: seeds 1-2 get byes; 3v6 and 4v5 in week 14).</p>
      ) : (
        [...new Set(playoffGames.map(g => g.week))].map(wk => (
          <div key={wk}>
            <p className="adv-label">Week {wk}{wk === 14 ? ' · Round 1' : wk === 15 ? ' · Semifinals' : ' · Championship'}</p>
            {playoffGames.filter(g => g.week === wk).map(g => {
              const tById = Object.fromEntries(teams.map(t => [t.id, t]))
              return (
                <div key={g.id} className="mu-row">
                  <span className={`mu-team ${g.completed && g.home_score > g.away_score ? 'lead' : ''}`}>{tById[g.home_team_id]?.team_name}</span>
                  <span className="mu-score">{(g.home_score || 0).toFixed(1)}</span>
                  <span className="mu-vs">vs</span>
                  <span className="mu-score">{(g.away_score || 0).toFixed(1)}</span>
                  <span className={`mu-team away ${g.completed && g.away_score > g.home_score ? 'lead' : ''}`}>{tById[g.away_team_id]?.team_name}</span>
                  {g.completed && <span className="mu-final">FINAL</span>}
                </div>
              )
            })}
          </div>
        ))
      )}
      {isLeagueAdmin && (
        <div className="admin-actions" style={{ marginTop: 10 }}>
          <button className="btn btn-sm" disabled={busy} onClick={async () => {
            setBusy(true); setPoMsg(null)
            try {
              const seeds = rows.map(r => r.team.id) // standings order = seeding
              const completedPO = playoffGames.filter(g => g.completed)
              const winnerOf = g => (g.home_score >= g.away_score ? g.home_team_id : g.away_team_id)
              let inserts = []
              if (playoffGames.length === 0) {
                // Round 1 (week 14): 3v6, 4v5; seeds 1-2 bye
                inserts = [
                  { week: 14, home_team_id: seeds[2], away_team_id: seeds[5] },
                  { week: 14, home_team_id: seeds[3], away_team_id: seeds[4] },
                ]
              } else if (playoffGames.filter(g => g.week === 14).length === 2 &&
                         completedPO.filter(g => g.week === 14).length === 2 &&
                         playoffGames.filter(g => g.week === 15).length === 0) {
                // Semis (week 15): 1 seed vs worst surviving seed, 2 vs the other
                const r1 = completedPO.filter(g => g.week === 14)
                const winners = r1.map(winnerOf)
                const seedIndex = id => seeds.indexOf(id)
                winners.sort((a, b) => seedIndex(a) - seedIndex(b)) // better seed first
                inserts = [
                  { week: 15, home_team_id: seeds[0], away_team_id: winners[1] },
                  { week: 15, home_team_id: seeds[1], away_team_id: winners[0] },
                ]
              } else if (completedPO.filter(g => g.week === 15).length === 2 &&
                         playoffGames.filter(g => g.week === 16).length === 0) {
                // Championship (week 16)
                const semis = completedPO.filter(g => g.week === 15)
                inserts = [
                  { week: 16, home_team_id: winnerOf(semis[0]), away_team_id: winnerOf(semis[1]) },
                ]
              } else {
                setPoMsg({ t: 'err', v: 'Next round unlocks when the current playoff round is finalized.' })
              }
              if (inserts.length) {
                const { error } = await supabase.from('matchups').insert(
                  inserts.map(m => ({ ...m, league_id: league.id, is_playoff: true }))
                )
                if (error) throw error
                setPoMsg({ t: 'ok', v: 'Playoff round generated.' })
                await reload()
              }
            } catch (err) {
              setPoMsg({ t: 'err', v: `Bracket failed: ${err.message}` })
            }
            setBusy(false)
          }}>
            Generate next playoff round
          </button>
        </div>
      )}
      {poMsg && <p className={`msg ${poMsg.t}`}>{poMsg.v}</p>}
    </div>
  )
}

// ============================================================
// FREE AGENTS — add/drop players not on any roster
// ============================================================
function FreeAgents({ league, teams, myTeamId, isLeagueAdmin }) {
  const [players, setPlayers] = useState([])
  const [rostered, setRostered] = useState(new Set())
  const [myRoster, setMyRoster] = useState([])
  const [search, setSearch] = useState('')
  const [posFilter, setPosFilter] = useState('ALL')
  const [adding, setAdding] = useState(null) // player being added (opens drop picker)
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)

  const week = league.current_week || 1
  const lockMs = league.lineup_lock_at ? new Date(league.lineup_lock_at).getTime() : null
  const locked = lockMs != null && Date.now() >= lockMs
  const canMove = !locked || isLeagueAdmin

  const [faProj, setFaProj] = useState({})
  const reload = useCallback(async () => {
    const all = await loadAllPlayers()
    setPlayers(all.filter(p => p.nfl_team != null || p.adp != null))
    try {
      const res = await fetch(`https://api.sleeper.app/v1/projections/nfl/regular/${league.season || CURRENT_SEASON}/${week}`)
      if (res.ok) {
        const map = {}
        Object.entries(normalizeSleeperStats(await res.json())).forEach(([pid, s]) => {
          const pts = s?.pts_half_ppr ?? s?.pts_std
          if (typeof pts === 'number') map[pid] = Math.round(pts * 10) / 10
        })
        setFaProj(map)
      }
    } catch { /* fine */ }
    const { data: ro } = await supabase
      .from('rosters').select('*')
      .eq('league_id', league.id).eq('week', week)
    setRostered(new Set((ro || []).map(r => r.player_id)))
    setMyRoster((ro || []).filter(r => r.team_id === myTeamId))
  }, [league.id, week, myTeamId])

  useEffect(() => { reload() }, [reload])

  const playersById = useMemo(() => Object.fromEntries(players.map(p => [p.id, p])), [players])

  const pool = useMemo(() => {
    const q = search.trim().toLowerCase()
    return players
      .filter(p => !rostered.has(p.id))
      .filter(p => posFilter === 'ALL' || p.position === posFilter)
      .filter(p => !q || p.name.toLowerCase().includes(q))
      .slice(0, 100)
  }, [players, rostered, posFilter, search])

  const executeAddDrop = async (addPlayer, dropRow) => {
    setBusy(true); setMsg(null)
    try {
      const dropped = playersById[dropRow.player_id]
      // vacate the dropped player's slot; incoming takes it if legal, else it
      // stays put and the lineup-legality banner on My Team flags it
      const slot = slotAccepts(addPlayer.position, dropRow.slot) ? dropRow.slot
        : (dropRow.slot.startsWith('BN') ? dropRow.slot : dropRow.slot)
      const { error: delErr } = await supabase.from('rosters').delete().eq('id', dropRow.id)
      if (delErr) throw delErr
      const { error: insErr } = await supabase.from('rosters').insert({
        league_id: league.id, team_id: myTeamId, player_id: addPlayer.id, slot, week,
      })
      if (insErr) {
        await supabase.from('rosters').insert({
          league_id: league.id, team_id: myTeamId, player_id: dropRow.player_id, slot: dropRow.slot, week,
        })
        throw insErr
      }
      await supabase.from('transactions').insert({
        league_id: league.id, team_id: myTeamId, type: 'add',
        detail: {
          summary: `${teams.find(t => t.id === myTeamId)?.team_name || 'Team'} added ` +
            `${addPlayer.name} (${addPlayer.position}), dropped ${dropped?.name || '?'} (${dropped?.position || '?'})`,
        },
      })
      setMsg({ t: 'ok', v: `Added ${addPlayer.name}, dropped ${dropped?.name}.` })
      setAdding(null)
      await reload()
    } catch (err) {
      setMsg({ t: 'err', v: `Move failed: ${err.message}` })
    }
    setBusy(false)
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <h2 style={{ fontSize: 32 }}>Free agents</h2>
        <span className="pill active">Week {week}</span>
      </div>
      {!canMove && (
        <div className="lock-banner">Lineups are locked — adds and drops reopen when the week advances.</div>
      )}
      <p className="sub" style={{ marginTop: 8 }}>
        Rosters hold 16 — adding a player means dropping one. First come, first served.
      </p>

      <div className="pool-controls">
        <input className="input" style={{ minWidth: 220 }}
          placeholder={`Search ${players.filter(p => !rostered.has(p.id)).length} available players…`}
          value={search} onChange={e => setSearch(e.target.value)} />
        {['ALL', ...FANTASY_POSITIONS].map(pos => (
          <button key={pos} className={`chip ${posFilter === pos ? 'on' : ''}`}
            onClick={() => setPosFilter(pos)}>{pos}</button>
        ))}
      </div>

      <div className="pool">
        {pool.map(p => (
          <div key={p.id} className={`pool-row pos-${p.position}`}>
            <span className="pname">{p.name}</span>
            <span className="pmeta">{p.position} · {p.nfl_team || 'FA'}</span>
            <span className="prank" title="This week's projection">{faProj[p.id] != null ? `${faProj[p.id]} proj` : '—'}</span>
            <span className="prank" title="2025 avg/game">{p.last_season_avg != null ? `${p.last_season_avg} avg` : '—'}</span>
            <button className="btn btn-xs btn-primary" disabled={!canMove || busy}
              onClick={() => setAdding(p)}>
              ADD
            </button>
          </div>
        ))}
        {pool.length === 0 && <div className="pool-row">No free agents match.</div>}
      </div>

      {adding && (
        <div className="drop-picker">
          <h3 className="display" style={{ fontSize: 20, margin: '14px 0 8px' }}>
            Adding {adding.name} — who do you drop?
          </h3>
          {myRoster.map(r => {
            const p = playersById[r.player_id]
            return (
              <div key={r.id} className="lineup-row tappable" onClick={() => executeAddDrop(adding, r)}>
                <span className="lslot">{r.slot}</span>
                <span className="lname">{p?.name || r.player_id}</span>
                <span className="lmeta">{p?.position} · {p?.nfl_team || 'FA'}</span>
              </div>
            )
          })}
          <button className="btn btn-sm btn-ghost" onClick={() => setAdding(null)}>Cancel</button>
        </div>
      )}
      {msg && <p className={`msg ${msg.t}`}>{msg.v}</p>}
    </div>
  )
}

// ============================================================
// TRADES — propose, accept, reject (executed by admin's client)
// ============================================================
function TradesPanel({ league, teams, myTeamId }) {
  const [trades, setTrades] = useState([])
  const [playersById, setPlayersById] = useState({})
  const [proposing, setProposing] = useState(false)
  const [targetTeamId, setTargetTeamId] = useState('')
  const [myRoster, setMyRoster] = useState([])
  const [theirRoster, setTheirRoster] = useState([])
  const [giveIds, setGiveIds] = useState([])
  const [getIds, setGetIds] = useState([])
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)

  const week = league.current_week || 1
  const teamsById = useMemo(() => Object.fromEntries(teams.map(t => [t.id, t])), [teams])

  const loadTrades = useCallback(async () => {
    const { data } = await supabase
      .from('trades').select('*')
      .eq('league_id', league.id)
      .in('status', ['pending', 'accepted'])
      .order('created_at', { ascending: false })
    const tr = (data || []).filter(t => t.from_team_id === myTeamId || t.to_team_id === myTeamId)
    setTrades(tr)
    const ids = [...new Set(tr.flatMap(t => [...(t.from_player_ids || []), ...(t.to_player_ids || [])]))]
    if (ids.length) {
      const { data: ps } = await supabase.from('players').select('*').in('id', ids)
      setPlayersById(prev => ({ ...prev, ...Object.fromEntries((ps || []).map(p => [p.id, p])) }))
    }
  }, [league.id, myTeamId])

  useEffect(() => {
    loadTrades()
    const channel = supabase
      .channel(`trades-panel-${league.id}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'trades', filter: `league_id=eq.${league.id}` },
        loadTrades)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [league.id, loadTrades])

  const openProposal = async () => {
    setProposing(true); setGiveIds([]); setGetIds([]); setTargetTeamId(''); setTheirRoster([])
    const { data: ro } = await supabase
      .from('rosters').select('*')
      .eq('league_id', league.id).eq('team_id', myTeamId).eq('week', week)
    setMyRoster(ro || [])
    const ids = (ro || []).map(r => r.player_id)
    if (ids.length) {
      const { data: ps } = await supabase.from('players').select('*').in('id', ids)
      setPlayersById(prev => ({ ...prev, ...Object.fromEntries((ps || []).map(p => [p.id, p])) }))
    }
  }

  const pickTarget = async (teamId) => {
    setTargetTeamId(teamId); setGetIds([])
    if (!teamId) { setTheirRoster([]); return }
    const { data: ro } = await supabase
      .from('rosters').select('*')
      .eq('league_id', league.id).eq('team_id', teamId).eq('week', week)
    setTheirRoster(ro || [])
    const ids = (ro || []).map(r => r.player_id)
    if (ids.length) {
      const { data: ps } = await supabase.from('players').select('*').in('id', ids)
      setPlayersById(prev => ({ ...prev, ...Object.fromEntries((ps || []).map(p => [p.id, p])) }))
    }
  }

  const toggle = (list, setList, pid) => {
    setList(list.includes(pid) ? list.filter(x => x !== pid) : [...list, pid].slice(0, 3))
  }

  const submitTrade = async () => {
    if (giveIds.length === 0 || giveIds.length !== getIds.length) {
      setMsg({ t: 'err', v: 'Trades must be even: 1-for-1, 2-for-2, or 3-for-3.' })
      return
    }
    setBusy(true); setMsg(null)
    const { error } = await supabase.from('trades').insert({
      league_id: league.id, from_team_id: myTeamId, to_team_id: targetTeamId,
      from_player_ids: giveIds, to_player_ids: getIds,
    })
    if (error) setMsg({ t: 'err', v: error.message })
    else { setMsg({ t: 'ok', v: 'Trade proposed — waiting on the other manager.' }); setProposing(false) }
    setBusy(false)
    loadTrades()
  }

  const respond = async (trade, status) => {
    setBusy(true)
    await supabase.from('trades').update({ status }).eq('id', trade.id)
    setBusy(false)
    loadTrades()
  }

  const names = ids => (ids || []).map(pid => playersById[pid]?.name || pid).join(', ')

  const renderCheckList = (roster, selected, setSelected) => (
    <div style={{ maxHeight: 220, overflowY: 'auto' }}>
      {roster.map(r => {
        const p = playersById[r.player_id]
        const on = selected.includes(r.player_id)
        return (
          <div key={r.id} className={`lineup-row tappable ${on ? 'sel' : ''}`}
            onClick={() => toggle(selected, setSelected, r.player_id)}>
            <span className="lslot">{r.slot}</span>
            <span className="lname">{p?.name || r.player_id}</span>
            <span className="lmeta">{p?.position} · {p?.nfl_team || 'FA'}</span>
          </div>
        )
      })}
    </div>
  )

  return (
    <div className="card">
      <h2>Trades</h2>

      {trades.length === 0 && !proposing && <p className="sub">No pending trades.</p>}

      {trades.map(tr => {
        const incoming = tr.to_team_id === myTeamId && tr.status === 'pending'
        return (
          <div key={tr.id} className="trade-row">
            <div style={{ flex: 1 }}>
              <b>{teamsById[tr.from_team_id]?.team_name}</b> sends <b>{names(tr.from_player_ids)}</b>
              {' '}to <b>{teamsById[tr.to_team_id]?.team_name}</b> for <b>{names(tr.to_player_ids)}</b>
              <div className="bp-meta">
                {tr.status === 'accepted' ? 'Accepted — commissioner processing…' : incoming ? 'Awaiting your response' : 'Awaiting their response'}
              </div>
            </div>
            {incoming && (
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-xs btn-turf" disabled={busy} onClick={() => respond(tr, 'accepted')}>Accept</button>
                <button className="btn btn-xs" disabled={busy} onClick={() => respond(tr, 'rejected')}>Reject</button>
              </div>
            )}
            {tr.from_team_id === myTeamId && tr.status === 'pending' && (
              <button className="btn btn-xs" disabled={busy} onClick={() => respond(tr, 'cancelled')}>Cancel</button>
            )}
          </div>
        )
      })}

      {!proposing ? (
        <div className="admin-actions">
          <button className="btn btn-sm" onClick={openProposal}>Propose a trade</button>
        </div>
      ) : (
        <>
          <hr className="divider" />
          <div className="field" style={{ marginBottom: 10 }}>
            <select className="input" value={targetTeamId} onChange={e => pickTarget(e.target.value)}>
              <option value="">Choose a team to trade with…</option>
              {teams.filter(t => t.id !== myTeamId).map(t => (
                <option key={t.id} value={t.id}>{t.team_name} ({t.user_name})</option>
              ))}
            </select>
          </div>
          {targetTeamId && (
            <div className="trade-grid">
              <div>
                <p className="adv-label">
                  You send · {giveIds.length} player{giveIds.length === 1 ? '' : 's'} ·{' '}
                  {(giveIds.reduce((s, pid) => s + (playersById[pid]?.last_season_avg || 0), 0)).toFixed(1)} PPG
                </p>
                {renderCheckList(myRoster, giveIds, setGiveIds)}
              </div>
              <div>
                <p className="adv-label">
                  You receive · {getIds.length} player{getIds.length === 1 ? '' : 's'} ·{' '}
                  {(getIds.reduce((s, pid) => s + (playersById[pid]?.last_season_avg || 0), 0)).toFixed(1)} PPG
                </p>
                {renderCheckList(theirRoster, getIds, setGetIds)}
              </div>
            </div>
          )}
          <div className="admin-actions" style={{ marginTop: 10 }}>
            <button className="btn btn-sm btn-primary" disabled={busy || !targetTeamId} onClick={submitTrade}>
              SEND PROPOSAL ({giveIds.length}-for-{getIds.length})
            </button>
            <button className="btn btn-sm btn-ghost" onClick={() => setProposing(false)}>Cancel</button>
          </div>
        </>
      )}
      {msg && <p className={`msg ${msg.t}`}>{msg.v}</p>}
    </div>
  )
}

// ============================================================
// TRANSACTIONS FEED — recent league activity on the home page
// ============================================================
function TransactionsFeed({ league }) {
  const [txns, setTxns] = useState([])

  useEffect(() => {
    let mounted = true
    const load = async () => {
      const { data } = await supabase
        .from('transactions').select('*')
        .eq('league_id', league.id)
        .order('created_at', { ascending: false })
        .limit(12)
      if (mounted) setTxns(data || [])
    }
    load()
    const channel = supabase
      .channel(`txns-${league.id}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'transactions', filter: `league_id=eq.${league.id}` },
        load)
      .subscribe()
    return () => { mounted = false; supabase.removeChannel(channel) }
  }, [league.id])

  if (txns.length === 0) return null
  return (
    <>
      <hr className="divider" />
      <h3 className="display" style={{ fontSize: 20, marginBottom: 8 }}>Recent moves</h3>
      {txns.map(t => (
        <div key={t.id} className="txn-row">
          {t.detail?.summary || t.type}
          <span className="when"> · {new Date(t.created_at).toLocaleDateString()}</span>
        </div>
      ))}
    </>
  )
}

// ============================================================
// DRAFT BOARD GRID — kit-style card grid (teams × rounds)
// ============================================================
function DraftBoardGrid({ league, teams, picks, playersById, numTeams, currentPick, secondsLeft, draftDone }) {
  const [open, setOpen] = useState(true)
  const teamsById = useMemo(() => Object.fromEntries(teams.map(t => [t.id, t])), [teams])
  const order = league.draft_order || teams.map(t => t.id)
  const picksByNumber = useMemo(
    () => Object.fromEntries(picks.map(p => [p.pick_number, p])), [picks])

  return (
    <div className="card" style={{ marginTop: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ marginBottom: 2 }}>Draft board</h2>
          <div className="bb-legend">
            <span><i className="sw pos-sw-RB" />RB</span>
            <span><i className="sw pos-sw-WR" />WR</span>
            <span><i className="sw pos-sw-QB" />QB</span>
            <span><i className="sw pos-sw-TE" />TE</span>
            <span><i className="sw pos-sw-K" />K</span>
            <span><i className="sw pos-sw-DEF" />DST</span>
          </div>
        </div>
        <button className="btn btn-sm btn-ghost" onClick={() => setOpen(!open)}>{open ? 'Hide' : 'Show'}</button>
      </div>
      {open && (
        <div className="board-scroll">
          <div className="bb-grid" style={{ gridTemplateColumns: `34px repeat(${order.length}, minmax(104px, 1fr))` }}>
            <div className="bb-head bb-rnd" />
            {order.map(id => (
              <div key={`h-${id}`} className="bb-head">{teamsById[id]?.team_name || '?'}</div>
            ))}
            {Array.from({ length: TOTAL_ROUNDS }).map((_, r) => (
              <FragmentRow key={r} r={r} order={order} numTeams={numTeams}
                picksByNumber={picksByNumber} playersById={playersById}
                currentPick={currentPick} secondsLeft={secondsLeft} draftDone={draftDone} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function FragmentRow({ r, order, numTeams, picksByNumber, playersById, currentPick, secondsLeft, draftDone }) {
  return (
    <>
      <div className="bb-rnd">{r + 1}</div>
      {order.map((teamId, col) => {
        const idxInRound = r % 2 === 0 ? col : numTeams - 1 - col
        const overallIdx = r * numTeams + idxInRound        // 0-indexed
        const overall = overallIdx + 1                       // 1-indexed pick_number
        const pick = picksByNumber[overall]
        const player = pick ? playersById[pick.player_id] : null
        const isLive = !draftDone && overallIdx === currentPick
        return (
          <div key={teamId}
            className={`bb-cell ${player ? `bb-filled pos-${player.position}` : ''} ${isLive ? 'bb-live' : ''}`}>
            {player ? (
              <>
                <div className="bb-name">{player.name}</div>
                <div className="bb-meta">{player.position} · {player.nfl_team || 'FA'} · {r + 1}.{String(idxInRound + 1).padStart(2, '0')}</div>
              </>
            ) : isLive ? (
              <>
                <div className="bb-name" style={{ color: 'var(--orange)' }}>PICKING</div>
                <div className="bb-meta">{secondsLeft != null ? `0:${String(secondsLeft).padStart(2, '0')}` : '—'}</div>
              </>
            ) : (
              <div className="bb-meta" style={{ opacity: 0.4 }}>{r + 1}.{String(idxInRound + 1).padStart(2, '0')}</div>
            )}
          </div>
        )
      })}
    </>
  )
}

// ============================================================
// DASHBOARD HERO — YOUR MATCHUP + stat strip + league scoreboard
// ============================================================
function DashboardHero({ league, teams, myTeamId, onFix, onStandings }) {
  const week = league.current_week || 1
  const source = league.stats_source || 'live'
  const [matchups, setMatchups] = useState([])
  const [allCompleted, setAllCompleted] = useState([])
  const [starters, setStarters] = useState([])
  const [bench, setBench] = useState([])
  const [playersById, setPlayersById] = useState({})
  const [stats, setStats] = useState({})
  const [proj, setProj] = useState({})

  const { statsYear, statsWeek } = useMemo(() => {
    if (source.startsWith('2025:')) return { statsYear: 2025, statsWeek: parseInt(source.split(':')[1], 10) || 1 }
    return { statsYear: league.season || CURRENT_SEASON, statsWeek: week }
  }, [source, week, league.season])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const { data: mu } = await supabase.from('matchups').select('*')
        .eq('league_id', league.id).eq('week', week)
      if (mounted) setMatchups((mu || []).filter(m => !m.is_playoff))
      const { data: done } = await supabase.from('matchups').select('*')
        .eq('league_id', league.id).eq('completed', true).eq('is_playoff', false)
      if (mounted) setAllCompleted(done || [])
      const { data: ro } = await supabase.from('rosters').select('*')
        .eq('league_id', league.id).eq('week', week)
      const rows = ro || []
      if (mounted) {
        setStarters(rows.filter(r => ROSTER_SLOTS.includes(r.slot)))
        setBench(rows.filter(r => r.team_id === myTeamId && !ROSTER_SLOTS.includes(r.slot)))
      }
      const ids = [...new Set(rows.map(r => r.player_id))]
      const byId = {}
      for (let i = 0; i < ids.length; i += 300) {
        const { data: ps } = await supabase.from('players').select('*').in('id', ids.slice(i, i + 300))
        ;(ps || []).forEach(p => { byId[p.id] = p })
      }
      if (mounted) setPlayersById(byId)
    })()
    return () => { mounted = false }
  }, [league.id, week, myTeamId])

  useEffect(() => {
    let mounted = true
    const run = async () => {
      try {
        const res = await fetch(`https://api.sleeper.app/v1/stats/nfl/regular/${statsYear}/${statsWeek}`)
        if (res.ok) { const raw = await res.json(); if (mounted) setStats(normalizeSleeperStats(raw)) }
      } catch { /* retry next poll */ }
      try {
        const res = await fetch(`https://api.sleeper.app/v1/projections/nfl/regular/${league.season || CURRENT_SEASON}/${week}`)
        if (res.ok) {
          const raw = await res.json()
          const map = {}
          Object.entries(normalizeSleeperStats(raw)).forEach(([pid, s]) => {
            const pts = s?.pts_half_ppr ?? s?.pts_std
            if (typeof pts === 'number') map[pid] = pts
          })
          if (mounted) setProj(map)
        }
      } catch { /* fine */ }
    }
    run()
    const t = setInterval(run, 60000)
    return () => { mounted = false; clearInterval(t) }
  }, [statsYear, statsWeek, week, league.season])

  const teamsById = useMemo(() => Object.fromEntries(teams.map(t => [t.id, t])), [teams])
  const pts = useCallback(pid => fantasyPoints(stats[pid], playersById[pid]?.position), [stats, playersById])
  const teamScore = useCallback(tid =>
    Math.round(starters.filter(r => r.team_id === tid).reduce((s, r) => s + pts(r.player_id), 0) * 10) / 10,
    [starters, pts])
  const teamProj = useCallback(tid =>
    Math.round(starters.filter(r => r.team_id === tid).reduce((s, r) => s + (proj[r.player_id] || 0), 0) * 10) / 10,
    [starters, proj])

  // Records / rank / streak from completed games
  const records = useMemo(() => {
    const rec = {}
    teams.forEach(t => { rec[t.id] = { w: 0, l: 0, t: 0, pf: 0, pa: 0, seq: [] } })
    ;[...allCompleted].sort((a, b) => a.week - b.week).forEach(m => {
      const h = rec[m.home_team_id], a = rec[m.away_team_id]
      if (!h || !a) return
      h.pf += m.home_score; h.pa += m.away_score
      a.pf += m.away_score; a.pa += m.home_score
      if (m.home_score > m.away_score) { h.w++; a.l++; h.seq.push('W'); a.seq.push('L') }
      else if (m.away_score > m.home_score) { a.w++; h.l++; a.seq.push('W'); h.seq.push('L') }
      else { h.t++; a.t++; h.seq.push('T'); a.seq.push('T') }
    })
    return rec
  }, [teams, allCompleted])

  const streakOf = tid => {
    const seq = records[tid]?.seq || []
    if (!seq.length) return '—'
    const last = seq[seq.length - 1]
    let n = 0
    for (let i = seq.length - 1; i >= 0 && seq[i] === last; i--) n++
    return `${last}${n}`
  }
  const rankOf = tid => {
    const sorted = [...teams].sort((a, b) =>
      (records[b.id]?.w || 0) - (records[a.id]?.w || 0) ||
      (records[b.id]?.pf || 0) - (records[a.id]?.pf || 0))
    return sorted.findIndex(t => t.id === tid) + 1
  }
  const ord = n => n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`

  const my = matchups.find(m => m.home_team_id === myTeamId || m.away_team_id === myTeamId)
  if (!my) return null
  const oppId = my.home_team_id === myTeamId ? my.away_team_id : my.home_team_id
  const myScore = my.completed ? (my.home_team_id === myTeamId ? my.home_score : my.away_score) : teamScore(myTeamId)
  const oppScore = my.completed ? (my.home_team_id === myTeamId ? my.away_score : my.home_score) : teamScore(oppId)
  const myProj = teamProj(myTeamId), oppProj = teamProj(oppId)
  const diff = (myScore + Math.max(myProj - myScore, 0)) - (oppScore + Math.max(oppProj - oppScore, 0))
  const winPct = Math.min(99, Math.max(1, Math.round(100 / (1 + Math.pow(10, -diff / 25)))))
  const myRec = records[myTeamId] || { w: 0, l: 0 }
  const oppRec = records[oppId] || { w: 0, l: 0 }

  // Lineup alert: bench player projected meaningfully above a starter he could replace
  const alert = useMemo(() => {
    const myStarters = starters.filter(r => r.team_id === myTeamId)
    for (const b of bench) {
      const bp = playersById[b.player_id]
      if (!bp || proj[b.player_id] == null) continue
      for (const s of myStarters) {
        const sp = playersById[s.player_id]
        if (!slotAccepts(bp.position, s.slot)) continue
        const gap = (proj[b.player_id] || 0) - (proj[s.player_id] || 0)
        if (gap >= 3) {
          return `${bp.name} on your bench has ${Math.round(gap * 10) / 10} more projected than ${sp?.name || s.slot}.`
        }
      }
    }
    return null
  }, [bench, starters, playersById, proj, myTeamId])

  return (
    <div className="card hero-card">
      <div className="hero-top">
        <span className="adv-label" style={{ margin: 0 }}>Your matchup</span>
        <span className="dt-sub">Week {week}{my.completed ? ' · FINAL' : ''}</span>
      </div>
      <div className="hero-grid">
        <div className="hero-side">
          <div className="hero-team">{teamsById[myTeamId]?.team_name}</div>
          <div className="hero-mgr">{teamsById[myTeamId]?.user_name} · {myRec.w}-{myRec.l}</div>
          <div className="hero-score">{(myScore || 0).toFixed(1)}</div>
          <div className="hero-proj">PROJ {myProj.toFixed(1)}</div>
        </div>
        <div className="hero-mid">
          <span className="mu-vs">VS</span>
          <div className="winbar"><div className="winbar-fill" style={{ width: `${winPct}%` }} /></div>
          <span className="hero-win">{winPct}% WIN</span>
        </div>
        <div className="hero-side away">
          <div className="hero-team">{teamsById[oppId]?.team_name}</div>
          <div className="hero-mgr">{teamsById[oppId]?.user_name} · {oppRec.w}-{oppRec.l}</div>
          <div className="hero-score">{(oppScore || 0).toFixed(1)}</div>
          <div className="hero-proj">PROJ {oppProj.toFixed(1)}</div>
        </div>
      </div>

      {alert && (
        <div className="alert-banner">
          <span><b>LINEUP ALERT</b> — {alert}</span>
          <button className="btn btn-xs btn-primary" onClick={onFix}>FIX</button>
        </div>
      )}

      <div className="stat-strip">
        <div><span className="dt-label">Rank</span><b>{ord(rankOf(myTeamId))}</b></div>
        <div><span className="dt-label">Rec</span><b>{myRec.w}-{myRec.l}</b></div>
        <div><span className="dt-label">PF</span><b>{Math.round((myRec.pf || 0) * 10) / 10}</b></div>
        <div><span className="dt-label">Strk</span><b>{streakOf(myTeamId)}</b></div>
        {onStandings && (
          <div className="strip-link" onClick={onStandings} role="button" tabIndex={0}>
            <span className="dt-label">Standings</span><b>→</b>
          </div>
        )}
      </div>

      {matchups.length > 1 && (
        <>
          <div className="hero-top" style={{ marginTop: 16 }}>
            <span className="adv-label" style={{ margin: 0 }}>League scoreboard</span>
            <span className="dt-sub">All games</span>
          </div>
          {matchups.filter(m => m.id !== my.id).map(m => (
            <div key={m.id} className="mu-row">
              <span className={`mu-team ${teamScore(m.home_team_id) > teamScore(m.away_team_id) ? 'lead' : ''}`}>
                {teamsById[m.home_team_id]?.team_name}</span>
              <span className="mu-score">{(m.completed ? m.home_score : teamScore(m.home_team_id)).toFixed(1)}</span>
              <span className="mu-vs">vs</span>
              <span className="mu-score">{(m.completed ? m.away_score : teamScore(m.away_team_id)).toFixed(1)}</span>
              <span className={`mu-team away ${teamScore(m.away_team_id) > teamScore(m.home_team_id) ? 'lead' : ''}`}>
                {teamsById[m.away_team_id]?.team_name}</span>
              {m.completed && <span className="mu-final">FINAL</span>}
            </div>
          ))}
        </>
      )}
    </div>
  )
}

// ============================================================
// TEAM PAGE V2 — kit layout: stat strip, STARTERS/BENCH/SEASON,
// POS · PLAYER · PROJ · AVG · PTS table with tap-to-swap
// ============================================================
function TeamPage2({ league, teams, myTeamId, isLeagueAdmin }) {
  const [roster, setRoster] = useState([])
  const [playersById, setPlayersById] = useState({})
  const [proj, setProj] = useState({})
  const [stats, setStats] = useState({})
  const [completed, setCompleted] = useState([])
  const [moves, setMoves] = useState(0)
  const [view, setView] = useState('starters') // starters | bench | season
  const [selectedId, setSelectedId] = useState(null)
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)

  const week = league.current_week || 1
  const source = league.stats_source || 'live'
  const lockMs = league.lineup_lock_at ? new Date(league.lineup_lock_at).getTime() : null
  const locked = lockMs != null && Date.now() >= lockMs
  const canEdit = !locked || isLeagueAdmin
  const myTeam = teams.find(t => t.id === myTeamId)

  const { statsYear, statsWeek } = useMemo(() => {
    if (source.startsWith('2025:')) return { statsYear: 2025, statsWeek: parseInt(source.split(':')[1], 10) || 1 }
    return { statsYear: league.season || CURRENT_SEASON, statsWeek: week }
  }, [source, week, league.season])

  const loadRoster = useCallback(async () => {
    const { data } = await supabase.from('rosters').select('*')
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
  useEffect(() => {
    if (roster.length > 0) return
    let tries = 0
    const t = setInterval(() => { tries += 1; if (tries > 6) { clearInterval(t); return } loadRoster() }, 2000)
    return () => clearInterval(t)
  }, [roster.length, loadRoster])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const { data: done } = await supabase.from('matchups').select('*')
        .eq('league_id', league.id).eq('completed', true).eq('is_playoff', false)
      if (mounted) setCompleted(done || [])
      const { count } = await supabase.from('transactions')
        .select('id', { count: 'exact', head: true })
        .eq('league_id', league.id).eq('team_id', myTeamId)
      if (mounted) setMoves(count || 0)
    })()
    return () => { mounted = false }
  }, [league.id, myTeamId])

  useEffect(() => {
    let mounted = true
    const run = async () => {
      try {
        const res = await fetch(`https://api.sleeper.app/v1/projections/nfl/regular/${league.season || CURRENT_SEASON}/${week}`)
        if (res.ok) {
          const map = {}
          Object.entries(normalizeSleeperStats(await res.json())).forEach(([pid, s]) => {
            const pts = s?.pts_half_ppr ?? s?.pts_std
            if (typeof pts === 'number') map[pid] = Math.round(pts * 10) / 10
          })
          if (mounted) setProj(map)
        }
      } catch { /* fine */ }
      try {
        const res = await fetch(`https://api.sleeper.app/v1/stats/nfl/regular/${statsYear}/${statsWeek}`)
        if (res.ok && mounted) setStats(normalizeSleeperStats(await res.json()))
      } catch { /* retry next poll */ }
    }
    run()
    const t = setInterval(run, 60000)
    return () => { mounted = false; clearInterval(t) }
  }, [league.season, week, statsYear, statsWeek])

  const rowBySlot = useMemo(() => Object.fromEntries(roster.map(r => [r.slot, r])), [roster])
  const livePts = pid => fantasyPoints(stats[pid], playersById[pid]?.position)

  // record / rank
  const rec = useMemo(() => {
    const out = { w: 0, l: 0, t: 0, pf: 0, pa: 0 }
    completed.forEach(m => {
      const home = m.home_team_id === myTeamId, away = m.away_team_id === myTeamId
      if (!home && !away) return
      const mine = home ? m.home_score : m.away_score
      const theirs = home ? m.away_score : m.home_score
      out.pf += mine; out.pa += theirs
      if (mine > theirs) out.w++; else if (theirs > mine) out.l++; else out.t++
    })
    return out
  }, [completed, myTeamId])
  const rank = useMemo(() => {
    const table = {}
    teams.forEach(t => { table[t.id] = { w: 0, pf: 0 } })
    completed.forEach(m => {
      if (table[m.home_team_id]) { table[m.home_team_id].pf += m.home_score; if (m.home_score > m.away_score) table[m.home_team_id].w++ }
      if (table[m.away_team_id]) { table[m.away_team_id].pf += m.away_score; if (m.away_score > m.home_score) table[m.away_team_id].w++ }
    })
    const sorted = [...teams].sort((a, b) => table[b.id].w - table[a.id].w || table[b.id].pf - table[a.id].pf)
    return sorted.findIndex(t => t.id === myTeamId) + 1
  }, [teams, completed, myTeamId])
  const ord = n => n === 1 ? '1ST' : n === 2 ? '2ND' : n === 3 ? '3RD' : `${n}TH`

  const handleTap = async (target) => {
    if (!canEdit || busy) return
    setMsg(null)
    if (!selectedId) { if (target.row) setSelectedId(target.row.id); return }
    const a = roster.find(r => r.id === selectedId)
    if (!a) { setSelectedId(null); return }
    if (target.row && target.row.id === a.id) { setSelectedId(null); return }
    const pa = playersById[a.player_id]
    setBusy(true)
    try {
      if (target.emptySlot) {
        if (!slotAccepts(pa?.position, target.emptySlot)) {
          setMsg({ t: 'err', v: `${pa?.name || 'That player'} can't go in ${target.emptySlot}.` })
        } else {
          const { error } = await supabase.from('rosters').update({ slot: target.emptySlot }).eq('id', a.id)
          if (error) throw error
          await loadRoster()
        }
      } else {
        const b = target.row
        const pb = playersById[b.player_id]
        if (!slotAccepts(pa?.position, b.slot) || !slotAccepts(pb?.position, a.slot)) {
          setMsg({ t: 'err', v: `That swap isn't position-legal (${pa?.position} ↔ ${pb?.position}).` })
        } else {
          const core = r => ({ league_id: r.league_id, team_id: r.team_id, player_id: r.player_id, week: r.week })
          const { error: delErr } = await supabase.from('rosters').delete().in('id', [a.id, b.id])
          if (delErr) throw delErr
          const { error: insErr } = await supabase.from('rosters').insert([
            { ...core(a), slot: b.slot }, { ...core(b), slot: a.slot },
          ])
          if (insErr) {
            await supabase.from('rosters').insert([
              { ...core(a), slot: a.slot }, { ...core(b), slot: b.slot },
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
      <div key={slot}
        className={`lineup-row ${p ? `pos-${p.position}` : ''} ${isSel ? 'sel' : ''} ${!row ? 'open' : ''} ${canEdit ? 'tappable' : ''}`}
        onClick={() => row ? handleTap({ row }) : handleTap({ emptySlot: slot })}>
        <span className="lslot">{slot}</span>
        {p ? (
          <>
            <span className="lname">{p.name}<span className="lmeta" style={{ display: 'block' }}>{p.position} · {p.nfl_team || 'FA'}</span></span>
            <span className="tp-col">{proj[p.id] != null ? proj[p.id].toFixed(1) : '—'}</span>
            <span className="tp-col">{p.last_season_avg != null ? p.last_season_avg.toFixed(1) : '—'}</span>
            <span className="tp-col tp-pts">{livePts(p.id).toFixed(1)}</span>
          </>
        ) : (
          <span className="lmeta">Empty — tap a player, then tap here</span>
        )}
      </div>
    )
  }

  const starterProj = ROSTER_SLOTS.reduce((s, slot) => {
    const row = rowBySlot[slot]
    return s + (row && proj[row.player_id] != null ? proj[row.player_id] : 0)
  }, 0)

  const myWeeks = useMemo(() => {
    return [...completed]
      .filter(m => m.home_team_id === myTeamId || m.away_team_id === myTeamId)
      .sort((a, b) => a.week - b.week)
      .map(m => {
        const home = m.home_team_id === myTeamId
        const mine = home ? m.home_score : m.away_score
        const theirs = home ? m.away_score : m.home_score
        const oppId = home ? m.away_team_id : m.home_team_id
        return { week: m.week, mine, theirs, opp: teams.find(t => t.id === oppId)?.team_name || '?', won: mine > theirs }
      })
  }, [completed, myTeamId, teams])

  const illegal = roster.some(r => {
    const p = playersById[r.player_id]
    return p && !slotAccepts(p.position, r.slot)
  })

  return (
    <>
      <div className="card">
        <div className="tp-header">
          <div>
            <span className="adv-label" style={{ margin: 0 }}>
              {(myTeam?.user_name || '').toUpperCase()} · {ord(rank)} OF {teams.length}
            </span>
            <h2 style={{ fontSize: 30, marginBottom: 0 }}>{myTeam?.team_name || 'My Team'}</h2>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span className="dt-label">Proj starters</span>
            <div className="hero-score" style={{ fontSize: 30 }}>{(Math.round(starterProj * 10) / 10).toFixed(1)}</div>
          </div>
        </div>

        <div className="stat-strip">
          <div><span className="dt-label">Record</span><b>{rec.w}-{rec.l}-{rec.t}</b></div>
          <div><span className="dt-label">PF</span><b>{(Math.round(rec.pf * 10) / 10).toFixed(1)}</b></div>
          <div><span className="dt-label">PA</span><b>{(Math.round(rec.pa * 10) / 10).toFixed(1)}</b></div>
          <div><span className="dt-label">Moves</span><b>{moves}</b></div>
        </div>

        {locked && (
          <div className="lock-banner">
            Lineups are locked for week {week}
            {isLeagueAdmin ? ' — commissioner override active, edits still allowed.' : '.'}
          </div>
        )}
        {!locked && lockMs && (
          <p className="sub" style={{ marginTop: 8 }}>Lineups lock {new Date(lockMs).toLocaleString()}.</p>
        )}
        {illegal && (
          <div className="lock-banner" style={{ background: 'rgba(255,90,90,0.14)', borderColor: 'var(--red)', color: 'var(--red-soft)' }}>
            Illegal lineup — a player is in a slot their position doesn't allow. Tap-swap to fix it before kickoff.
          </div>
        )}

        <div className="tabs" style={{ margin: '16px 0 10px' }}>
          {['starters', 'bench', 'season'].map(v => (
            <button key={v} className={`tab ${view === v ? 'on' : ''}`} onClick={() => setView(v)}>{v}</button>
          ))}
        </div>

        {view !== 'season' && (
          <div className="tp-thead">
            <span className="lslot">POS</span>
            <span style={{ flex: 1 }}>PLAYER</span>
            <span className="tp-col">PROJ</span>
            <span className="tp-col">AVG</span>
            <span className="tp-col">PTS</span>
          </div>
        )}
        {view === 'starters' && ROSTER_SLOTS.map(renderRow)}
        {view === 'bench' && BENCH_SLOTS.map(renderRow)}
        {view === 'season' && (
          myWeeks.length === 0 ? <p className="sub">Finalized weeks will appear here.</p> :
          myWeeks.map(w => (
            <div key={w.week} className="lineup-row">
              <span className="lslot">WK {w.week}</span>
              <span className="lname">{w.won ? 'W' : w.mine === w.theirs ? 'T' : 'L'} vs {w.opp}</span>
              <span className="tp-col tp-pts">{w.mine.toFixed(1)}</span>
              <span className="tp-col">{w.theirs.toFixed(1)}</span>
            </div>
          ))
        )}

        {canEdit && view !== 'season' && (
          <p className="sub" style={{ marginTop: 12 }}>
            Tap a player, then tap another player (or an empty slot) to swap — selection carries across the Starters/Bench tabs. Position rules apply.
          </p>
        )}
        {msg && <p className={`msg ${msg.t}`}>{msg.v}</p>}
      </div>

      <TradesPanel league={league} teams={teams} myTeamId={myTeamId} />
    </>
  )
}

// ============================================================
// FEED — recaps of league moves + trash talk (kit's FEED screen)
// ============================================================
function FeedScreen({ league, teams, myTeamId, session }) {
  const [posts, setPosts] = useState([])
  const [txns, setTxns] = useState([])
  const [body, setBody] = useState('')
  const [filter, setFilter] = useState('all') // all | moves | chat
  const [busy, setBusy] = useState(false)

  const myTeam = teams.find(t => t.id === myTeamId)

  const load = useCallback(async () => {
    const { data: p } = await supabase.from('feed_posts').select('*')
      .eq('league_id', league.id)
      .order('created_at', { ascending: false }).limit(50)
    setPosts(p || [])
    const { data: t } = await supabase.from('transactions').select('*')
      .eq('league_id', league.id)
      .order('created_at', { ascending: false }).limit(50)
    setTxns(t || [])
  }, [league.id])

  useEffect(() => {
    load()
    const channel = supabase
      .channel(`feed-${league.id}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'feed_posts', filter: `league_id=eq.${league.id}` }, load)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'transactions', filter: `league_id=eq.${league.id}` }, load)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [league.id, load])

  const items = useMemo(() => {
    const chat = posts.map(p => ({ kind: 'chat', at: p.created_at, p }))
    const moves = txns.map(t => ({ kind: 'move', at: t.created_at, t }))
    const merged = [...chat, ...moves].sort((a, b) => new Date(b.at) - new Date(a.at))
    if (filter === 'moves') return merged.filter(i => i.kind === 'move')
    if (filter === 'chat') return merged.filter(i => i.kind === 'chat')
    return merged
  }, [posts, txns, filter])

  const post = async () => {
    const text = body.trim()
    if (!text || busy) return
    setBusy(true)
    const { error } = await supabase.from('feed_posts').insert({
      league_id: league.id,
      user_id: session.user.id,
      user_name: session.user.user_metadata?.full_name?.split(' ')[0] || session.user.email,
      team_name: myTeam?.team_name || null,
      body: text.slice(0, 500),
    })
    if (!error) setBody('')
    setBusy(false)
  }

  const ago = (iso) => {
    const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
    if (mins < 60) return `${mins}M`
    const hrs = Math.round(mins / 60)
    if (hrs < 24) return `${hrs}H`
    return `${Math.round(hrs / 24)}D`
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <h2 style={{ marginBottom: 0 }}>League feed</h2>
        <div className="tabs" style={{ margin: 0 }}>
          {['all', 'moves', 'chat'].map(f => (
            <button key={f} className={`tab ${filter === f ? 'on' : ''}`}
              style={{ padding: '6px 12px', fontSize: 12 }}
              onClick={() => setFilter(f)}>{f}</button>
          ))}
        </div>
      </div>

      <div className="field" style={{ margin: '14px 0' }}>
        <input className="input" placeholder="Say something…" maxLength={500}
          value={body} onChange={e => setBody(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') post() }} />
        <button className="btn btn-primary btn-sm" disabled={busy || !body.trim()} onClick={post}>POST</button>
      </div>

      {items.length === 0 && <p className="sub">Nothing yet — start the trash talk.</p>}
      {items.map((item, i) => item.kind === 'chat' ? (
        <div key={`c-${item.p.id}`} className="feed-post">
          <div className="fp-head">
            <b>{item.p.user_name}</b>
            <span className="fp-meta">{(item.p.team_name || '').toUpperCase()} · {ago(item.p.created_at)}</span>
          </div>
          <div className="fp-body">{item.p.body}</div>
        </div>
      ) : (
        <div key={`m-${item.t.id}`} className="feed-post move">
          <div className="fp-head">
            <b>{item.t.type === 'trade' ? 'Trade processed' : 'Roster move'}</b>
            <span className="fp-meta">{ago(item.t.created_at)} AGO</span>
          </div>
          <div className="fp-body">{item.t.detail?.summary || item.t.type}</div>
        </div>
      ))}
    </div>
  )
}

// ============================================================
// DRAFT COUNTDOWN — pre-draft hero with live ticking clock
// ============================================================
function DraftCountdown({ league, teams }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const at = league.draft_at ? new Date(league.draft_at).getTime() : null
  const diff = at ? at - now : null
  const past = diff != null && diff <= 0
  const d = diff != null && !past ? Math.floor(diff / 86400000) : 0
  const h = diff != null && !past ? Math.floor((diff % 86400000) / 3600000) : 0
  const m = diff != null && !past ? Math.floor((diff % 3600000) / 60000) : 0
  const s = diff != null && !past ? Math.floor((diff % 60000) / 1000) : 0
  const pad = n => String(n).padStart(2, '0')

  return (
    <div className="card hero-card countdown-card">
      <div className="hero-top">
        <span className="adv-label" style={{ margin: 0 }}>Draft day</span>
        <span className="dt-sub">{teams.length} of {MAX_TEAMS} teams in</span>
      </div>
      {!at ? (
        <p className="cd-tbd">Date TBD — the commissioner will set it. Get your rankings ready.</p>
      ) : past ? (
        <p className="cd-live">IT'S DRAFT DAY. The commissioner will open the draft room shortly.</p>
      ) : (
        <>
          <div className="cd-grid">
            <div className="cd-cell"><span className="cd-num">{d}</span><span className="dt-label">Days</span></div>
            <div className="cd-cell"><span className="cd-num">{pad(h)}</span><span className="dt-label">Hrs</span></div>
            <div className="cd-cell"><span className="cd-num">{pad(m)}</span><span className="dt-label">Min</span></div>
            <div className="cd-cell"><span className="cd-num">{pad(s)}</span><span className="dt-label">Sec</span></div>
          </div>
          <p className="dt-sub" style={{ marginTop: 10 }}>
            {new Date(at).toLocaleString(undefined, { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
            {' '}· Snake · 16 rounds · 90s clock · Half-PPR
          </p>
        </>
      )}
    </div>
  )
}

// ============================================================
// COMING SOON — pre-draft placeholder for locked tabs
// ============================================================
function ComingSoon({ tab, league, onHome }) {
  const copy = {
    team: ['Your team', 'Your roster lives here once the draft is done — starters, bench, projections, and weekly lineup moves.'],
    scores: ['Matchups', 'Head-to-head scoreboards with live Sunday scoring appear here every week of the season.'],
    players: ['Free agents', 'The waiver wire opens after the draft — add and drop players all season long.'],
    standings: ['Standings', 'Records, points for and against, streaks, and the playoff picture — starting week 1.'],
  }
  const [title, body] = copy[tab] || ['Coming soon', 'This unlocks after the draft.']
  return (
    <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
      <h2>{title}</h2>
      <p className="sub" style={{ maxWidth: 420, margin: '0 auto 8px' }}>{body}</p>
      <p className="sub" style={{ marginBottom: 20 }}>
        <b style={{ color: 'var(--orange)' }}>Unlocks after the draft{league.draft_at ? ` — ${new Date(league.draft_at).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}` : ''}.</b>
      </p>
      <button className="btn btn-sm" onClick={onHome}>Back to league</button>
    </div>
  )
}

// ============================================================
// PRE-DRAFT COACH — talk strategy with Coach Sunday before draft day
// ============================================================
function PreDraftCoach({ league, teams, myTeamId }) {
  const [topPlayers, setTopPlayers] = useState([])

  useEffect(() => {
    let mounted = true
    supabase.from('players').select('name, position, nfl_team, adp, last_season_avg')
      .not('adp', 'is', null)
      .order('adp', { ascending: true })
      .limit(20)
      .then(({ data }) => { if (mounted) setTopPlayers(data || []) })
    return () => { mounted = false }
  }, [])

  const buildContext = () => {
    const at = league.draft_at ? new Date(league.draft_at) : null
    const days = at ? Math.max(0, Math.ceil((at.getTime() - Date.now()) / 86400000)) : null
    const myTeam = teams.find(t => t.id === myTeamId)
    const board = topPlayers.map((p, i) =>
      `${i + 1}. ${p.name} (${p.position} ${p.nfl_team || 'FA'}` +
      `${p.last_season_avg != null ? `, 2025 avg ${p.last_season_avg}` : ''})`
    ).join('\n')
    return `PRE-DRAFT MODE — no live pick is happening. This is draft-prep talk.\n` +
      `The league draft ${at ? `is ${days === 0 ? 'TODAY' : `in ${days} day${days === 1 ? '' : 's'}`} (${at.toLocaleDateString()})` : 'date is not set yet'}.\n` +
      `${teams.length} of ${MAX_TEAMS} teams have joined. The manager's team: ${myTeam?.team_name || 'unnamed'}.\n` +
      `Format: 12-team snake, 16 rounds, 90-second clock, half-PPR.\n\n` +
      `TOP OF THE 2026 DRAFT BOARD (by rank, with 2025 avg points/game):\n${board}\n\n` +
      `The manager wants draft strategy, rankings talk, or hype for draft day. Keep it fun and grounded in the board above.`
  }

  return <CoachCard buildContext={buildContext} />
}
