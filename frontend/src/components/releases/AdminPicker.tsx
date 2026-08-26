import { useEffect, useState } from 'react'
import { addReleaseAdmin, fetchReleaseAdmins, ReleaseAdmin } from '../../api'

interface Props {
  value: string
  onChange: (name: string) => void
}

const ADD_NEW = '__add_new__'

export default function AdminPicker({ value, onChange }: Props) {
  const [admins, setAdmins] = useState<ReleaseAdmin[]>([])
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchReleaseAdmins()
      .then(setAdmins)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
  }, [])

  async function handleAddNew() {
    const name = newName.trim()
    if (!name) return
    try {
      const admin = await addReleaseAdmin(name)
      setAdmins((prev) => (prev.some((a) => a.id === admin.id) ? prev : [...prev, admin]))
      onChange(admin.name)
      setAdding(false)
      setNewName('')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  if (adding) {
    return (
      <span className="admin-picker-adding">
        <input
          type="text"
          autoFocus
          placeholder="Имя нового администратора"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <button type="button" onClick={handleAddNew}>
          Добавить
        </button>
        <button type="button" className="btn-secondary" onClick={() => setAdding(false)}>
          Отмена
        </button>
        {error && <span className="error-banner">{error}</span>}
      </span>
    )
  }

  return (
    <select
      value={admins.some((a) => a.name === value) ? value : ''}
      onChange={(e) => {
        if (e.target.value === ADD_NEW) {
          setAdding(true)
          return
        }
        onChange(e.target.value)
      }}
    >
      <option value="">— не выбран —</option>
      {value && !admins.some((a) => a.name === value) && <option value={value}>{value}</option>}
      {admins.map((a) => (
        <option key={a.id} value={a.name}>
          {a.name}
        </option>
      ))}
      <option value={ADD_NEW}>+ добавить нового…</option>
    </select>
  )
}
