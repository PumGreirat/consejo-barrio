'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Profile, Report, emptyReportData, getOrg } from '@/types'
import ReportEditor from './ReportEditor'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Plus, Trash2, Pencil, Check, X, ChevronDown, ChevronUp } from 'lucide-react'

interface Props {
  profile: Profile
  reports: Report[]
  onRefresh: () => Promise<void>
}

// ── Jerarquía Año > Mes > Semana ──────────────────────────────
interface WeekGroup { sunday: string; reports: Report[] }
interface MonthGroup { year: number; month: number; monthKey: string; monthLabel: string; weeks: WeekGroup[] }
interface YearGroup { year: number; months: MonthGroup[] }

function buildHierarchy(reports: Report[]): { years: YearGroup[]; sinFecha: Report[] } {
  const sinFecha: Report[] = []
  // Map: year -> monthKey -> sunday -> reports[]
  const yearMap = new Map<number, Map<string, Map<string, Report[]>>>()

  reports.forEach(r => {
    const sunday = r.council_sunday ?? r.council_date
    if (!sunday) { sinFecha.push(r); return }
    const date = new Date(sunday + 'T12:00:00')
    const year = date.getFullYear()
    const monthKey = format(date, 'yyyy-MM')
    if (!yearMap.has(year)) yearMap.set(year, new Map())
    const monthMap = yearMap.get(year)!
    if (!monthMap.has(monthKey)) monthMap.set(monthKey, new Map())
    const weekMap = monthMap.get(monthKey)!
    if (!weekMap.has(sunday)) weekMap.set(sunday, [])
    weekMap.get(sunday)!.push(r)
  })

  const years: YearGroup[] = Array.from(yearMap.entries())
    .sort(([a], [b]) => b - a)
    .map(([year, monthMap]) => ({
      year,
      months: Array.from(monthMap.entries())
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([monthKey, weekMap]) => {
          const date = new Date(monthKey + '-01T12:00:00')
          return {
            year,
            month: date.getMonth(),
            monthKey,
            monthLabel: format(date, 'MMMM', { locale: es }),
            weeks: Array.from(weekMap.entries())
              .sort(([a], [b]) => b.localeCompare(a))
              .map(([sunday, reports]) => ({ sunday, reports })),
          }
        }),
    }))
  return { years, sinFecha }
}

function countItems(reports: Report[]) {
  return reports.reduce((sum, r) =>
    sum + Object.values(r.data ?? {}).reduce((s, val) => s + (Array.isArray(val) ? val.length : 0), 0)
  , 0)
}

