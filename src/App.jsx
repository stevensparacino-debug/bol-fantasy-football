import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { supabase } from './supabase'

// ============================================================
// CONSTANTS
// ============================================================
const ADMIN_EMAIL = 'steven.sparacino@bol-agency.com'
const MAX_TEAMS = 12
const CURRENT_SEASON = 2026
const APP_URL = 'https://stevensparacino-debug.github.io/bol-fantasy-football/'

const FANTASY_POSITIONS = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF']
const ROSTER_SLOTS = ['QB', 'RB1', 'RB2', 'WR1', 'WR2', 'TE', 'FLEX', 'K', 'DEF']
const BENCH_SLOTS = ['BN1', 'BN2', 'BN3', 'BN4', 'BN5', 'BN6', 'BN7']
const TOTAL_ROUNDS = 16 // 9 starters + 7 bench
const DRAFT_PICK_TIMER = 60 // seconds
const BOT_PICK_DELAY_MS = 1500

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

// Snake draft: which slot in draft_order picks at overall pick n (0-indexed)
function slotForPick(n, numTeams) {
  const round = Math.floor(n / numTeams)
  const idx = n % numTeams
  return round % 2 === 0 ? idx : numTeams - 1 - idx
}

function bestAvailable(players, draftedSet, teamPicks) {
  // Positional needs: don't autopick a 3rd QB before you have a K, etc.
  const counts = {}
  teamPicks.forEach(p => { counts[p.position] = (counts[p.position] || 0) + 1 })
  const need = pos => {
    const caps = { QB: 2, RB: 6, WR: 6, TE: 2, K: 1, DEF: 1 }
    return (counts[pos] || 0) < (caps[pos] ?? 2)
  }
  const avail = players.filter(p => !draftedSet.has(p.id) && p.adp != null)
  const preferred = avail.find(p => need(p.position))
  return preferred || avail[0] || players.find(p => !draftedSet.has(p.id))
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

      <div className="footer">BOL Agency · {CURRENT_SEASON} Season</div>
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
      <p>12 teams. Standard scoring. One office champion. Sign in with Google to claim your spot.</p>
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

  return (
    <>
      {isMock && (
        <div className="mock-banner">
          MOCK DRAFT MODE — practice league, only visible to the commissioner. Nothing here touches the real league.
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
          adp: typeof p.search_rank === 'number' && p.search_rank < 9999999 ? p.search_rank : null,
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
  const firedForPick = useRef(-1) // guards duplicate autopick/bot fires per pick number

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
    supabase.from('players').select('*').order('adp', { ascending: true, nullsFirst: false })
      .limit(5000)
      .then(({ data }) => { if (mounted) setPlayers(data || []) })
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

  // ---- bot picks (mock mode; only the admin's client drives bots) ----
  useEffect(() => {
    if (!isMock || !isLeagueAdmin || draftDone || league.paused) return
    if (!onClockIsBot) return
    if (firedForPick.current === currentPick) return
    firedForPick.current = currentPick
    const t = setTimeout(() => { doAutoPick() }, BOT_PICK_DELAY_MS)
    return () => clearTimeout(t)
  }, [isMock, isLeagueAdmin, draftDone, league.paused, onClockIsBot, currentPick, doAutoPick])

  // ---- timer-expired autopick (admin client or the on-the-clock user's client) ----
  useEffect(() => {
    if (draftDone || league.paused || !deadlineMs) return
    if (!(isLeagueAdmin || onClockIsMe)) return
    if (now < deadlineMs + 500) return // small grace
    if (firedForPick.current === currentPick && onClockIsBot) return
    if (firedForPick.current === currentPick) return
    firedForPick.current = currentPick
    doAutoPick()
  }, [now, deadlineMs, draftDone, league.paused, isLeagueAdmin, onClockIsMe, onClockIsBot, currentPick, doAutoPick])

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

  // ---- finalize: write week-1 rosters when draft completes (admin client, once) ----
  const finalized = useRef(false)
  useEffect(() => {
    if (!draftDone || !isLeagueAdmin || finalized.current) return
    if (picks.length < totalPicks) return
    finalized.current = true
    ;(async () => {
      const { count } = await supabase
        .from('rosters').select('id', { count: 'exact', head: true })
        .eq('league_id', league.id).eq('week', 1)
      if ((count || 0) > 0) return // already finalized by another session
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
  }, [draftDone, isLeagueAdmin, picks, totalPicks, teams, league.id, playersById])

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
        <div className="mock-banner">MOCK DRAFT — bots autopick their turns. You're {teamsById[myTeamId]?.team_name}.</div>
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
    </>
  )
}
