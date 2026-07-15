import { useEffect, useState } from 'react'
import {
  addGanttStage,
  deleteGanttChart,
  deleteGanttStage,
  fetchGanttChart,
  GanttChart,
  GanttStage,
  GanttStageInput,
  GanttStageUpdateInput,
  reorderGanttStages,
  updateGanttStage,
} from '../../api'
import GanttStageForm from './GanttStageForm'
import GanttTimeline from './GanttTimeline'

interface Props {
  chartId: number
  onBack: () => void
  onDeleted: () => void
}

type FormMode = { type: 'add' } | { type: 'add-child'; parentId: number } | { type: 'edit'; stage: GanttStage }

function formatDate(value: string | null): string {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('ru-RU')
}

export default function GanttChartView({ chartId, onBack, onDeleted }: Props) {
  const [chart, setChart] = useState<GanttChart | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [formMode, setFormMode] = useState<FormMode>({ type: 'add' })

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
    setFormMode({ type: 'add' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartId])

  async function handleAddStage(data: GanttStageInput | GanttStageUpdateInput) {
    await addGanttStage(chartId, data as GanttStageInput)
    await load()
  }

  async function handleUpdateStage(data: GanttStageInput | GanttStageUpdateInput) {
    if (formMode.type !== 'edit') return
    await updateGanttStage(formMode.stage.id, data as GanttStageUpdateInput)
    setFormMode({ type: 'add' })
    await load()
  }

  async function handleDeleteStage(stageId: number) {
    if (!confirm('Удалить этап? Подпункты этого этапа удалятся вместе с ним.')) return
    try {
      await deleteGanttStage(stageId)
      if (formMode.type === 'edit' && formMode.stage.id === stageId) {
        setFormMode({ type: 'add' })
      }
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

  async function handleDatesChange(stageId: number, startDate: string, endDate: string) {
    try {
      await updateGanttStage(stageId, { start_date: startDate, end_date: endDate })
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      await load() // откатываем визуальный превью к тому, что реально сохранено
    }
  }

  async function handleReorder(_parentId: number | null, orderedIds: number[]) {
    try {
      await reorderGanttStages(chartId, orderedIds)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  async function handleToggleDone(stageId: number, done: boolean) {
    try {
      await updateGanttStage(stageId, { done })
      await load()
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

  const formTitle =
    formMode.type === 'edit'
      ? 'Изменить этап'
      : formMode.type === 'add-child'
        ? 'Добавить подпункт'
        : 'Добавить этап'

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

      <div className="chart-summary">
        Этапов: {chart.stage_count} · Срок: {formatDate(chart.overall_start)} —{' '}
        {formatDate(chart.overall_end)}
        {chart.overall_duration_days != null && ` (${chart.overall_duration_days} дн.)`}
      </div>

      <h2>{formTitle}</h2>
      <GanttStageForm
        key={formMode.type === 'edit' ? formMode.stage.id : formMode.type === 'add-child' ? `child-${formMode.parentId}` : 'new'}
        editingStage={formMode.type === 'edit' ? formMode.stage : null}
        parentId={formMode.type === 'add-child' ? formMode.parentId : null}
        allStages={chart.stages}
        onSubmit={formMode.type === 'edit' ? handleUpdateStage : handleAddStage}
        onCancel={formMode.type !== 'add' ? () => setFormMode({ type: 'add' }) : undefined}
      />

      <h2>Этапы</h2>
      <GanttTimeline
        stages={chart.stages}
        onEdit={(stage) => setFormMode({ type: 'edit', stage })}
        onAddChild={(parentId) => setFormMode({ type: 'add-child', parentId })}
        onDelete={handleDeleteStage}
        onDatesChange={handleDatesChange}
        onReorder={handleReorder}
        onToggleDone={handleToggleDone}
      />
    </div>
  )
}
