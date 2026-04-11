// ── ORG / ROLE CONSTANTS ─────────────────────────────────────

export const ROLE_LABELS: Record<string, string> = {
  obispo: 'Obispo',
  c1_ob: '1er Consejero del Obispo',
  c2_ob: '2do Consejero del Obispo',
  sec_ej: 'Secretario Auxiliar',
  sec_ba: 'Secretario de Barrio',
  pres_cu: 'Pte. Cuórum de Élderes',
  c1_cu: '1er Consejero - C.É.',
  c2_cu: '2do Consejero - C.É.',
  sec_cu: 'Secretario - C.É.',
  pres_sr: 'Presidenta - S. Socorro',
  c1_sr: '1ra Consejera - S.S.',
  c2_sr: '2da Consejera - S.S.',
  sec_sr: 'Secretaria - S.S.',
  pres_mj: 'Presidenta - M. Jóvenes',
  c1_mj: '1ra Consejera - M.J.',
  c2_mj: '2da Consejera - M.J.',
  sec_mj: 'Secretaria - M.J.',
  ayud_pr: 'Ayudante Obispo - Presb.',
  pres_ma: 'Pte. C. Maestros',
  pres_di: 'Pte. C. Diáconos',
  pres_pm: 'Presidenta Primaria',
  c1_pm: 'Consejera Primaria',
  sec_pm: 'Secretaria Primaria',
  pres_ed: 'Pte. Escuela Dominical',
  c1_ed: 'Consejero - E. Dominical',
  sec_ed: 'Secretario - E. Dominical',
}

export const ORGS = [
  { id: 'ob', name: 'Obispado', color: '#374151', roles: ['obispo','c1_ob','c2_ob','sec_ej','sec_ba'] },
  { id: 'cu', name: 'Cuórum de Élderes', color: '#1d4ed8', roles: ['pres_cu','c1_cu','c2_cu','sec_cu'] },
  { id: 'sr', name: 'Sociedad de Socorro', color: '#6d28d9', roles: ['pres_sr','c1_sr','c2_sr','sec_sr'] },
  { id: 'mj', name: 'Mujeres Jóvenes', color: '#0369a1', roles: ['pres_mj','c1_mj','c2_mj','sec_mj'] },
  { id: 'sa', name: 'Sacerdocio Aarónico', color: '#065f46', roles: ['ayud_pr','pres_ma','pres_di'] },
  { id: 'pm', name: 'Primaria', color: '#92400e', roles: ['pres_pm','c1_pm','sec_pm'] },
  { id: 'ed', name: 'Escuela Dominical', color: '#9f1239', roles: ['pres_ed','c1_ed','sec_ed'] },
] as const

export function getOrg(role: string) {
  return ORGS.find(o => o.roles.includes(role as never)) ?? ORGS[0]
}

export function isBishopric(role: string) {
  return ['obispo','c1_ob','c2_ob','sec_ej','sec_ba'].includes(role)
}

// ── REPORT SECTIONS ──────────────────────────────────────────

export const SECTIONS = [
  {
    id: 'urgentes', icon: '🚨', title: 'Asuntos Urgentes / Importantes',
    color: '#dc2626', bg: '#fef2f2',
    desc: 'Situaciones urgentes o importantes que requieren atención del obispado.',
    pLabel: 'Nivel', pOpts: ['🔴 Urgente','🟡 Importante','🔵 Para información'],
    isMU: false, isObisp: false,
  },
  {
    id: 'miembros', icon: '👥', title: 'Miembros que Necesitan Atención',
    color: '#7c3aed', bg: '#f5f3ff',
    desc: 'Hermanos que necesitan ayuda, visitas, menos activos o tienen situaciones especiales.',
    pLabel: 'Situación', pOpts: ['Necesita ayuda','Menos activo','Necesita visita','Situación familiar','Otro'],
    isMU: false, isObisp: false,
  },
  {
    id: 'datos_miembros', icon: '📋', title: 'Actualizaciones de Datos de Miembros',
    color: '#0369a1', bg: '#f0f9ff',
    desc: 'Mudanzas, cambios de teléfono, dirección, nombre.',
    pLabel: '', pOpts: [],
    isMU: true, isObisp: false,
  },
  {
    id: 'preguntas_obispo', icon: '💬', title: 'Preguntas / Solicitudes para el Obispo',
    color: '#b45309', bg: '#fffbeb',
    desc: 'Preguntas, solicitudes de recursos, aprobaciones.',
    pLabel: 'Tipo', pOpts: ['Pregunta','Solicitud de recursos','Aprobación','Orientación'],
    isMU: false, isObisp: true,
  },
  {
    id: 'actividades', icon: '📣', title: 'Actividades y Eventos',
    color: '#15803d', bg: '#f0fdf4',
    desc: 'Actividades planeadas, anuncios o novedades.',
    pLabel: 'Tipo', pOpts: ['Actividad planeada','Anuncio','Logro','Actualización de programa'],
    isMU: false, isObisp: false,
  },
  {
    id: 'generales', icon: '🗂', title: 'Actualizaciones Generales',
    color: '#4338ca', bg: '#eef2ff',
    desc: 'Logros, necesidades de materiales, informe de asistencia, coordinación entre organizaciones.',
    pLabel: 'Categoría', pOpts: ['Logro / Reconocimiento','Necesidad de materiales','Informe de asistencia','Coordinación entre organizaciones','Otro'],
    isMU: false, isObisp: false,
  },
] as const

