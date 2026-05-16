'use client'
import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

export default function Home() {
  const [activeTab, setActiveTab] = useState('heroes')
  const [user, setUser] = useState<any>(null), [profile, setProfile] = useState<any>(null)
  const [allCharacters, setAllCharacters] = useState<any[]>([]), [history, setHistory] = useState<any[]>([])
  const [allSessionsForAnalysis, setAllSessionsForAnalysis] = useState<any[]>([]), [allUsers, setAllUsers] = useState<any[]>([])
  const [heroSearchTerm, setHeroSearchTerm] = useState(''), [gameSearchTerm, setGameSearchTerm] = useState('')
  const [gameDateFilter, setGameDateFilter] = useState(''), [analysisFrom, setAnalysisFrom] = useState(''), [analysisTo, setAnalysisTo] = useState('')
  const [selectedChars, setSelectedChars] = useState<any[]>([]), [sessionTitle, setSessionTitle] = useState('')
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split('T')[0])
  const [sessionTime, setSessionTime] = useState(new Date().toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' }))
  const [currentPage, setCurrentPage] = useState(0), [totalCount, setTotalCount] = useState(0), pageSize = 5 
  const [isSubmitting, setIsSubmitting] = useState(false), [editNickname, setEditNickname] = useState('')
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' }), [email, setEmail] = useState(''), [password, setPassword] = useState('')
  const [newChar, setNewChar] = useState({ name: '', race: '', class: '', player: '' })

  const [isResettingPassword, setIsResettingPassword] = useState(false)
  const [isRecoveryMode, setIsRecoveryMode] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [toast, setToast] = useState({ message: '', type: 'success' })

  const xpTable = [{lvl:1,xp:0},{lvl:2,xp:550},{lvl:3,xp:1100},{lvl:4,xp:2200},{lvl:5,xp:4400},{lvl:6,xp:8500},{lvl:7,xp:15000},{lvl:8,xp:24000},{lvl:9,xp:36000},{lvl:10,xp:51000},{lvl:11,xp:69000},{lvl:12,xp:90000},{lvl:13,xp:114000},{lvl:14,xp:141000},{lvl:15,xp:170000},{lvl:16,xp:200000}];
  const getLvl = (xp: number) => ({ lvl: [...xpTable].reverse().find(l => xp >= l.xp)?.lvl || 1 });

  const inputBase = { height: '42px', padding: '10px', color: 'black', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box' as const };
  const navBtn = (a: boolean) => ({ padding: '12px 20px', cursor: 'pointer', background: a ? '#3182ce' : 'transparent', color: 'white', border: 'none', borderBottom: a ? '3px solid #63b3ed' : 'none', fontWeight: 'bold' as const, fontSize: '13px' });

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast({ message: '', type: 'success' }), 3000);
  };

  const canSee = (t: string) => {
    const r = profile?.role || 'player';
    if (t === 'settings' || t === 'heroes') return true;
    if (t === 'admin' || t === 'analysis') return r === 'manager' || r === 'admin';
    if (r === 'player') return false; 
    return true;
  };

  useEffect(() => { 
    supabase.auth.getSession().then(({ data: { session } }) => setUser(session?.user ?? null)) 
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') setIsRecoveryMode(true);
    });
    return () => { authListener.subscription.unsubscribe(); };
  }, [])
  
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (user && !isRecoveryMode) { fetchProfile(); fetchChars(); fetchHistory(); fetchAnalysis(); if (canSee('admin')) fetchUsers(); } }, [user, currentPage, activeTab, gameSearchTerm, gameDateFilter, isRecoveryMode])

  async function fetchProfile() { const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single(); if (data) { setProfile(data); setEditNickname(data.full_name); } }
  async function fetchUsers() { const { data } = await supabase.from('profiles').select('*').order('full_name'); setAllUsers(data || []); }
  async function fetchChars() { const { data } = await supabase.from('characters').select('*, xp_logs(xp_gained)'); setAllCharacters(data?.map(c => ({ ...c, total_xp: c.xp_logs?.reduce((a: number, b: any) => a + b.xp_gained, 0) || 0, games_played: c.xp_logs?.length || 0 })) || []); }
  async function fetchHistory() { const from = currentPage * pageSize, to = from + pageSize - 1; let q = supabase.from('sessions').select('*, xp_logs(*, characters(*, xp_logs(xp_gained)))', { count: 'exact' }); if (gameSearchTerm) q = q.or(`title.ilike.%${gameSearchTerm}%,pj_name.ilike.%${gameSearchTerm}%`); if (gameDateFilter) q = q.eq('date', gameDateFilter); const { data, count } = await q.order('date', { ascending: false }).range(from, to); setHistory(data || []); setTotalCount(count || 0); }
  async function fetchAnalysis() { const { data } = await supabase.from('sessions').select('*, xp_logs(*, characters(*))'); setAllSessionsForAnalysis(data || []); }

  const saveSession = async () => {
    if (!sessionTitle || selectedChars.length === 0) return showToast('Doplňte název výpravy a vyberte hrdiny!', 'error');
    setIsSubmitting(true);
    const { data: s, error } = await supabase.from('sessions').insert([{ title: sessionTitle, date: sessionDate, start_time: sessionTime, dm_id: user.id, pj_name: profile.full_name }]).select().single();
    if (error) { showToast("Chyba DB: " + error.message, 'error'); setIsSubmitting(false); return; }
    await supabase.from('xp_logs').insert(selectedChars.map(c => ({ character_id: c.id, session_id: s.id, xp_gained: c.xp_to_add || 0, loot: c.loot_to_add || '', notes: c.notes_to_add || '', created_by: user.id })));
    showToast('Výprava úspěšně uložena!', 'success'); setSelectedChars([]); setSessionTitle(''); fetchChars(); fetchHistory(); setIsSubmitting(false);
  }

  const downloadCSV = (csv: string, name: string) => { const blob = new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8;' }); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.setAttribute("download", name); link.click(); };
  const exportHeroes = () => { let csv = "Jméno;Rasa;Povolání;Lvl;XP;Hráč\n"; sortedHeroes.forEach(c => csv += `${c.name};${c.race};${c.class};${getLvl(c.total_xp).lvl};${c.total_xp};${c.player_name}\n`); downloadCSV(csv, "hrdinove.csv"); };
  const exportGames = () => { let csv = "Hra;Datum;PJ;Hrdina;XP;Loot\n"; allSessionsForAnalysis.forEach(s => s.xp_logs?.forEach((l: any) => csv += `${s.title};${s.date};${s.pj_name};${l.characters?.name};${l.xp_gained};${l.loot}\n`)); downloadCSV(csv, "kronika.csv"); };

  const sortedHeroes = [...allCharacters].filter(c => c.name.toLowerCase().includes(heroSearchTerm.toLowerCase()) || c.player_name?.toLowerCase().includes(heroSearchTerm.toLowerCase())).sort((a, b) => {
    const aV = a[sortConfig.key as keyof typeof a], bV = b[sortConfig.key as keyof typeof b]; return sortConfig.direction === 'asc' ? (aV > bV ? 1 : -1) : (aV < bV ? 1 : -1);
  });

  const stats = (() => {
    const pM: any = {}, hM: any = {}, pjM: any = {}, f = allSessionsForAnalysis.filter(s => (!analysisFrom || s.date >= analysisFrom) && (!analysisTo || s.date <= analysisTo));
    f.forEach(s => { pjM[s.pj_name] = (pjM[s.pj_name] || 0) + 1; s.xp_logs?.forEach((l: any) => {
        const pN = l.characters?.player_name, hN = l.characters?.name;
        if (!pM[pN]) pM[pN] = { g: 0, pjs: new Set() }; pM[pN].g++; pM[pN].pjs.add(s.pj_name);
        if (!hM[hN]) hM[hN] = { g: 0, pjs: new Set(), r: l.characters?.race, c: l.characters?.class }; hM[hN].g++; hM[hN].pjs.add(s.pj_name);
    })}); return { pM, hM, pjM, count: f.length };
  })();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return showToast("Vyplňte e-mail i heslo.", 'error');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) showToast("Chyba přihlášení: " + error.message, 'error');
    else window.location.reload();
  };

  const handleResetPasswordRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) return showToast("Prosím, zadejte platný e-mail.", 'error');
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
    if (error) showToast("Chyba: " + error.message, 'error');
    else showToast('E-mail s odkazem byl odeslán!', 'success');
    setIsResettingPassword(false);
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) return showToast("Heslo musí mít alespoň 6 znaků.", 'error');
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) showToast("Chyba při změně hesla: " + error.message, 'error');
    else {
      showToast('Heslo bylo úspěšně změněno!', 'success');
      setIsRecoveryMode(false);
      setNewPassword('');
    }
  };

  if (!user || isRecoveryMode) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#1a202c', position: 'relative' }}>
      {toast.message && (
        <div style={{ position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)', background: toast.type === 'error' ? '#fc8181' : '#48bb78', color: 'white', padding: '15px 30px', borderRadius: '8px', fontWeight: 'bold', boxShadow: '0 4px 15px rgba(0,0,0,0.3)', zIndex: 1000, transition: 'all 0.3s' }}>
          {toast.message}
        </div>
      )}
      <div style={{ background: '#2d3748', padding: '40px 30px', borderRadius: '12px', color: 'white', width: '340px', display: 'flex', flexDirection: 'column', alignItems: 'center', boxShadow: '0 10px 40px rgba(0,0,0,0.5)' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Želvák" style={{ width: '130px', height: '130px', objectFit: 'contain', marginBottom: '20px' }} />
        <div style={{ textAlign: 'center', marginBottom: '25px', width: '100%' }}>
            <h1 style={{ margin: 0, fontSize: '1.6em', fontWeight: 'bold' }}>Cesta Dobrodruha</h1>
            <h2 style={{ margin: '5px 0 0 0', fontSize: '1.3em', color: '#f6ad55', fontWeight: 'normal' }}>U Želváka</h2>
        </div>
        {isRecoveryMode ? (
          <form onSubmit={handleUpdatePassword} style={{ width: '100%' }}>
            <h3 style={{ textAlign: 'center', marginTop: 0, color: '#63b3ed' }}>Zadejte nové heslo</h3>
            <input type="password" placeholder="Nové heslo" value={newPassword} onChange={e => setNewPassword(e.target.value)} style={{ ...inputBase, width: '100%', marginBottom: '20px' }} />
            <button type="submit" style={{ width: '100%', height: '45px', background: '#38a169', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Uložit heslo</button>
          </form>
        ) : isResettingPassword ? (
          <form onSubmit={handleResetPasswordRequest} style={{ width: '100%' }}>
            <h3 style={{ textAlign: 'center', marginTop: 0 }}>Obnova hesla</h3>
            <p style={{ fontSize: '12px', textAlign: 'center', color: '#a0aec0', marginBottom: '15px' }}>Zadejte e-mail, na který vám zašleme záchranný odkaz.</p>
            <input placeholder="Váš e-mail" value={email} onChange={e => setEmail(e.target.value)} style={{ ...inputBase, width: '100%', marginBottom: '20px' }} />
            <button type="submit" style={{ width: '100%', height: '45px', background: '#3182ce', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', marginBottom: '15px' }}>Odeslat odkaz do e-mailu</button>
            <button type="button" onClick={() => setIsResettingPassword(false)} style={{ width: '100%', background: 'none', border: 'none', color: '#a0aec0', cursor: 'pointer', fontSize: '12px' }}>Zpět na přihlášení</button>
          </form>
        ) : (
          <form onSubmit={handleLogin} style={{ width: '100%' }}>
            <input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} style={{ ...inputBase, width: '100%', marginBottom: '10px' }} />
            <input type="password" placeholder="Heslo" value={password} onChange={e => setPassword(e.target.value)} style={{ ...inputBase, width: '100%', marginBottom: '20px' }} />
            <button type="submit" style={{ width: '100%', height: '45px', background: '#38a169', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1.1em', marginBottom: '15px' }}>VSTOUPIT</button>
            <button type="button" onClick={() => { setIsResettingPassword(true); setPassword(''); }} style={{ width: '100%', background: 'none', border: 'none', color: '#a0aec0', cursor: 'pointer', fontSize: '12px' }}>Zapomněli jste heslo?</button>
          </form>
        )}
      </div>
    </div>
  )

  return (
    <div style={{ color: 'white', fontFamily: 'sans-serif', minHeight: '100vh', background: '#1a202c', position: 'relative' }}>
      
      {/* Globální Toast Notifikace v aplikaci */}
      {toast.message && (
        <div style={{ position: 'fixed', bottom: '30px', right: '30px', background: toast.type === 'error' ? '#fc8181' : '#48bb78', color: 'white', padding: '15px 30px', borderRadius: '8px', fontWeight: 'bold', boxShadow: '0 4px 15px rgba(0,0,0,0.3)', zIndex: 1000, transition: 'all 0.3s' }}>
          {toast.message}
        </div>
      )}

      <nav style={{ background: '#2d3748', padding: '0 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 2px 10px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex' }}>
          {canSee('dashboard') && <button onClick={() => setActiveTab('dashboard')} style={navBtn(activeTab === 'dashboard')}>ZÁZNAM</button>}
          {canSee('heroes') && <button onClick={() => setActiveTab('heroes')} style={navBtn(activeTab === 'heroes')}>HRDINOVÉ</button>}
          {canSee('games') && <button onClick={() => setActiveTab('games')} style={navBtn(activeTab === 'games')}>KRONIKA</button>}
          {canSee('analysis') && <button onClick={() => setActiveTab('analysis')} style={navBtn(activeTab === 'analysis')}>ANALÝZY</button>}
          {canSee('admin') && <button onClick={() => setActiveTab('admin')} style={navBtn(activeTab === 'admin')}>SPRÁVA</button>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div onClick={() => setActiveTab('settings')} style={{ cursor: 'pointer', textAlign: 'right' }}>
            <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#63b3ed' }}>{profile?.full_name}</div>
            <div style={{ fontSize: '9px', color: '#a0aec0', textTransform: 'uppercase' }}>{profile?.role}</div>
          </div>
          <button onClick={() => supabase.auth.signOut().then(() => window.location.reload())} style={{ background: '#fc8181', border: 'none', color: 'white', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>Odhlásit</button>
        </div>
      </nav>

      <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
        {activeTab === 'dashboard' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.8fr', gap: '30px' }}>
            <div>
              <section style={{ background: '#2d3748', padding: '20px', borderRadius: '10px', marginBottom: '20px' }}>
                <h3 style={{ marginTop: 0 }}>🔍 Vyhledat hrdinu</h3>
                <input placeholder="Hledat jméno..." value={heroSearchTerm} onChange={e => setHeroSearchTerm(e.target.value)} style={{ ...inputBase, width: '100%' }} />
                <div style={{ maxHeight: '200px', overflowY: 'auto', marginTop: '10px' }}>
                  {heroSearchTerm.length > 1 && sortedHeroes.map(c => (
                    <div key={c.id} onClick={() => { if (!selectedChars.find(x => x.id === c.id)) setSelectedChars([...selectedChars, { ...c, xp_to_add: 0, loot_to_add: '', notes_to_add: '' }]); setHeroSearchTerm('') }} style={{ padding: '10px', background: '#1a202c', marginBottom: '5px', cursor: 'pointer', borderRadius: '4px', display: 'flex', justifyContent: 'space-between' }}>
                      <span><strong>{c.name}</strong> <small style={{ color: '#a0aec0' }}>({c.race} {c.class})</small></span>
                      <small style={{ color: '#f6ad55' }}>{c.player_name}</small>
                    </div>
                  ))}
                </div>
              </section>
              <section style={{ background: '#2d3748', padding: '20px', borderRadius: '10px', borderLeft: '4px solid #3182ce' }}>
                <h3 style={{ marginTop: 0 }}>🆕 Nový hrdina</h3>
                <input placeholder="Jméno hrdiny" value={newChar.name} onChange={e => setNewChar({ ...newChar, name: e.target.value })} style={{ ...inputBase, width: '100%', marginBottom: '10px' }} />
                <input placeholder="Jméno hráče" value={newChar.player} onChange={e => setNewChar({ ...newChar, player: e.target.value })} style={{ ...inputBase, width: '100%', marginBottom: '10px' }} />
                <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                  <input placeholder="Rasa" onChange={e => setNewChar({ ...newChar, race: e.target.value })} style={{ ...inputBase, width: '100%' }} />
                  <input placeholder="Povolání" onChange={e => setNewChar({ ...newChar, class: e.target.value })} style={{ ...inputBase, width: '100%' }} />
                </div>
                <button onClick={() => supabase.from('characters').insert([{ name: newChar.name, player_name: newChar.player, race: newChar.race, class: newChar.class }]).then(() => { showToast('Hrdina vytvořen!', 'success'); setNewChar({ name: '', race: '', class: '', player: '' }); fetchChars(); })} style={{ width: '100%', height: '40px', background: '#3182ce', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Vytvořit</button>
              </section>
            </div>
            <section style={{ background: '#2d3748', padding: '20px', borderRadius: '10px' }}>
              <h3 style={{ marginTop: 0 }}>📝 Dnešní výprava</h3>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                <input placeholder="Název výpravy" value={sessionTitle} onChange={e => setSessionTitle(e.target.value)} style={{ ...inputBase, flex: 2 }} />
                <input type="date" value={sessionDate} onChange={e => setSessionDate(e.target.value)} style={{ ...inputBase, flex: 1 }} />
                <input type="time" value={sessionTime} onChange={e => setSessionTime(e.target.value)} style={{ ...inputBase, flex: 0.8 }} />
              </div>
              <div style={{ background: '#1a202c', padding: '10px', borderRadius: '6px', minHeight: '300px' }}>
                {selectedChars.map(c => (
                  <div key={c.id} style={{ padding: '15px', borderBottom: '1px solid #2d3748' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <strong>{c.name} <small style={{ color: '#a0aec0' }}>({c.race} {c.class})</small></strong>
                      <button onClick={() => setSelectedChars(selectedChars.filter(x => x.id !== c.id))} style={{ color: '#fc8181', background: 'none', border: 'none', cursor: 'pointer' }}>✖</button>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input type="number" placeholder="XP" onChange={e => setSelectedChars(selectedChars.map(x => x.id === c.id ? { ...x, xp_to_add: parseInt(e.target.value) || 0 } : x))} style={{ ...inputBase, width: '70px', height: '34px' }} />
                      <input placeholder="Kořist" onChange={e => setSelectedChars(selectedChars.map(x => x.id === c.id ? { ...x, loot_to_add: e.target.value } : x))} style={{ ...inputBase, flex: 1, height: '34px' }} />
                      <input placeholder="Poznámka" onChange={e => setSelectedChars(selectedChars.map(x => x.id === c.id ? { ...x, notes_to_add: e.target.value } : x))} style={{ ...inputBase, flex: 1, height: '34px' }} />
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={saveSession} disabled={isSubmitting} style={{ width: '100%', height: '50px', background: '#38a169', color: 'white', border: 'none', borderRadius: '6px', marginTop: '15px', fontWeight: 'bold', cursor: 'pointer' }}>💾 ULOŽIT</button>
            </section>
          </div>
        )}

        {activeTab === 'heroes' && (
          <section style={{ background: '#2d3748', padding: '25px', borderRadius: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', alignItems: 'center' }}>
              <h2 style={{ margin: 0 }}>🛡️ Seznam hrdinů</h2>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input placeholder="Hledat hrdinu..." value={heroSearchTerm} onChange={e => setHeroSearchTerm(e.target.value)} style={{ ...inputBase, width: '220px' }} />
                <button onClick={exportHeroes} style={{ background: '#48bb78', color: 'white', border: 'none', height: '42px', padding: '0 15px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>📥 CSV</button>
              </div>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '2px solid #4a5568', color: '#a0aec0' }}>
                  <th style={{ padding: '12px', cursor: 'pointer' }} onClick={() => setSortConfig({ key: 'name', direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' })}>Jméno ↕</th>
                  <th>Rasa / Povolání</th>
                  <th style={{ cursor: 'pointer' }} onClick={() => setSortConfig({ key: 'total_xp', direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' })}>Level (XP) ↕</th>
                  <th>Hry</th><th>Hráč</th>
                </tr>
              </thead>
              <tbody>
                {sortedHeroes.map(c => (
                  <tr key={c.id} style={{ borderBottom: '1px solid #4a5568' }}>
                    <td style={{ padding: '12px', fontWeight: 'bold' }}>{c.name}</td>
                    <td style={{ color: '#a0aec0' }}>{c.race} {c.class}</td>
                    <td><span style={{ color: '#63b3ed', fontWeight: 'bold' }}>Lvl {getLvl(c.total_xp).lvl}</span> ({c.total_xp})</td>
                    <td>{c.games_played}</td><td style={{ color: '#f6ad55' }}>{c.player_name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {activeTab === 'games' && canSee('games') && (
          <section style={{ background: '#2d3748', padding: '25px', borderRadius: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', alignItems: 'center' }}>
              <h2 style={{ margin: 0 }}>📜 Kronika výprav</h2>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input placeholder="Hledat hru/PJ..." value={gameSearchTerm} onChange={e => { setGameSearchTerm(e.target.value); setCurrentPage(0); }} style={{ ...inputBase, width: '220px' }} />
                <input type="date" value={gameDateFilter} onChange={e => { setGameDateFilter(e.target.value); setCurrentPage(0); }} style={{ ...inputBase, width: '160px' }} />
                <button onClick={exportGames} style={{ background: '#48bb78', color: 'white', border: 'none', height: '42px', padding: '0 15px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>📥 CSV</button>
              </div>
            </div>
            {history.map(s => (
              <div key={s.id} style={{ background: '#1a202c', borderRadius: '8px', marginBottom: '20px', border: '1px solid #4a5568', overflow: 'hidden' }}>
                <div style={{ background: '#2d3748', padding: '15px', display: 'flex', justifyContent: 'space-between' }}>
                  <div><h3 style={{ margin: 0, color: '#63b3ed' }}>{s.title}</h3><small>{new Date(s.date).toLocaleDateString('cs-CZ')} | {s.start_time}</small></div>
                  <div style={{ textAlign: 'right' }}><small>PJ:</small><br /><strong>{s.pj_name}</strong></div>
                </div>
                <div style={{ padding: '15px' }}>
                  <table style={{ width: '100%', fontSize: '14px' }}>
                    <tbody>
                      {s.xp_logs?.map((l: any) => (
                        <tr key={l.id} style={{ borderBottom: '1px solid #2d3748' }}>
                          <td style={{ padding: '10px' }}><strong>{l.characters?.name}</strong> <small>({l.characters?.player_name})</small><br/><small>{l.characters?.race} {l.characters?.class}</small></td>
                          <td style={{ color: '#48bb78', fontWeight: 'bold' }}>+{l.xp_gained} XP</td>
                          <td><div style={{ color: '#ecc94b' }}>{l.loot}</div><div style={{ fontSize: '11px', color: '#a0aec0' }}>{l.notes}</div></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </section>
        )}

        {activeTab === 'analysis' && canSee('analysis') && (
          <section>
            <div style={{ background: '#2d3748', padding: '20px', borderRadius: '10px', marginBottom: '20px', display: 'flex', gap: '20px' }}>
              <div style={{ flex: 1 }}><label style={{ fontSize: '12px' }}>Od:</label><input type="date" value={analysisFrom} onChange={e => setAnalysisFrom(e.target.value)} style={{ ...inputBase, width: '100%' }} /></div>
              <div style={{ flex: 1 }}><label style={{ fontSize: '12px' }}>Do:</label><input type="date" value={analysisTo} onChange={e => setAnalysisTo(e.target.value)} style={{ ...inputBase, width: '100%' }} /></div>
              <div style={{ flex: 1, textAlign: 'right' }}><span style={{ color: '#a0aec0' }}>Výprav:</span><div style={{ fontSize: '24px', fontWeight: 'bold', color: '#63b3ed' }}>{stats.count}</div></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div style={{ background: '#2d3748', padding: '20px', borderRadius: '10px' }}>
                <h3>👤 Hráči (Mix u PJ)</h3>
                {Object.entries(stats.pM).sort((a: any, b: any) => b[1].g - a[1].g).map(([n, d]: any) => (
                  <div key={n} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #4a5568' }}>
                    <span><strong>{n}</strong></span><span>{d.g} her | <span style={{ color: d.pjs.size > 1 ? '#48bb78' : '#fc8181' }}>{d.pjs.size} PJ</span></span>
                  </div>
                ))}
              </div>
              <div style={{ background: '#2d3748', padding: '20px', borderRadius: '10px' }}>
                <h3>🛡️ Vypravěči</h3>
                {Object.entries(stats.pjM).sort((a: any, b: any) => b[1] - a[1]).map(([n, c]: any) => (
                  <div key={n} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #4a5568' }}>
                    <span><strong>{n}</strong></span><span>{c as number} sezení</span>
                  </div>
                ))}
              </div>
              <div style={{ background: '#2d3748', padding: '20px', borderRadius: '10px', gridColumn: 'span 2' }}>
                <h3>🐉 Postavy u různých PJ</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '15px', marginTop: '15px' }}>
                  {Object.entries(stats.hM).sort((a: any, b: any) => b[1].g - a[1].g).map(([n, d]: any) => (
                    <div key={n} style={{ background: '#1a202c', padding: '15px', borderRadius: '8px', borderTop: '3px solid #3182ce' }}>
                      <div style={{ fontWeight: 'bold' }}>{n}</div>
                      <div style={{ fontSize: '11px', color: '#a0aec0' }}>{d.r} {d.c}</div>
                      <div style={{ marginTop: '10px', fontSize: '13px' }}>Hry: <strong>{d.g}</strong> | PJ: <strong style={{ color: '#63b3ed' }}>{d.pjs.size}</strong></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {activeTab === 'admin' && canSee('admin') && (
          <section style={{ background: '#2d3748', padding: '25px', borderRadius: '10px' }}>
            <h2>👥 Správa uživatelů</h2>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '15px' }}>
              <thead><tr style={{ textAlign: 'left', color: '#a0aec0' }}><th>Uživatel</th><th>Role</th><th>Akce</th></tr></thead>
              <tbody>
                {allUsers.map(u => {
                  // Bezpečnostní pojistky:
                  const isSelf = u.id === profile?.id; // 1. Můj vlastní řádek
                  const isTargetAdmin = u.role === 'admin'; // 2. Řádek patří Adminovi
                  const isTargetManager = u.role === 'manager'; // 3. Řádek patří Správci
                  const isMeAdmin = profile?.role === 'admin'; // 4. Já jsem Admin

                  // Roletka se zamkne pokud to jsem já, pokud upravuju admina, nebo pokud nejsem admin a snažím se upravit jiného správce
                  const isDisabled = isSelf || isTargetAdmin || (!isMeAdmin && isTargetManager);

                  return (
                    <tr key={u.id} style={{ borderBottom: '1px solid #4a5568' }}>
                      <td style={{ padding: '15px' }}><strong>{u.full_name}</strong></td>
                      <td><span style={{ fontSize: '10px', background: '#4a5568', padding: '3px 7px', borderRadius: '4px' }}>{u.role}</span></td>
                      <td>
                        <select 
                          value={u.role} 
                          disabled={isDisabled}
                          onChange={async (e) => {
                            const newRole = e.target.value;
                            const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', u.id);
                            if (error) {
                              showToast("Chyba při ukládání: " + error.message, 'error');
                            } else {
                              showToast("Role úspěšně změněna!", 'success');
                              fetchUsers();
                            }
                          }}
                          style={{ background: '#1a202c', color: 'white', padding: '6px', borderRadius: '4px', cursor: isDisabled ? 'not-allowed' : 'pointer' }}
                        >
                          <option value="player">Hráč</option>
                          <option value="storyteller">Vypravěč</option>
                          {/* Správce jde vidět a přiřadit, jen pokud k tomu mám práva */}
                          {(isMeAdmin || isTargetManager) && <option value="manager">Správce</option>}
                          {/* Admin jde jen vidět (aby se vypsal), ale nikdo ho nesmí v menu vybrat k přiřazení */}
                          {isTargetAdmin && <option value="admin">Admin</option>}
                        </select>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </section>
        )}

        {activeTab === 'settings' && (
          <section style={{ maxWidth: '600px', margin: '0 auto' }}>
            <div style={{ background: '#2d3748', padding: '25px', borderRadius: '10px', marginBottom: '20px' }}>
              <h3 style={{ marginTop: 0 }}>⚙️ Můj profil</h3>
              <label style={{ fontSize: '12px' }}>Moje přezdívka:</label>
              <div style={{ display: 'flex', gap: '10px', marginTop: '5px' }}>
                <input value={editNickname} onChange={e => setEditNickname(e.target.value)} style={{ ...inputBase, width: '100%' }} />
                <button onClick={() => supabase.from('profiles').update({ full_name: editNickname }).eq('id', user.id).then(() => { showToast('Profil úspěšně upraven!', 'success'); fetchProfile(); })} style={{ background: '#3182ce', color: 'white', border: 'none', padding: '0 20px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Uložit</button>
              </div>
              <div style={{ fontSize: '12px', color: '#fc8181', marginTop: '15px', background: 'rgba(252, 129, 129, 0.15)', padding: '12px', borderRadius: '6px', lineHeight: '1.4' }}>
                <strong>⚠️ POZOR:</strong> Změna přezdívky je trvalá. Pokud se tvá nová přezdívka nebude shodovat se jménem hráče u tvých postav, ztratíš na ně v této sekci vazbu, dokud je PJ nepřejmenuje.
              </div>
            </div>
            <div style={{ background: '#2d3748', padding: '25px', borderRadius: '10px' }}>
              <h3 style={{ marginTop: 0 }}>🛡️ Moje postavy</h3>
              {allCharacters.filter(c => c.player_name === profile?.full_name).map(c => (
                <div key={c.id} style={{ padding: '15px', background: '#1a202c', marginBottom: '10px', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div><strong>{c.name}</strong> <small style={{ color: '#a0aec0' }}>({c.race} {c.class})</small></div>
                  <span style={{ color: '#63b3ed', fontWeight: 'bold' }}>Lvl {getLvl(c.total_xp).lvl}</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}