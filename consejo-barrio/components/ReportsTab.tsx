'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Profile, Report, emptyReportData, getOrg, isBishopric, SECTIONS } from '@/types'
import ReportEditor from './ReportEditor'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Plus, FileText, Send } from 'lucide-react'

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
  const supabase = createClient()
  const org = getOrg(profile.role)
  const isBish = isBishopric(profile.role)

  // Filter: own org reports + (if bishop) all published
  const myReports = reports.filter(r =>
    r.org_id === org.id || (isBish && r.status === 'published')
  )

  async function createReport() {
    if (!newName.trim()) return
    setCreating(true)
    const { data, error } = await supabase.from('reports').insert({
      org_id: org.id,
      created_by: profile.id,
      created_by_name: profile.name,
      name: newName.trim(),
      council_date: newDate || null,
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
          <span className="org-badge px-3.5 py-1.5 rounded-full text-xs font-bold" style={{ background: org.color + '18', color: org.color, border: `1.5px solid ${org.color}40` }}>
            {org.name}
          </span>
        </div>

        <button
          onClick={() => setShowNewModal(true)}
          className="btn btn-navy mb-5"
        >
          <Plus size={15} /> Nuevo reporte
        </button>

        {myReports.length === 0 ? (
          <p className="text-sm text-gray-400 italic py-4">No hay reportes aún. Crea el primero.</p>
        ) : (
          <div className="space-y-2.5">
            {myReports.map(r => {
              const pub = r.status === 'published'
              const totalItems = Object.values(r.data ?? {}).reduce((a, arr) => a + (arr?.length ?? 0), 0)
              const dateStr = r.council_date
                ? format(new Date(r.council_date + 'T12:00:00'), "d 'de' MMMM, yyyy", { locale: es })
                : 'Sin fecha'
              const updStr = format(new Date(r.updated_at), "d MMM · HH:mm", { locale: es })
              const isOwn = r.org_id === org.id

              return (
                <button
                  key={r.id}
                  onClick={() => setActiveReport(r)}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border-[1.5px] border-[#ddd6c8] bg-white hover:border-gold hover:bg-amber-50/30 transition-all text-left"
                >
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                    style={{ background: pub ? '#dcfce7' : '#fef9c3' }}
                  >
                    {pub ? '📤' : '📝'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-navy truncate">{r.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {isOwn ? org.name : reports.find(x => x.id === r.id) ? getOrg(profile.role).name : ''} · Consejo: {dateStr} · {totalItems} items · {updStr}
                    </p>
                  </div>
                  <span className={`sec-pill ${pub ? 'status-published' : 'status-draft'}`}>
                    {pub ? '✓ Publicado' : 'Borrador'}
                  </span>
                </button>
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
              <input
                className="input"
                type="text"
                placeholder="Ej: Consejo de Barrio — Abril 2025"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && createReport()}
                autoFocus
              />
            </div>
            <div className="mb-6">
              <label className="label">Fecha del consejo</label>
              <input className="input" type="date" value={newDate} onChange={e => setNewDate(e.target.value)} />
            </div>
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
