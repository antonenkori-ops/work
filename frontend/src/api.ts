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
  name: string
  task_key: string | null
  jira_url: string | null
  start_date: string
  end_date: string
}

export interface GanttChart {
  id: number
  title: string
  created_at: string
  stages: GanttStage[]
}

export interface GanttStageInput {
  name?: string
  task_key?: string
  start_date: string
  end_date: string
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
  stage: Partial<GanttStageInput>,
): Promise<GanttStage> {
  return jsonRequest(`${API_BASE}/gantt/stages/${stageId}`, 'PATCH', stage)
}

export function deleteGanttStage(stageId: number): Promise<void> {
  return jsonRequest(`${API_BASE}/gantt/stages/${stageId}`, 'DELETE')
}
