'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { Profile, Report, Event, Notification, isBishopric, ROLE_LABELS } from '@/types'
import ReportsTab from '@/components/ReportsTab'
import CouncilView from '@/components/CouncilView'
import { EventsTab, MembersTab, NotifPanel } from '@/components/TabComponents'
import { Bell, LogOut } from 'lucide-react'

type Tab = 'reports' | 'council' | 'events' | 'members'

export default function DashboardClient({ profile }: { profile: Profile }) {
  const [tab, setTab] = useState<Tab>('reports')
  const [reports, setReports] = useState<Report[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [notifs, setNotifs] = useState<Notification[]>([])
  const [members, setMembers] = useState<Profile[]>([])
  const [npOpen, setNpOpen] = useState(false)
  const supabase = createClient()
  const isBish = isBishopric(profile.role)

  const fetchReports = useCallback(async () => {
    const { data } = await supabase.from('reports').select('*').order('created_at', { ascending: false })
    if (data) setReports(data as Report[])
  }, [supabase])

  const fetchEvents = useCallback(async () => {
    const { data } = await supabase.from('events').select('*').order('event_date', { ascending: true })
    if (data) setEvents(data as Event[])
  }, [supabase])

  const fetchNotifs = useCallback(async () => {
    if (!isBish) return
    const { data } = await supabase.from('notifications').select('*').order('created_at', { ascending: false })
    if (data) setNotifs(data as Notification[])
  }, [supabase, isBish])

  const fetchMembers = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('*').order('name')
    if (data) setMembers(data as Profile[])
  }, [supabase])

  useEffect(() => {
    fetchReports(); fetchEvents(); fetchNotifs(); fetchMembers()
    const ch1 = supabase.channel('rpt').on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, fetchReports).subscribe()
    const ch2 = supabase.channel('ntf').on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, fetchNotifs).subscribe()
    return () => { supabase.removeChannel(ch1); supabase.removeChannel(ch2) }
  }, [fetchReports, fetchEvents, fetchNotifs, fetchMembers, supabase])

  async function handleLogout() {
    await supabase.auth.signOut()
    window.location.href = '/auth/login'
  }

  const unread = notifs.filter(n => !n.is_read).length

  const TABS: { id: Tab; label: string; bishOnly?: boolean }[] = [
    { id: 'reports', label: '📝 Mis Reportes' },
    { id: 'council', label: '📋 Vista del Consejo', bishOnly: true },
    { id: 'events', label: '📅 Eventos' },
    { id: 'members', label: '👥 Miembros' },
  ]

  return (
    <div className="flex flex-col min-h-screen bg-cream">
      <header className="bg-navy text-white h-[62px] px-5 flex items-center justify-between sticky top-0 z-50 shadow-lg">
        <div className="flex items-center gap-3">
          <span className="text-[#d4a044] text-xl">📋</span>
          <h1 className="font-serif text-base font-semibold hidden sm:block">Consejo de Barrio</h1>
          <h1 className="font-serif text-base font-semibold sm:hidden">C. Barrio</h1>
        </div>
        <div className="flex items-center gap-2.5">
          {isBish && (
            <button onClick={() => setNpOpen(!npOpen)} className="relative w-9 h-9 rounded-lg border border-white/20 flex items-center justify-center hover:bg-white/10 transition-colors">
              <Bell size={16} />
              {unread > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1 border-2 border-navy">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </button>
          )}
          <div className="bg-white/10 rounded-full px-3 py-1.5 text-xs font-medium items-center gap-2 max-w-[140px] sm:max-w-[260px] overflow-hidden hidden sm:flex">
            <span className="w-2 h-2 rounded-full bg-[#d4a044] flex-shrink-0" />
            <span className="truncate">{profile.name} · {ROLE_LABELS[profile.role] ?? profile.role}</span>
          </div>
          <button onClick={handleLogout} className="border border-white/20 text-white px-3.5 py-1.5 rounded-lg text-xs font-medium hover:bg-white/10 transition-colors flex items-center gap-1.5">
            <LogOut size={13} /> Salir
          </button>
        </div>
      </header>

      <nav className="bg-white border-b-2 border-[#ede8de] flex px-5 overflow-x-auto">
        {TABS.filter(t => !t.bishOnly || isBish).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-3.5 text-sm whitespace-nowrap border-b-[3px] -mb-0.5 transition-colors ${
              tab === t.id ? 'text-navy border-[#b8822a] font-bold' : 'text-gray-400 border-transparent hover:text-gray-700 font-medium'
            }`}>
            {t.label}
          </button>
        ))}
      </nav>

      {isBish && <NotifPanel open={npOpen} notifs={notifs} onClose={() => setNpOpen(false)} onRefresh={fetchNotifs} profile={profile} />}

      <main className="flex-1 p-6 max-w-[960px] mx-auto w-full">
        {tab === 'reports' && <ReportsTab profile={profile} reports={reports} onRefresh={fetchReports} />}
        {tab === 'council' && isBish && <CouncilView reports={reports} profile={profile} onRefresh={fetchReports} />}
        {tab === 'events' && <EventsTab events={events} onRefresh={fetchEvents} profile={profile} />}
        {tab === 'members' && <MembersTab members={members} />}
      </main>
    </div>
  )
}
