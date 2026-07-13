import { useEffect, useState } from 'react'
import {
  addGanttStage,
  deleteGanttChart,
  deleteGanttStage,
  fetchGanttChart,
  GanttChart,
  GanttStage,
  GanttStageInput,
  updateGanttStage,
} from '../../api'
import GanttStageForm from './GanttStageForm'
import GanttTimeline from './GanttTimeline'

interface Props {
  chartId: number
  onBack: () => void
  onDeleted: () => void
}

export default function GanttChartView({ chartId, onBack, onDeleted }: Props) {
  const [chart, setChart] = useState<GanttChart | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editingStage, setEditingStage] = useState<GanttStage | null>(null)

  async function load() {
    setError(null)
    try {
      setChart(await fetchGanttChart(chartId))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  useEffect(() => {
    load()
    setEditingStage(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartId])

  async function handleAddStage(data: GanttStageInput) {
    await addGanttStage(chartId, data)
    await load()
  }

  async function handleUpdateStage(data: GanttStageInput) {
    if (!editingStage) return
    await updateGanttStage(editingStage.id, data)
    setEditingStage(null)
    await load()
  }

  async function handleDeleteStage(stageId: number) {
    if (!confirm('Удалить этап?')) return
    try {
      await deleteGanttStage(stageId)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  async function handleDeleteChart() {
    if (!confirm('Удалить диаграмму целиком?')) return
    try {
      await deleteGanttChart(chartId)
      onDeleted()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  if (!chart) {
    return (
      <div className="page">
        {error && <div className="error-banner">Ошибка: {error}</div>}
        {!error && <div>Загрузка…</div>}
      </div>
    )
  }

  return (
    <div className="page">
      <header className="app-header">
        <div>
          <button className="btn-secondary" onClick={onBack}>
            ← К списку диаграмм
          </button>
          <h1>{chart.title}</h1>
        </div>
        <button className="btn-danger" onClick={handleDeleteChart}>
          Удалить диаграмму
        </button>
      </header>

      {error && <div className="error-banner">Ошибка: {error}</div>}

      <h2>{editingStage ? 'Изменить этап' : 'Добавить этап'}</h2>
      <GanttStageForm
        key={editingStage?.id ?? 'new'}
        editingStage={editingStage}
        onSubmit={editingStage ? handleUpdateStage : handleAddStage}
        onCancel={editingStage ? () => setEditingStage(null) : undefined}
      />

      <h2>Этапы</h2>
      <GanttTimeline
        stages={chart.stages}
        onEdit={setEditingStage}
        onDelete={handleDeleteStage}
      />
    </div>
  )
}
