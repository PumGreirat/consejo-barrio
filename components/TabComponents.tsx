'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Event, Notification, Profile, ORGS, ROLE_LABELS, getMuType, isBishopric } from '@/types'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Plus, X, Pencil, Trash2 } from 'lucide-react'

// ── EVENTS TAB ────────────────────────────────────────────────
export function EventsTab({ events, onRefresh, profile }: { events: Event[]; onRefresh: () => Promise<void>; profile: Profile }) {
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const supabase = createClient()
  const canEdit = isBishopric(profile.role)

  // Form state
  const [name, setName] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [time, setTime] = useState('')
  const [resp, setResp] = useState('')
  const [notes, setNotes] = useState('')
  const [sync, setSync] = useState<'pending' | 'synced'>('pending')

  function resetForm() { setName(''); setDate(new Date().toISOString().split('T')[0]); setTime(''); setResp(''); setNotes(''); setSync('pending') }

  function openNew() { resetForm(); setEditingId(null); setShowModal(true) }

  function openEdit(ev: Event) {
    setName(ev.name)
    setDate(ev.event_date)
    setTime(ev.event_time ?? '')
    setResp(ev.responsible ?? '')
    setNotes(ev.notes ?? '')
    setSync(ev.sync_status)
    setEditingId(ev.id)
    setShowModal(true)
  }

  async function saveEvent() {
    if (!name.trim() || !date) return
    setSaving(true)
    if (editingId) {
      await supabase.from('events').update({
        name: name.trim(), event_date: date, event_time: time || null,
        responsible: resp || null, notes: notes || null, sync_status: sync
      }).eq('id', editingId)
    } else {
      await supabase.from('events').insert({
        name: name.trim(), event_date: date, event_time: time || null,
        responsible: resp || null, notes: notes || null, sync_status: sync,
        created_by: profile.id
      })
    }
    setSaving(false)
    setShowModal(false)
    resetForm()
    setEditingId(null)
    await onRefresh()
  }

  async function deleteEvent(id: string, evName: string) {
    if (!confirm(`¿Eliminar el evento "${evName}"?`)) return
    await supabase.from('events').delete().eq('id', id)
    await onRefresh()
  }

  async function toggleSync(ev: Event) {
    const newSync = ev.sync_status === 'synced' ? 'pending' : 'synced'
    await supabase.from('events').update({ sync_status: newSync }).eq('id', ev.id)
    await onRefresh()
  }

  return (
    <div className="card">
      <div className="flex items-start justify-between mb-5 gap-3 flex-wrap">
        <div>
          <h2 className="font-serif text-xl text-navy font-semibold">📅 Próximos Eventos</h2>
          <p className="text-xs text-gray-400 mt-1">Calendario del barrio y estado en Church Tools</p>
        </div>
        <button onClick={openNew} className="btn btn-navy btn-sm"><Plus size={14} /> Añadir</button>
      </div>

      {!events.length ? (
        <p className="text-sm text-gray-400 italic">Sin eventos registrados.</p>
      ) : (
        <div className="divide-y divide-cream-dark">
          {events.map(ev => {
            const d = new Date(ev.event_date + 'T12:00:00')
            const mon = format(d, 'MMM', { locale: es }).replace('.', '').toUpperCase()
            const synced = ev.sync_status === 'synced'
            return (
              <div key={ev.id} className="flex items-center gap-4 py-3.5">
                {/* Calendar */}
                <div className="min-w-[52px] text-center bg-navy text-white rounded-xl py-2 px-1.5 flex-shrink-0">
                  <div className="text-2xl font-bold leading-none">{d.getDate()}</div>
                  <div className="text-[10px] uppercase tracking-wide opacity-80 mt-0.5">{mon}</div>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-navy">{ev.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {ev.responsible}{ev.event_time ? ' · ' + ev.event_time : ''}{ev.notes ? ' · ' + ev.notes : ''}
                  </p>
                </div>

                {/* Sync status — clickable for admins */}
                <button
                  onClick={() => canEdit && toggleSync(ev)}
                  className={`text-[11px] font-bold px-3 py-1 rounded-full whitespace-nowrap transition-colors ${
                    synced
                      ? 'bg-green-100 text-green-700 ' + (canEdit ? 'hover:bg-green-200 cursor-pointer' : 'cursor-default')
                      : 'bg-amber-100 text-amber-700 ' + (canEdit ? 'hover:bg-amber-200 cursor-pointer' : 'cursor-default')
                  }`}
                  title={canEdit ? (synced ? 'Clic para marcar como pendiente' : 'Clic para marcar como separado') : ''}
                >
                  {synced ? '✓ En calendario' : '⏳ Pendiente'}
                </button>

                {/* Edit / Delete — only for admins */}
                {canEdit && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => openEdit(ev)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-300 hover:text-navy hover:bg-gray-100 transition-colors"
                      title="Editar evento"
                    ><Pencil size={13} /></button>
                    <button
                      onClick={() => deleteEvent(ev.id, ev.name)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                      title="Eliminar evento"
                    ><Trash2 size={13} /></button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* MODAL — Add / Edit */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl">
            <h3 className="font-serif text-xl text-navy font-semibold mb-1">{editingId ? 'Editar Evento' : 'Añadir Evento'}</h3>
            <p className="text-sm text-gray-400 mb-5">{editingId ? 'Modifica los datos del evento' : 'Registra un nuevo evento del barrio'}</p>
            <div className="space-y-3">
              <div>
                <label className="label">Nombre del evento</label>
                <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Actividad familiar" autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Fecha</label>
                  <input className="input" type="date" value={date} onChange={e => setDate(e.target.value)} />
                </div>
                <div>
                  <label className="label">Hora (opcional)</label>
                  <input className="input" type="time" value={time} onChange={e => setTime(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="label">Responsable</label>
                <input className="input" value={resp} onChange={e => setResp(e.target.value)} placeholder="Ej: Sociedad de Socorro" />
              </div>
              <div>
                <label className="label">Notas</label>
                <textarea className="input min-h-[56px] resize-none" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Detalles..." />
              </div>
              <div>
                <label className="label">Estado en Church Tools</label>
                <select className="input" value={sync} onChange={e => setSync(e.target.value as any)}>
                  <option value="pending">⏳ Pendiente de separar en calendario</option>
                  <option value="synced">✅ Ya separado en Church Tools</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2.5 mt-5">
              <button className="btn btn-navy" onClick={saveEvent} disabled={saving || !name.trim() || !date}>
                {saving ? 'Guardando...' : editingId ? '💾 Guardar cambios' : 'Añadir evento'}
              </button>
              <button className="btn btn-ghost" onClick={() => { setShowModal(false); resetForm(); setEditingId(null) }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


// ── MEMBERS TAB ───────────────────────────────────────────────
export function MembersTab({ members }: { members: Profile[] }) {
  return (
    <div className="card">
      <h2 className="font-serif text-xl text-navy font-semibold mb-1">👥 Miembros del Consejo</h2>
      <p className="text-xs text-gray-400 mb-5">Líderes con acceso al sistema</p>
      {ORGS.map(org => {
        const ms = members.filter(m => org.roles.includes(m.role as never))
        if (!ms.length) return null
        return (
          <div key={org.id} className="mb-6">
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-cream-dark">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: org.color }} />
              <span className="text-xs font-bold uppercase tracking-wide" style={{ color: org.color }}>{org.name}</span>
            </div>
            {ms.map(m => {
              const ini = m.name.split(' ').filter(w => w.length > 2).slice(-2).map(w => w[0]).join('').toUpperCase() || '??'
              const isSec = ['sec_ba','sec_ej'].includes(m.role)
              return (
                <div key={m.id} className="flex items-center gap-3 py-2.5 border-b border-cream-dark last:border-0">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0" style={{ background: org.color }}>{ini}</div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm">{m.name}</p>
                    <p className="text-xs text-gray-400">{ROLE_LABELS[m.role] ?? m.role}</p>
                  </div>
                  {isSec && <span className="text-[10px] font-bold bg-amber-100 text-amber-800 rounded-full px-2.5 py-1">🔔 Secretario</span>}
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

// ── NOTIF PANEL ───────────────────────────────────────────────
export function NotifPanel({ open, notifs, onClose, onRefresh, profile }: { open: boolean; notifs: Notification[]; onClose: () => void; onRefresh: () => Promise<void>; profile: Profile }) {
  const supabase = createClient()

  async function markRead(nid: string, memberId: string) {
    await supabase.from('notifications').update({ is_read: true }).eq('id', nid)
    // Also update readBySec on the report item
    const { data: reps } = await supabase.from('reports').select('id, data')
    for (const rep of reps ?? []) {
      const items = (rep.data?.datos_miembros ?? []) as any[]
      const idx = items.findIndex((i: any) => i.id === memberId)
      if (idx >= 0) {
        items[idx].readBySec = true
        await supabase.from('reports').update({ data: { ...rep.data, datos_miembros: items } }).eq('id', rep.id)
        break
      }
    }
    await onRefresh()
  }

  const FLABELS: Record<string, string> = { phone: 'Teléfono', address: 'Dirección', notes: 'Notas', destination: 'Destino', old_val: 'Datos anteriores', new_val: 'Datos nuevos', old_addr: 'Dir. anterior', new_addr: 'Dir. nueva', old_name: 'Nombre anterior', new_name: 'Nombre nuevo', date: 'Fecha' }

  return (
    <div className={`fixed top-[62px] right-0 w-[360px] max-h-[calc(100vh-62px)] overflow-y-auto bg-white border-l border-[#ddd6c8] shadow-2xl z-40 transition-transform duration-250 ${open ? 'translate-x-0' : 'translate-x-full'}`}>
      <div className="sticky top-0 bg-navy text-white px-5 py-4 flex items-center justify-between">
        <div>
          <p className="font-serif text-base font-semibold">📋 Panel del Secretario</p>
          <p className="text-xs opacity-70 mt-0.5">Actualizaciones de miembros</p>
        </div>
        <button onClick={onClose} className="text-white/60 hover:text-white text-xl leading-none"><X size={18} /></button>
      </div>
      {!notifs.length ? (
        <div className="p-8 text-center text-gray-400 text-sm">🎉 Sin actualizaciones pendientes</div>
      ) : notifs.map(n => {
        const mt = getMuType(n.mu_type)
        const ts = format(new Date(n.created_at), "d MMM · HH:mm", { locale: es })
        return (
          <div key={n.id} className={`px-5 py-4 border-b border-cream-dark ${!n.is_read ? 'border-l-[3px] border-l-gold bg-amber-50/50' : 'border-l-[3px] border-l-transparent'}`}>
            <div className="flex justify-between text-xs text-gray-400 mb-1.5">
              <span>{n.reported_by_org} · {n.reported_by}</span>
              <span>{ts}</span>
            </div>
            <p className="font-bold text-sm mb-1.5">{n.member_name}</p>
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-700">{mt.label}</span>
            <div className="mt-2 space-y-1">
              {Object.entries(n.fields ?? {}).filter(([, v]) => v).map(([k, v]) => (
                <p key={k} className="text-xs text-gray-500"><strong className="text-gray-700">{FLABELS[k] ?? k}:</strong> {v as string}</p>
              ))}
            </div>
            {!n.is_read ? (
              <button onClick={() => markRead(n.id, n.member_item_id)} className="btn btn-green btn-sm w-full justify-center mt-3 text-xs">✓ Marcar como revisado</button>
            ) : (
              <p className="text-xs font-bold text-green-700 mt-2">✓ Revisado</p>
            )}
          </div>
        )
      })}
    </div>
  )
}
