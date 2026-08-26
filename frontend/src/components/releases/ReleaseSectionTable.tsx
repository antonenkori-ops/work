import { DragEvent as ReactDragEvent, FormEvent, useRef, useState } from 'react'
import {
  addReleaseItem,
  deleteReleaseItem,
  moveReleaseItemDown,
  moveReleaseItemUp,
  Release,
  ReleaseItem,
  ReleaseSection,
  updateReleaseItem,
} from '../../api'
import EditableField from './EditableField'

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

interface AddFormState {
  title: string
  durationMinutes: string
  dependsOn: string
  startAt: string
  executor: string
  comment: string
  markerAt: string
  moduleSetId: string
}

function emptyAddForm(release: Release, itemType: 'work' | 'marker'): AddFormState {
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

export default function ReleaseSectionTable({ release, section, label, onChange, onError }: Props) {
  const items = release.items
    .filter((i) => i.section === section)
    .sort((a, b) => a.sort_order - b.sort_order)

  const [addingType, setAddingType] = useState<'work' | 'marker' | null>(null)
  const [addForm, setAddForm] = useState<AddFormState>(emptyAddForm(release, 'work'))
  const dragItemId = useRef<number | null>(null)
  const [dropBeforeId, setDropBeforeId] = useState<number | null>(null)

  const workItems = items.filter((i) => i.item_type === 'work')
  const totalMinutes = workItems.reduce((sum, i) => sum + (i.duration_minutes ?? 0), 0)

  function startAdd(type: 'work' | 'marker') {
    setAddingType(type)
    const base = emptyAddForm(release, type)
    if (type === 'work' && workItems.length > 0) {
      base.dependsOn = String(workItems[workItems.length - 1].id)
    }
    setAddForm(base)
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

  async function handleDelete(itemId: number) {
    if (!confirm('Удалить пункт?')) return
    try {
      onChange(await deleteReleaseItem(itemId))
    } catch (err) {
      onError(err)
    }
  }

  async function patchItem(itemId: number, payload: Parameters<typeof updateReleaseItem>[1]) {
    try {
      onChange(await updateReleaseItem(itemId, payload))
    } catch (err) {
      onError(err)
    }
  }

  function moduleSetFor(item: ReleaseItem) {
    return release.module_sets.find((s) => s.id === item.module_set_id) ?? null
  }

  // --- перетаскивание строк мышкой (смена порядка внутри раздела) ---

  function handleDragStart(e: ReactDragEvent, itemId: number) {
    dragItemId.current = itemId
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(itemId))
  }

  function handleDragOverRow(e: ReactDragEvent, itemId: number) {
    if (dragItemId.current == null || dragItemId.current === itemId) return
    e.preventDefault()
    setDropBeforeId(itemId)
  }

  async function moveItemToIndex(itemId: number, fromIndex: number, toIndex: number) {
    const steps = toIndex - fromIndex
    if (steps === 0) return
    try {
      let released: Release | undefined
      for (let i = 0; i < Math.abs(steps); i++) {
        released = await (steps < 0 ? moveReleaseItemUp(itemId) : moveReleaseItemDown(itemId))
      }
      if (released) onChange(released)
    } catch (err) {
      onError(err)
    }
  }

  async function handleDropOnRow(e: ReactDragEvent, targetId: number) {
    e.preventDefault()
    setDropBeforeId(null)
    const draggedId = dragItemId.current
    dragItemId.current = null
    if (draggedId == null || draggedId === targetId) return
    const fromIndex = items.findIndex((i) => i.id === draggedId)
    const toIndex = items.findIndex((i) => i.id === targetId)
    if (fromIndex === -1 || toIndex === -1) return
    await moveItemToIndex(draggedId, fromIndex, toIndex)
  }

  async function handleDropAtEnd(e: ReactDragEvent) {
    e.preventDefault()
    setDropBeforeId(null)
    const draggedId = dragItemId.current
    dragItemId.current = null
    if (draggedId == null) return
    const fromIndex = items.findIndex((i) => i.id === draggedId)
    if (fromIndex === -1) return
    await moveItemToIndex(draggedId, fromIndex, items.length - 1)
  }

  return (
    <section className="release-section">
      <h2 className="release-section-title">{label}</h2>
      <div className="release-table-wrap">
        <table className="release-table">
          <thead>
            <tr>
              <th></th>
              <th>№</th>
              <th>Работы</th>
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
              const dragHandle = (
                <span
                  className="release-drag-handle"
                  draggable
                  onDragStart={(e) => handleDragStart(e, item.id)}
                  title="Перетащить, чтобы изменить порядок"
                >
                  ⠿
                </span>
              )

              if (item.item_type === 'marker') {
                return (
                  <tr
                    key={item.id}
                    className={`release-marker-row${dropBeforeId === item.id ? ' release-row-drop-target' : ''}`}
                    onDragOver={(e) => handleDragOverRow(e, item.id)}
                    onDrop={(e) => handleDropOnRow(e, item.id)}
                    onDragLeave={() => setDropBeforeId((id) => (id === item.id ? null : id))}
                  >
                    <td>{dragHandle}</td>
                    <td colSpan={7}>
                      <input
                        type="datetime-local"
                        defaultValue={toDatetimeLocal(item.marker_at)}
                        key={`marker-at-${item.id}`}
                        onBlur={(e) => patchItem(item.id, { marker_at: e.target.value || null })}
                      />
                      <EditableField
                        multiline
                        className="release-inline-textarea"
                        raw={item.title}
                        display={item.title_display || item.title}
                        onSave={(value) => patchItem(item.id, { title: value })}
                      />
                    </td>
                    <td className="release-row-actions">
                      <button className="chart-delete-btn" onClick={() => handleDelete(item.id)}>
                        Удалить
                      </button>
                    </td>
                  </tr>
                )
              }

              const moduleSet = moduleSetFor(item)
              const isAnchor = item.depends_on_id == null

              return (
                <tr
                  key={item.id}
                  className={dropBeforeId === item.id ? 'release-row-drop-target' : ''}
                  onDragOver={(e) => handleDragOverRow(e, item.id)}
                  onDrop={(e) => handleDropOnRow(e, item.id)}
                  onDragLeave={() => setDropBeforeId((id) => (id === item.id ? null : id))}
                >
                  <td>{dragHandle}</td>
                  <td className="release-col-number">{item.number}</td>
                  <td className="release-col-title">
                    <EditableField
                      multiline
                      className="release-inline-textarea"
                      raw={item.title}
                      display={item.title_display || item.title}
                      onSave={(value) => patchItem(item.id, { title: value })}
                    />
                    <select
                      className="release-inline-module-select"
                      value={item.module_set_id != null ? String(item.module_set_id) : ''}
                      onChange={(e) =>
                        patchItem(item.id, {
                          module_set_id: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                    >
                      <option value="">Модули: нет</option>
                      {release.module_sets.map((s) => (
                        <option key={s.id} value={s.id}>
                          Модули: {s.name} ({s.entries.length})
                        </option>
                      ))}
                    </select>
                    {moduleSet && (
                      <div className="release-modules-readonly">
                        {moduleSet.entries
                          .map((en) => (en.version ? `${en.name}:${en.version}` : en.name))
                          .join(', ')}
                      </div>
                    )}
                  </td>
                  <td className="release-col-number">
                    <input
                      type="number"
                      min={0}
                      className="release-inline-number"
                      defaultValue={item.duration_minutes ?? ''}
                      key={`duration-${item.id}`}
                      placeholder="мин"
                      onBlur={(e) =>
                        patchItem(item.id, {
                          duration_minutes: e.target.value !== '' ? Number(e.target.value) : null,
                        })
                      }
                    />
                  </td>
                  <td className="release-col-datetime">
                    {isAnchor ? (
                      <input
                        type="datetime-local"
                        className="release-inline-datetime"
                        defaultValue={toDatetimeLocal(item.start_at)}
                        key={`start-${item.id}-${item.start_at ?? ''}`}
                        onBlur={(e) => patchItem(item.id, { start_at: e.target.value || null })}
                      />
                    ) : (
                      fmtDateTime(item.start_at)
                    )}
                  </td>
                  <td className="release-col-datetime">{fmtDateTime(item.end_at)}</td>
                  <td>
                    <EditableField
                      multiline
                      className="release-inline-textarea release-inline-executor"
                      raw={item.executor ?? ''}
                      display={item.executor_display || item.executor || ''}
                      onSave={(value) => patchItem(item.id, { executor: value || null })}
                    />
                  </td>
                  <td className="release-col-comment">
                    <EditableField
                      multiline
                      className="release-inline-textarea"
                      raw={item.comment ?? ''}
                      display={item.comment_display || item.comment || ''}
                      onSave={(value) => patchItem(item.id, { comment: value || null })}
                    />
                  </td>
                  <td className="release-row-actions">
                    <button className="chart-delete-btn" onClick={() => handleDelete(item.id)}>
                      Удалить
                    </button>
                  </td>
                </tr>
              )
            })}

            <tr
              className={`release-drop-end${dropBeforeId === -1 ? ' release-row-drop-target' : ''}`}
              onDragOver={(e) => {
                if (dragItemId.current == null) return
                e.preventDefault()
                setDropBeforeId(-1)
              }}
              onDrop={handleDropAtEnd}
              onDragLeave={() => setDropBeforeId((id) => (id === -1 ? null : id))}
            >
              <td colSpan={9} />
            </tr>

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
                        <label className="stage-form-field">
                          Зависит от пункта
                          <select
                            value={addForm.dependsOn}
                            onChange={(e) => setAddForm({ ...addForm, dependsOn: e.target.value })}
                          >
                            <option value="">Не зависит от других пунктов</option>
                            {workItems.map((d) => (
                              <option key={d.id} value={d.id}>
                                №{d.number} {d.title.slice(0, 40)}
                              </option>
                            ))}
                          </select>
                        </label>
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

            {workItems.length > 0 && (
              <tr className="release-total-row">
                <td colSpan={3}>Итого по разделу</td>
                <td className="release-col-number">{fmtDuration(totalMinutes)}</td>
                <td colSpan={5}></td>
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
        </div>
      )}
    </section>
  )
}
