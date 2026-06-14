'use client'
import { useState } from 'react'
import { Report, SECTIONS, ORGS, getMuType, isBishopric, Profile } from '@/types'
import { createClient } from '@/lib/supabase'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { ChevronDown, ChevronUp, AlertTriangle, CheckCircle, AlertCircle, Pencil, Trash2 } from 'lucide-react'

interface Props { reports: Report[]; profile: Profile; onRefresh: () => Promise<void> }

// ── Estructuras jerárquicas ───────────────────────────────────
interface SundayFolder {
  sunday: string
  reports: Report[]
  totalItems: number
  resolvedItems: number
  urgentUnresolved: number
  hasUnresolved: boolean
}

interface MonthGroup {
  monthKey: string          // '2026-05'
  monthLabel: string        // 'Mayo'
  folders: SundayFolder[]
  totalItems: number
  resolvedItems: number
}

interface YearGroup {
  year: number
  months: MonthGroup[]
  totalItems: number
}

// ── Helpers ───────────────────────────────────────────────────
// Soporta items en formato viejo (resolution: {note, by, byBishop, ts})
// y nuevo (notes: [...], resolved: boolean)
function isItemResolved(item: any): boolean {
  return typeof item.resolved === 'boolean' ? item.resolved : !!item.resolution
}

function getItemNotes(item: any): any[] {
  if (Array.isArray(item.notes)) return item.notes
  if (item.resolution) {
    return [{ id: 'legacy', text: item.resolution.note ?? '', by: item.resolution.by, byBishop: item.resolution.byBishop, ts: item.resolution.ts }]
  }
  return []
}

function genId(): string {
  return (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2)
}

function buildSundayFolder(sunday: string, reps: Report[]): SundayFolder {
  let totalItems = 0, resolvedItems = 0, urgentUnresolved = 0
  reps.forEach(r => {
    Object.values(r.data ?? {}).forEach((arr: any) => {
      if (!Array.isArray(arr)) return
      arr.forEach((item: any) => {
        totalItems++
        if (isItemResolved(item)) resolvedItems++
        else if (item.pri?.includes('Urgente')) urgentUnresolved++
      })
    })
  })
  return { sunday, reports: reps, totalItems, resolvedItems, urgentUnresolved, hasUnresolved: resolvedItems < totalItems }
}

function buildHierarchy(published: Report[]): { years: YearGroup[]; sinFecha: SundayFolder | null } {
  // Agrupar por council_sunday
  const folderMap = new Map<string, Report[]>()
  published.forEach(r => {
    const key = r.council_sunday ?? r.council_date ?? 'sin-fecha'
    if (!folderMap.has(key)) folderMap.set(key, [])
    folderMap.get(key)!.push(r)
  })

  let sinFecha: SundayFolder | null = null
  const yearMap = new Map<number, Map<string, SundayFolder[]>>()

  Array.from(folderMap.entries()).forEach(([sunday, reps]) => {
    const folder = buildSundayFolder(sunday, reps)
    if (sunday === 'sin-fecha') { sinFecha = folder; return }
    const date = parseISO(sunday)
    const year = date.getFullYear()
    const monthKey = format(date, 'yyyy-MM')
    if (!yearMap.has(year)) yearMap.set(year, new Map())
    const monthMap = yearMap.get(year)!
    if (!monthMap.has(monthKey)) monthMap.set(monthKey, [])
    monthMap.get(monthKey)!.push(folder)
  })

  const years: YearGroup[] = Array.from(yearMap.entries())
    .sort(([a], [b]) => b - a)
    .map(([year, monthMap]) => {
      const months: MonthGroup[] = Array.from(monthMap.entries())
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([monthKey, folders]) => {
          folders.sort((a, b) => b.sunday.localeCompare(a.sunday))
          const totalItems = folders.reduce((s, f) => s + f.totalItems, 0)
          const resolvedItems = folders.reduce((s, f) => s + f.resolvedItems, 0)
          const date = new Date(monthKey + '-01T12:00:00')
          const monthLabel = format(date, 'MMMM', { locale: es })
          return { monthKey, monthLabel, folders, totalItems, resolvedItems }
        })
      const totalItems = months.reduce((s, m) => s + m.totalItems, 0)
      return { year, months, totalItems }
    })

  return { years, sinFecha }
}

