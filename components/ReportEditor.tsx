'use client'
import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { Profile, Report, ReportItem, MemberUpdateItem, SECTIONS, MU_TYPES, getMuType, isBishopric } from '@/types'
import { ChevronDown, ChevronUp, Plus, X, CheckCircle, MessageSquare, Pencil } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface Props {
  report: Report
  profile: Profile
  onBack: () => Promise<void>
  onUpdate: (r: Report) => Promise<void>
}

export default function ReportEditor({ report, profile, onBack, onUpdate }: Props) {
  const [rep, setRep] = useState<Report>(report)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [openSecs, setOpenSecs] = useState<Set<string>>(new Set(['urgentes']))
  const supabase = createClient()
  const isBish = isBishopric(profile.role)
  const published = rep.status === 'published'

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 2400) }

  const persist = useCallback(async (updated: Report, msg?: string) => {
    setSaving(true)
    const { data } = await supabase
      .from('reports')
      .update({ data: updated.data, status: updated.status })
      .eq('id', updated.id)
      .select()
      .single()
    setSaving(false)
    if (data) {
      const fresh = data as Report
      setRep(fresh)
      await onUpdate(fresh)
      if (msg) showToast(msg)
    }
  }, [supabase, onUpdate])

  async function handlePublish() {
    if (!confirm('¿Enviar este reporte al Obispado?\n\nEl obispado podrá verlo. Podrás revertirlo a borrador después.')) return
    const updated = { ...rep, status: 'published' as const }
    await persist(updated, '📤 Reporte enviado al Obispado')
    const items = (updated.data.datos_miembros ?? []) as MemberUpdateItem[]
    for (const item of items) {
      await supabase.from('notifications').upsert({
        member_item_id: item.id,
        member_name: item.memberName,
        mu_type: item.muType,
        type_label: getMuType(item.muType).label,
        fields: item.fields,
        reported_by: profile.name,
        reported_by_org: item.reportedByOrg,
        is_read: false,
      }, { onConflict: 'member_item_id', ignoreDuplicates: true })
    }
  }

  async function handleUnpublish() {
    if (!confirm('¿Revertir a borrador? El obispado dejará de ver este reporte.')) return
    await persist({ ...rep, status: 'draft' }, '↩ Revertido a borrador')
  }

  async function handleSaveDraft() {
    await persist(rep, '💾 Borrador guardado')
  }

  function getItems(sid: string): ReportItem[] { return (rep.data as any)[sid] ?? [] }

  function setItems(sid: string, items: ReportItem[]) {
    const newData = { ...rep.data, [sid]: items }
    setRep(r => ({ ...r, data: newData }))
    return { ...rep, data: newData }
  }

  async function addItem(sid: string, title: string, body: string, pri: string) {
    if (!title.trim()) return
    const item: ReportItem = { id: 'i' + Date.now(), title: title.trim(), body, pri, ts: Date.now() }
    await persist(setItems(sid, [...getItems(sid), item]), '✓ Guardado')
  }

  async function deleteItem(sid: string, id: string) {
    if (!confirm('¿Eliminar este item?')) return
    await persist(setItems(sid, getItems(sid).filter(i => i.id !== id)), '✓ Eliminado')
  }

  async function editItem(sid: string, id: string, title: string, body: string, pri: string) {
    const items = getItems(sid).map(i => i.id === id ? { ...i, title, body, pri, resolution: undefined } : i)
    const updated = setItems(sid, items as ReportItem[])
    // Convert to draft when editing a resolved item
    if (published) {
      updated.status = 'draft'
      setRep(r => ({ ...r, status: 'draft' }))
    }
    await persist(updated, '✏️ Asunto editado — reporte vuelto a borrador')
  }

  async function resolveItem(sid: string, id: string, note: string, byBishop: boolean) {
    const items = getItems(sid).map(i =>
      i.id === id ? { ...i, resolution: { note, by: profile.name, byBishop, ts: Date.now() } } : i
    )
    await persist(setItems(sid, items), byBishop ? '✍️ Respuesta guardada' : '✅ Marcado como resuelto')
  }

  function getMuItems(): MemberUpdateItem[] { return (rep.data.datos_miembros ?? []) as MemberUpdateItem[] }

  async function addMuItem(memberName: string, muType: string, fields: Record<string, string>) {
    if (!memberName.trim()) return
    const item: MemberUpdateItem = {
      id: 'mu' + Date.now(), memberName: memberName.trim(), muType, fields,
      ts: Date.now(), readBySec: false, reportedBy: profile.name, reportedByOrg: profile.org_id
    }
    const newData = { ...rep.data, datos_miembros: [...getMuItems(), item] }
    const updated = { ...rep, data: newData }
    setRep(updated)
    await persist(updated, '✓ Guardado')
  }

  async function deleteMuItem(id: string) {
    if (!confirm('¿Eliminar esta actualización?')) return
    const newData = { ...rep.data, datos_miembros: getMuItems().filter(i => i.id !== id) }
    const updated = { ...rep, data: newData }
    setRep(updated)
    await persist(updated, '✓ Eliminado')
  }

  async function resolveMuItem(id: string, note: string) {
    const items = getMuItems().map(i =>
      i.id === id ? { ...i, resolution: { note, by: profile.name, ts: Date.now() } } : i
    )
    const newData = { ...rep.data, datos_miembros: items }
    const updated = { ...rep, data: newData }
    setRep(updated)
    await persist(updated, '✅ Marcado como completado')
  }

  const toggleSec = (id: string) => {
    setOpenSecs(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const dateStr = rep.council_date
    ? format(new Date(rep.council_date + 'T12:00:00'), "EEEE d 'de' MMMM, yyyy", { locale: es })
    : ''

  return (
    <div>
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1a6b47] text-white px-5 py-3 rounded-full text-sm font-bold shadow-lg">
          {toast}
        </div>
      )}
      <div className="card">
        <div className="flex items-center gap-3 mb-5 flex-wrap">
          <button onClick={onBack} className="btn btn-ghost btn-sm">← Volver</button>
          <div className="flex-1 min-w-0">
            <h2 className="font-serif text-lg text-navy font-semibold truncate">{rep.name}</h2>
            {dateStr && <p className="text-xs text-gray-400 mt-0.5 capitalize">{dateStr}</p>}
          </div>
          <span className={`sec-pill ${published ? 'status-published' : 'status-draft'}`}>
            {published ? '✓ Publicado' : 'Borrador'}
          </span>
        </div>

        <div className={`flex items-center justify-between gap-3 p-3.5 rounded-xl border-[1.5px] mb-5 flex-wrap ${
          published ? 'bg-green-50 border-green-200 text-green-800' : 'bg-yellow-50 border-yellow-200 text-yellow-800'
        }`}>
          <span className="text-sm font-medium">
            {published
              ? '✅ Publicado — visible para el obispado'
              : '📝 Borrador — solo visible para tu organización. El obispado no lo ve aún.'}
          </span>
          <div className="flex gap-2 flex-wrap">
            {!published && (
              <button onClick={handleSaveDraft} disabled={saving} className="btn btn-ghost btn-sm">
                {saving ? '...' : '💾 Guardar borrador'}
              </button>
            )}
            {published ? (
              <button onClick={handleUnpublish} disabled={saving} className="btn btn-ghost btn-sm">↩ Revertir a borrador</button>
            ) : (
              <button onClick={handlePublish} disabled={saving} className="btn btn-gold btn-sm">
                {saving ? '...' : '📤 Enviar al Obispado'}
              </button>
            )}
          </div>
        </div>

        <div className="space-y-3">
          {SECTIONS.map(s => {
            const items = s.isMU ? getMuItems() : getItems(s.id)
            const count = items.length
            const isOpen = openSecs.has(s.id)
            return (
              <div key={s.id} className="border-[1.5px] border-[#ddd6c8] rounded-xl overflow-hidden">
                <button onClick={() => toggleSec(s.id)} className="w-full flex items-center gap-3 p-4 bg-cream hover:bg-cream-dark transition-colors text-left">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg flex-shrink-0" style={{ background: s.bg }}>{s.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm text-navy flex items-center flex-wrap gap-2">
                      {s.title}
                      {(s as any).secAlert && (
                        <span className="text-[11px] font-bold bg-amber-100 text-amber-800 rounded-full px-2.5 py-0.5">🔔 Notifica al Secretario al publicar</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">{s.desc}</div>
                  </div>
                  <span className={`sec-pill ${count ? 'status-published' : 'bg-[#ede8de] text-gray-500'}`}>
                    {count ? `${count} item${count !== 1 ? 's' : ''}` : 'Vacío'}
                  </span>
                  {isOpen ? <ChevronUp size={14} className="text-gray-400 flex-shrink-0" /> : <ChevronDown size={14} className="text-gray-400 flex-shrink-0" />}
                </button>
                {isOpen && (
                  <div className="p-4 border-t border-[#ddd6c8]">
                    {(s as any).secAlert && (
                      <div className="flex items-center gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 font-medium mb-4">
                        🔔 Al publicar, el Secretario recibirá una notificación por cada actualización registrada aquí.
                      </div>
                    )}
                    {s.isMU
                      ? <MUSection items={getMuItems()} profile={profile} published={published} onAdd={addMuItem} onDelete={deleteMuItem} onResolve={resolveMuItem} />
                      : <ItemSection sid={s.id} sec={s as any} items={getItems(s.id)} profile={profile} published={published} isBish={isBish} onAdd={addItem} onDelete={deleteItem} onEdit={editItem} onResolve={resolveItem} />
                    }
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function ItemSection({ sid, sec, items, profile, published, isBish, onAdd, onDelete, onEdit, onResolve }: any) {
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [pri, setPri] = useState(sec.pOpts[0] ?? '')
  const [showRfw, setShowRfw] = useState<string | null>(null)
  const [rfwNote, setRfwNote] = useState('')
  const [rfwMode, setRfwMode] = useState<'resolve' | 'reply'>('resolve')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editBody, setEditBody] = useState('')
  const [editPri, setEditPri] = useState('')
  

  async function submit() {
    await onAdd(sid, title, body, pri)
    setTitle(''); setBody(''); setShowForm(false)
  }

  function startEdit(it: ReportItem) {
    setEditingId(it.id)
    setEditTitle(it.title)
    setEditBody(it.body ?? '')
    setEditPri(it.pri)
  }

  async function submitEdit(it: ReportItem) {
    await onEdit(sid, it.id, editTitle, editBody, editPri)
    setEditingId(null)
  }

  return (
    <div>
      {!items.length && !showForm && (
        <p className="text-sm text-gray-400 italic mb-3 py-1">Sin items en esta sección.</p>
      )}
      {items.map((it: ReportItem) => {
        const resolved = !!it.resolution
        const canReply = sec.isObisp && isBish && !resolved && published
        const canResolve = !resolved && published && isBish
        const pc = priColor(it.pri)
        const isEditing = editingId === it.id

        return (
          <div key={it.id} className={`rounded-xl p-4 mb-2.5 border-l-[3px] ${resolved ? 'opacity-60 bg-gray-50 border-l-gray-300' : ''}`}
            style={!resolved ? { background: sec.bg, borderLeftColor: sec.color } : {}}>

            {isEditing ? (
              <div className="space-y-2.5">
                <div>
                  <label className="label">Título</label>
                  <input className="input text-sm" value={editTitle} onChange={e => setEditTitle(e.target.value)} autoFocus />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="label">{sec.pLabel}</label>
                    <select className="input text-sm" value={editPri} onChange={e => setEditPri(e.target.value)}>
                      {sec.pOpts.map((o: string) => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="label">Detalles</label>
                  <textarea className="input text-sm min-h-[60px] resize-none" value={editBody} onChange={e => setEditBody(e.target.value)} />
                </div>
                <div className="flex gap-2">
                  <button className="btn btn-navy btn-sm" onClick={() => submitEdit(it)} disabled={!editTitle.trim()}>💾 Guardar cambios</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditingId(null)}>Cancelar</button>
                </div>
                {published && <p className="text-xs text-amber-600 font-medium">⚠️ Al guardar, el reporte volverá a borrador y deberás enviarlo al Obispado de nuevo.</p>}
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <p className={`font-bold text-sm leading-snug ${resolved ? 'line-through text-gray-400' : ''}`}>{it.title}</p>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {resolved && <span className="text-[10px] font-bold bg-gray-100 text-gray-500 rounded-full px-2 py-0.5">✓ Cerrado</span>}
                    <button onClick={() => startEdit(it)} className="text-gray-300 hover:text-navy transition-colors" title="Editar asunto"><Pencil size={13} /></button>
                    <button onClick={() => onDelete(sid, it.id)} className="text-gray-300 hover:text-red-500 transition-colors" title="Eliminar"><X size={14} /></button>
                  </div>
                </div>
                {it.body && <p className="text-sm text-gray-600 leading-relaxed mb-2">{it.body}</p>}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full" style={{ background: pc.bg, color: pc.c }}>{it.pri}</span>
                  {it.ts && <span className="text-[11px] text-gray-400">{format(new Date(it.ts), 'HH:mm')}</span>}
                </div>
                {resolved && it.resolution && (
                  <div className={`mt-3 p-3 rounded-lg ${it.resolution.byBishop ? 'bg-amber-50 border border-amber-200' : 'bg-green-50 border border-green-200'}`}>
                    <p className={`text-[11px] font-bold mb-1 ${it.resolution.byBishop ? 'text-amber-700' : 'text-green-700'}`}>
                      {it.resolution.byBishop ? '✍️ Respuesta del Obispo' : '✅ Resuelto'} · {it.resolution.by} · {format(new Date(it.resolution.ts), 'HH:mm')}
                    </p>
                    {it.resolution.note && <p className="text-sm text-gray-600">{it.resolution.note}</p>}
                  </div>
                )}
                {!resolved && (canReply || canResolve) && (
                  <div className="flex gap-2 mt-3 flex-wrap">
                    {canReply && (
                      <button onClick={() => { setShowRfw(it.id); setRfwMode('reply'); setRfwNote('') }} className="btn btn-gold btn-sm">
                        <MessageSquare size={12} /> Responder
                      </button>
                    )}
                    {canResolve && (
                      <button onClick={() => { setShowRfw(it.id); setRfwMode('resolve'); setRfwNote('') }} className="btn btn-green btn-sm">
                        <CheckCircle size={12} /> Marcar resuelto
                      </button>
                    )}
                  </div>
                )}
                {showRfw === it.id && (
                  <div className="mt-3 p-3.5 bg-blue-50 border border-blue-200 rounded-xl">
                    <label className="label">{rfwMode === 'reply' ? 'Respuesta del Obispo' : 'Nota de resolución (opcional)'}</label>
                    <textarea className="input min-h-[64px] resize-none" placeholder="Escribe una respuesta, acción tomada o nota..." value={rfwNote} onChange={e => setRfwNote(e.target.value)} autoFocus />
                    <div className="flex gap-2 mt-2">
                      <button className="btn btn-navy btn-sm" onClick={async () => { await onResolve(sid, it.id, rfwNote, rfwMode === 'reply'); setShowRfw(null) }}>Confirmar</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setShowRfw(null)}>Cancelar</button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )
      })}

      {showForm ? (
        <div className="mt-2 p-4 bg-blue-50 border-[1.5px] border-dashed border-blue-200 rounded-xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="label">{sid === 'miembros' ? 'Nombre del hermano / familia' : 'Título'}</label>
              <input className="input" type="text" placeholder={sid === 'miembros' ? 'Ej: Familia Rojas' : 'Título breve'} value={title} onChange={e => setTitle(e.target.value)} autoFocus />
            </div>
            <div>
              <label className="label">{sec.pLabel}</label>
              <select className="input" value={pri} onChange={e => setPri(e.target.value)}>
                {sec.pOpts.map((o: string) => <option key={o}>{o}</option>)}
              </select>
            </div>
          </div>
          <div className="mb-3">
            <label className="label">Detalles</label>
            <textarea className="input min-h-[70px] resize-none" placeholder="Descripción o notas..." value={body} onChange={e => setBody(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <button className="btn btn-navy btn-sm" onClick={submit} disabled={!title.trim()}>💾 Guardar</button>
            <button className="btn btn-ghost btn-sm" onClick={() => { setShowForm(false); setTitle(''); setBody('') }}>Cancelar</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowForm(true)} className="btn btn-ghost btn-sm mt-1"><Plus size={13} /> Añadir</button>
      )}
    </div>
  )
}

function MUSection({ items, profile, published, onAdd, onDelete, onResolve }: any) {
  const [showForm, setShowForm] = useState(false)
  const [muName, setMuName] = useState('')
  const [muType, setMuType] = useState('new')
  const [fields, setFields] = useState<Record<string, string>>({})
  const [showRfw, setShowRfw] = useState<string | null>(null)
  const [rfwNote, setRfwNote] = useState('')
  const isBish = isBishopric(profile.role)
  const mt = getMuType(muType)

  function setField(id: string, val: string) { setFields(f => ({ ...f, [id]: val })) }

  async function submit() {
    await onAdd(muName, muType, fields)
    setMuName(''); setFields({}); setShowForm(false)
  }

  const MU_TYPE_COLORS: Record<string, string> = {
    new: 'text-green-700 bg-green-100', out: 'text-red-700 bg-red-100',
    phone: 'text-blue-700 bg-blue-100', address: 'text-blue-700 bg-blue-100',
    name: 'text-purple-700 bg-purple-100', death: 'text-gray-700 bg-gray-100'
  }

  return (
    <div>
      {!items.length && !showForm && (
        <p className="text-sm text-gray-400 italic mb-3 py-1">Sin actualizaciones de miembros.</p>
      )}
      {items.map((it: MemberUpdateItem) => {
        const mt2 = getMuType(it.muType)
        const done = !!it.resolution
        return (
          <div key={it.id} className="rounded-xl p-4 mb-3 border-[1.5px]" style={{ background: mt2.cardColor, borderColor: mt2.borderColor }}>
            <div className="flex items-start justify-between gap-2 mb-2">
              <p className="font-bold text-base">{it.memberName}</p>
              <div className="flex items-center gap-2">
                <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${MU_TYPE_COLORS[it.muType] ?? 'bg-gray-100 text-gray-700'}`}>{mt2.label}</span>
                <button onClick={() => onDelete(it.id)} className="text-gray-300 hover:text-red-500 transition-colors"><X size={14} /></button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
              {mt2.fields.filter((f: any) => it.fields?.[f.id]).map((f: any) => (
                <div key={f.id} className="bg-white/70 rounded-lg p-2.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">{f.label}</div>
                  <div className="text-sm font-medium">{it.fields[f.id]}</div>
                </div>
              ))}
            </div>
            {done ? (
              <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-[11px] font-bold text-green-700 mb-1">✅ Actualizado en registros · {it.resolution!.by}</p>
                {it.resolution!.note && <p className="text-sm text-gray-600">{it.resolution!.note}</p>}
              </div>
            ) : it.readBySec ? (
              <div className="mt-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <span className="text-xs font-bold text-green-700">✓ Recibido por el Secretario</span>
                  {isBish && (
                    <button onClick={() => { setShowRfw(it.id); setRfwNote('') }} className="btn btn-green btn-sm">
                      <CheckCircle size={12} /> Marcar actualizado en registros
                    </button>
                  )}
                </div>
                {showRfw === it.id && (
                  <div className="mt-3 p-3.5 bg-blue-50 border border-blue-200 rounded-xl">
                    <label className="label">Nota de confirmación (opcional)</label>
                    <textarea className="input min-h-[60px] resize-none" value={rfwNote} onChange={e => setRfwNote(e.target.value)} autoFocus />
                    <div className="flex gap-2 mt-2">
                      <button className="btn btn-navy btn-sm" onClick={async () => { await onResolve(it.id, rfwNote); setShowRfw(null) }}>Confirmar</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setShowRfw(null)}>Cancelar</button>
                    </div>
                  </div>
                )}
              </div>
            ) : published ? (
              <p className="mt-2.5 text-xs font-bold text-amber-600">⏳ Pendiente — el Secretario aún no ha revisado</p>
            ) : (
              <p className="mt-2.5 text-xs text-gray-400">Se notificará al Secretario cuando publiques el reporte.</p>
            )}
          </div>
        )
      })}

      {showForm ? (
        <div className="mt-2 p-4 bg-green-50 border-[1.5px] border-dashed border-green-300 rounded-xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="label">Nombre del hermano / familia</label>
              <input className="input" type="text" placeholder="Ej: Familia Rojas" value={muName} onChange={e => setMuName(e.target.value)} autoFocus />
            </div>
            <div>
              <label className="label">Tipo de actualización</label>
              <select className="input" value={muType} onChange={e => { setMuType(e.target.value); setFields({}) }}>
                {MU_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>
          </div>
          <div className={`grid gap-3 mb-3 ${mt.fields.length > 2 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
            {mt.fields.map((f: any) => (
              <div key={f.id}>
                <label className="label">{f.label}</label>
                <input className="input" type="text" placeholder={f.label + '...'} value={fields[f.id] ?? ''} onChange={e => setField(f.id, e.target.value)} />
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button className="btn btn-green btn-sm" onClick={submit} disabled={!muName.trim()}>💾 Guardar</button>
            <button className="btn btn-ghost btn-sm" onClick={() => { setShowForm(false); setMuName(''); setFields({}) }}>Cancelar</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowForm(true)} className="btn btn-ghost btn-sm mt-1"><Plus size={13} /> Añadir</button>
      )}
    </div>
  )
}

function priColor(p: string) {
  if (!p) return { bg: '#f1f5f9', c: '#475569' }
  if (p.includes('Urgente') || p === 'Necesita ayuda' || p === 'Solicitud de recursos') return { bg: '#fee2e2', c: '#991b1b' }
  if (p.includes('Importante') || p === 'Menos activo' || p === 'Necesita visita' || p === 'Pregunta') return { bg: '#fef3c7', c: '#92400e' }
  if (p.includes('Logro') || p === 'Actividad planeada') return { bg: '#dcfce7', c: '#166534' }
  return { bg: '#f1f5f9', c: '#475569' }
}
