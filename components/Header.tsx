import React from 'react';
import { SettingsIcon, FolderPlusIcon, XIcon, TerminalIcon } from './icons';

interface HeaderProps {
    onOpenProject: () => void;
    onCloseProject: () => void;
    onOpenSettings: () => void;
    isProjectOpen: boolean;
    onOpenTerminal: () => void;
}

const Header: React.FC<HeaderProps> = ({ onOpenProject, onCloseProject, onOpenSettings, isProjectOpen, onOpenTerminal }) => {
  const logoSrc = import.meta.env.PROD ? '../assets/icon.png' : '/assets/icon.png';

  return (
    <header className="bg-slate-900/80 backdrop-blur-sm sticky top-0 z-10 border-b border-slate-700 flex-shrink-0">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
            <div className="flex items-center min-w-0">
                <img src={logoSrc} alt="Coder App Logo" className="w-8 h-8 sm:w-10 sm:h-10 mr-2 sm:mr-3" />
                <h1 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight text-slate-100 truncate">
                    Coder App
                </h1>
            </div>
            <div className="flex items-center gap-2">
                <button
                    onClick={onOpenSettings}
                    title="Settings"
                    className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-full transition-colors flex-shrink-0"
                >
                    <SettingsIcon className="w-5 h-5" />
                </button>
                
                {isProjectOpen ? (
                    <>
                        <button
                            onClick={onOpenTerminal}
                            title="Open in Terminal"
                            className="flex items-center justify-center text-sm p-2 md:px-4 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white transition-colors duration-200"
                        >
                            <TerminalIcon className="w-5 h-5 md:mr-2" />
                            <span className="hidden md:inline">Terminal</span>
                        </button>
                        <button
                            onClick={onCloseProject}
                            title="Close Project"
                            className="flex items-center justify-center text-sm p-2 md:px-4 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white transition-colors duration-200"
                        >
                            <XIcon className="w-5 h-5 md:mr-2" />
                            <span className="hidden md:inline">Close</span>
                        </button>
                    </>
                ) : (
                    <button
                        onClick={onOpenProject}
                        title="Open Project"
                        className="flex items-center justify-center text-sm p-2 md:px-4 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white transition-colors duration-200"
                    >
                        <FolderPlusIcon className="w-5 h-5 md:mr-2" />
                        <span className="hidden md:inline">Open Project</span>
                    </button>
                )}
            </div>
        </div>
      </div>
    </header>
  );
};

export default Header;