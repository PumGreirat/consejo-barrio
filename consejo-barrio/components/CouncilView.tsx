'use client'
import { Report, SECTIONS, ORGS, getMuType, isBishopric, getOrg } from '@/types'
import { Profile } from '@/types'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { createClient } from '@/lib/supabase'

interface Props { reports: Report[]; profile: Profile; onRefresh: () => Promise<void> }

export default function CouncilView({ reports, profile, onRefresh }: Props) {
  const published = reports.filter(r => r.status === 'published')
  const supabase = createClient()

  const totalItems = published.reduce((a, r) =>
    a + Object.values(r.data ?? {}).reduce((b, arr) => b + (arr?.length ?? 0), 0), 0)
  const urgent = published.reduce((a, r) =>
    a + (r.data.urgentes ?? []).filter(i => i.pri?.includes('Urgente')).length, 0)
  const resolved = published.reduce((a, r) =>
    a + Object.values(r.data ?? {}).reduce((b, arr) =>
      b + arr.filter((i: any) => i.resolution).length, 0), 0)

  async function resolveItem(reportId: string, sid: string, itemId: string, note: string, byBishop: boolean) {
    const rep = published.find(r => r.id === reportId)
    if (!rep) return
    const items = ((rep.data as any)[sid] ?? []).map((i: any) =>
      i.id === itemId ? { ...i, resolution: { note, by: profile.name, byBishop, ts: Date.now() } } : i
    )
    await supabase.from('reports').update({ data: { ...rep.data, [sid]: items } }).eq('id', reportId)
    await onRefresh()
  }

  async function resolveMu(reportId: string, itemId: string, note: string) {
    const rep = published.find(r => r.id === reportId)
    if (!rep) return
    const items = (rep.data.datos_miembros ?? []).map((i: any) =>
      i.id === itemId ? { ...i, resolution: { note, by: profile.name, ts: Date.now() } } : i
    )
    await supabase.from('reports').update({ data: { ...rep.data, datos_miembros: items } }).eq('id', reportId)
    await onRefresh()
  }

  return (
    <div className="card">
      <div className="flex items-start justify-between mb-5 gap-3 flex-wrap">
        <div>
          <h2 className="font-serif text-xl text-navy font-semibold">📋 Vista del Consejo</h2>
          <p className="text-xs text-gray-400 mt-1">Reportes publicados de todas las organizaciones</p>
        </div>
        <button onClick={onRefresh} className="btn btn-ghost btn-sm">↻ Actualizar</button>
      </div>

      {/* Stats */}
      <div className="flex gap-2.5 flex-wrap mb-6">
        {[
          { n: published.length, l: 'organizaciones', bg: '#1c2b4a', c: 'white' },
          { n: totalItems, l: 'items totales', bg: '#ede8de', c: '#1c2b4a' },
          ...(urgent ? [{ n: urgent, l: 'urgentes', bg: '#fee2e2', c: '#991b1b' }] : []),
          ...(resolved ? [{ n: resolved, l: 'resueltos', bg: '#dcfce7', c: '#1a6b47' }] : []),
        ].map((s, i) => (
          <div key={i} className="rounded-xl px-5 py-3.5 flex-1 min-w-[110px]" style={{ background: s.bg }}>
            <div className="text-2xl font-bold" style={{ color: s.c }}>{s.n}</div>
            <div className="text-[11px] mt-0.5" style={{ color: s.c, opacity: 0.8 }}>{s.l}</div>
          </div>
        ))}
      </div>

      {!published.length ? (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-3 text-sm">
          Aún no hay reportes publicados. Las presidencias deben crear y publicar su reporte.
        </div>
      ) : (
        SECTIONS.map(s => {
          const blocks: { org: typeof ORGS[number]; items: any[]; repId: string; repName: string }[] = []
          ORGS.forEach(org => {
            const rep = published.filter(r => r.org_id === org.id).sort((a, b) =>
              new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0]
            if (!rep) return
            const items = (rep.data as any)[s.id] ?? []
            if (!items.length) return
            blocks.push({ org, items, repId: rep.id, repName: rep.name })
          })
          const total = blocks.reduce((a, b) => a + b.items.length, 0)

          return (
            <div key={s.id} className="mb-7">
              <div className="flex items-center gap-3 p-3.5 rounded-xl mb-3.5" style={{ background: s.bg, border: `1.5px solid ${s.color}22` }}>
                <span className="text-xl">{s.icon}</span>
                <div className="flex-1">
                  <p className="font-serif text-base font-semibold" style={{ color: s.color }}>{s.title}</p>
                  {(s as any).secAlert && <p className="text-[11px] font-bold text-amber-600 mt-0.5">🔔 Notificado al Secretario de Barrio</p>}
                </div>
                <span className="text-xs font-bold text-white px-2.5 py-1 rounded-full" style={{ background: s.color }}>{total} items</span>
              </div>

              {!blocks.length ? (
                <p className="text-sm text-gray-400 italic px-1 pb-3">Sin items en esta sección.</p>
              ) : blocks.map(({ org, items, repId, repName }) => (
                <div key={org.id} className="mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: org.color }} />
                    <span className="text-xs font-bold uppercase tracking-wide" style={{ color: org.color }}>{org.name}</span>
                    <span className="text-xs text-gray-400">— {repName}</span>
                  </div>
                  {s.isMU
                    ? items.map((it: any) => <MUCard key={it.id} it={it} repId={repId} profile={profile} onResolve={resolveMu} />)
                    : items.map((it: any) => <ItemCard key={it.id} it={it} sid={s.id} sec={s} repId={repId} orgColor={org.color} profile={profile} onResolve={resolveItem} />)
                  }
                </div>
              ))}
            </div>
          )
        })
      )}
    </div>
  )
}

