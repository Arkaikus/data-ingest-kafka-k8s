import type { Task } from "../types";
import { TaskItem } from "./TaskItem";

interface TaskListProps {
  tasks: Task[];
  onDelete: (id: string) => void;
}

export function TaskList({ tasks, onDelete }: TaskListProps) {
  if (tasks.length === 0) {
    return (
      <div className="task-list-empty">
        <p>No import tasks yet. Upload a CSV file to get started.</p>
      </div>
    );
  }

  return (
    <div className="task-list">
      {tasks.map((task) => (
        <TaskItem key={task._id} task={task} onDelete={onDelete} />
      ))}
    </div>
  );
}
