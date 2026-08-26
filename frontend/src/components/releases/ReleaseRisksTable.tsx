import { FormEvent, useState } from 'react'
import {
  addReleaseRisk,
  deleteReleaseRisk,
  Release,
  ReleaseRisk,
  updateReleaseRisk,
} from '../../api'

interface Props {
  release: Release
  onChange: (release: Release) => void
  onError: (e: unknown) => void
}

interface RiskFormState {
  description: string
  level: string
  measures: string
  owners: string
}

function emptyForm(): RiskFormState {
  return { description: '', level: '', measures: '', owners: '' }
}

function formFromRisk(risk: ReleaseRisk): RiskFormState {
  return {
    description: risk.description,
    level: risk.level ?? '',
    measures: risk.measures ?? '',
    owners: risk.owners ?? '',
  }
}

export default function ReleaseRisksTable({ release, onChange, onError }: Props) {
  const risks = [...release.risks].sort((a, b) => a.sort_order - b.sort_order)
  const [adding, setAdding] = useState(false)
  const [addForm, setAddForm] = useState<RiskFormState>(emptyForm())
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<RiskFormState>(emptyForm())

  async function submitAdd(e: FormEvent) {
    e.preventDefault()
    try {
      onChange(
        await addReleaseRisk(release.id, {
          description: addForm.description.trim(),
          level: addForm.level.trim() || undefined,
          measures: addForm.measures.trim() || undefined,
          owners: addForm.owners.trim() || undefined,
        }),
      )
      setAdding(false)
      setAddForm(emptyForm())
    } catch (err) {
      onError(err)
    }
  }

  function startEdit(risk: ReleaseRisk) {
    setEditingId(risk.id)
    setEditForm(formFromRisk(risk))
  }

  async function submitEdit(e: FormEvent, riskId: number) {
    e.preventDefault()
    try {
      onChange(
        await updateReleaseRisk(riskId, {
          description: editForm.description.trim(),
          level: editForm.level.trim() || undefined,
          measures: editForm.measures.trim() || undefined,
          owners: editForm.owners.trim() || undefined,
        }),
      )
      setEditingId(null)
    } catch (err) {
      onError(err)
    }
  }

  async function handleDelete(riskId: number) {
    if (!confirm('Удалить риск?')) return
    try {
      onChange(await deleteReleaseRisk(riskId))
    } catch (err) {
      onError(err)
    }
  }

  return (
    <section className="release-section">
      <h2 className="release-section-title">Риски при внедрении</h2>
      <div className="release-table-wrap">
        <table className="release-table release-risk-table">
          <thead>
            <tr>
              <th>№</th>
              <th>Описание риска</th>
              <th>Уровень риска</th>
              <th>Компенсирующие меры</th>
              <th>ФИО</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {risks.map((risk) =>
              editingId === risk.id ? (
                <tr key={risk.id} className="release-row-editing">
                  <td colSpan={6}>
                    <form className="release-item-form" onSubmit={(e) => submitEdit(e, risk.id)}>
                      <textarea
                        placeholder="Описание риска"
                        value={editForm.description}
                        onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                        rows={2}
                      />
                      <input
                        type="text"
                        placeholder="Уровень риска (Низкий/Средний/Высокий)"
                        value={editForm.level}
                        onChange={(e) => setEditForm({ ...editForm, level: e.target.value })}
                      />
                      <textarea
                        placeholder="Компенсирующие меры"
                        value={editForm.measures}
                        onChange={(e) => setEditForm({ ...editForm, measures: e.target.value })}
                        rows={2}
                      />
                      <textarea
                        placeholder="ФИО"
                        value={editForm.owners}
                        onChange={(e) => setEditForm({ ...editForm, owners: e.target.value })}
                        rows={2}
                      />
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
              ) : (
                <tr key={risk.id}>
                  <td className="release-col-number">{risk.number}</td>
                  <td className="release-col-comment">{risk.description}</td>
                  <td>{risk.level}</td>
                  <td className="release-col-comment">{risk.measures}</td>
                  <td className="release-col-comment">{risk.owners}</td>
                  <td className="release-row-actions">
                    <button className="btn-secondary" onClick={() => startEdit(risk)}>
                      Изменить
                    </button>
                    <button className="chart-delete-btn" onClick={() => handleDelete(risk.id)}>
                      Удалить
                    </button>
                  </td>
                </tr>
              ),
            )}

            {adding && (
              <tr className="release-row-editing">
                <td colSpan={6}>
                  <form className="release-item-form" onSubmit={submitAdd}>
                    <textarea
                      placeholder="Описание риска"
                      value={addForm.description}
                      onChange={(e) => setAddForm({ ...addForm, description: e.target.value })}
                      rows={2}
                      autoFocus
                    />
                    <input
                      type="text"
                      placeholder="Уровень риска (Низкий/Средний/Высокий)"
                      value={addForm.level}
                      onChange={(e) => setAddForm({ ...addForm, level: e.target.value })}
                    />
                    <textarea
                      placeholder="Компенсирующие меры"
                      value={addForm.measures}
                      onChange={(e) => setAddForm({ ...addForm, measures: e.target.value })}
                      rows={2}
                    />
                    <textarea
                      placeholder="ФИО"
                      value={addForm.owners}
                      onChange={(e) => setAddForm({ ...addForm, owners: e.target.value })}
                      rows={2}
                    />
                    <div className="release-item-form-actions">
                      <button type="submit">Добавить</button>
                      <button type="button" className="btn-secondary" onClick={() => setAdding(false)}>
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

      {!adding && (
        <div className="release-section-add-buttons">
          <button className="btn-secondary" onClick={() => setAdding(true)}>
            + Добавить риск
          </button>
        </div>
      )}
    </section>
  )
}
