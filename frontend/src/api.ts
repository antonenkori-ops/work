const API_BASE = 'http://localhost:8000/api'

export interface Comment {
  id: number
  author: string | null
  body: string | null
  created: string | null
  updated: string | null
}

export interface Task {
  key: string
  jira_url: string
  summary: string
  description: string | null
  status: string
  status_category: string
  issue_type: string | null
  priority: string | null
  project_key: string | null
  assignee: string | null
  reporter: string | null
  created: string | null
  updated: string | null
  resolved: string | null
  comments: Comment[]
}

export interface Stats {
  done_total: number
  done_this_year: number
  done_this_month: number
  done_this_week: number
  open_total: number
  status_counts: Record<string, number>
}

export interface SyncResult {
  tasks_synced: number
  comments_synced: number
  last_sync: string
}

export interface GanttStage {
  id: number
  parent_id: number | null
  depends_on_id: number | null
  name: string
  task_key: string | null
  task_status_category: string | null
  jira_url: string | null
  start_date: string
  end_date: string
  sort_order: number
  duration_days: number
  done: boolean
  is_done: boolean
  is_overdue: boolean
}

export interface GanttChart {
  id: number
  title: string
  created_at: string
  stages: GanttStage[]
  stage_count: number
  overall_start: string | null
  overall_end: string | null
  overall_duration_days: number | null
}

export interface GanttStageInput {
  name?: string
  task_key?: string
  parent_id?: number
  depends_on_id?: number
  start_date?: string
  end_date: string
}

export interface GanttStageUpdateInput {
  name?: string
  start_date?: string
  end_date?: string
  depends_on_id?: number | null
  done?: boolean
}

async function handle<T>(resp: Response): Promise<T> {
  if (!resp.ok) {
    const text = await resp.text()
    let message = text
    try {
      const parsed = JSON.parse(text)
      if (parsed && typeof parsed.detail === 'string') {
        message = parsed.detail
      }
    } catch {
      // ответ не JSON — используем как есть
    }
    throw new Error(message || `${resp.status}`)
  }
  if (resp.status === 204) return undefined as T
  return resp.json() as Promise<T>
}

export function fetchTasks(): Promise<Task[]> {
  return fetch(`${API_BASE}/tasks`).then((r) => handle<Task[]>(r))
}

export function fetchAvailableGanttTasks(): Promise<Task[]> {
  return fetch(`${API_BASE}/gantt/available-tasks`).then((r) => handle<Task[]>(r))
}

export function fetchStats(): Promise<Stats> {
  return fetch(`${API_BASE}/stats`).then((r) => handle<Stats>(r))
}

export function triggerSync(): Promise<SyncResult> {
  return fetch(`${API_BASE}/sync`, { method: 'POST' }).then((r) => handle<SyncResult>(r))
}

function jsonRequest<T>(url: string, method: string, body?: unknown): Promise<T> {
  return fetch(url, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  }).then((r) => handle<T>(r))
}

export function fetchGanttCharts(): Promise<GanttChart[]> {
  return jsonRequest(`${API_BASE}/gantt/charts`, 'GET')
}

export function fetchGanttChart(chartId: number): Promise<GanttChart> {
  return jsonRequest(`${API_BASE}/gantt/charts/${chartId}`, 'GET')
}

export function createGanttChart(title: string): Promise<GanttChart> {
  return jsonRequest(`${API_BASE}/gantt/charts`, 'POST', { title })
}

export function deleteGanttChart(chartId: number): Promise<void> {
  return jsonRequest(`${API_BASE}/gantt/charts/${chartId}`, 'DELETE')
}

export function addGanttStage(chartId: number, stage: GanttStageInput): Promise<GanttStage> {
  return jsonRequest(`${API_BASE}/gantt/charts/${chartId}/stages`, 'POST', stage)
}

export function updateGanttStage(
  stageId: number,
  stage: GanttStageUpdateInput,
): Promise<GanttStage> {
  return jsonRequest(`${API_BASE}/gantt/stages/${stageId}`, 'PATCH', stage)
}

