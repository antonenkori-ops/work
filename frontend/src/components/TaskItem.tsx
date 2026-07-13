import { Task } from '../api'

function formatDate(value: string | null): string {
  if (!value) return '—'
  return new Date(value).toLocaleString('ru-RU')
}

export default function TaskItem({ task }: { task: Task }) {
  return (
    <div className="task-item">
      <div className="task-header">
        <a className="task-key" href={task.jira_url} target="_blank" rel="noopener noreferrer">
          {task.key}
        </a>
        <span className="task-summary">{task.summary}</span>
        <span className="task-status">{task.status}</span>
      </div>
      <div className="task-meta">
        <span>Исполнитель: {task.assignee ?? '—'}</span>
        <span>Обновлено: {formatDate(task.updated)}</span>
      </div>

      <details className="task-collapsible">
        <summary>Описание</summary>
        <div className="task-description">{task.description || 'Без описания'}</div>
      </details>

      <details className="task-collapsible">
        <summary>Комментарии ({task.comments.length})</summary>
        <div className="task-comments">
          {task.comments.length === 0 && <div>Комментариев нет</div>}
          {task.comments.map((c) => (
            <div className="comment" key={c.id}>
              <div className="comment-header">
                <span className="comment-author">{c.author ?? 'Неизвестный автор'}</span>
                <span className="comment-date">{formatDate(c.created)}</span>
              </div>
              <div className="comment-body">{c.body}</div>
            </div>
          ))}
        </div>
      </details>
    </div>
  )
}
