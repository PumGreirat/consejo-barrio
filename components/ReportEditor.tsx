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
  }

  async function handleUnpublish() {
    if (!confirm('¿Revertir a borrador? El obispado dejará de ver este reporte.')) return
    await persist({ ...rep, status: 'draft' }, '↩ Revertido a borrador')
  }

  async function handleSaveDraft() { await persist(rep, '💾 Borrador guardado') }

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
    if (published) { updated.status = 'draft'; setRep(r => ({ ...r, status: 'draft' })) }
    await persist(updated, '✏️ Asunto editado')
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

  async function editMuItem(id: string, memberName: string, muType: string, fields: Record<string, string>) {
    const items = getMuItems().map(i =>
      i.id === id ? { ...i, memberName, muType, fields, resolution: undefined } : i
    )
    const newData = { ...rep.data, datos_miembros: items }
    const updated = { ...rep, data: newData }
    setRep(updated)
    await persist(updated, '✏️ Actualización editada')
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
    setOpenSecs(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next })
  }

  const dateStr = rep.council_date
    ? format(new Date(rep.council_date + 'T12:00:00'), "EEEE d 'de' MMMM, yyyy", { locale: es }) : ''

  return (
    <div>
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-800 text-white px-5 py-3 rounded-full text-sm font-semibold shadow-lg">
          {toast}
        </div>
      )}
      <div className="card">
        <div className="flex items-center gap-3 mb-5 flex-wrap">
          <button onClick={onBack} className="btn btn-ghost btn-sm">← Volver</button>
          <div className="flex-1 min-w-0">
            <h2 className="font-serif text-lg text-slate-800 font-semibold truncate">{rep.name}</h2>
            {dateStr && <p className="text-xs text-slate-400 mt-0.5 capitalize">{dateStr}</p>}
          </div>
          <span className={`sec-pill ${published ? 'status-published' : 'status-draft'}`}>
            {published ? '✓ Publicado' : 'Borrador'}
          </span>
        </div>

        <div className={`flex items-center justify-between gap-3 p-3.5 rounded-xl border mb-5 flex-wrap ${
          published ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-800'
        }`}>
          <span className="text-sm font-medium">
            {published ? '✅ Publicado — visible para el obispado' : '📝 Borrador — solo visible para tu organización.'}
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
              <button onClick={handlePublish} disabled={saving} className="btn btn-navy btn-sm">
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
              <div key={s.id} className="border border-slate-200 rounded-xl overflow-hidden">
                <button onClick={() => toggleSec(s.id)} className="w-full flex items-center gap-3 p-4 bg-slate-50 hover:bg-slate-100 transition-colors text-left">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg flex-shrink-0" style={{ background: s.bg }}>{s.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-slate-700">{s.title}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{s.desc}</div>
                  </div>
                  <span className={`sec-pill ${count ? 'bg-slate-700 text-white border-transparent' : 'bg-slate-100 text-slate-400 border-slate-200'}`}>
                    {count ? `${count} item${count !== 1 ? 's' : ''}` : 'Vacío'}
                  </span>
                  {isOpen ? <ChevronUp size={14} className="text-slate-400 flex-shrink-0" /> : <ChevronDown size={14} className="text-slate-400 flex-shrink-0" />}
                </button>
                {isOpen && (
                  <div className="p-4 border-t border-slate-100">
                    {s.isMU
                      ? <MUSection items={getMuItems()} profile={profile} published={published} onAdd={addMuItem} onEdit={editMuItem} onDelete={deleteMuItem} onResolve={resolveMuItem} />
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

  async function submit() { await onAdd(sid, title, body, pri); setTitle(''); setBody(''); setShowForm(false) }

  function startEdit(it: ReportItem) { setEditingId(it.id); setEditTitle(it.title); setEditBody(it.body ?? ''); setEditPri(it.pri) }
  async function submitEdit(it: ReportItem) { await onEdit(sid, it.id, editTitle, editBody, editPri); setEditingId(null) }

  return (
    <div>
      {!items.length && !showForm && <p className="text-sm text-slate-400 italic mb-3 py-1">Sin items en esta sección.</p>}
      {items.map((it: ReportItem) => {
        const resolved = !!it.resolution
        const canReply = sec.isObisp && isBish && !resolved && published
        const canResolve = !resolved && published && isBish
        const pc = priColor(it.pri)
        const isEditing = editingId === it.id

        return (
          <div key={it.id}
            className={`rounded-xl p-4 mb-2.5 border-l-[3px] ${resolved ? 'opacity-55 bg-slate-50 border-l-slate-300' : 'border-l-slate-300'}`}
            style={!resolved ? { background: sec.bg, borderLeftColor: sec.color } : {}}>
            {isEditing ? (
              <div className="space-y-2.5">
                <div><label className="label">Título</label><input className="input text-sm" value={editTitle} onChange={e => setEditTitle(e.target.value)} autoFocus /></div>
                <div><label className="label">{sec.pLabel}</label>
                  <select className="input text-sm" value={editPri} onChange={e => setEditPri(e.target.value)}>
                    {sec.pOpts.map((o: string) => <option key={o}>{o}</option>)}
                  </select>
                </div>
                <div><label className="label">Detalles</label><textarea className="input text-sm min-h-[60px] resize-none" value={editBody} onChange={e => setEditBody(e.target.value)} /></div>
                <div className="flex gap-2">
                  <button className="btn btn-navy btn-sm" onClick={() => submitEdit(it)} disabled={!editTitle.trim()}>💾 Guardar</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditingId(null)}>Cancelar</button>
                </div>
                {published && <p className="text-xs text-amber-600 font-medium">⚠️ El reporte volverá a borrador al guardar.</p>}
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <p className={`font-semibold text-sm leading-snug ${resolved ? 'line-through text-slate-400' : 'text-slate-700'}`}>{it.title}</p>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {resolved && <span className="text-[10px] font-semibold bg-slate-100 text-slate-500 rounded-full px-2 py-0.5">✓ Cerrado</span>}
                    <button onClick={() => startEdit(it)} className="icon-btn-edit" title="Editar"><Pencil size={12} /></button>
                    <button onClick={() => onDelete(sid, it.id)} className="icon-btn-delete" title="Eliminar"><X size={13} /></button>
                  </div>
                </div>
                {it.body && <p className="text-sm text-slate-600 leading-relaxed mb-2">{it.body}</p>}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full" style={{ background: pc.bg, color: pc.c }}>{it.pri}</span>
                  {it.ts && <span className="text-[11px] text-slate-400">{format(new Date(it.ts), 'HH:mm')}</span>}
                </div>
                {resolved && it.resolution && (
                  <div className="mt-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
                    <p className="text-[11px] font-semibold text-slate-600 mb-1">
                      {it.resolution.byBishop ? '✍️ Respuesta del Obispo' : '✅ Resuelto'} · {it.resolution.by} · {format(new Date(it.resolution.ts), 'HH:mm')}
                    </p>
                    {it.resolution.note && <p className="text-sm text-slate-600">{it.resolution.note}</p>}
                  </div>
                )}
                {!resolved && (canReply || canResolve) && (
                  <div className="flex gap-2 mt-3 flex-wrap">
                    {canReply && <button onClick={() => { setShowRfw(it.id); setRfwMode('reply'); setRfwNote('') }} className="btn btn-gold btn-sm"><MessageSquare size={12} /> Responder</button>}
                    {canResolve && <button onClick={() => { setShowRfw(it.id); setRfwMode('resolve'); setRfwNote('') }} className="btn btn-green btn-sm"><CheckCircle size={12} /> Marcar resuelto</button>}
                  </div>
                )}
                {showRfw === it.id && (
                  <div className="mt-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                    <label className="label">{rfwMode === 'reply' ? 'Respuesta del Obispo' : 'Nota (opcional)'}</label>
                    <textarea className="input min-h-[64px] resize-none" placeholder="Escribe una respuesta o nota..." value={rfwNote} onChange={e => setRfwNote(e.target.value)} autoFocus />
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
        <div className="mt-2 p-4 bg-slate-50 border border-dashed border-slate-300 rounded-xl">
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
          <div className="mb-3"><label className="label">Detalles</label><textarea className="input min-h-[70px] resize-none" placeholder="Descripción o notas..." value={body} onChange={e => setBody(e.target.value)} /></div>
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

function MUSection({ items, profile, published, onAdd, onEdit, onDelete, onResolve }: any) {
  const [showForm, setShowForm] = useState(false)
  const [muName, setMuName] = useState('')
  const [muType, setMuType] = useState('new')
  const [fields, setFields] = useState<Record<string, string>>({})
  const [showRfw, setShowRfw] = useState<string | null>(null)
  const [rfwNote, setRfwNote] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editType, setEditType] = useState('new')
  const [editFields, setEditFields] = useState<Record<string, string>>({})
  const isBish = isBishopric(profile.role)
  const mt = getMuType(muType)
  const editMt = getMuType(editType)

  function setField(id: string, val: string) { setFields(f => ({ ...f, [id]: val })) }
  function setEditField(id: string, val: string) { setEditFields(f => ({ ...f, [id]: val })) }

  async function submit() { await onAdd(muName, muType, fields); setMuName(''); setFields({}); setShowForm(false) }

  function startEdit(it: MemberUpdateItem) {
    setEditingId(it.id); setEditName(it.memberName); setEditType(it.muType); setEditFields({ ...it.fields })
  }
  async function submitEdit(id: string) { await onEdit(id, editName, editType, editFields); setEditingId(null) }

  const MU_TYPE_COLORS: Record<string, string> = {
    new: 'text-slate-700 bg-slate-100', out: 'text-slate-700 bg-slate-100',
    phone: 'text-slate-700 bg-slate-100', address: 'text-slate-700 bg-slate-100',
    name: 'text-slate-700 bg-slate-100', death: 'text-slate-700 bg-slate-100'
  }

  return (
    <div>
      {!items.length && !showForm && <p className="text-sm text-slate-400 italic mb-3 py-1">Sin actualizaciones de miembros.</p>}
      {items.map((it: MemberUpdateItem) => {
        const mt2 = getMuType(it.muType)
        const done = !!it.resolution
        const isEditing = editingId === it.id

        return (
          <div key={it.id} className="rounded-xl p-4 mb-3 border border-slate-200 bg-white">
            {isEditing ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><label className="label">Nombre</label><input className="input" value={editName} onChange={e => setEditName(e.target.value)} autoFocus /></div>
                  <div><label className="label">Tipo</label>
                    <select className="input" value={editType} onChange={e => { setEditType(e.target.value); setEditFields({}) }}>
                      {MU_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                    </select>
                  </div>
                </div>
                <div className={`grid gap-3 ${editMt.fields.length > 2 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
                  {editMt.fields.map((f: any) => (
                    <div key={f.id}><label className="label">{f.label}</label>
                      <input className="input" placeholder={f.label + '...'} value={editFields[f.id] ?? ''} onChange={e => setEditField(f.id, e.target.value)} />
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button className="btn btn-navy btn-sm" onClick={() => submitEdit(it.id)} disabled={!editName.trim()}>💾 Guardar</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditingId(null)}>Cancelar</button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="font-semibold text-sm text-slate-700">{it.memberName}</p>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${MU_TYPE_COLORS[it.muType] ?? 'bg-slate-100 text-slate-700'}`}>{mt2.label}</span>
                    <button onClick={() => startEdit(it)} className="icon-btn-edit" title="Editar"><Pencil size={12} /></button>
                    <button onClick={() => onDelete(it.id)} className="icon-btn-delete" title="Eliminar"><X size={13} /></button>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                  {mt2.fields.filter((f: any) => it.fields?.[f.id]).map((f: any) => (
                    <div key={f.id} className="bg-slate-50 rounded-lg p-2.5 border border-slate-100">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">{f.label}</div>
                      <div className="text-sm text-slate-700">{it.fields[f.id]}</div>
                    </div>
                  ))}
                </div>
                {done ? (
                  <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <p className="text-[11px] font-semibold text-slate-600 mb-1">✅ Actualizado en registros · {it.resolution!.by}</p>
                    {it.resolution!.note && <p className="text-sm text-slate-500">{it.resolution!.note}</p>}
                  </div>
                ) : it.readBySec ? (
                  <div className="mt-3">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <span className="text-xs font-semibold text-emerald-600">✓ Recibido por el Secretario</span>
                      <button onClick={() => { setShowRfw(it.id); setRfwNote('') }} className="btn btn-green btn-sm"><CheckCircle size={12} /> Marcar actualizado</button>
                    </div>
                    {showRfw === it.id && (
                      <div className="mt-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                        <label className="label">Nota de confirmación (opcional)</label>
                        <textarea className="input min-h-[56px] resize-none" value={rfwNote} onChange={e => setRfwNote(e.target.value)} autoFocus />
                        <div className="flex gap-2 mt-2">
                          <button className="btn btn-navy btn-sm" onClick={async () => { await onResolve(it.id, rfwNote); setShowRfw(null) }}>Confirmar</button>
                          <button className="btn btn-ghost btn-sm" onClick={() => setShowRfw(null)}>Cancelar</button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : published ? (
                  
                ) : (
                  <p className="mt-2.5 text-xs text-slate-400">Se notificará al Secretario cuando publiques el reporte.</p>
                )}
              </>
            )}
          </div>
        )
      })}
      {showForm ? (
        <div className="mt-2 p-4 bg-slate-50 border border-dashed border-slate-300 rounded-xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div><label className="label">Nombre del hermano / familia</label><input className="input" type="text" placeholder="Ej: Familia Rojas" value={muName} onChange={e => setMuName(e.target.value)} autoFocus /></div>
            <div><label className="label">Tipo de actualización</label>
              <select className="input" value={muType} onChange={e => { setMuType(e.target.value); setFields({}) }}>
                {MU_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>
          </div>
          <div className={`grid gap-3 mb-3 ${mt.fields.length > 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
            {mt.fields.map((f: any) => (
              <div key={f.id}><label className="label">{f.label}</label>
                <input className="input" type="text" placeholder={f.label + '...'} value={fields[f.id] ?? ''} onChange={e => setField(f.id, e.target.value)} />
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button className="btn btn-navy btn-sm" onClick={submit} disabled={!muName.trim()}>💾 Guardar</button>
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
