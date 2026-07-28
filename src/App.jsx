import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'

// ============================================================
// CONSTANTS
// ============================================================
const ADMIN_EMAIL = 'steven.sparacino@bol-agency.com'
const MAX_TEAMS = 12
const CURRENT_SEASON = 2026
// ⚠️ REPLACE with your final GitHub Pages URL before committing
const APP_URL = 'https://YOUR-ORG.github.io/bol-fantasy-football/'

const FANTASY_POSITIONS = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF']

// ============================================================
// STYLES (injected — no external CSS files)
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
}
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { background: var(--cream); color: var(--ink); }
body { font-family: 'DM Sans', sans-serif; -webkit-font-smoothing: antialiased; }
.app { min-height: 100vh; display: flex; flex-direction: column; }

.display { font-family: 'Bebas Neue', sans-serif; letter-spacing: 0.02em; }

/* Header */
.header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 24px; border-bottom: 3px solid var(--ink);
}
.header .logo { font-size: 30px; line-height: 1; }
.header .logo span { color: var(--orange); }
.header .user { display: flex; align-items: center; gap: 12px; font-size: 14px; }

/* Layout */
.main { flex: 1; width: 100%; max-width: 960px; margin: 0 auto; padding: 32px 20px 64px; }

/* Login */
.login-hero { text-align: center; padding: 12vh 16px 0; }
.login-hero h1 { font-size: clamp(64px, 14vw, 140px); line-height: 0.9; }
.login-hero h1 .accent { color: var(--orange); }
.login-hero p { margin: 20px auto 32px; max-width: 420px; font-size: 17px; opacity: 0.8; }

/* Buttons */
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
.btn-sm { padding: 8px 14px; font-size: 13px; }
.btn-ghost { background: transparent; box-shadow: none; border-color: var(--line); }
.btn-ghost:hover { box-shadow: none; transform: none; border-color: var(--ink); }

/* Cards */
.card {
  background: var(--chalk); border: 2px solid var(--ink); border-radius: 12px;
  box-shadow: 4px 4px 0 var(--ink); padding: 24px; margin-bottom: 24px;
}
.card h2 { font-family: 'Bebas Neue', sans-serif; font-size: 28px; margin-bottom: 12px; }
.card p.sub { font-size: 14px; opacity: 0.75; margin-bottom: 16px; }

/* Forms */
.field { display: flex; gap: 10px; flex-wrap: wrap; }
.input {
  flex: 1; min-width: 180px; font-family: 'DM Sans', sans-serif; font-size: 15px;
  padding: 12px 14px; border: 2px solid var(--ink); border-radius: 8px; background: var(--cream);
}
.input:focus-visible { outline: 3px solid var(--orange); outline-offset: 1px; }
.input.code { text-transform: uppercase; letter-spacing: 0.25em; font-weight: 700; }

/* Join code chip */
.code-chip {
  display: inline-flex; align-items: center; gap: 10px;
  font-family: 'Bebas Neue', sans-serif; font-size: 32px; letter-spacing: 0.2em;
  background: var(--ink); color: var(--cream); padding: 8px 18px; border-radius: 8px;
}

