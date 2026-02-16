import { useState } from 'react';

interface Task {
  id: number;
  title: string;
  description: string | null;
  column: 'todo' | 'in_progress' | 'done';
  position: number;
  assignee_id: number | null;
  created_by: number;
  created_at: string;
  updated_at: string;
}

interface EditTaskModalProps {
  task: Task;
  users: Array<{ id: number; email: string; name: string }>;
  onSave: (id: number, data: Record<string, unknown>) => void;
  onDelete: (id: number) => void;
  onClose: () => void;
}

export default function EditTaskModal({ task, users, onSave, onDelete, onClose }: EditTaskModalProps) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? '');
  const [assigneeId, setAssigneeId] = useState<string>(
    task.assignee_id != null ? String(task.assignee_id) : ''
  );
  const [column, setColumn] = useState(task.column);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  function handleSave() {
    onSave(task.id, {
      title,
      description,
      assignee_id: assigneeId ? Number(assigneeId) : null,
      column,
    });
  }

  function handleDelete() {
    setConfirmingDelete(true);
  }

  function handleConfirmDelete() {
    onDelete(task.id);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-xl bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Edit Task</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-gray-400 hover:text-gray-600"
          >
            &times;
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="edit-title" className="block text-sm font-medium text-gray-700">
              Title
            </label>
            <input
              id="edit-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
            />
          </div>

          <div>
            <label htmlFor="edit-description" className="block text-sm font-medium text-gray-700">
              Description
            </label>
            <textarea
              id="edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
            />
          </div>

          <div>
            <label htmlFor="edit-assignee" className="block text-sm font-medium text-gray-700">
              Assignee
            </label>
            <select
              id="edit-assignee"
              aria-label="Assignee"
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
            >
              <option value="">Unassigned</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="edit-column" className="block text-sm font-medium text-gray-700">
              Column
            </label>
            <select
              id="edit-column"
              aria-label="Column"
              value={column}
              onChange={(e) => setColumn(e.target.value as Task['column'])}
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
            >
              <option value="todo">To Do</option>
              <option value="in_progress">In Progress</option>
              <option value="done">Done</option>
            </select>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between">
          <div>
            {!confirmingDelete ? (
              <button
                onClick={handleDelete}
                className="rounded bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700"
              >
                Delete
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-sm text-red-600">Are you sure?</span>
                <button
                  onClick={handleConfirmDelete}
                  className="rounded bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-700"
                >
                  Confirm
                </button>
              </div>
            )}
          </div>
          <button
            onClick={handleSave}
            className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
