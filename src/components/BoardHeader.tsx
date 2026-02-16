import React from 'react';

interface BoardHeaderProps {
  userName: string;
  onRefresh: () => void;
  onLogout: () => void;
}

const BoardHeader: React.FC<BoardHeaderProps> = ({ userName, onRefresh, onLogout }) => {
  return (
    <header className="flex items-center justify-between border-b bg-white px-6 py-3">
      <h1 className="text-xl font-bold text-gray-900">Kanban Board</h1>
      <div className="flex items-center gap-4">
        <span className="text-gray-700">{userName}</span>
        <button
          onClick={onRefresh}
          className="rounded bg-gray-100 px-3 py-1 text-sm text-gray-700 hover:bg-gray-200"
        >
          Refresh
        </button>
        <button
          onClick={onLogout}
          className="rounded bg-red-500 px-3 py-1 text-sm text-white hover:bg-red-600"
        >
          Logout
        </button>
      </div>
    </header>
  );
};

export default BoardHeader;
