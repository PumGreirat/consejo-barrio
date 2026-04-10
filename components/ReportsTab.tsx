'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Profile, Report, emptyReportData, getOrg } from '@/types'
import ReportEditor from './ReportEditor'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Plus, Trash2, Pencil, Check, X } from 'lucide-react'

interface Props {
  profile: Profile
  reports: Report[]
  onRefresh: () => Promise<void>
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

  // Only show reports that haven't been hidden by the org
  const myReports = reports
    .filter(r => r.org_id === org.id && !(r as any).hidden_by_org)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

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
    }
  }

  async function hideReport(rep: Report, e: React.MouseEvent) {
    e.stopPropagation()
    const msg = rep.status === 'published'
      ? `¿Eliminar "${rep.name}" de tus reportes?\n\nComo está publicado, los asuntos que enviaste al Consejo seguirán apareciendo en la Vista del Consejo. Solo el obispado puede eliminarlos de ahí.`
      : `¿Eliminar el reporte "${rep.name}"?\n\nEsta acción no se puede deshacer.`
    if (!confirm(msg)) return
    if (rep.status === 'published') {
      // Just hide from org view, keep in council view
      await supabase.from('reports').update({ hidden_by_org: true } as any).eq('id', rep.id)
    } else {
      // Draft — delete completely
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
          <div className="space-y-2.5">
            {myReports.map(r => {
              const pub = r.status === 'published'
              const totalItems = Object.values(r.data ?? {}).reduce((a, arr) => a + (arr?.length ?? 0), 0)
              const sundayStr = r.council_sunday
                ? format(new Date(r.council_sunday + 'T12:00:00'), "d 'de' MMMM", { locale: es })
                : r.council_date
                  ? format(new Date(r.council_date + 'T12:00:00'), "d 'de' MMMM, yyyy", { locale: es })
                  : 'Sin fecha'
              const updStr = format(new Date(r.updated_at), "d MMM · HH:mm", { locale: es })
              const isEditing = editingId === r.id

              return (
                <div key={r.id} className="flex items-center gap-3 p-4 rounded-xl border-[1.5px] border-[#ddd6c8] bg-white hover:border-gold hover:bg-amber-50/30 transition-all">
                  {/* Icon */}
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0 cursor-pointer"
                    style={{ background: pub ? '#dcfce7' : '#fef9c3' }}
                    onClick={() => !isEditing && setActiveReport(r)}>
                    {pub ? '📤' : '📝'}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <input
                          className="input text-sm py-1.5 flex-1"
                          value={editingName}
                          onChange={e => setEditingName(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') saveReportName(r); if (e.key === 'Escape') setEditingId(null) }}
                          autoFocus
                          onClick={e => e.stopPropagation()}
                        />
                        <button onClick={() => saveReportName(r)} className="w-7 h-7 rounded-lg bg-green-100 text-green-700 flex items-center justify-center hover:bg-green-200 transition-colors">
                          <Check size={13} />
                        </button>
                        <button onClick={() => setEditingId(null)} className="w-7 h-7 rounded-lg bg-gray-100 text-gray-500 flex items-center justify-center hover:bg-gray-200 transition-colors">
                          <X size={13} />
                        </button>
                      </div>
                    ) : (
                      <div className="cursor-pointer" onClick={() => setActiveReport(r)}>
                        <p className="font-bold text-sm text-navy truncate">{r.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Consejo: {sundayStr} · {totalItems} items · {updStr}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Status pill */}
                  {!isEditing && (
                    <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full whitespace-nowrap flex-shrink-0 ${pub ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-800'}`}>
                      {pub ? '✓ Publicado' : 'Borrador'}
                    </span>
                  )}

                  {/* Actions */}
                  {!isEditing && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={e => { e.stopPropagation(); setEditingId(r.id); setEditingName(r.name) }}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-300 hover:text-navy hover:bg-gray-100 transition-colors"
                        title="Editar nombre"
                      ><Pencil size={13} /></button>
                      <button
                        onClick={e => hideReport(r, e)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                        title="Eliminar reporte"
                      ><Trash2 size={13} /></button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* NEW REPORT MODAL */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl">
            <h3 className="font-serif text-xl text-navy font-semibold mb-1">Nuevo Reporte</h3>
            <p className="text-sm text-gray-400 mb-5">Dale un nombre para identificarlo fácilmente</p>
            <div className="mb-4">
              <label className="label">Nombre del reporte</label>
              <input className="input" type="text" placeholder="Ej: Consejo de Barrio — Abril 2025"
                value={newName} onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && createReport()} autoFocus />
            </div>
            <div className="mb-2">
              <label className="label">Fecha del consejo</label>
              <input className="input" type="date" value={newDate} onChange={e => setNewDate(e.target.value)} />
            </div>
            {newDate && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-5">
                📅 Se asignará al domingo <strong>
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