function ItemCard({ it, sid, sec, repId, orgColor, profile, onResolve }: any) {
  const resolved = !!it.resolution
  const [showForm, setShowForm] = ('useState' in Object ? require('react') : { useState: (v: any) => [v, () => {}] }).useState(false) as any
  // We need real useState here — use a wrapper
  return <ItemCardInner it={it} sid={sid} sec={sec} repId={repId} orgColor={orgColor} profile={profile} onResolve={onResolve} />
}

function ItemCardInner({ it, sid, sec, repId, orgColor, profile, onResolve }: any) {
  const { useState } = require('react')
  const [showForm, setShowForm] = useState(false)
  const [note, setNote] = useState('')
  const [mode, setMode] = useState<'resolve'|'reply'>('resolve')
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
  const { useState } = require('react')
  const [showForm, setShowForm] = useState(false)
  const [note, setNote] = useState('')
  const mt = getMuType(it.muType)
  const done = !!it.resolution
  const MU_COLORS: Record<string, string> = { new: '#f0fdf4', out: '#fef2f2', phone: '#eff6ff', address: '#eff6ff', name: '#f5f3ff', death: '#f8fafc' }
  const MU_BORDERS: Record<string, string> = { new: '#86efac', out: '#fca5a5', phone: '#93c5fd', address: '#93c5fd', name: '#d8b4fe', death: '#cbd5e1' }

  return (
    <div className="rounded-xl p-3.5 mb-2.5 border-[1.5px]" style={{ background: MU_COLORS[it.muType] ?? '#f8fafc', borderColor: MU_BORDERS[it.muType] ?? '#cbd5e1' }}>
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
              <button onClick={() => setShowForm(true)} className="btn btn-green btn-sm text-xs">✅ Marcar actualizado en registros</button>
            )}
          </div>
          {showForm && (
            <div className="mt-2.5 p-3 bg-blue-50 border border-blue-200 rounded-xl">
              <label className="label">Nota de confirmación (opcional)</label>
              <textarea className="input min-h-[56px] resize-none text-sm" placeholder="Ej: Datos actualizados en Leader and Clerk Resources..." value={note} onChange={e => setNote(e.target.value)} autoFocus />
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