export default function ReportsTab({ profile, reports, onRefresh }: Props) {
  const [activeReport, setActiveReport] = useState<Report | null>(null)
  const [showNewModal, setShowNewModal] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0])
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const supabase = createClient()
  const org = getOrg(profile.role)

  const today = new Date()
  const currentYear = today.getFullYear()
  const currentMonthKey = format(today, 'yyyy-MM')

  const [openYears, setOpenYears] = useState<Set<number>>(() => new Set([currentYear]))
  const [openMonths, setOpenMonths] = useState<Set<string>>(() => new Set([currentMonthKey]))

  const myReports = reports
    .filter(r => r.org_id === org.id && !(r as any).hidden_by_org)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  const { years, sinFecha } = buildHierarchy(myReports)

  function toggleYear(year: number) {
    setOpenYears(prev => { const n = new Set(prev); n.has(year) ? n.delete(year) : n.add(year); return n })
  }
  function toggleMonth(key: string) {
    setOpenMonths(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n })
  }

  function getNextSunday(from: Date = new Date()): string {
    const day = from.getDay()
    const diff = day === 0 ? 0 : 7 - day
    const sunday = new Date(from)
    sunday.setDate(from.getDate() + diff)
    return sunday.toISOString().split('T')[0]
  }

  async function createReport() {
    if (!newName.trim()) return
    setCreating(true)
    const sunday = getNextSunday(newDate ? new Date(newDate + 'T12:00:00') : new Date())
    const { data } = await supabase.from('reports').insert({
      org_id: org.id,
      created_by: profile.id,
      created_by_name: profile.name,
      name: newName.trim(),
      council_date: newDate || null,
      council_sunday: sunday,
      status: 'draft',
      data: emptyReportData(),
    }).select().single()
    setCreating(false)
    if (data) {
      await onRefresh()
      setActiveReport(data as Report)
      setShowNewModal(false)
      setNewName('')
      // Abrir el año y mes del nuevo reporte automáticamente
      const d = new Date(sunday + 'T12:00:00')
      setOpenYears(prev => { const n = new Set(prev); n.add(d.getFullYear()); return n })
      setOpenMonths(prev => { const n = new Set(prev); n.add(format(d, 'yyyy-MM')); return n })
    }
  }

  async function hideReport(rep: Report, e: React.MouseEvent) {
    e.stopPropagation()
    const msg = rep.status === 'published'
      ? `¿Eliminar "${rep.name}" de tus reportes?\n\nComo está publicado, los asuntos que enviaste al Consejo seguirán apareciendo en la Vista del Consejo. Solo el obispado puede eliminarlos de ahí.`
      : `¿Eliminar el reporte "${rep.name}"?\n\nEsta acción no se puede deshacer.`
    if (!confirm(msg)) return
    if (rep.status === 'published') {
      await supabase.from('reports').update({ hidden_by_org: true } as any).eq('id', rep.id)
    } else {
      await supabase.from('reports').delete().eq('id', rep.id)
    }
    await onRefresh()
  }

  async function saveReportName(rep: Report) {
    if (!editingName.trim()) { setEditingId(null); return }
    await supabase.from('reports').update({ name: editingName.trim() }).eq('id', rep.id)
    setEditingId(null)
    await onRefresh()
  }

  if (activeReport) {
    return (
      <ReportEditor
        report={activeReport}
        profile={profile}
        onBack={async () => { await onRefresh(); setActiveReport(null) }}
        onUpdate={async (updated) => { setActiveReport(updated); await onRefresh() }}
      />
    )
  }

  return (
    <div>
      <div className="card">
        <div className="flex items-start justify-between mb-5 gap-3 flex-wrap">
          <div>
            <h2 className="font-serif text-xl text-navy font-semibold">📝 Mis Reportes</h2>
            <p className="text-xs text-gray-400 mt-1">Organización: {org.name}</p>
          </div>
          <span className="px-3.5 py-1.5 rounded-full text-xs font-bold"
            style={{ background: org.color + '18', color: org.color, border: `1.5px solid ${org.color}40` }}>
            {org.name}
          </span>
        </div>

        <button onClick={() => setShowNewModal(true)} className="btn btn-navy mb-5">
          <Plus size={15} /> Nuevo reporte
        </button>

        {myReports.length === 0 ? (
          <p className="text-sm text-gray-400 italic py-4">No hay reportes aún. Crea el primero.</p>
        ) : (
          <div className="space-y-2">

            {/* ── Jerarquía Año > Mes > Semana ── */}
            {years.map(yg => {
              const isYearOpen = openYears.has(yg.year)
              const totalYear = countItems(yg.months.flatMap(m => m.weeks.flatMap(w => w.reports)))
              return (
                <div key={yg.year} className="border border-slate-200 rounded-xl overflow-hidden">
                  {/* Cabecera de AÑO */}
                  <button
                    onClick={() => toggleYear(yg.year)}
                    className="w-full flex items-center gap-3 px-4 py-3 bg-slate-800 text-white hover:bg-slate-700 transition-colors text-left"
                  >
                    <span className="text-base font-bold flex-1">📁 {yg.year}</span>
                    <span className="text-xs opacity-60">{yg.months.length} {yg.months.length === 1 ? 'mes' : 'meses'} · {totalYear} items</span>
                    {isYearOpen ? <ChevronUp size={14} className="opacity-60" /> : <ChevronDown size={14} className="opacity-60" />}
                  </button>

                  {isYearOpen && (
                    <div className="divide-y divide-slate-100">
                      {yg.months.map(mg => {
                        const isMonthOpen = openMonths.has(mg.monthKey)
                        const totalMonth = countItems(mg.weeks.flatMap(w => w.reports))
                        const monthLabel = mg.monthLabel.charAt(0).toUpperCase() + mg.monthLabel.slice(1)
                        return (
                          <div key={mg.monthKey}>
                            {/* Cabecera de MES */}
                            <button
                              onClick={() => toggleMonth(mg.monthKey)}
                              className="w-full flex items-center gap-3 px-5 py-2.5 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
                            >
                              <span className="text-sm font-semibold text-slate-700 flex-1">📂 {monthLabel}</span>
                              <span className="text-xs text-slate-400">{mg.weeks.length} {mg.weeks.length === 1 ? 'semana' : 'semanas'} · {totalMonth} items</span>
                              {isMonthOpen ? <ChevronUp size={13} className="text-slate-400" /> : <ChevronDown size={13} className="text-slate-400" />}
                            </button>

                            {isMonthOpen && (
                              <div className="px-4 py-2 space-y-1.5">
                                {mg.weeks.map(wg => {
                                  const sundayDate = new Date(wg.sunday + 'T12:00:00')
                                  const weekLabel = format(sundayDate, "d 'de' MMMM", { locale: es })
                                  return (
                                    <div key={wg.sunday}>
                                      {/* Etiqueta de SEMANA */}
                                      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mt-2 mb-1.5 pl-1">
                                        📅 Semana del {weekLabel}
                                      </p>
                                      {/* Tarjetas de reportes */}
                                      {wg.reports.map(r => (
                                        <ReportCard
                                          key={r.id}
                                          r={r}
                                          editingId={editingId}
                                          editingName={editingName}
                                          onOpen={() => !editingId && setActiveReport(r)}
                                          onEdit={(id, name) => { setEditingId(id); setEditingName(name) }}
                                          onSave={() => saveReportName(r)}
                                          onCancelEdit={() => setEditingId(null)}
                                          onNameChange={setEditingName}
                                          onHide={(e) => hideReport(r, e)}
                                        />
                                      ))}
                                    </div>
                                  )
                                })}
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

            {/* Reportes sin fecha asignada */}
            {sinFecha.length > 0 && (
              <div className="border border-dashed border-slate-300 rounded-xl p-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-2">📅 Sin fecha asignada</p>
                <div className="space-y-1.5">
                  {sinFecha.map(r => (
                    <ReportCard
                      key={r.id}
                      r={r}
                      editingId={editingId}
                      editingName={editingName}
                      onOpen={() => !editingId && setActiveReport(r)}
                      onEdit={(id, name) => { setEditingId(id); setEditingName(name) }}
                      onSave={() => saveReportName(r)}
                      onCancelEdit={() => setEditingId(null)}
                      onNameChange={setEditingName}
                      onHide={(e) => hideReport(r, e)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODAL — Nuevo Reporte */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl">
            <h3 className="font-serif text-xl text-navy font-semibold mb-1">Nuevo Reporte</h3>
            <p className="text-sm text-gray-400 mb-5">Dale un nombre para identificarlo fácilmente</p>
            <div className="mb-4">
              <label className="label">Nombre del reporte</label>
              <input className="input" type="text" placeholder="Ej: Consejo de Barrio — Mayo 2026"
                value={newName} onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && createReport()} autoFocus />
            </div>
            <div className="mb-2">
              <label className="label">Fecha del consejo</label>
              <input className="input" type="date" value={newDate} onChange={e => setNewDate(e.target.value)} />
            </div>
            {newDate && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-5">
                📁 Se guardará en <strong>
                  {format(new Date(newDate + 'T12:00:00'), "MMMM yyyy", { locale: es })}
                </strong> → Semana del <strong>
                  {format(new Date(getNextSunday(new Date(newDate + 'T12:00:00')) + 'T12:00:00'), "d 'de' MMMM", { locale: es })}
                </strong>
              </p>
            )}
            <div className="flex gap-2.5">
              <button className="btn btn-navy" onClick={createReport} disabled={creating || !newName.trim()}>
                {creating ? 'Creando...' : 'Crear reporte'}
              </button>
              <button className="btn btn-ghost" onClick={() => { setShowNewModal(false); setNewName('') }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Tarjeta de reporte reutilizable ───────────────────────────
function ReportCard({
  r, editingId, editingName,
  onOpen, onEdit, onSave, onCancelEdit, onNameChange, onHide
}: {
  r: Report
  editingId: string | null
  editingName: string
  onOpen: () => void
  onEdit: (id: string, name: string) => void
  onSave: () => void
  onCancelEdit: () => void
  onNameChange: (v: string) => void
  onHide: (e: React.MouseEvent) => void
}) {
  const pub = r.status === 'published'
  // Bug 2 fix: ignorar _folder_label (string) al contar items
  const totalItems = Object.values(r.data ?? {}).reduce((a, val) => a + (Array.isArray(val) ? val.length : 0), 0)
  const updStr = format(new Date(r.updated_at), "d MMM · HH:mm", { locale: es })
  const isEditing = editingId === r.id

  return (
    <div className="flex items-center gap-3 p-3.5 rounded-xl border-[1.5px] border-[#ddd6c8] bg-white hover:border-gold hover:bg-amber-50/30 transition-all">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 cursor-pointer"
        style={{ background: pub ? '#dcfce7' : '#fef9c3' }}
        onClick={() => !isEditing && onOpen()}>
        {pub ? '📤' : '📝'}
      </div>

      <div className="flex-1 min-w-0">
        {isEditing ? (
          <div className="flex items-center gap-2">
            <input
              className="input text-sm py-1.5 flex-1"
              value={editingName}
              onChange={e => onNameChange(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') onSave(); if (e.key === 'Escape') onCancelEdit() }}
              autoFocus
              onClick={e => e.stopPropagation()}
            />
            <button onClick={onSave} className="w-7 h-7 rounded-lg bg-green-100 text-green-700 flex items-center justify-center hover:bg-green-200 transition-colors">
              <Check size={13} />
            </button>
            <button onClick={onCancelEdit} className="w-7 h-7 rounded-lg bg-gray-100 text-gray-500 flex items-center justify-center hover:bg-gray-200 transition-colors">
              <X size={13} />
            </button>
          </div>
        ) : (
          <div className="cursor-pointer" onClick={onOpen}>
            <p className="font-bold text-sm text-navy truncate">{r.name}</p>
            <p className="text-xs text-gray-400 mt-0.5">{totalItems} items · {updStr}</p>
          </div>
        )}
      </div>

      {!isEditing && (
        <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full whitespace-nowrap flex-shrink-0 ${pub ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-800'}`}>
          {pub ? '✓ Publicado' : 'Borrador'}
        </span>
      )}

      {!isEditing && (
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={e => { e.stopPropagation(); onEdit(r.id, r.name) }}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-300 hover:text-navy hover:bg-gray-100 transition-colors"
            title="Editar nombre"
          ><Pencil size={13} /></button>
          <button
            onClick={onHide}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
            title="Eliminar reporte"
          ><Trash2 size={13} /></button>
        </div>
      )}
    </div>
  )
}
