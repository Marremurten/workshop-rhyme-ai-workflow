import React from 'react';
import Button from './ui/Button';

interface BoardHeaderProps {
  userName: string;
  onRefresh: () => void;
  onLogout: () => void;
}

const BoardHeader: React.FC<BoardHeaderProps> = ({ userName, onRefresh, onLogout }) => {
  return (
    <header className="flex items-center justify-between border-b border-gray-800 bg-gray-900 px-6 py-3">
      <h1 className="text-xl font-bold text-white">Kanban Board</h1>
      <div className="flex items-center gap-4">
        <span className="text-gray-300">{userName}</span>
        <Button variant="secondary" onClick={onRefresh}>
          Refresh
        </Button>
        <Button variant="danger" onClick={onLogout} className="px-3 py-1">
          Logout
        </Button>
      </div>
    </header>
  );
};

export default BoardHeader;
