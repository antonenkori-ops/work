import { useEffect, useRef, useState } from 'react'

interface Props {
  raw: string
  display: string
  onSave: (value: string) => void
  multiline?: boolean
  className?: string
  placeholder?: string
}

/**
 * Поле, где в обычном состоянии показан готовый текст с подставленными
 * значениями ({{sprint_link}} и т.п.), а при клике — исходный шаблон с
 * плейсхолдерами для правки (как формула в Excel — видна при клике в ячейку,
 * а не всегда). По содержимому подстраивается высота, если multiline.
 */
export default function EditableField({
  raw,
  display,
  onSave,
  multiline,
  className,
  placeholder,
}: Props) {
  const [value, setValue] = useState(display)
  const [editing, setEditing] = useState(false)
  const ref = useRef<HTMLTextAreaElement | HTMLInputElement>(null)

  useEffect(() => {
    if (!editing) setValue(display)
  }, [display, editing])

  useEffect(() => {
    if (multiline && ref.current) {
      const el = ref.current as HTMLTextAreaElement
      el.style.height = 'auto'
      el.style.height = `${el.scrollHeight}px`
    }
  }, [value, multiline])

  function handleFocus() {
    setEditing(true)
    setValue(raw)
  }

  function handleBlur() {
    setEditing(false)
    if (value !== raw) onSave(value)
  }

  if (multiline) {
    return (
      <textarea
        ref={ref as React.RefObject<HTMLTextAreaElement>}
        className={className}
        value={value}
        placeholder={placeholder}
        rows={1}
        onFocus={handleFocus}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleBlur}
      />
    )
  }

  return (
    <input
      ref={ref as React.RefObject<HTMLInputElement>}
      type="text"
      className={className}
      value={value}
      placeholder={placeholder}
      onFocus={handleFocus}
      onChange={(e) => setValue(e.target.value)}
      onBlur={handleBlur}
    />
  )
}