// ── MEMBER UPDATE TYPES ───────────────────────────────────────

export const MU_TYPES = [
  {
    id: 'new', label: 'Se mudó al barrio', cls: 'new',
    cardColor: '#f8fafc', borderColor: '#cbd5e1',
    fields: [
      {id:'phone',label:'Teléfono'},
      {id:'address',label:'Dirección'},
      {id:'cedula',label:'Número de cédula'},
      {id:'birthdate',label:'Fecha de nacimiento'},
      {id:'notes',label:'Notas'},
    ]
  },
  {
    id: 'out', label: 'Se mudó del barrio', cls: 'out',
    cardColor: '#f8fafc', borderColor: '#cbd5e1',
    fields: [{id:'destination',label:'¿A dónde se fue?'},{id:'notes',label:'Notas'}]
  },
  {
    id: 'phone', label: 'Cambio de teléfono / correo', cls: 'info',
    cardColor: '#f8fafc', borderColor: '#cbd5e1',
    fields: [{id:'old_val',label:'Datos anteriores'},{id:'new_val',label:'Datos nuevos'},{id:'notes',label:'Notas'}]
  },
  {
    id: 'address', label: 'Cambio de dirección', cls: 'info',
    cardColor: '#f8fafc', borderColor: '#cbd5e1',
    fields: [{id:'old_addr',label:'Dirección anterior'},{id:'new_addr',label:'Dirección nueva'},{id:'notes',label:'Notas'}]
  },
  {
    id: 'name', label: 'Matrimonio / Nuevo apellido', cls: 'event',
    cardColor: '#f8fafc', borderColor: '#cbd5e1',
    fields: [{id:'old_name',label:'Nombre anterior'},{id:'new_name',label:'Nombre nuevo'},{id:'notes',label:'Notas'}]
  },
  {
    id: 'death', label: 'Fallecimiento', cls: 'death',
    cardColor: '#f8fafc', borderColor: '#cbd5e1',
    fields: [{id:'date',label:'Fecha de fallecimiento'},{id:'notes',label:'Notas adicionales'}]
  },
] as const

export function getMuType(id: string) {
  return MU_TYPES.find(t => t.id === id) ?? MU_TYPES[0]
}

// ── DB TYPES ─────────────────────────────────────────────────

export interface Profile {
  id: string
  name: string
  role: string
  org_id: string
  created_at: string
}

export interface ReportItem {
  id: string
  title: string
  body?: string
  pri: string
  ts: number
  resolution?: {
    note: string
    by: string
    byBishop: boolean
    ts: number
  }
}

export interface MemberUpdateItem {
  id: string
  memberName: string
  muType: string
  fields: Record<string, string>
  ts: number
  readBySec: boolean
  reportedBy: string
  reportedByOrg: string
  resolution?: {
    note: string
    by: string
    ts: number
  }
}

export interface ReportData {
  urgentes: ReportItem[]
  miembros: ReportItem[]
  datos_miembros: MemberUpdateItem[]
  preguntas_obispo: ReportItem[]
  actividades: ReportItem[]
  generales: ReportItem[]
}

export interface Report {
  id: string
  org_id: string
  created_by: string
  created_by_name: string
  name: string
  council_date: string | null
  council_sunday: string | null
  status: 'draft' | 'published'
  data: ReportData
  created_at: string
  updated_at: string
}

export interface Event {
  id: string
  name: string
  event_date: string
  event_time: string | null
  responsible: string | null
  notes: string | null
  sync_status: 'pending' | 'synced'
  created_by: string | null
  created_at: string
}

export interface Notification {
  id: string
  member_item_id: string
  member_name: string
  mu_type: string
  type_label: string
  fields: Record<string, string>
  reported_by: string
  reported_by_org: string
  is_read: boolean
  created_at: string
}

export function emptyReportData(): ReportData {
  return {
    urgentes: [],
    miembros: [],
    datos_miembros: [],
    preguntas_obispo: [],
    actividades: [],
    generales: [],
  }
}