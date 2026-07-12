import { Task } from '../api'
import TaskItem from './TaskItem'

export default function TaskList({ tasks }: { tasks: Task[] }) {
  if (tasks.length === 0) {
    return <div className="empty-state">Нет задач в работе. Нажмите «Обновить».</div>
  }

  return (
    <div className="task-list">
      {tasks.map((task) => (
        <TaskItem key={task.key} task={task} />
      ))}
    </div>
  )
}
