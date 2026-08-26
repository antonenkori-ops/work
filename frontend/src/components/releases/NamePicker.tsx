import { useEffect, useState } from 'react'

interface NamedOption {
  id: number
  name: string
}

interface Props {
  value: string
  onChange: (name: string) => void
  fetchOptions: () => Promise<NamedOption[]>
  addOption: (name: string) => Promise<NamedOption>
  emptyLabel?: string
  addPlaceholder?: string
}

const ADD_NEW = '__add_new__'

export default function NamePicker({
  value,
  onChange,
  fetchOptions,
  addOption,
  emptyLabel = '— не выбрано —',
  addPlaceholder = 'Новое значение',
}: Props) {
  const [options, setOptions] = useState<NamedOption[]>([])
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchOptions()
      .then(setOptions)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleAddNew() {
    const name = newName.trim()
    if (!name) return
    try {
      const option = await addOption(name)
      setOptions((prev) => (prev.some((o) => o.id === option.id) ? prev : [...prev, option]))
      onChange(option.name)
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
          placeholder={addPlaceholder}
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
      value={options.some((o) => o.name === value) ? value : ''}
      onChange={(e) => {
        if (e.target.value === ADD_NEW) {
          setAdding(true)
          return
        }
        onChange(e.target.value)
      }}
    >
      <option value="">{emptyLabel}</option>
      {value && !options.some((o) => o.name === value) && <option value={value}>{value}</option>}
      {options.map((o) => (
        <option key={o.id} value={o.name}>
          {o.name}
        </option>
      ))}
      <option value={ADD_NEW}>+ добавить новое…</option>
    </select>
  )
}
