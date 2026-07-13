import { useEffect, useState } from 'react'
import { fetchStats, fetchTasks, triggerSync, Stats, Task } from '../api'
import StatsPanel from '../components/StatsPanel'
import TaskList from '../components/TaskList'

export default function JiraPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastSync, setLastSync] = useState<string | null>(null)

  async function loadData() {
    setLoading(true)
    setError(null)
    try {
      const [t, s] = await Promise.all([fetchTasks(), fetchStats()])
      setTasks(t)
      setStats(s)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  async function handleSync() {
    setSyncing(true)
    setError(null)
    try {
      const result = await triggerSync()
      setLastSync(result.last_sync)
      await loadData()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSyncing(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  return (
    <div className="page">
      <header className="app-header">
        <h1>Jira</h1>
        <div className="app-header-actions">
          {lastSync && (
            <span className="last-sync">
              Последняя синхронизация: {new Date(lastSync).toLocaleString('ru-RU')}
            </span>
          )}
          <button onClick={handleSync} disabled={syncing}>
            {syncing ? 'Обновление…' : 'Обновить'}
          </button>
        </div>
      </header>

      {error && <div className="error-banner">Ошибка: {error}</div>}

      <StatsPanel stats={stats} />

      <h2>Задачи в работе</h2>
      {loading ? <div>Загрузка…</div> : <TaskList tasks={tasks} />}
    </div>
  )
}