export function deleteGanttStage(stageId: number): Promise<void> {
  return jsonRequest(`${API_BASE}/gantt/stages/${stageId}`, 'DELETE')
}

export function reorderGanttStages(chartId: number, stageIds: number[]): Promise<void> {
  return jsonRequest(`${API_BASE}/gantt/charts/${chartId}/reorder`, 'POST', {
    stage_ids: stageIds,
  })
}

// --- Releases ---------------------------------------------------------

export type ReleaseSection = 'prep' | 'main' | 'closing' | 'rollback'
export type ReleaseItemType = 'work' | 'marker'

export type ReleaseTicketKind = 'sprint' | 'bundle' | 'rov' | 'other'

export interface ReleaseTicket {
  id: number
  label: string
  key: string
  kind: ReleaseTicketKind
  jira_url: string
  sort_order: number
}

export interface ReleaseModuleSetEntry {
  id: number
  name: string
  version: string | null
  sort_order: number
}

export interface ReleaseModuleSet {
  id: number
  name: string
  sort_order: number
  entries: ReleaseModuleSetEntry[]
}

export interface ReleaseItem {
  id: number
  section: ReleaseSection
  item_type: ReleaseItemType
  title: string
  title_display: string
  comment_display: string | null
  duration_minutes: number | null
  start_at: string | null
  end_at: string | null
  depends_on_id: number | null
  executor: string | null
  executor_display: string | null
  comment: string | null
  marker_at: string | null
  sort_order: number
  number: number | null
  module_set_id: number | null
}

export interface ReleaseRisk {
  id: number
  description: string
  level: string | null
  measures: string | null
  owners: string | null
  sort_order: number
  number: number | null
}

export interface Release {
  id: number
  kind: string
  title: string
  main_admin: string | null
  second_admin: string | null
  rollback_note: string | null
  created_at: string
  updated_at: string
  tickets: ReleaseTicket[]
  items: ReleaseItem[]
  risks: ReleaseRisk[]
  module_sets: ReleaseModuleSet[]
  item_count: number
}

export interface ReleaseAdmin {
  id: number
  name: string
}

export interface ReleaseCreateInput {
  kind?: string
  title?: string
  main_admin?: string
  second_admin?: string
  tickets?: { label: string; key: string; kind: ReleaseTicketKind }[]
}

export interface ReleaseUpdateInput {
  title?: string
  main_admin?: string
  second_admin?: string
  rollback_note?: string
}

export interface ReleaseItemCreateInput {
  section: ReleaseSection
  item_type?: ReleaseItemType
  title: string
  duration_minutes?: number | null
  depends_on_id?: number | null
  start_at?: string | null
  executor?: string | null
  comment?: string | null
  marker_at?: string | null
  module_set_id?: number | null
}

export interface ReleaseItemUpdateInput {
  title?: string
  duration_minutes?: number | null
  depends_on_id?: number | null
  start_at?: string | null
  executor?: string | null
  comment?: string | null
  marker_at?: string | null
  module_set_id?: number | null
}

export interface ReleaseRiskInput {
  description?: string
  level?: string | null
  measures?: string | null
  owners?: string | null
}

export function fetchReleases(): Promise<Release[]> {
  return jsonRequest(`${API_BASE}/releases`, 'GET')
}

export function fetchRelease(releaseId: number): Promise<Release> {
  return jsonRequest(`${API_BASE}/releases/${releaseId}`, 'GET')
}

export function createRelease(input: ReleaseCreateInput): Promise<Release> {
  return jsonRequest(`${API_BASE}/releases`, 'POST', input)
}

export function updateRelease(releaseId: number, input: ReleaseUpdateInput): Promise<Release> {
  return jsonRequest(`${API_BASE}/releases/${releaseId}`, 'PATCH', input)
}

export function deleteRelease(releaseId: number): Promise<void> {
  return jsonRequest(`${API_BASE}/releases/${releaseId}`, 'DELETE')
}

export function fetchReleaseAdmins(): Promise<ReleaseAdmin[]> {
  return jsonRequest(`${API_BASE}/releases/admins`, 'GET')
}

