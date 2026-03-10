import { useCallback, useEffect, useRef, useState } from "react";
import { TaskForm } from "./components/TaskForm";
import { TaskList } from "./components/TaskList";
import "./index.css";
import type { Task } from "./types";

export function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string>("");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch("/api/tasks");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: Task[] = await res.json();
      setTasks(data);
      setFetchError("");
    } catch (err) {
      setFetchError(String(err));
    }
  }, []);

  useEffect(() => {
    fetchTasks();
    intervalRef.current = setInterval(fetchTasks, 3000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchTasks]);

  const handleCreate = async (formData: FormData) => {
    setLoading(true);
    try {
      const res = await fetch("/api/tasks", { method: "POST", body: formData });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      await fetchTasks();
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    await fetchTasks();
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>📊 Data Ingest Dashboard</h1>
        <p className="subtitle">Kafka-powered distributed CSV ingestion</p>
      </header>

      <main className="app-main">
        <TaskForm onSubmit={handleCreate} loading={loading} />
        {fetchError && <div className="fetch-error">⚠️ Could not reach the API: {fetchError}</div>}
        <section className="tasks-section">
          <h2>Import Tasks</h2>
          <TaskList tasks={tasks} onDelete={handleDelete} />
        </section>
      </main>
    </div>
  );
}

export default App;
