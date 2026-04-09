'use client'
import { useState } from 'react'
import { Report, SECTIONS, ORGS, getMuType, isBishopric, Profile } from '@/types'
import { createClient } from '@/lib/supabase'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { ChevronDown, ChevronUp, AlertTriangle, CheckCircle, AlertCircle } from 'lucide-react'

interface Props { reports: Report[]; profile: Profile; onRefresh: () => Promise<void> }

interface SundayFolder {
  sunday: string
  reports: Report[]
  totalItems: number
  resolvedItems: number
  urgentUnresolved: number
  hasUnresolved: boolean
}

export default function CouncilView({ reports, profile, onRefresh }: Props) {
  const [openFolder, setOpenFolder] = useState<string | null>(null)
  const supabase = createClient()

  if (!isBishopric(profile.role)) {
    return <div className="card"><p className="text-sm text-red-600">🔒 Acceso restringido al obispado.</p></div>
  }

  const published = reports.filter(r => r.status === 'published')

  // Group by council_sunday
  const folderMap = new Map<string, Report[]>()
  published.forEach(r => {
    const key = r.council_sunday ?? r.council_date ?? 'sin-fecha'
    if (!folderMap.has(key)) folderMap.set(key, [])
    folderMap.get(key)!.push(r)
  })

  // Build folder objects sorted by date descending
  const folders: SundayFolder[] = Array.from(folderMap.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([sunday, reps]) => {
      let totalItems = 0, resolvedItems = 0, urgentUnresolved = 0
      reps.forEach(r => {
        Object.values(r.data ?? {}).forEach((arr: any[]) => {
          arr.forEach((item: any) => {
            totalItems++
            if (item.resolution) resolvedItems++
            else {
              if (item.pri?.includes('Urgente')) urgentUnresolved++
            }
          })
        })
      })
      return {
        sunday,
        reports: reps,
        totalItems,
        resolvedItems,
        urgentUnresolved,
        hasUnresolved: resolvedItems < totalItems,
      }
    })

  function formatSunday(dateStr: string) {
    if (dateStr === 'sin-fecha') return 'Sin fecha asignada'
    try {
      return format(parseISO(dateStr), "EEEE d 'de' MMMM, yyyy", { locale: es })
    } catch { return dateStr }
  }

  function isCurrentSunday(dateStr: string) {
    const today = new Date()
    const day = today.getDay()
    const diff = day === 0 ? 0 : 7 - day
    const nextSunday = new Date(today)
    nextSunday.setDate(today.getDate() + diff)
    return dateStr === nextSunday.toISOString().split('T')[0]
  }

  return (
    <div className="card">
      <div className="flex items-start justify-between mb-5 gap-3 flex-wrap">
        <div>
          <h2 className="font-serif text-xl text-navy font-semibold">📋 Vista del Consejo</h2>
          <p className="text-xs text-gray-400 mt-1">Reportes organizados por domingo de consejo</p>
        </div>
        <button onClick={onRefresh} className="btn btn-ghost btn-sm">↻ Actualizar</button>
      </div>

      {!folders.length ? (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-3 text-sm">
          Aún no hay reportes publicados.
        </div>
      ) : (
        <div className="space-y-3">
          {folders.map(folder => {
            const isOpen = openFolder === folder.sunday
            const isCurrent = isCurrentSunday(folder.sunday)
            const allDone = !folder.hasUnresolved
            const hasUrgent = folder.urgentUnresolved > 0

            return (
              <div key={folder.sunday} className={`border-[1.5px] rounded-xl overflow-hidden transition-all ${
                isCurrent ? 'border-gold' : 'border-[#ddd6c8]'
              }`}>
                {/* Folder header */}
                <button
                  onClick={() => setOpenFolder(isOpen ? null : folder.sunday)}
                  className="w-full flex items-center gap-4 p-4 bg-cream hover:bg-cream-dark transition-colors text-left"
                >
                  {/* Calendar icon */}
                  <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center flex-shrink-0 ${
                    isCurrent ? 'bg-navy text-white' : 'bg-white border border-[#ddd6c8]'
                  }`}>
                    <span className="text-[10px] font-bold uppercase opacity-70">
                      {folder.sunday !== 'sin-fecha' ? format(parseISO(folder.sunday), 'MMM', { locale: es }).toUpperCase() : '—'}
                    </span>
                    <span className={`text-lg font-bold leading-none ${isCurrent ? 'text-white' : 'text-navy'}`}>
                      {folder.sunday !== 'sin-fecha' ? format(parseISO(folder.sunday), 'd') : '?'}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-sm text-navy capitalize">{formatSunday(folder.sunday)}</p>
                      {isCurrent && <span className="text-[10px] font-bold bg-gold text-white px-2 py-0.5 rounded-full">Próximo consejo</span>}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {folder.reports.length} org · {folder.totalItems} items · {folder.resolvedItems} resueltos
                    </p>
                  </div>

                  {/* Status indicator */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {hasUrgent && (
                      <div className="flex items-center gap-1 bg-red-100 text-red-700 text-[11px] font-bold px-2.5 py-1 rounded-full">
                        <AlertCircle size={12} />
                        {folder.urgentUnresolved} urgente{folder.urgentUnresolved > 1 ? 's' : ''}
                      </div>
                    )}
                    {folder.hasUnresolved && !hasUrgent && (
                      <div className="flex items-center gap-1 bg-amber-100 text-amber-700 text-[11px] font-bold px-2.5 py-1 rounded-full">
                        <AlertTriangle size={12} />
                        {folder.totalItems - folder.resolvedItems} pendiente{folder.totalItems - folder.resolvedItems > 1 ? 's' : ''}
                      </div>
                    )}
                    {allDone && folder.totalItems > 0 && (
                      <div className="flex items-center gap-1 bg-green-100 text-green-700 text-[11px] font-bold px-2.5 py-1 rounded-full">
                        <CheckCircle size={12} /> Completo
                      </div>
                    )}
                    {isOpen ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                  </div>
                </button>

                {/* Folder content */}
                {isOpen && (
                  <div className="border-t border-[#ddd6c8] p-4">
                    <FolderContent reports={folder.reports} profile={profile} onRefresh={onRefresh} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function FolderContent({ reports, profile, onRefresh }: { reports: Report[]; profile: Profile; onRefresh: () => Promise<void> }) {
  const supabase = createClient()

  async function resolveItem(reportId: string, sid: string, itemId: string, note: string, byBishop: boolean) {
    const rep = reports.find(r => r.id === reportId)
    if (!rep) return
    const items = ((rep.data as any)[sid] ?? []).map((i: any) =>
      i.id === itemId ? { ...i, resolution: { note, by: profile.name, byBishop, ts: Date.now() } } : i
    )
    await supabase.from('reports').update({ data: { ...rep.data, [sid]: items } }).eq('id', reportId)
    await onRefresh()
  }

  async function resolveMu(reportId: string, itemId: string, note: string) {
    const rep = reports.find(r => r.id === reportId)
    if (!rep) return
    const items = (rep.data.datos_miembros ?? []).map((i: any) =>
      i.id === itemId ? { ...i, resolution: { note, by: profile.name, ts: Date.now() } } : i
    )
    await supabase.from('reports').update({ data: { ...rep.data, datos_miembros: items } }).eq('id', reportId)
    await onRefresh()
  }

  // Stats for this folder
  let total = 0, resolved = 0
  reports.forEach(r => {
    Object.values(r.data ?? {}).forEach((arr: any[]) => {
      arr.forEach((i: any) => { total++; if (i.resolution) resolved++ })
    })
  })

  return (
    <div>
      {/* Mini stats */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <div className="bg-navy text-white rounded-lg px-3 py-2 text-xs font-bold">{reports.length} org</div>
        <div className="bg-cream border border-[#ddd6c8] rounded-lg px-3 py-2 text-xs font-bold text-navy">{total} items</div>
        {resolved > 0 && <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-xs font-bold text-green-700">✅ {resolved} resueltos</div>}
        {total - resolved > 0 && <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs font-bold text-amber-700">⏳ {total - resolved} pendientes</div>}
      </div>

      {SECTIONS.map(s => {
        const blocks: { org: typeof ORGS[number]; items: any[]; repId: string }[] = []
        ORGS.forEach(org => {
          const rep = reports.filter(r => r.org_id === org.id).sort((a, b) =>
            new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0]
          if (!rep) return
          const items = (rep.data as any)[s.id] ?? []
          if (!items.length) return
          blocks.push({ org, items, repId: rep.id })
        })
        if (!blocks.length) return null

        return (
          <div key={s.id} className="mb-5">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg mb-2" style={{ background: s.bg }}>
              <span>{s.icon}</span>
              <span className="font-bold text-sm" style={{ color: s.color }}>{s.title}</span>
              <span className="ml-auto text-xs font-bold text-white px-2 py-0.5 rounded-full" style={{ background: s.color }}>
                {blocks.reduce((a, b) => a + b.items.length, 0)}
              </span>
            </div>
            {blocks.map(({ org, items, repId }) => (
              <div key={org.id} className="mb-3 pl-2">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ background: org.color }} />
                  <span className="text-xs font-bold uppercase tracking-wide" style={{ color: org.color }}>{org.name}</span>
                </div>
                {s.isMU
                  ? items.map((it: any) => <MUCard key={it.id} it={it} repId={repId} profile={profile} onResolve={resolveMu} />)
                  : items.map((it: any) => <ItemCard key={it.id} it={it} sid={s.id} sec={s} repId={repId} orgColor={org.color} profile={profile} onResolve={resolveItem} />)
                }
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}

function ItemCard({ it, sid, sec, repId, orgColor, profile, onResolve }: any) {
  const [showForm, setShowForm] = useState(false)
  const [note, setNote] = useState('')
  const [mode, setMode] = useState('resolve' as 'resolve' | 'reply')
  const resolved = !!it.resolution
  const canReply = sec.isObisp && isBishopric(profile.role) && !resolved
  const canResolve = !resolved && isBishopric(profile.role)
  const pc = priColor(it.pri)

  return (
    <div className={`rounded-xl p-3.5 mb-2 border-l-[3px] ${resolved ? 'opacity-60 bg-gray-50' : ''}`}
      style={!resolved ? { background: sec.bg, borderLeftColor: orgColor } : { borderLeftColor: '#94a3b8' }}>
      <p className={`font-bold text-sm mb-1 ${resolved ? 'line-through text-gray-400' : ''}`}>{it.title}</p>
      {it.body && <p className="text-sm text-gray-600 mb-2">{it.body}</p>}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full" style={{ background: pc.bg, color: pc.c }}>{it.pri}</span>
        {resolved && <span className="text-[10px] font-bold bg-gray-100 text-gray-500 rounded-full px-2 py-0.5">✓ Cerrado</span>}
      </div>
      {resolved && it.resolution && (
        <div className={`mt-2.5 p-2.5 rounded-lg ${it.resolution.byBishop ? 'bg-amber-50 border border-amber-200' : 'bg-green-50 border border-green-200'}`}>
          <p className={`text-[11px] font-bold mb-0.5 ${it.resolution.byBishop ? 'text-amber-700' : 'text-green-700'}`}>
            {it.resolution.byBishop ? '✍️ Respuesta del Obispo' : '✅ Resuelto'} · {it.resolution.by}
          </p>
          {it.resolution.note && <p className="text-xs text-gray-600">{it.resolution.note}</p>}
        </div>
      )}
      {!resolved && (canReply || canResolve) && (
        <div className="flex gap-2 mt-2.5 flex-wrap">
          {canReply && <button onClick={() => { setMode('reply'); setShowForm(true) }} className="btn btn-gold btn-sm text-xs">✍️ Responder</button>}
          {canResolve && <button onClick={() => { setMode('resolve'); setShowForm(true) }} className="btn btn-green btn-sm text-xs">✅ Marcar resuelto</button>}
        </div>
      )}
      {showForm && (
        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-xl">
          <label className="label">{mode === 'reply' ? 'Respuesta del Obispo' : 'Nota (opcional)'}</label>
          <textarea className="input min-h-[56px] resize-none text-sm" value={note} onChange={e => setNote(e.target.value)} autoFocus />
          <div className="flex gap-2 mt-2">
            <button className="btn btn-navy btn-sm" onClick={async () => { await onResolve(repId, sid, it.id, note, mode === 'reply'); setShowForm(false) }}>Confirmar</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  )
}

function MUCard({ it, repId, profile, onResolve }: any) {
  const [showForm, setShowForm] = useState(false)
  const [note, setNote] = useState('')
  const mt = getMuType(it.muType)
  const done = !!it.resolution
  const MU_BG: Record<string, string> = { new: '#f0fdf4', out: '#fef2f2', phone: '#eff6ff', address: '#eff6ff', name: '#f5f3ff', death: '#f8fafc' }
  const MU_BD: Record<string, string> = { new: '#86efac', out: '#fca5a5', phone: '#93c5fd', address: '#93c5fd', name: '#d8b4fe', death: '#cbd5e1' }

  return (
    <div className="rounded-xl p-3.5 mb-2.5 border-[1.5px]" style={{ background: MU_BG[it.muType] ?? '#f8fafc', borderColor: MU_BD[it.muType] ?? '#cbd5e1' }}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="font-bold text-sm">{it.memberName}</p>
        <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-700">{mt.label}</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {mt.fields.filter((f: any) => it.fields?.[f.id]).map((f: any) => (
          <div key={f.id} className="bg-white/70 rounded-lg p-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-0.5">{f.label}</div>
            <div className="text-xs font-medium">{it.fields[f.id]}</div>
          </div>
        ))}
      </div>
      {done ? (
        <div className="mt-2.5 p-2.5 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-[11px] font-bold text-green-700">✅ Actualizado en registros · {it.resolution.by}</p>
          {it.resolution.note && <p className="text-xs text-gray-600 mt-0.5">{it.resolution.note}</p>}
        </div>
      ) : it.readBySec ? (
        <div className="mt-2.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-xs font-bold text-green-700">✓ Recibido por el Secretario</span>
            {isBishopric(profile.role) && (
              <button onClick={() => setShowForm(true)} className="btn btn-green btn-sm text-xs">✅ Marcar actualizado</button>
            )}
          </div>
          {showForm && (
            <div className="mt-2.5 p-3 bg-blue-50 border border-blue-200 rounded-xl">
              <label className="label">Nota (opcional)</label>
              <textarea className="input min-h-[56px] resize-none text-sm" value={note} onChange={e => setNote(e.target.value)} autoFocus />
              <div className="flex gap-2 mt-2">
                <button className="btn btn-navy btn-sm" onClick={async () => { await onResolve(repId, it.id, note); setShowForm(false) }}>Confirmar</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)}>Cancelar</button>
              </div>
            </div>
          )}
        </div>
      ) : <p className="mt-2 text-xs font-bold text-amber-600">⏳ Pendiente revisión del Secretario</p>}
    </div>
  )
}

function priColor(p: string) {
  if (!p) return { bg: '#f1f5f9', c: '#475569' }
  if (p.includes('Urgente') || p === 'Necesita ayuda' || p === 'Solicitud de recursos') return { bg: '#fee2e2', c: '#991b1b' }
  if (p.includes('Importante') || p === 'Menos activo' || p === 'Necesita visita' || p === 'Pregunta') return { bg: '#fef3c7', c: '#92400e' }
  return { bg: '#f1f5f9', c: '#475569' }
}