export function addReleaseAdmin(name: string): Promise<ReleaseAdmin> {
  return jsonRequest(`${API_BASE}/releases/admins`, 'POST', { name })
}

export interface ReleaseAcSystem {
  id: number
  name: string
}

export function fetchAcSystems(): Promise<ReleaseAcSystem[]> {
  return jsonRequest(`${API_BASE}/releases/ac-systems`, 'GET')
}

export function addAcSystem(name: string): Promise<ReleaseAcSystem> {
  return jsonRequest(`${API_BASE}/releases/ac-systems`, 'POST', { name })
}

export function addReleaseTicket(
  releaseId: number,
  label: string,
  key: string,
  kind: ReleaseTicketKind = 'other',
): Promise<Release> {
  return jsonRequest(`${API_BASE}/releases/${releaseId}/tickets`, 'POST', { label, key, kind })
}

export function updateReleaseTicket(
  ticketId: number,
  input: { label?: string; key?: string; kind?: ReleaseTicketKind },
): Promise<Release> {
  return jsonRequest(`${API_BASE}/releases/tickets/${ticketId}`, 'PATCH', input)
}

export function deleteReleaseTicket(ticketId: number): Promise<Release> {
  return jsonRequest(`${API_BASE}/releases/tickets/${ticketId}`, 'DELETE')
}

export function addReleaseItem(
  releaseId: number,
  input: ReleaseItemCreateInput,
): Promise<Release> {
  return jsonRequest(`${API_BASE}/releases/${releaseId}/items`, 'POST', input)
}

export function updateReleaseItem(
  itemId: number,
  input: ReleaseItemUpdateInput,
): Promise<Release> {
  return jsonRequest(`${API_BASE}/releases/items/${itemId}`, 'PATCH', input)
}

export function moveReleaseItemUp(itemId: number): Promise<Release> {
  return jsonRequest(`${API_BASE}/releases/items/${itemId}/move-up`, 'POST')
}

export function moveReleaseItemDown(itemId: number): Promise<Release> {
  return jsonRequest(`${API_BASE}/releases/items/${itemId}/move-down`, 'POST')
}

export function deleteReleaseItem(itemId: number): Promise<Release> {
  return jsonRequest(`${API_BASE}/releases/items/${itemId}`, 'DELETE')
}

export function addModuleSet(releaseId: number, name: string): Promise<Release> {
  return jsonRequest(`${API_BASE}/releases/${releaseId}/module-sets`, 'POST', { name })
}

export function renameModuleSet(setId: number, name: string): Promise<Release> {
  return jsonRequest(`${API_BASE}/releases/module-sets/${setId}`, 'PATCH', { name })
}

export function deleteModuleSet(setId: number): Promise<Release> {
  return jsonRequest(`${API_BASE}/releases/module-sets/${setId}`, 'DELETE')
}

export function bulkSetModuleSetEntries(setId: number, text: string): Promise<Release> {
  return jsonRequest(`${API_BASE}/releases/module-sets/${setId}/entries/bulk`, 'POST', { text })
}

export function addReleaseRisk(releaseId: number, input: ReleaseRiskInput): Promise<Release> {
  return jsonRequest(`${API_BASE}/releases/${releaseId}/risks`, 'POST', input)
}

export function updateReleaseRisk(riskId: number, input: ReleaseRiskInput): Promise<Release> {
  return jsonRequest(`${API_BASE}/releases/risks/${riskId}`, 'PATCH', input)
}

export function deleteReleaseRisk(riskId: number): Promise<Release> {
  return jsonRequest(`${API_BASE}/releases/risks/${riskId}`, 'DELETE')
}

export async function downloadReleaseExport(releaseId: number, title: string): Promise<void> {
  const resp = await fetch(`${API_BASE}/releases/${releaseId}/export.xlsx`)
  if (!resp.ok) {
    throw new Error(`Не удалось скачать файл (${resp.status})`)
  }
  const blob = await resp.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const safeTitle = title.replace(/[^\p{L}\p{N} _-]/gu, '').trim() || 'release'
  a.download = `Plan_${safeTitle}.xlsx`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
