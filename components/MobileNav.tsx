
import React from 'react';
import { SlidersHorizontalIcon, CodeIcon } from './icons';

interface MobileNavProps {
  activeView: 'controls' | 'code';
  onNavigate: (view: 'controls' | 'code') => void;
}

const MobileNav: React.FC<MobileNavProps> = ({ activeView, onNavigate }) => {
  const NavButton = ({
    view,
    label,
    icon: Icon,
  }: {
    view: 'controls' | 'code';
    label: string;
    icon: React.FC<React.SVGProps<SVGSVGElement>>;
  }) => {
    const isActive = activeView === view;
    return (
      <button
        onClick={() => onNavigate(view)}
        className={`flex flex-col items-center justify-center flex-1 py-2 text-xs transition-colors ${
          isActive ? 'text-indigo-400' : 'text-slate-400 hover:text-indigo-400'
        }`}
      >
        <Icon className="w-6 h-6 mb-1" />
        {label}
      </button>
    );
  };

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-700 flex z-20">
      <NavButton view="controls" label="Controls" icon={SlidersHorizontalIcon} />
      <NavButton view="code" label="Code" icon={CodeIcon} />
    </div>
  );
};

export default MobileNav;
