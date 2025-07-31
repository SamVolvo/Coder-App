
import React, { useEffect, useRef } from 'react';

export type ContextMenuItem =
  | {
      type: 'action';
      label: string;
      action: () => void;
      icon?: React.FC<React.SVGProps<SVGSVGElement>>;
      disabled?: boolean;
    }
  | {
      type: 'separator';
    };

interface ContextMenuProps {
  items: ContextMenuItem[];
  position: { x: number; y: number };
  onClose: () => void;
}

const ContextMenu: React.FC<ContextMenuProps> = ({ items, position, onClose }) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const menuStyle: React.CSSProperties = {
    top: `${position.y}px`,
    left: `${position.x}px`,
  };

  return (
    <div
      ref={menuRef}
      style={menuStyle}
      className="fixed bg-slate-800 border border-slate-700 rounded-md shadow-2xl z-50 w-48 py-1"
      role="menu"
      aria-orientation="vertical"
    >
      {items.map((item, index) => {
        if (item.type === 'separator') {
          return <div key={`separator-${index}`} className="border-t border-slate-700 my-1" />;
        }

        const Icon = item.icon;

        return (
          <button
            key={item.label}
            onClick={() => {
              item.action();
              onClose();
            }}
            disabled={item.disabled}
            className="w-full flex items-center text-left px-3 py-2 text-sm text-slate-300 hover:bg-indigo-600 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-slate-300"
            role="menuitem"
          >
            {Icon && <Icon className="w-4 h-4 mr-3" />}
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
};

export default ContextMenu;