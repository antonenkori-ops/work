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

async function handle<T>(resp: Response): Promise<T> {
  if (!resp.ok) {
    const detail = await resp.text()
    throw new Error(`${resp.status}: ${detail}`)
  }
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