// ── Componente principal ──────────────────────────────────────
export default function CouncilView({ reports, profile, onRefresh }: Props) {
  const supabase = createClient()
  const today = new Date()
  const currentYear = today.getFullYear()
  const currentMonthKey = format(today, 'yyyy-MM')

  // Todos los hooks ANTES del early return (regla de hooks de React)
  const [openYears, setOpenYears] = useState<Set<number>>(() => new Set([currentYear]))
  const [openMonths, setOpenMonths] = useState<Set<string>>(() => new Set([currentMonthKey]))
  const [openFolder, setOpenFolder] = useState<string | null>(null)
  const [editingLabel, setEditingLabel] = useState<string | null>(null)
  const [labelValue, setLabelValue] = useState('')
  const [loadingAction, setLoadingAction] = useState<string | null>(null) // Bug 6

  if (!isBishopric(profile.role)) {
    return <div className="card"><p className="text-sm text-red-600">Acceso restringido al obispado.</p></div>
  }

  const published = reports.filter(r => r.status === 'published')
  const { years, sinFecha } = buildHierarchy(published)

  function toggleYear(year: number) {
    setOpenYears(prev => { const n = new Set(prev); n.has(year) ? n.delete(year) : n.add(year); return n })
  }
  function toggleMonth(key: string) {
    setOpenMonths(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n })
  }

  function formatSunday(dateStr: string) {
    if (dateStr === 'sin-fecha') return 'Sin fecha asignada'
    try { return format(parseISO(dateStr), "EEEE d 'de' MMMM, yyyy", { locale: es }) } catch { return dateStr }
  }

  function isCurrentSunday(dateStr: string) {
    const day = today.getDay()
    const diff = day === 0 ? 0 : 7 - day
    const next = new Date(today)
    next.setDate(today.getDate() + diff)
    return dateStr === format(next, 'yyyy-MM-dd')
  }

  function getFolderLabel(folder: SundayFolder): string {
    for (const rep of folder.reports) {
      const lbl = (rep.data as any)?._folder_label
      if (lbl) return lbl
    }
    return formatSunday(folder.sunday)
  }

  // Bug 6: loading state en deleteFolder
  async function deleteFolder(folder: SundayFolder) {
    const name = getFolderLabel(folder)
    if (!confirm(`¿Eliminar la carpeta "${name}"?\n\nLos reportes volverán a borrador.`)) return
    setLoadingAction('delete-' + folder.sunday)
    for (const rep of folder.reports) {
      await supabase.from('reports').update({ status: 'draft' }).eq('id', rep.id)
    }
    setLoadingAction(null)
    await onRefresh()
  }

  // Bug 6: loading state en saveLabel
  async function saveLabel(folder: SundayFolder) {
    setLoadingAction('label-' + folder.sunday)
    await Promise.all(folder.reports.map(rep =>
      supabase.from('reports').update({
        data: { ...(rep.data as any), _folder_label: labelValue.trim() || null }
      }).eq('id', rep.id)
    ))
    setLoadingAction(null)
    setEditingLabel(null)
    await onRefresh()
  }

  const allEmpty = years.length === 0 && !sinFecha

  return (
    <div className="card">
      <div className="flex items-start justify-between mb-5 gap-3 flex-wrap">
        <div>
          <h2 className="font-serif text-xl text-slate-800 font-semibold">📋 Vista del Consejo</h2>
          <p className="text-xs text-slate-400 mt-1">Reportes organizados por año · mes · domingo</p>
        </div>
        <button onClick={onRefresh} className="btn btn-ghost btn-sm">↻ Actualizar</button>
      </div>

      {allEmpty ? (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-3 text-sm">
          Aún no hay reportes publicados.
        </div>
      ) : (
        <div className="space-y-2">

          {/* ── Jerarquía Año > Mes > Domingo ── */}
          {years.map(yg => {
            const isYearOpen = openYears.has(yg.year)
            return (
              <div key={yg.year} className="border border-slate-200 rounded-xl overflow-hidden">
                {/* Cabecera de AÑO */}
                <button
                  onClick={() => toggleYear(yg.year)}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-slate-800 text-white hover:bg-slate-700 transition-colors text-left"
                >
                  <span className="text-base font-bold flex-1">📁 {yg.year}</span>
                  <span className="text-xs opacity-60">
                    {yg.months.length} {yg.months.length === 1 ? 'mes' : 'meses'} · {yg.totalItems} items
                  </span>
                  {isYearOpen ? <ChevronUp size={14} className="opacity-60" /> : <ChevronDown size={14} className="opacity-60" />}
                </button>

                {isYearOpen && (
                  <div className="divide-y divide-slate-100">
                    {yg.months.map(mg => {
                      const isMonthOpen = openMonths.has(mg.monthKey)
                      const monthLabel = mg.monthLabel.charAt(0).toUpperCase() + mg.monthLabel.slice(1)
                      const pendientes = mg.totalItems - mg.resolvedItems
                      return (
                        <div key={mg.monthKey}>
                          {/* Cabecera de MES */}
                          <button
                            onClick={() => toggleMonth(mg.monthKey)}
                            className="w-full flex items-center gap-3 px-5 py-2.5 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
                          >
                            <span className="text-sm font-semibold text-slate-700 flex-1">📂 {monthLabel}</span>
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-slate-400">{mg.folders.length} {mg.folders.length === 1 ? 'domingo' : 'domingos'}</span>
                              {pendientes > 0 && (
                                <span className="bg-amber-100 text-amber-700 font-semibold px-2 py-0.5 rounded-full">
                                  {pendientes} pendiente{pendientes !== 1 ? 's' : ''}
                                </span>
                              )}
                              {pendientes === 0 && mg.totalItems > 0 && (
                                <span className="bg-emerald-100 text-emerald-700 font-semibold px-2 py-0.5 rounded-full">✓ Completo</span>
                              )}
                            </div>
                            {isMonthOpen ? <ChevronUp size={13} className="text-slate-400" /> : <ChevronDown size={13} className="text-slate-400" />}
                          </button>

                          {isMonthOpen && (
                            <div className="p-3 space-y-2">
                              {mg.folders.map(folder => (
                                <SundayFolderCard
                                  key={folder.sunday}
                                  folder={folder}
                                  isOpen={openFolder === folder.sunday}
                                  isEditing={editingLabel === folder.sunday}
                                  labelValue={labelValue}
                                  loadingAction={loadingAction}
                                  profile={profile}
                                  onRefresh={onRefresh}
                                  onToggle={() => setOpenFolder(openFolder === folder.sunday ? null : folder.sunday)}
                                  onStartEdit={() => { setEditingLabel(folder.sunday); setLabelValue(getFolderLabel(folder)) }}
                                  onCancelEdit={() => setEditingLabel(null)}
                                  onSaveLabel={() => saveLabel(folder)}
                                  onLabelChange={setLabelValue}
                                  onDelete={() => deleteFolder(folder)}
                                  getFolderLabel={getFolderLabel}
                                  formatSunday={formatSunday}
                                  isCurrentSunday={isCurrentSunday}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}

          {/* Reportes sin fecha */}
          {sinFecha && (
            <div className="border border-dashed border-slate-300 rounded-xl p-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-2">📅 Sin fecha asignada</p>
              <SundayFolderCard
                folder={sinFecha}
                isOpen={openFolder === 'sin-fecha'}
                isEditing={editingLabel === 'sin-fecha'}
                labelValue={labelValue}
                loadingAction={loadingAction}
                profile={profile}
                onRefresh={onRefresh}
                onToggle={() => setOpenFolder(openFolder === 'sin-fecha' ? null : 'sin-fecha')}
                onStartEdit={() => { setEditingLabel('sin-fecha'); setLabelValue(getFolderLabel(sinFecha)) }}
                onCancelEdit={() => setEditingLabel(null)}
                onSaveLabel={() => saveLabel(sinFecha)}
                onLabelChange={setLabelValue}
                onDelete={() => deleteFolder(sinFecha)}
                getFolderLabel={getFolderLabel}
                formatSunday={formatSunday}
                isCurrentSunday={isCurrentSunday}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Tarjeta de domingo (nivel hoja) ───────────────────────────
function SundayFolderCard({
  folder, isOpen, isEditing, labelValue, loadingAction, profile, onRefresh,
  onToggle, onStartEdit, onCancelEdit, onSaveLabel, onLabelChange, onDelete,
  getFolderLabel, formatSunday, isCurrentSunday,
}: {
  folder: SundayFolder
  isOpen: boolean
  isEditing: boolean
  labelValue: string
  loadingAction: string | null
  profile: Profile
  onRefresh: () => Promise<void>
  onToggle: () => void
  onStartEdit: () => void
  onCancelEdit: () => void
  onSaveLabel: () => void
  onLabelChange: (v: string) => void
  onDelete: () => void
  getFolderLabel: (f: SundayFolder) => string
  formatSunday: (s: string) => string
  isCurrentSunday: (s: string) => boolean
}) {
  const isCurrent = isCurrentSunday(folder.sunday)
  const allDone = !folder.hasUnresolved && folder.totalItems > 0
  const hasUrgent = folder.urgentUnresolved > 0
  const displayLabel = getFolderLabel(folder)
  const isLoadingDelete = loadingAction === 'delete-' + folder.sunday
  const isLoadingLabel = loadingAction === 'label-' + folder.sunday

  return (
    <div className={`border rounded-xl overflow-hidden ${isCurrent ? 'border-amber-400' : 'border-slate-200'}`}>
      <div className="flex items-center gap-3 p-3.5 bg-slate-50 hover:bg-slate-100 transition-colors">
        {/* Fecha */}
        <div
          className={`w-11 h-11 rounded-xl flex flex-col items-center justify-center flex-shrink-0 cursor-pointer ${isCurrent ? 'bg-slate-800 text-white' : 'bg-white border border-slate-200'}`}
          onClick={onToggle}
        >
          {folder.sunday !== 'sin-fecha' ? (
            <>
              <span className="text-[9px] font-bold uppercase opacity-70">
                {format(parseISO(folder.sunday), 'MMM', { locale: es }).toUpperCase()}
              </span>
              <span className={`text-base font-bold leading-none ${isCurrent ? 'text-white' : 'text-slate-800'}`}>
                {format(parseISO(folder.sunday), 'd')}
              </span>
            </>
          ) : (
            <span className="text-slate-400 text-lg">?</span>
          )}
        </div>

        {/* Info / edición de label */}
        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => !isEditing && onToggle()}>
          {isEditing ? (
            <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
              <input
                className="input text-sm py-1.5 flex-1"
                value={labelValue}
                onChange={e => onLabelChange(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') onSaveLabel(); if (e.key === 'Escape') onCancelEdit() }}
                autoFocus
              />
              <button onClick={onSaveLabel} disabled={isLoadingLabel} className="btn btn-navy btn-sm">
                {isLoadingLabel ? '...' : '✓'}
              </button>
              <button onClick={onCancelEdit} className="btn btn-ghost btn-sm">✕</button>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-sm text-slate-700 capitalize">{displayLabel}</p>
                {isCurrent && <span className="text-[10px] font-semibold bg-amber-600 text-white px-2 py-0.5 rounded-full">Próximo consejo</span>}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {folder.reports.length} org · {folder.totalItems} items · {folder.resolvedItems} resueltos
              </p>
            </div>
          )}
        </div>

        {/* Badges + acciones */}
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
          <button
            onClick={e => { e.stopPropagation(); onStartEdit() }}
            className="icon-btn-edit" title="Renombrar"
          ><Pencil size={13} /></button>
          <button
            onClick={e => { e.stopPropagation(); onDelete() }}
            disabled={isLoadingDelete}
            className="icon-btn-delete" title="Eliminar carpeta"
          >{isLoadingDelete ? <span className="text-[10px]">...</span> : <Trash2 size={13} />}</button>
          <button onClick={onToggle} className="text-slate-400 ml-1">
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
}

// ── Contenido expandido del domingo ──────────────────────────
function FolderContent({ reports, profile, onRefresh }: { reports: Report[]; profile: Profile; onRefresh: () => Promise<void> }) {
  const supabase = createClient()

  // Actualiza un item dentro de data[field], aplicando `updater` al item con id === itemId
  async function updateItem(reportId: string, field: string, itemId: string, updater: (i: any) => any) {
    const rep = reports.find(r => r.id === reportId)
    if (!rep) return
    const items = ((rep.data as any)[field] ?? []).map((i: any) => i.id === itemId ? updater(i) : i)
    await supabase.from('reports').update({ data: { ...rep.data, [field]: items } }).eq('id', reportId)
    await onRefresh()
  }

  // Agrega una nota nueva al historial, sin cambiar el estado resuelto/pendiente
  async function addNote(reportId: string, field: string, itemId: string, text: string, byBishop: boolean) {
    await updateItem(reportId, field, itemId, i => {
      const { resolution, ...rest } = i
      const notes = getItemNotes(i)
      const newNote = { id: genId(), text, by: profile.name, byBishop, ts: Date.now() }
      return { ...rest, notes: [...notes, newNote], resolved: isItemResolved(i) }
    })
  }

  // Edita el texto de una nota existente (por confusiones o errores)
  async function editNote(reportId: string, field: string, itemId: string, noteId: string, text: string) {
    await updateItem(reportId, field, itemId, i => {
      const { resolution, ...rest } = i
      const notes = getItemNotes(i).map((n: any) => n.id === noteId ? { ...n, text, editedAt: Date.now() } : n)
      return { ...rest, notes, resolved: isItemResolved(i) }
    })
  }

  // Cambia el estado resuelto/pendiente de forma independiente de las notas
  async function setResolved(reportId: string, field: string, itemId: string, value: boolean) {
    await updateItem(reportId, field, itemId, i => {
      const { resolution, ...rest } = i
      return {
        ...rest,
        notes: getItemNotes(i),
        resolved: value,
        ...(value ? { resolvedBy: profile.name, resolvedAt: Date.now() } : { resolvedBy: undefined, resolvedAt: undefined }),
      }
    })
  }

  async function deleteItem(reportId: string, sid: string, itemId: string) {
    if (!confirm('¿Eliminar este asunto de la Vista del Consejo?')) return
    const rep = reports.find(r => r.id === reportId)
    if (!rep) return
    const items = ((rep.data as any)[sid] ?? []).filter((i: any) => i.id !== itemId)
    await supabase.from('reports').update({ data: { ...rep.data, [sid]: items } }).eq('id', reportId)
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
  reports.forEach(r => {
    Object.values(r.data ?? {}).forEach((arr: any) => {
      if (!Array.isArray(arr)) return
      arr.forEach((i: any) => { total++; if (isItemResolved(i)) resolved++ })
    })
  })

  return (
    <div>
      <div className="flex gap-2 mb-4 flex-wrap">
        <div className="bg-slate-800 text-white rounded-lg px-3 py-2 text-xs font-semibold">{reports.length} org</div>
        <div className="bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold text-slate-700">{total} items</div>
        {resolved > 0 && <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-xs font-semibold text-emerald-700">✅ {resolved} resueltos</div>}
        {total - resolved > 0 && <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs font-semibold text-amber-700">⏳ {total - resolved} pendientes</div>}
      </div>

      {total === 0 && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-3 text-sm">
          ⚠️ Este reporte fue publicado sin asuntos. Pide a la organización que agregue contenido y vuelva a publicar.
        </div>
      )}

      {SECTIONS.map(s => {
        const blocks: { org: typeof ORGS[number]; items: any[]; repId: string }[] = []
        ORGS.forEach(org => {
          const rep = reports.filter(r => r.org_id === org.id).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0]
          if (!rep) return
          const items = (rep.data as any)[s.id] ?? []
          if (!Array.isArray(items) || !items.length) return
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
                  ? items.map((it: any) => <MUCard key={it.id} it={it} repId={repId} profile={profile} onAddNote={addNote} onEditNote={editNote} onSetResolved={setResolved} onDelete={deleteMuItem} />)
                  : items.map((it: any) => <ItemCard key={it.id} it={it} sid={s.id} sec={s} repId={repId} orgColor={org.color} profile={profile} onAddNote={addNote} onEditNote={editNote} onSetResolved={setResolved} onDelete={deleteItem} />)
                }
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}

function ItemCard({ it, sid, sec, repId, orgColor, profile, onAddNote, onEditNote, onSetResolved, onDelete }: any) {
  const [showNoteForm, setShowNoteForm] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [editNoteText, setEditNoteText] = useState('')
  const resolved = isItemResolved(it)
  const notes = getItemNotes(it)
  const canAct = isBishopric(profile.role)
  const pc = priColor(it.pri)

  return (
    <div className={`rounded-xl p-3.5 mb-2 border-l-[3px] ${resolved ? 'opacity-70 bg-slate-50' : ''}`}
      style={!resolved ? { background: sec.bg, borderLeftColor: orgColor } : { borderLeftColor: '#94a3b8' }}>
      <div className="flex items-start justify-between gap-2 mb-1">
        <p className={`font-semibold text-sm ${resolved ? 'text-slate-500' : 'text-slate-700'}`}>{it.title}</p>
        <button onClick={() => onDelete(repId, sid, it.id)} className="icon-btn-delete flex-shrink-0" title="Eliminar"><Trash2 size={13} /></button>
      </div>
      {it.body && <p className="text-sm text-slate-600 mb-2">{it.body}</p>}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full" style={{ background: pc.bg, color: pc.c }}>{it.pri}</span>
        {resolved
          ? <span className="flex items-center gap-1 text-[10px] font-semibold bg-emerald-100 text-emerald-700 rounded-full px-2 py-0.5"><CheckCircle size={11} /> Resuelto</span>
          : <span className="flex items-center gap-1 text-[10px] font-semibold bg-amber-100 text-amber-700 rounded-full px-2 py-0.5"><AlertTriangle size={11} /> Pendiente</span>
        }
      </div>

      {notes.length > 0 && (
        <div className="mt-2.5 space-y-1.5">
          {notes.map((n: any) => (
            <div key={n.id} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[11px] font-semibold text-slate-600 mb-0.5">
                  {n.byBishop ? '✍️ Respuesta del Obispo' : '📝 Nota'} · {n.by}{n.editedAt ? ' (editado)' : ''}
                </p>
                {canAct && editingNoteId !== n.id && (
                  <button onClick={() => { setEditingNoteId(n.id); setEditNoteText(n.text) }} className="icon-btn-edit flex-shrink-0" title="Editar nota"><Pencil size={12} /></button>
                )}
              </div>
              {editingNoteId === n.id ? (
                <div className="mt-1">
                  <textarea className="input min-h-[56px] resize-none text-xs" value={editNoteText} onChange={e => setEditNoteText(e.target.value)} autoFocus />
                  <div className="flex gap-2 mt-2">
                    <button className="btn btn-navy btn-sm text-xs" onClick={async () => { await onEditNote(repId, sid, it.id, n.id, editNoteText); setEditingNoteId(null) }}>Guardar</button>
                    <button className="btn btn-ghost btn-sm text-xs" onClick={() => setEditingNoteId(null)}>Cancelar</button>
                  </div>
                </div>
              ) : (
                n.text && <p className="text-xs text-slate-500">{n.text}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {canAct && (
        <div className="flex gap-2 mt-2.5 flex-wrap">
          <button onClick={() => setShowNoteForm(v => !v)} className="btn btn-gold btn-sm text-xs">💬 Agregar nota</button>
          {resolved
            ? <button onClick={() => onSetResolved(repId, sid, it.id, false)} className="btn btn-ghost btn-sm text-xs">↩ Marcar pendiente</button>
            : <button onClick={() => onSetResolved(repId, sid, it.id, true)} className="btn btn-green btn-sm text-xs">✅ Marcar resuelto</button>
          }
        </div>
      )}

      {showNoteForm && (
        <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
          <label className="label">{sec.isObisp ? 'Respuesta del Obispo' : 'Nueva nota'}</label>
          <textarea className="input min-h-[56px] resize-none text-sm" value={noteText} onChange={e => setNoteText(e.target.value)} autoFocus />
          <div className="flex gap-2 mt-2">
            <button className="btn btn-navy btn-sm" onClick={async () => {
              if (!noteText.trim()) return
              await onAddNote(repId, sid, it.id, noteText.trim(), !!sec.isObisp)
              setNoteText(''); setShowNoteForm(false)
            }}>Enviar</button>
            <button className="btn btn-ghost btn-sm" onClick={() => { setShowNoteForm(false); setNoteText('') }}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  )
}

function MUCard({ it, repId, profile, onAddNote, onEditNote, onSetResolved, onDelete }: any) {
  const [showNoteForm, setShowNoteForm] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [editNoteText, setEditNoteText] = useState('')
  const mt = getMuType(it.muType)
  const resolved = isItemResolved(it)
  const notes = getItemNotes(it)
  const canAct = isBishopric(profile.role)

  return (
    <div className="rounded-xl p-3.5 mb-2.5 border border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="font-semibold text-sm text-slate-700">{it.memberName}</p>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600">{mt.label}</span>
          {resolved
            ? <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-700 rounded-full px-2 py-0.5">✅ Actualizado</span>
            : <span className="text-[10px] font-semibold bg-amber-100 text-amber-700 rounded-full px-2 py-0.5">⏳ Pendiente</span>
          }
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

      {notes.length > 0 && (
        <div className="mt-2.5 space-y-1.5">
          {notes.map((n: any) => (
            <div key={n.id} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[11px] font-semibold text-slate-600 mb-0.5">📝 {n.by}{n.editedAt ? ' (editado)' : ''}</p>
                {canAct && editingNoteId !== n.id && (
                  <button onClick={() => { setEditingNoteId(n.id); setEditNoteText(n.text) }} className="icon-btn-edit flex-shrink-0" title="Editar nota"><Pencil size={12} /></button>
                )}
              </div>
              {editingNoteId === n.id ? (
                <div className="mt-1">
                  <textarea className="input min-h-[56px] resize-none text-xs" value={editNoteText} onChange={e => setEditNoteText(e.target.value)} autoFocus />
                  <div className="flex gap-2 mt-2">
                    <button className="btn btn-navy btn-sm text-xs" onClick={async () => { await onEditNote(repId, 'datos_miembros', it.id, n.id, editNoteText); setEditingNoteId(null) }}>Guardar</button>
                    <button className="btn btn-ghost btn-sm text-xs" onClick={() => setEditingNoteId(null)}>Cancelar</button>
                  </div>
                </div>
              ) : (
                n.text && <p className="text-xs text-slate-500 mt-0.5">{n.text}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {canAct && (
        <div className="flex gap-2 mt-2.5 flex-wrap">
          <button onClick={() => setShowNoteForm(v => !v)} className="btn btn-gold btn-sm text-xs">💬 Agregar nota</button>
          {resolved
            ? <button onClick={() => onSetResolved(repId, 'datos_miembros', it.id, false)} className="btn btn-ghost btn-sm text-xs">↩ Marcar pendiente</button>
            : <button onClick={() => onSetResolved(repId, 'datos_miembros', it.id, true)} className="btn btn-green btn-sm text-xs">✅ Marcar actualizado</button>
          }
        </div>
      )}

      {showNoteForm && (
        <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
          <label className="label">Nueva nota</label>
          <textarea className="input min-h-[56px] resize-none text-sm" value={noteText} onChange={e => setNoteText(e.target.value)} autoFocus />
          <div className="flex gap-2 mt-2">
            <button className="btn btn-navy btn-sm" onClick={async () => {
              if (!noteText.trim()) return
              await onAddNote(repId, 'datos_miembros', it.id, noteText.trim(), false)
              setNoteText(''); setShowNoteForm(false)
            }}>Enviar</button>
            <button className="btn btn-ghost btn-sm" onClick={() => { setShowNoteForm(false); setNoteText('') }}>Cancelar</button>
          </div>
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
