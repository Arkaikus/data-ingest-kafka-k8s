export type TaskStatus = "pending" | "processing" | "completed" | "failed";

export interface Task {
  _id: string;
  name: string;
  filename: string;
  status: TaskStatus;
  total_rows: number;
  processed_rows: number;
  created_at: string;
  updated_at: string;
}
