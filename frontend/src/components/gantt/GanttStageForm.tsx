import { FormEvent, useEffect, useState } from 'react'
import {
  fetchTasks,
  GanttStage,
  GanttStageInput,
  GanttStageUpdateInput,
  Task,
} from '../../api'

interface Props {
  editingStage?: GanttStage | null
  parentId?: number | null
  allStages: GanttStage[]
  onSubmit: (data: GanttStageInput | GanttStageUpdateInput) => Promise<void>
  onCancel?: () => void
}

type Source = 'jira' | 'manual'

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`)
  d.setDate(d.getDate() + days)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function daysBetweenISO(startIso: string, endIso: string): number {
  const a = new Date(`${startIso}T00:00:00`)
  const b = new Date(`${endIso}T00:00:00`)
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))
}

export default function GanttStageForm({
  editingStage,
  parentId,
  allStages,
  onSubmit,
  onCancel,
}: Props) {
  const isEditing = !!editingStage
  const [source, setSource] = useState<Source>(editingStage?.task_key ? 'jira' : 'manual')
  const [availableTasks, setAvailableTasks] = useState<Task[]>([])
  const [taskKey, setTaskKey] = useState(editingStage?.task_key ?? '')
  const [name, setName] = useState(editingStage?.name ?? '')
  const [startDate, setStartDate] = useState(editingStage?.start_date ?? '')
  const [endDate, setEndDate] = useState(editingStage?.end_date ?? '')
  const [durationDays, setDurationDays] = useState(
    editingStage ? String(editingStage.duration_days) : '',
  )
  const [dependsOn, setDependsOn] = useState<string>(
    editingStage?.depends_on_id != null ? String(editingStage.depends_on_id) : '',
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (source === 'jira' && availableTasks.length === 0) {
      fetchTasks()
        .then(setAvailableTasks)
        .catch((e) => setError(e instanceof Error ? e.message : String(e)))
    }
  }, [source, availableTasks.length])

  const predecessor = dependsOn ? allStages.find((s) => String(s.id) === dependsOn) : undefined
  const effectiveStart = predecessor ? predecessor.end_date : startDate

  function handleStartChange(value: string) {
    setStartDate(value)
    if (value && durationDays) {
      setEndDate(addDays(value, Number(durationDays) - 1))
    } else if (value && endDate) {
      setDurationDays(String(daysBetweenISO(value, endDate) + 1))
    }
  }

  function handleEndChange(value: string) {
    setEndDate(value)
    if (effectiveStart && value) {
      setDurationDays(String(daysBetweenISO(effectiveStart, value) + 1))
    }
  }

  function handleDurationChange(value: string) {
    setDurationDays(value)
    if (effectiveStart && value && Number(value) >= 1) {
      setEndDate(addDays(effectiveStart, Number(value) - 1))
    }
  }

  function handleDependsOnChange(value: string) {
    setDependsOn(value)
    const newPredecessor = value ? allStages.find((s) => String(s.id) === value) : undefined
    if (newPredecessor && durationDays) {
      setEndDate(addDays(newPredecessor.end_date, Number(durationDays) - 1))
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    const usingTaskPicker = source === 'jira' && !isEditing

    if (!dependsOn && !startDate) {
      setError('Укажите дату начала или этап-предшественник')
      return
    }
    if (!endDate) {
      setError('Укажите дату окончания или количество дней')
      return
    }
    if (usingTaskPicker && !taskKey) {
      setError('Выберите задачу')
      return
    }
    if (!usingTaskPicker && !name.trim()) {
      setError('Укажите название этапа')
      return
    }

    setSubmitting(true)
    try {
      if (isEditing) {
        const payload: GanttStageUpdateInput = {
          name: name.trim(),
          end_date: endDate,
          depends_on_id: dependsOn ? Number(dependsOn) : null,
        }
        if (!dependsOn) payload.start_date = startDate
        await onSubmit(payload)
      } else {
        const payload: GanttStageInput = {
          end_date: endDate,
        }
        if (usingTaskPicker) {
          payload.task_key = taskKey
        } else {
          payload.name = name.trim()
        }
        if (parentId != null) payload.parent_id = parentId
        if (dependsOn) {
          payload.depends_on_id = Number(dependsOn)
        } else {
          payload.start_date = startDate
        }
        await onSubmit(payload)
        setName('')
        setTaskKey('')
        setStartDate('')
        setEndDate('')
        setDurationDays('')
        setDependsOn('')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSubmitting(false)
    }
  }

  const dependencyOptions = allStages.filter((s) => s.id !== editingStage?.id)

  return (
    <form className="stage-form" onSubmit={handleSubmit}>
      {parentId != null && !isEditing && <div className="stage-form-hint">Подпункт этапа</div>}

      {!isEditing && (
        <div className="stage-form-source">
          <label>
            <input type="radio" checked={source === 'jira'} onChange={() => setSource('jira')} />
            Из задачи Jira
          </label>
          <label>
            <input
              type="radio"
              checked={source === 'manual'}
              onChange={() => setSource('manual')}
            />
            Вручную
          </label>
        </div>
      )}

      {source === 'jira' && !isEditing ? (
        <select value={taskKey} onChange={(e) => setTaskKey(e.target.value)}>
          <option value="">— выберите задачу —</option>
          {availableTasks.map((t) => (
            <option key={t.key} value={t.key}>
              {t.key}: {t.summary}
            </option>
          ))}
        </select>
      ) : (
        <input
          type="text"
          placeholder="Название этапа"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      )}

      <select value={dependsOn} onChange={(e) => handleDependsOnChange(e.target.value)}>
        <option value="">Не зависит от других этапов</option>
        {dependencyOptions.map((s) => (
          <option key={s.id} value={s.id}>
            После: {s.name}
          </option>
        ))}
      </select>

      <label className="stage-form-field">
        Начало
        <input
          type="date"
          value={effectiveStart}
          disabled={!!predecessor}
          title={predecessor ? 'Определяется автоматически по завершении предшественника' : ''}
          onChange={(e) => handleStartChange(e.target.value)}
        />
      </label>

      <label className="stage-form-field">
        Окончание
        <input type="date" value={endDate} onChange={(e) => handleEndChange(e.target.value)} />
      </label>

      <label className="stage-form-field">
        Дней
        <input
          type="number"
          min={1}
          className="stage-form-duration"
          value={durationDays}
          onChange={(e) => handleDurationChange(e.target.value)}
        />
      </label>

      <button type="submit" disabled={submitting}>
        {isEditing ? 'Сохранить' : 'Добавить этап'}
      </button>
      {onCancel && (
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Отмена
        </button>
      )}

      {error && <div className="error-banner">Ошибка: {error}</div>}
    </form>
  )
}
