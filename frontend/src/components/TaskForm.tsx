import { type FormEvent, useRef, useState } from "react";

interface TaskFormProps {
  onSubmit: (formData: FormData) => Promise<void>;
  loading: boolean;
}

export function TaskForm({ onSubmit, loading }: TaskFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [fileName, setFileName] = useState<string>("");
  const [error, setError] = useState<string>("");

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    const form = e.currentTarget;
    const formData = new FormData(form);
    const file = formData.get("file") as File | null;
    if (!file || !(file instanceof File) || file.size === 0) {
      setError("Please select a CSV file.");
      return;
    }

    try {
      await onSubmit(formData);
      form.reset();
      setFileName("");
    } catch (err) {
      setError(String(err));
    }
  };

  return (
    <div className="task-form-container">
      <h2>Import CSV Data</h2>
      <form ref={formRef} onSubmit={handleSubmit} className="task-form">
        <div className="form-row">
          <input
            type="text"
            name="name"
            placeholder="Task name (optional)"
            className="text-input"
          />
        </div>
        <div className="form-row file-row">
          <label className="file-label">
            <input
              type="file"
              name="file"
              accept=".csv"
              className="file-input"
              onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")}
            />
            <span className="file-button">📂 Choose CSV</span>
            <span className="file-name">{fileName || "No file chosen"}</span>
          </label>
          <button type="submit" className="submit-button" disabled={loading}>
            {loading ? "Uploading…" : "🚀 Start Import"}
          </button>
        </div>
        {error && <p className="form-error">{error}</p>}
      </form>
    </div>
  );
}
