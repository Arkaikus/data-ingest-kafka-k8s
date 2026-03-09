import type { Task } from "../types";

interface TaskItemProps {
  task: Task;
  onDelete: (id: string) => void;
}

const STATUS_COLORS: Record<Task["status"], string> = {
  pending: "#f59e0b",
  processing: "#3b82f6",
  completed: "#22c55e",
  failed: "#ef4444",
};

const STATUS_LABELS: Record<Task["status"], string> = {
  pending: "⏳ Pending",
  processing: "⚙️ Processing",
  completed: "✅ Completed",
  failed: "❌ Failed",
};

export function TaskItem({ task, onDelete }: TaskItemProps) {
  const progress =
    task.total_rows > 0
      ? Math.round((task.processed_rows / task.total_rows) * 100)
      : 0;

  return (
    <div className="task-item">
      <div className="task-header">
        <div className="task-info">
          <span className="task-name">{task.name}</span>
          <span className="task-filename">{task.filename}</span>
        </div>
        <div className="task-actions">
          <span
            className="task-status"
            style={{ color: STATUS_COLORS[task.status] }}
          >
            {STATUS_LABELS[task.status]}
          </span>
          <button
            className="delete-button"
            onClick={() => onDelete(task._id)}
            title="Delete task"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="task-progress">
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{
              width: `${progress}%`,
              backgroundColor: STATUS_COLORS[task.status],
            }}
          />
        </div>
        <span className="progress-label">
          {task.processed_rows} / {task.total_rows} rows ({progress}%)
        </span>
      </div>

      <div className="task-meta">
        <span>Created: {new Date(task.created_at).toLocaleString()}</span>
        <span>Updated: {new Date(task.updated_at).toLocaleString()}</span>
      </div>
    </div>
  );
}
