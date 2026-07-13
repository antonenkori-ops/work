import { FormEvent, useEffect, useState } from 'react'
import { fetchTasks, GanttStage, GanttStageInput, Task } from '../../api'

interface Props {
  editingStage?: GanttStage | null
  onSubmit: (data: GanttStageInput) => Promise<void>
  onCancel?: () => void
}

type Source = 'jira' | 'manual'

export default function GanttStageForm({ editingStage, onSubmit, onCancel }: Props) {
  const isEditing = !!editingStage
  const [source, setSource] = useState<Source>(editingStage?.task_key ? 'jira' : 'manual')
  const [availableTasks, setAvailableTasks] = useState<Task[]>([])
  const [taskKey, setTaskKey] = useState(editingStage?.task_key ?? '')
  const [name, setName] = useState(editingStage?.name ?? '')
  const [startDate, setStartDate] = useState(editingStage?.start_date ?? '')
  const [endDate, setEndDate] = useState(editingStage?.end_date ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (source === 'jira' && availableTasks.length === 0) {
      fetchTasks()
        .then(setAvailableTasks)
        .catch((e) => setError(e instanceof Error ? e.message : String(e)))
    }
  }, [source, availableTasks.length])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    const usingTaskPicker = source === 'jira' && !isEditing

    if (!startDate || !endDate) {
      setError('Укажите даты начала и окончания')
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
      const payload: GanttStageInput = {
        start_date: startDate,
        end_date: endDate,
      }
      if (usingTaskPicker) {
        payload.task_key = taskKey
      } else {
        payload.name = name.trim()
      }
      await onSubmit(payload)
      if (!isEditing) {
        setName('')
        setTaskKey('')
        setStartDate('')
        setEndDate('')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="stage-form" onSubmit={handleSubmit}>
      {!isEditing && (
        <div className="stage-form-source">
          <label>
            <input
              type="radio"
              checked={source === 'jira'}
              onChange={() => setSource('jira')}
            />
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

      <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
      <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />

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
