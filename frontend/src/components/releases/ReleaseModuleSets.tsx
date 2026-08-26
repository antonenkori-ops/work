import { FormEvent, useState } from 'react'
import {
  addModuleSet,
  bulkSetModuleSetEntries,
  deleteModuleSet,
  Release,
  ReleaseModuleSet,
  renameModuleSet,
} from '../../api'

interface Props {
  release: Release
  onChange: (release: Release) => void
  onError: (e: unknown) => void
}

function entriesToText(set: ReleaseModuleSet): string {
  return set.entries.map((e) => (e.version ? `${e.name}:${e.version}` : e.name)).join('\n')
}

export default function ReleaseModuleSets({ release, onChange, onError }: Props) {
  const sets = [...release.module_sets].sort((a, b) => a.sort_order - b.sort_order)
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editText, setEditText] = useState('')

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    try {
      onChange(await addModuleSet(release.id, newName.trim()))
      setNewName('')
    } catch (err) {
      onError(err)
    }
  }

  async function handleRename(setId: number, name: string) {
    try {
      onChange(await renameModuleSet(setId, name))
    } catch (err) {
      onError(err)
    }
  }

  async function handleDelete(setId: number) {
    if (!confirm('Удалить набор модулей? Пункты, которые на него ссылались, останутся без модулей.')) {
      return
    }
    try {
      onChange(await deleteModuleSet(setId))
    } catch (err) {
      onError(err)
    }
  }

  function startEdit(set: ReleaseModuleSet) {
    setEditingId(set.id)
    setEditText(entriesToText(set))
  }

  async function submitEdit(setId: number) {
    try {
      onChange(await bulkSetModuleSetEntries(setId, editText))
      setEditingId(null)
    } catch (err) {
      onError(err)
    }
  }

  return (
    <section className="release-section">
      <h2 className="release-section-title">Наборы модулей</h2>
      <p className="release-module-sets-hint">
        Общий список модулей на несколько пунктов сразу (например, «site» ставится и в СЦОД, и в
        МЦОД) — правите список один раз здесь, пункты плана сами подтянут актуальную версию.
      </p>

      <div className="release-module-sets">
        {sets.map((set) => (
          <div className="release-module-set-card" key={set.id}>
            <div className="release-module-set-header">
              <input
                type="text"
                defaultValue={set.name}
                key={`name-${set.id}`}
                onBlur={(e) => {
                  const value = e.target.value.trim()
                  if (value && value !== set.name) handleRename(set.id, value)
                }}
              />
              <button className="chart-delete-btn" onClick={() => handleDelete(set.id)}>
                Удалить набор
              </button>
            </div>

            {editingId === set.id ? (
              <div className="release-modules-bulk">
                <textarea
                  rows={Math.max(4, set.entries.length + 1)}
                  placeholder={'deposit:D-03.032.000\ndocument:D-03.009.000\n...'}
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  autoFocus
                />
                <div className="release-item-form-actions">
                  <button type="button" onClick={() => submitEdit(set.id)}>
                    Сохранить список
                  </button>
                  <button type="button" className="btn-secondary" onClick={() => setEditingId(null)}>
                    Отмена
                  </button>
                </div>
              </div>
            ) : (
              <div className="release-module-set-body" onClick={() => startEdit(set)}>
                {set.entries.length === 0 ? (
                  <span className="release-module-set-empty">
                    Список пуст — нажмите, чтобы вставить модули
                  </span>
                ) : (
                  <pre>{entriesToText(set)}</pre>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <form className="inline-form" onSubmit={handleAdd}>
        <input
          type="text"
          placeholder="Название нового набора (напр. site)"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <button type="submit">Добавить набор</button>
      </form>
    </section>
  )
}
