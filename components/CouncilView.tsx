'use client'
import { useState } from 'react'
import { Report, SECTIONS, ORGS, getMuType, isBishopric, Profile } from '@/types'
import { createClient } from '@/lib/supabase'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { ChevronDown, ChevronUp, AlertTriangle, CheckCircle, AlertCircle, Pencil, Trash2 } from 'lucide-react'

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
  const [editingLabel, setEditingLabel] = useState<string | null>(null)
  const [labelValue, setLabelValue] = useState('')
  const supabase = createClient()

  if (!isBishopric(profile.role)) {
    return <div className="card"><p className="text-sm text-red-600">Acceso restringido al obispado.</p></div>
  }

  const published = reports.filter(r => r.status === 'published')

  const folderMap = new Map<string, Report[]>()
  published.forEach(r => {
    const key = r.council_sunday ?? r.council_date ?? 'sin-fecha'
    if (!folderMap.has(key)) folderMap.set(key, [])
    folderMap.get(key)!.push(r)
  })

  const folders: SundayFolder[] = Array.from(folderMap.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([sunday, reps]) => {
      let totalItems = 0, resolvedItems = 0, urgentUnresolved = 0
      reps.forEach(r => {
        Object.values(r.data ?? {}).forEach((arr: any[]) => {
          arr.forEach((item: any) => {
            if (item._folder_label !== undefined) return
            totalItems++
            if (item.resolution) resolvedItems++
            else if (item.pri?.includes('Urgente')) urgentUnresolved++
          })
        })
      })
      return { sunday, reports: reps, totalItems, resolvedItems, urgentUnresolved, hasUnresolved: resolvedItems < totalItems }
    })

  function formatSunday(dateStr: string) {
    if (dateStr === 'sin-fecha') return 'Sin fecha asignada'
    try { return format(parseISO(dateStr), "EEEE d 'de' MMMM, yyyy", { locale: es }) } catch { return dateStr }
  }

  function isCurrentSunday(dateStr: string) {
    const today = new Date()
    const diff = today.getDay() === 0 ? 0 : 7 - today.getDay()
    const next = new Date(today)
    next.setDate(today.getDate() + diff)
    return dateStr === next.toISOString().split('T')[0]
  }

  function getFolderLabel(folder: SundayFolder): string {
    for (const rep of folder.reports) {
      const lbl = (rep.data as any)?._folder_label
      if (lbl) return lbl
    }
    return formatSunday(folder.sunday)
  }

  async function deleteFolder(folder: SundayFolder) {
    const name = getFolderLabel(folder)
    if (!confirm(`¿Eliminar la carpeta "${name}"?\n\nLos reportes volverán a borrador.`)) return
    for (const rep of folder.reports) {
      await supabase.from('reports').update({ status: 'draft' }).eq('id', rep.id)
    }
    await onRefresh()
  }

  async function saveLabel(folder: SundayFolder) {
    for (const rep of folder.reports) {
      await supabase.from('reports').update({
        data: { ...(rep.data as any), _folder_label: labelValue.trim() || null }
      }).eq('id', rep.id)
    }
    setEditingLabel(null)
    await onRefresh()
  }

  return (
    <div className="card">
      <div className="flex items-start justify-between mb-5 gap-3 flex-wrap">
        <div>
          <h2 className="font-serif text-xl text-slate-800 font-semibold">📋 Vista del Consejo</h2>
          <p className="text-xs text-slate-400 mt-1">Reportes organizados por domingo de consejo</p>
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
            const allDone = !folder.hasUnresolved && folder.totalItems > 0
            const hasUrgent = folder.urgentUnresolved > 0
            const displayLabel = getFolderLabel(folder)
            const isEditing = editingLabel === folder.sunday

            return (
              <div key={folder.sunday} className={`border rounded-xl overflow-hidden ${isCurrent ? 'border-amber-400' : 'border-slate-200'}`}>
                <div className="flex items-center gap-3 p-4 bg-slate-50 hover:bg-slate-100 transition-colors">
                  <div
                    className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center flex-shrink-0 cursor-pointer ${isCurrent ? 'bg-slate-800 text-white' : 'bg-white border border-slate-200'}`}
                    onClick={() => setOpenFolder(isOpen ? null : folder.sunday)}
                  >
                    <span className="text-[10px] font-bold uppercase opacity-70">
                      {folder.sunday !== 'sin-fecha' ? format(parseISO(folder.sunday), 'MMM', { locale: es }).toUpperCase() : '—'}
                    </span>
                    <span className={`text-lg font-bold leading-none ${isCurrent ? 'text-white' : 'text-slate-800'}`}>
                      {folder.sunday !== 'sin-fecha' ? format(parseISO(folder.sunday), 'd') : '?'}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => !isEditing && setOpenFolder(isOpen ? null : folder.sunday)}>
                    {isEditing ? (
                      <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                        <input className="input text-sm py-1.5 flex-1" value={labelValue} onChange={e => setLabelValue(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') saveLabel(folder); if (e.key === 'Escape') setEditingLabel(null) }} autoFocus />
                        <button onClick={() => saveLabel(folder)} className="btn btn-navy btn-sm">✓</button>
                        <button onClick={() => setEditingLabel(null)} className="btn btn-ghost btn-sm">✕</button>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-sm text-slate-700 capitalize">{displayLabel}</p>
                          {isCurrent && <span className="text-[10px] font-semibold bg-amber-600 text-white px-2 py-0.5 rounded-full">Próximo consejo</span>}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">{folder.reports.length} org · {folder.totalItems} items · {folder.resolvedItems} resueltos</p>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap">
                    {hasUrgent && (
                      <div className="flex items-center gap-1 bg-red-100 text-red-700 text-[11px] font-semibold px-2 py-0.5 rounded-full">
                        <AlertCircle size={11} /> {folder.urgentUnresolved} urgente{folder.urgentUnresolved > 1 ? 's' : ''}
                      </div>
                    )}
                    {folder.hasUnresolved && !hasUrgent && (
                      <div className="flex items-center gap-1 bg-amber-100 text-amber-700 text-[11px] font-semibold px-2 py-0.5 rounded-full">
                        <AlertTriangle size={11} /> {folder.totalItems - folder.resolvedItems} pendiente{folder.totalItems - folder.resolvedItems > 1 ? 's' : ''}
                      </div>
                    )}
                    {allDone && (
                      <div className="flex items-center gap-1 bg-emerald-100 text-emerald-700 text-[11px] font-semibold px-2 py-0.5 rounded-full">
                        <CheckCircle size={11} /> Completo
                      </div>
                    )}
                    <button onClick={e => { e.stopPropagation(); setEditingLabel(folder.sunday); setLabelValue(displayLabel) }}
                      className="icon-btn-edit" title="Renombrar"><Pencil size={13} /></button>
                    <button onClick={e => { e.stopPropagation(); deleteFolder(folder) }}
                      className="icon-btn-delete" title="Eliminar carpeta"><Trash2 size={13} /></button>
                    <button onClick={() => setOpenFolder(isOpen ? null : folder.sunday)} className="text-slate-400 ml-1">
                      {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </div>
                </div>

                {isOpen && (
                  <div className="border-t border-slate-100 p-4">
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

  async function deleteItem(reportId: string, sid: string, itemId: string) {
    if (!confirm('¿Eliminar este asunto de la Vista del Consejo?')) return
    const rep = reports.find(r => r.id === reportId)
    if (!rep) return
    const items = ((rep.data as any)[sid] ?? []).filter((i: any) => i.id !== itemId)
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

  async function deleteMuItem(reportId: string, itemId: string) {
    if (!confirm('¿Eliminar esta actualización?')) return
    const rep = reports.find(r => r.id === reportId)
    if (!rep) return
    const items = (rep.data.datos_miembros ?? []).filter((i: any) => i.id !== itemId)
    await supabase.from('reports').update({ data: { ...rep.data, datos_miembros: items } }).eq('id', reportId)
    await onRefresh()
  }

  let total = 0, resolved = 0
  reports.forEach(r => { Object.values(r.data ?? {}).forEach((arr: any[]) => { arr.forEach((i: any) => { total++; if (i.resolution) resolved++ }) }) })

  return (
    <div>
      <div className="flex gap-2 mb-4 flex-wrap">
        <div className="bg-slate-800 text-white rounded-lg px-3 py-2 text-xs font-semibold">{reports.length} org</div>
        <div className="bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold text-slate-700">{total} items</div>
        {resolved > 0 && <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-xs font-semibold text-emerald-700">✅ {resolved} resueltos</div>}
        {total - resolved > 0 && <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs font-semibold text-amber-700">⏳ {total - resolved} pendientes</div>}
      </div>

      {SECTIONS.map(s => {
        const blocks: { org: typeof ORGS[number]; items: any[]; repId: string }[] = []
        ORGS.forEach(org => {
          const rep = reports.filter(r => r.org_id === org.id).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0]
          if (!rep) return
          const items = (rep.data as any)[s.id] ?? []
          if (!items.length) return
          blocks.push({ org, items, repId: rep.id })
        })
        if (!blocks.length) return null

        return (
          <div key={s.id} className="mb-5">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg mb-2 bg-slate-50 border border-slate-100">
              <span>{s.icon}</span>
              <span className="font-semibold text-sm text-slate-700">{s.title}</span>
              <span className="ml-auto text-xs font-semibold bg-slate-700 text-white px-2 py-0.5 rounded-full">
                {blocks.reduce((a, b) => a + b.items.length, 0)}
              </span>
            </div>
            {blocks.map(({ org, items, repId }) => (
              <div key={org.id} className="mb-3 pl-2">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ background: org.color }} />
                  <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: org.color }}>{org.name}</span>
                </div>
                {s.isMU
                  ? items.map((it: any) => <MUCard key={it.id} it={it} repId={repId} profile={profile} onResolve={resolveMu} onDelete={deleteMuItem} />)
                  : items.map((it: any) => <ItemCard key={it.id} it={it} sid={s.id} sec={s} repId={repId} orgColor={org.color} profile={profile} onResolve={resolveItem} onDelete={deleteItem} />)
                }
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}

function ItemCard({ it, sid, sec, repId, orgColor, profile, onResolve, onDelete }: any) {
  const [showForm, setShowForm] = useState(false)
  const [note, setNote] = useState('')
  const [mode, setMode] = useState('resolve' as 'resolve' | 'reply')
  const resolved = !!it.resolution
  const canReply = sec.isObisp && isBishopric(profile.role) && !resolved
  const canResolve = !resolved && isBishopric(profile.role)
  const pc = priColor(it.pri)

  return (
    <div className={`rounded-xl p-3.5 mb-2 border-l-[3px] ${resolved ? 'opacity-55 bg-slate-50' : ''}`}
      style={!resolved ? { background: sec.bg, borderLeftColor: orgColor } : { borderLeftColor: '#94a3b8' }}>
      <div className="flex items-start justify-between gap-2 mb-1">
        <p className={`font-semibold text-sm ${resolved ? 'line-through text-slate-400' : 'text-slate-700'}`}>{it.title}</p>
        <button onClick={() => onDelete(repId, sid, it.id)} className="icon-btn-delete flex-shrink-0" title="Eliminar"><Trash2 size={13} /></button>
      </div>
      {it.body && <p className="text-sm text-slate-600 mb-2">{it.body}</p>}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full" style={{ background: pc.bg, color: pc.c }}>{it.pri}</span>
        {resolved && <span className="text-[10px] font-semibold bg-slate-100 text-slate-500 rounded-full px-2 py-0.5">✓ Cerrado</span>}
      </div>
      {resolved && it.resolution && (
        <div className="mt-2.5 p-2.5 rounded-lg bg-slate-50 border border-slate-200">
          <p className="text-[11px] font-semibold text-slate-600 mb-0.5">
            {it.resolution.byBishop ? '✍️ Respuesta del Obispo' : '✅ Resuelto'} · {it.resolution.by}
          </p>
          {it.resolution.note && <p className="text-xs text-slate-500">{it.resolution.note}</p>}
        </div>
      )}
      {!resolved && (canReply || canResolve) && (
        <div className="flex gap-2 mt-2.5 flex-wrap">
          {canReply && <button onClick={() => { setMode('reply'); setShowForm(true) }} className="btn btn-gold btn-sm text-xs">✍️ Responder</button>}
          {canResolve && <button onClick={() => { setMode('resolve'); setShowForm(true) }} className="btn btn-green btn-sm text-xs">✅ Marcar resuelto</button>}
        </div>
      )}
      {showForm && (
        <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
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

function MUCard({ it, repId, profile, onResolve, onDelete }: any) {
  const [showForm, setShowForm] = useState(false)
  const [note, setNote] = useState('')
  const mt = getMuType(it.muType)
  const done = !!it.resolution

  return (
    <div className="rounded-xl p-3.5 mb-2.5 border border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="font-semibold text-sm text-slate-700">{it.memberName}</p>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600">{mt.label}</span>
          <button onClick={() => onDelete(repId, it.id)} className="icon-btn-delete" title="Eliminar"><Trash2 size={13} /></button>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {mt.fields.filter((f: any) => it.fields?.[f.id]).map((f: any) => (
          <div key={f.id} className="bg-slate-50 rounded-lg p-2 border border-slate-100">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-0.5">{f.label}</div>
            <div className="text-xs text-slate-700">{it.fields[f.id]}</div>
          </div>
        ))}
      </div>
      {done ? (
        <div className="mt-2.5 p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg">
          <p className="text-[11px] font-semibold text-emerald-700">✅ Actualizado · {it.resolution.by}</p>
          {it.resolution.note && <p className="text-xs text-slate-500 mt-0.5">{it.resolution.note}</p>}
        </div>
      ) : (
        <div className="mt-2.5">
          <button onClick={() => setShowForm(true)} className="btn btn-green btn-sm text-xs">✅ Marcar actualizado en registros</button>
          {showForm && (
            <div className="mt-2.5 p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <label className="label">Nota de confirmación (opcional)</label>
              <textarea className="input min-h-[56px] resize-none text-sm" value={note} onChange={e => setNote(e.target.value)} autoFocus />
              <div className="flex gap-2 mt-2">
                <button className="btn btn-navy btn-sm" onClick={async () => { await onResolve(repId, it.id, note); setShowForm(false) }}>Confirmar</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)}>Cancelar</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function priColor(p: string) {
  if (!p) return { bg: '#f1f5f9', c: '#475569' }
  if (p.includes('Urgente') || p === 'Necesita ayuda' || p === 'Solicitud de recursos') return { bg: '#fee2e2', c: '#991b1b' }
  if (p.includes('Importante') || p === 'Menos activo' || p === 'Necesita visita' || p === 'Pregunta') return { bg: '#fef3c7', c: '#92400e' }
  return { bg: '#f1f5f9', c: '#475569' }
}