/* Teams grid */
.teams-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
.team-slot {
  border: 2px solid var(--ink); border-radius: 10px; padding: 14px; background: var(--cream);
}
.team-slot .num { font-family: 'Bebas Neue', sans-serif; font-size: 14px; color: var(--orange); }
.team-slot .tname { font-weight: 700; font-size: 16px; margin: 2px 0; }
.team-slot .uname { font-size: 13px; opacity: 0.7; }
.team-slot.empty { border-style: dashed; border-color: var(--line); color: var(--line); display: flex; align-items: center; justify-content: center; min-height: 74px; font-size: 13px; }
.team-slot.mine { background: #FDEBDD; border-color: var(--orange); }

/* Status pill */
.pill {
  display: inline-block; font-size: 12px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.08em; padding: 4px 10px; border-radius: 999px; border: 2px solid var(--ink);
}
.pill.setup { background: #FCE9A8; }
.pill.locked { background: var(--orange); color: var(--chalk); }
.pill.drafting { background: var(--turf); color: var(--chalk); }
.pill.active { background: var(--turf); color: var(--chalk); }

/* Admin */
.admin-card { border-color: var(--orange); }
.admin-card h2 { color: var(--orange-dark); }
.admin-actions { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 8px; }
.seed-status { font-size: 13px; margin-top: 10px; font-weight: 500; }

/* Misc */
.msg { font-size: 14px; margin-top: 10px; font-weight: 500; }
.msg.err { color: #B3261E; }
.msg.ok { color: var(--turf); }
.divider { border: none; border-top: 2px dashed var(--line); margin: 24px 0; }
.footer { text-align: center; font-size: 12px; opacity: 0.5; padding: 20px; }

@media (prefers-reduced-motion: reduce) {
  .btn { transition: none; }
}
`

// ============================================================
// HELPERS
// ============================================================
function makeJoinCode() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789' // no confusable chars
  let code = ''
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

// ============================================================
// APP
// ============================================================
export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [myTeam, setMyTeam] = useState(null)
  const [league, setLeague] = useState(null)
  const [teams, setTeams] = useState([])

  // Inject styles
  useEffect(() => {
    const tag = document.createElement('style')
    tag.textContent = CSS
    document.head.appendChild(tag)
    return () => tag.remove()
  }, [])

  // Auth session
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  // Load my team + league once signed in
  const loadMyLeague = useCallback(async () => {
    if (!session) return
    const { data: team } = await supabase
      .from('teams')
      .select('*')
      .eq('user_id', session.user.id)
      .maybeSingle()
    setMyTeam(team || null)
    if (team) {
      const { data: lg } = await supabase
        .from('leagues')
        .select('*')
        .eq('id', team.league_id)
        .single()
      setLeague(lg || null)
    } else {
      setLeague(null)
    }
  }, [session])

  useEffect(() => { loadMyLeague() }, [loadMyLeague])

  // Load + subscribe to teams in my league
  useEffect(() => {
    if (!league) { setTeams([]); return }
    let mounted = true
    const loadTeams = async () => {
      const { data } = await supabase
        .from('teams')
        .select('*')
        .eq('league_id', league.id)
        .order('created_at', { ascending: true })
      if (mounted) setTeams(data || [])
    }
    loadTeams()
    const channel = supabase
      .channel(`teams-${league.id}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'teams', filter: `league_id=eq.${league.id}` },
        loadTeams)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'leagues', filter: `id=eq.${league.id}` },
        async () => {
          const { data } = await supabase.from('leagues').select('*').eq('id', league.id).single()
          if (mounted && data) setLeague(data)
        })
      .subscribe()
    return () => { mounted = false; supabase.removeChannel(channel) }
  }, [league?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: APP_URL },
    })
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setMyTeam(null); setLeague(null); setTeams([])
  }

  if (loading) return <div className="app"><div className="main">Loading…</div></div>

  const isAdmin = session?.user?.email === ADMIN_EMAIL
  const isLeagueAdmin = league && session && league.admin_id === session.user.id

  return (
    <div className="app">
      {session && (
        <header className="header">
          <div className="display logo">BOL <span>FANTASY</span> FOOTBALL</div>
          <div className="user">
            <span>{session.user.user_metadata?.full_name?.split(' ')[0] || session.user.email}</span>
            <button className="btn btn-sm btn-ghost" onClick={handleLogout}>Sign out</button>
          </div>
        </header>
      )}

      <div className="main">
        {!session && <LoginScreen onLogin={handleLogin} />}
        {session && !myTeam && (
          <Lobby session={session} isAdmin={isAdmin} onDone={loadMyLeague} />
        )}
        {session && myTeam && league && (
          <LeagueHome
            session={session}
            league={league}
            teams={teams}
            myTeam={myTeam}
            isLeagueAdmin={isLeagueAdmin || isAdmin}
            onLeagueChange={setLeague}
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
// LOBBY — create or join a league
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
    const code = makeJoinCode()
    const { data: lg, error } = await supabase
      .from('leagues')
      .insert({
        name: leagueName.trim() || 'BOL Fantasy Football',
        join_code: code,
        admin_id: session.user.id,
        season: CURRENT_SEASON,
        status: 'setup',
      })
      .select()
      .single()
    if (error) { setMsg({ t: 'err', v: error.message }); setBusy(false); return }
    const { error: tErr } = await supabase.from('teams').insert({
      league_id: lg.id,
      user_id: session.user.id,
      user_name: displayName,
      team_name: adminTeamName.trim(),
    })
    if (tErr) { setMsg({ t: 'err', v: tErr.message }); setBusy(false); return }
    setBusy(false)
    onDone()
  }

  const joinLeague = async () => {
    const code = joinCode.trim().toUpperCase()
    if (code.length !== 6) { setMsg({ t: 'err', v: 'Join codes are 6 characters.' }); return }
    if (!teamName.trim()) { setMsg({ t: 'err', v: 'Name your team first.' }); return }
    setBusy(true); setMsg(null)
    const { data: lg, error } = await supabase
      .from('leagues')
      .select('*')
      .eq('join_code', code)
      .maybeSingle()
    if (error || !lg) { setMsg({ t: 'err', v: 'No league found with that code.' }); setBusy(false); return }
    if (lg.status !== 'setup') { setMsg({ t: 'err', v: 'This league is locked — joining is closed.' }); setBusy(false); return }
    const { count } = await supabase
      .from('teams')
      .select('id', { count: 'exact', head: true })
      .eq('league_id', lg.id)
    if ((count || 0) >= MAX_TEAMS) { setMsg({ t: 'err', v: 'League is full (12 teams).' }); setBusy(false); return }
    const { error: tErr } = await supabase.from('teams').insert({
      league_id: lg.id,
      user_id: session.user.id,
      user_name: displayName,
      team_name: teamName.trim(),
    })
    if (tErr) {
      setMsg({ t: 'err', v: tErr.message.includes('duplicate') ? 'You already have a team in this league.' : tErr.message })
      setBusy(false); return
    }
    setBusy(false)
    onDone()
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
// LEAGUE HOME — roster of teams + admin panel
// ============================================================
function LeagueHome({ session, league, teams, myTeam, isLeagueAdmin, onLeagueChange }) {
  return (
    <>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2 style={{ fontSize: 36 }}>{league.name}</h2>
            <span className={`pill ${league.status}`}>{league.status}</span>
          </div>
          {isLeagueAdmin && (
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
            <div key={t.id} className={`team-slot ${t.id === myTeam.id ? 'mine' : ''}`}>
              <div className="num">TEAM {String(i + 1).padStart(2, '0')}</div>
              <div className="tname">{t.team_name}</div>
              <div className="uname">{t.user_name}</div>
            </div>
          ))}
          {Array.from({ length: Math.max(0, MAX_TEAMS - teams.length) }).map((_, i) => (
            <div key={`empty-${i}`} className="team-slot empty">Open slot</div>
          ))}
        </div>
      </div>

      {isLeagueAdmin && (
        <AdminPanel league={league} teams={teams} onLeagueChange={onLeagueChange} />
      )}
    </>
  )
}

// ============================================================
// ADMIN PANEL
// ============================================================
function AdminPanel({ league, teams, onLeagueChange }) {
  const [seedMsg, setSeedMsg] = useState(null)
  const [seeding, setSeeding] = useState(false)
  const [lockBusy, setLockBusy] = useState(false)
  const [playerCount, setPlayerCount] = useState(null)

  useEffect(() => {
    supabase.from('players').select('id', { count: 'exact', head: true })
      .then(({ count }) => setPlayerCount(count ?? 0))
  }, [seeding])

  const toggleLock = async () => {
    setLockBusy(true)
    const next = league.status === 'setup' ? 'locked' : 'setup'
    const { data, error } = await supabase
      .from('leagues')
      .update({ status: next })
      .eq('id', league.id)
      .select()
      .single()
    if (!error && data) onLeagueChange(data)
    setLockBusy(false)
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
          (p.position === 'DEF' || p.active === true)
        )
        .map(p => ({
          id: String(p.player_id),
          name: p.position === 'DEF'
            ? `${p.first_name || ''} ${p.last_name || ''}`.trim() || String(p.player_id)
            : p.full_name || `${p.first_name || ''} ${p.last_name || ''}`.trim(),
          position: p.position,
          nfl_team: p.team || null,
          // Sleeper's search_rank works as a draft-value proxy (lower = better).
          // Used for autopick ordering in the draft.
          adp: typeof p.search_rank === 'number' && p.search_rank < 9999999 ? p.search_rank : null,
          status: p.injury_status || (p.active ? 'active' : 'inactive'),
        }))

      setSeedMsg({ t: 'ok', v: `Upserting ${rows.length} players…` })
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

  return (
    <div className="card admin-card">
      <h2>Commissioner Controls</h2>
      <p className="sub">
        {playerCount === null ? 'Checking player database…'
          : playerCount > 0 ? `Player database: ${playerCount} players loaded.`
          : 'Player database is empty — run the seed before drafting.'}
      </p>
      <div className="admin-actions">
        <button className="btn" disabled={seeding} onClick={seedPlayers}>
          {seeding ? 'Seeding…' : playerCount > 0 ? 'Re-seed players (Sleeper)' : 'Seed players (Sleeper)'}
        </button>
        <button className="btn" disabled={lockBusy} onClick={toggleLock}>
          {league.status === 'setup' ? 'Lock league (close joins)' : 'Unlock league (reopen joins)'}
        </button>
        <button className="btn btn-primary" disabled title="Coming in Phase 2">
          Start draft ({teams.length}/{MAX_TEAMS} teams)
        </button>
      </div>
      {seedMsg && <p className={`seed-status msg ${seedMsg.t}`}>{seedMsg.v}</p>}
    </div>
  )
}
