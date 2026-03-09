import { useState } from "react";
import type { Task, ColumnId, Priority, UpdateTaskInput } from "../../shared/types";
import { COLUMNS } from "../constants";
import Modal from "../ui/Modal";
import FormField, { inputClassName } from "../ui/FormField";
import Button from "../ui/Button";

interface EditTaskModalProps {
  task: Task;
  users: Array<{ id: number; email: string; name: string }>;
  onSave: (id: number, data: UpdateTaskInput) => void;
  onDelete: (id: number) => void;
  onClose: () => void;
}

export default function EditTaskModal({
  task,
  users,
  onSave,
  onDelete,
  onClose,
}: EditTaskModalProps) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [assigneeId, setAssigneeId] = useState<string>(
    task.assignee_id != null ? String(task.assignee_id) : "",
  );
  const [column, setColumn] = useState(task.column);
  const [priority, setPriority] = useState<Priority>(task.priority);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  function handleSave() {
    onSave(task.id, {
      title,
      description,
      assignee_id: assigneeId ? Number(assigneeId) : null,
      column,
      priority,
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
    <Modal title="Edit Task" onClose={onClose}>
      <div className="space-y-4">
        <FormField label="Title" htmlFor="edit-title">
          <input
            id="edit-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={inputClassName}
          />
        </FormField>

        <FormField label="Description" htmlFor="edit-description">
          <textarea
            id="edit-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className={inputClassName}
          />
        </FormField>

        <FormField label="Assignee" htmlFor="edit-assignee">
          <select
            id="edit-assignee"
            aria-label="Assignee"
            value={assigneeId}
            onChange={(e) => setAssigneeId(e.target.value)}
            className={inputClassName}
          >
            <option value="">Unassigned</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="Column" htmlFor="edit-column">
          <select
            id="edit-column"
            aria-label="Column"
            value={column}
            onChange={(e) => setColumn(e.target.value as ColumnId)}
            className={inputClassName}
          >
            {COLUMNS.map((col) => (
              <option key={col.id} value={col.id}>
                {col.title}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="Priority" htmlFor="edit-priority">
          <select
            id="edit-priority"
            aria-label="Priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value as Priority)}
            className={inputClassName}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </FormField>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <div>
          {!confirmingDelete ? (
            <Button variant="danger" onClick={handleDelete}>
              Delete
            </Button>
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
        <Button variant="primary" onClick={handleSave}>
          Save
        </Button>
      </div>
    </Modal>
  );
}
