import { useState, useRef, useEffect, type KeyboardEvent } from "react";

interface CreateTaskFormProps {
  column: string;
  onSubmit: (data: { title: string; column: string }) => void;
}

export default function CreateTaskForm({
  column,
  onSubmit,
}: CreateTaskFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (title.trim()) {
        onSubmit({ title: title.trim(), column });
        setTitle("");
        setIsOpen(false);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
      setTitle("");
    }
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="mt-3 w-full rounded py-1 text-sm text-gray-500 hover:bg-gray-700"
      >
        + Add a card
      </button>
    );
  }

  return (
    <div className="mt-3">
      <input
        ref={inputRef}
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Enter a title..."
        className="w-full rounded border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white"
      />
    </div>
  );
}
