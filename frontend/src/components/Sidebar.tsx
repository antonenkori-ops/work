export type View = 'jira' | 'gantt'

interface Item {
  id: View
  label: string
}

const ITEMS: Item[] = [
  { id: 'jira', label: 'Jira' },
  { id: 'gantt', label: 'Диаграммы Ганта' },
]

interface Props {
  active: View
  onSelect: (view: View) => void
}

export default function Sidebar({ active, onSelect }: Props) {
  return (
    <nav className="sidebar">
      <div className="sidebar-title">Work Assistant</div>
      <ul className="sidebar-list">
        {ITEMS.map((item) => (
          <li key={item.id}>
            <button
              className={`sidebar-item${active === item.id ? ' sidebar-item-active' : ''}`}
              onClick={() => onSelect(item.id)}
            >
              {item.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}
