import { FormEvent, useState } from 'react'
import {
  addReleaseItem,
  deleteReleaseItem,
  Release,
  ReleaseItem,
  ReleaseItemUpdateInput,
  ReleaseSection,
  updateReleaseItem,
} from '../../api'

interface Props {
  release: Release
  section: ReleaseSection
  label: string
  onChange: (release: Release) => void
  onError: (e: unknown) => void
}

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return ''
  return iso.slice(0, 16)
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function fmtDuration(minutes: number | null): string {
  if (minutes === null || minutes === undefined) return ''
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h}:${String(m).padStart(2, '0')}`
}

interface ItemFormState {
  title: string
  durationMinutes: string
  dependsOn: string
  startAt: string
  executor: string
  comment: string
  markerAt: string
  moduleSetId: string
}

function emptyForm(release: Release, itemType: 'work' | 'marker'): ItemFormState {
  return {
    title: '',
    durationMinutes: '',
    dependsOn: '',
    startAt: '',
    executor: itemType === 'work' ? release.main_admin ?? '' : '',
    comment: '',
    markerAt: '',
    moduleSetId: '',
  }
}

function formFromItem(item: ReleaseItem): ItemFormState {
  return {
    title: item.title,
    durationMinutes: item.duration_minutes != null ? String(item.duration_minutes) : '',
    dependsOn: item.depends_on_id != null ? String(item.depends_on_id) : '',
    startAt: toDatetimeLocal(item.start_at),
    executor: item.executor ?? '',
    comment: item.comment ?? '',
    markerAt: toDatetimeLocal(item.marker_at),
    moduleSetId: item.module_set_id != null ? String(item.module_set_id) : '',
  }
}

export default function ReleaseSectionTable({ release, section, label, onChange, onError }: Props) {
  const items = release.items
    .filter((i) => i.section === section)
    .sort((a, b) => a.sort_order - b.sort_order)

  const dependencyOptions = release.items.filter((i) => i.item_type === 'work')

  const [addingType, setAddingType] = useState<'work' | 'marker' | null>(null)
  const [addForm, setAddForm] = useState<ItemFormState>(emptyForm(release, 'work'))
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<ItemFormState>(emptyForm(release, 'work'))

  const workItems = items.filter((i) => i.item_type === 'work')
  const firstWorkItem = workItems[0] ?? null

  async function saveSectionStart(value: string) {
    if (!firstWorkItem) return
    try {
      onChange(await updateReleaseItem(firstWorkItem.id, { start_at: value || null }))
    } catch (err) {
      onError(err)
    }
  }

  function startAdd(type: 'work' | 'marker') {
    setAddingType(type)
    const base = emptyForm(release, type)
    if (type === 'work' && workItems.length > 0) {
      base.dependsOn = String(workItems[workItems.length - 1].id)
    }
    setAddForm(base)
    setEditingId(null)
  }

  async function submitAdd(e: FormEvent) {
    e.preventDefault()
    if (!addingType) return
    try {
      const released = await addReleaseItem(release.id, {
        section,
        item_type: addingType,
        title: addForm.title.trim(),
        duration_minutes:
          addingType === 'work' && addForm.durationMinutes !== ''
            ? Number(addForm.durationMinutes)
            : undefined,
        depends_on_id:
          addingType === 'work' && addForm.dependsOn ? Number(addForm.dependsOn) : undefined,
        start_at: addingType === 'work' && addForm.startAt ? addForm.startAt : undefined,
        executor: addingType === 'work' ? addForm.executor.trim() || undefined : undefined,
        comment: addingType === 'work' ? addForm.comment.trim() || undefined : undefined,
        marker_at: addingType === 'marker' && addForm.markerAt ? addForm.markerAt : undefined,
        module_set_id:
          addingType === 'work' && addForm.moduleSetId ? Number(addForm.moduleSetId) : undefined,
      })
      onChange(released)
      setAddingType(null)
    } catch (err) {
      onError(err)
    }
  }

  function startEdit(item: ReleaseItem) {
    setEditingId(item.id)
    setEditForm(formFromItem(item))
    setAddingType(null)
  }

  async function submitEdit(e: FormEvent, item: ReleaseItem) {
    e.preventDefault()
    try {
      const payload: ReleaseItemUpdateInput = {
        title: editForm.title.trim(),
        executor: editForm.executor.trim() || undefined,
        comment: editForm.comment.trim() || undefined,
      }
      if (item.item_type === 'marker') {
        payload.marker_at = editForm.markerAt || null
      } else {
        payload.duration_minutes = editForm.durationMinutes !== '' ? Number(editForm.durationMinutes) : null
        payload.depends_on_id = editForm.dependsOn ? Number(editForm.dependsOn) : null
        if (!editForm.dependsOn) {
          payload.start_at = editForm.startAt || null
        }
        payload.module_set_id = editForm.moduleSetId ? Number(editForm.moduleSetId) : null
      }
      const released = await updateReleaseItem(item.id, payload)
      onChange(released)
      setEditingId(null)
    } catch (err) {
      onError(err)
    }
  }

  async function handleDelete(itemId: number) {
    if (!confirm('Удалить пункт?')) return
    try {
      onChange(await deleteReleaseItem(itemId))
    } catch (err) {
      onError(err)
    }
  }

  function moduleSetFor(item: ReleaseItem) {
    return release.module_sets.find((s) => s.id === item.module_set_id) ?? null
  }

  return (
    <section className="release-section">
      <div className="release-section-header">
        <h2 className="release-section-title">{label}</h2>
        {firstWorkItem && firstWorkItem.depends_on_id == null && (
          <label className="release-section-start">
            Начало раздела (план)
            <input
              type="datetime-local"
              defaultValue={toDatetimeLocal(firstWorkItem.start_at)}
              key={`section-start-${firstWorkItem.id}-${firstWorkItem.start_at ?? ''}`}
              onBlur={(e) => saveSectionStart(e.target.value)}
            />
          </label>
        )}
        {firstWorkItem && firstWorkItem.depends_on_id != null && (
          <span className="release-section-start-hint">
            Начало считается автоматически от пункта, от которого зависит первый пункт раздела
          </span>
        )}
      </div>
      <div className="release-table-wrap">
        <table className="release-table">
          <thead>
            <tr>
              <th>№</th>
              <th>Работы</th>
              <th>Зависит от №</th>
              <th>Продолжительность</th>
              <th>Начало (план)</th>
              <th>Конец (план)</th>
              <th>Отв. исполнитель</th>
              <th>Комментарий</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              if (editingId === item.id) {
                return (
                  <tr key={item.id} className="release-row-editing">
                    <td colSpan={9}>
                      <form className="release-item-form" onSubmit={(e) => submitEdit(e, item)}>
                        <textarea
                          placeholder="Текст работы"
                          value={editForm.title}
                          onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                          rows={3}
                        />
                        {item.item_type === 'marker' ? (
                          <label className="stage-form-field">
                            Дата и время маркера
                            <input
                              type="datetime-local"
                              value={editForm.markerAt}
                              onChange={(e) => setEditForm({ ...editForm, markerAt: e.target.value })}
                            />
                          </label>
                        ) : (
                          <>
                            <select
                              value={editForm.dependsOn}
                              onChange={(e) => setEditForm({ ...editForm, dependsOn: e.target.value })}
                            >
                              <option value="">Не зависит от других пунктов</option>
                              {dependencyOptions
                                .filter((d) => d.id !== item.id)
                                .map((d) => (
                                  <option key={d.id} value={d.id}>
                                    №{d.number} {d.title.slice(0, 40)}
                                  </option>
                                ))}
                            </select>
                            <label className="stage-form-field">
                              Начало
                              <input
                                type="datetime-local"
                                disabled={!!editForm.dependsOn}
                                title={
                                  editForm.dependsOn
                                    ? 'Определяется автоматически по завершении предшественника'
                                    : ''
                                }
                                value={editForm.startAt}
                                onChange={(e) => setEditForm({ ...editForm, startAt: e.target.value })}
                              />
                            </label>
                            <label className="stage-form-field">
                              Продолжительность, мин
                              <input
                                type="number"
                                min={0}
                                value={editForm.durationMinutes}
                                onChange={(e) =>
                                  setEditForm({ ...editForm, durationMinutes: e.target.value })
                                }
                              />
                            </label>
                            <input
                              type="text"
                              placeholder="Отв. исполнитель"
                              value={editForm.executor}
                              onChange={(e) => setEditForm({ ...editForm, executor: e.target.value })}
                            />
                            <textarea
                              placeholder="Комментарий"
                              value={editForm.comment}
                              onChange={(e) => setEditForm({ ...editForm, comment: e.target.value })}
                              rows={2}
                            />
                            <label className="stage-form-field">
                              Набор модулей
                              <select
                                value={editForm.moduleSetId}
                                onChange={(e) =>
                                  setEditForm({ ...editForm, moduleSetId: e.target.value })
                                }
                              >
                                <option value="">— нет —</option>
                                {release.module_sets.map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.name} ({s.entries.length})
                                  </option>
                                ))}
                              </select>
                            </label>
                          </>
                        )}
                        <div className="release-item-form-actions">
                          <button type="submit">Сохранить</button>
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => setEditingId(null)}
                          >
                            Отмена
                          </button>
                        </div>
                      </form>
                    </td>
                  </tr>
                )
              }

              if (item.item_type === 'marker') {
                return (
                  <tr key={item.id} className="release-marker-row">
                    <td colSpan={8}>
                      <strong>{fmtDateTime(item.marker_at)}</strong> — {item.title}
                    </td>
                    <td className="release-row-actions">
                      <button className="btn-secondary" onClick={() => startEdit(item)}>
                        Изменить
                      </button>
                      <button className="chart-delete-btn" onClick={() => handleDelete(item.id)}>
                        Удалить
                      </button>
                    </td>
                  </tr>
                )
              }

              const moduleSet = moduleSetFor(item)

              return (
                <tr key={item.id}>
                  <td className="release-col-number">{item.number}</td>
                  <td className="release-col-title">
                    <div className="release-item-title">{item.title_display}</div>
                    {moduleSet && (
                      <div className="release-modules-readonly">
                        Модули «{moduleSet.name}»:{' '}
                        {moduleSet.entries
                          .map((en) => (en.version ? `${en.name}:${en.version}` : en.name))
                          .join(', ')}
                      </div>
                    )}
                  </td>
                  <td className="release-col-number">
                    {item.depends_on_id
                      ? dependencyOptions.find((d) => d.id === item.depends_on_id)?.number ?? ''
                      : ''}
                  </td>
                  <td className="release-col-number">{fmtDuration(item.duration_minutes)}</td>
                  <td className="release-col-datetime">{fmtDateTime(item.start_at)}</td>
                  <td className="release-col-datetime">{fmtDateTime(item.end_at)}</td>
                  <td>{item.executor}</td>
                  <td className="release-col-comment">{item.comment_display}</td>
                  <td className="release-row-actions">
                    <button className="btn-secondary" onClick={() => startEdit(item)}>
                      Изменить
                    </button>
                    <button className="chart-delete-btn" onClick={() => handleDelete(item.id)}>
                      Удалить
                    </button>
                  </td>
                </tr>
              )
            })}

            {addingType && (
              <tr className="release-row-editing">
                <td colSpan={9}>
                  <form className="release-item-form" onSubmit={submitAdd}>
                    <textarea
                      placeholder="Текст работы"
                      value={addForm.title}
                      onChange={(e) => setAddForm({ ...addForm, title: e.target.value })}
                      rows={3}
                      autoFocus
                    />
                    {addingType === 'marker' ? (
                      <label className="stage-form-field">
                        Дата и время маркера
                        <input
                          type="datetime-local"
                          value={addForm.markerAt}
                          onChange={(e) => setAddForm({ ...addForm, markerAt: e.target.value })}
                        />
                      </label>
                    ) : (
                      <>
                        <select
                          value={addForm.dependsOn}
                          onChange={(e) => setAddForm({ ...addForm, dependsOn: e.target.value })}
                        >
                          <option value="">Не зависит от других пунктов</option>
                          {dependencyOptions.map((d) => (
                            <option key={d.id} value={d.id}>
                              №{d.number} {d.title.slice(0, 40)}
                            </option>
                          ))}
                        </select>
                        <label className="stage-form-field">
                          Начало
                          <input
                            type="datetime-local"
                            disabled={!!addForm.dependsOn}
                            value={addForm.startAt}
                            onChange={(e) => setAddForm({ ...addForm, startAt: e.target.value })}
                          />
                        </label>
                        <label className="stage-form-field">
                          Продолжительность, мин
                          <input
                            type="number"
                            min={0}
                            value={addForm.durationMinutes}
                            onChange={(e) =>
                              setAddForm({ ...addForm, durationMinutes: e.target.value })
                            }
                          />
                        </label>
                        <input
                          type="text"
                          placeholder="Отв. исполнитель"
                          value={addForm.executor}
                          onChange={(e) => setAddForm({ ...addForm, executor: e.target.value })}
                        />
                        <textarea
                          placeholder="Комментарий"
                          value={addForm.comment}
                          onChange={(e) => setAddForm({ ...addForm, comment: e.target.value })}
                          rows={2}
                        />
                        <label className="stage-form-field">
                          Набор модулей
                          <select
                            value={addForm.moduleSetId}
                            onChange={(e) => setAddForm({ ...addForm, moduleSetId: e.target.value })}
                          >
                            <option value="">— нет —</option>
                            {release.module_sets.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name} ({s.entries.length})
                              </option>
                            ))}
                          </select>
                        </label>
                      </>
                    )}
                    <div className="release-item-form-actions">
                      <button type="submit">Добавить</button>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => setAddingType(null)}
                      >
                        Отмена
                      </button>
                    </div>
                  </form>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {!addingType && (
        <div className="release-section-add-buttons">
          <button className="btn-secondary" onClick={() => startAdd('work')}>
            + Добавить пункт
          </button>
          <button className="btn-secondary" onClick={() => startAdd('marker')}>
            + Добавить маркер
          </button>
        </div>
      )}
    </section>
  )
}
