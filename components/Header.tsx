
import React from 'react';
import { PlusIcon, FolderOpenIcon, SettingsIcon } from './icons';
import appIcon from '../assets/icon.png';

interface HeaderProps {
    onNewProject: () => void;
    onOpenProject: () => void;
    onOpenSettings: () => void;
}

const Header: React.FC<HeaderProps> = ({ onNewProject, onOpenProject, onOpenSettings }) => {
  return (
    <header className="bg-slate-900/70 backdrop-blur-sm sticky top-0 z-10 border-b border-slate-700">
      <div className="max-w-screen-2xl mx-auto px-4 md:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
                <img src={appIcon} alt="Coder App Logo" className="w-10 h-10 mr-3" />
                <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-100">
                    Coder App
                </h1>
            </div>
            <div className="flex items-center gap-2 md:gap-4">
                <button
                    onClick={onOpenSettings}
                    className="inline-flex items-center justify-center p-2 rounded-md text-slate-400 hover:text-white hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-indigo-500 transition-colors"
                    title="Settings"
                >
                    <SettingsIcon className="w-5 h-5" />
                </button>
                <div className="w-px h-6 bg-slate-700"></div>
                <button
                    onClick={onOpenProject}
                    className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-indigo-500 transition-colors"
                >
                    <FolderOpenIcon className="w-5 h-5 mr-2 -ml-1" />
                    Open Project
                </button>
                 <button
                    onClick={onNewProject}
                    title={"Close current project"}
                    className="inline-flex items-center justify-center px-4 py-2 border border-slate-600 text-sm font-medium rounded-md shadow-sm text-slate-200 bg-slate-700 hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <PlusIcon className="w-5 h-5 mr-2 -ml-1" />
                    New Session
                </button>
            </div>
        </div>
      </div>
    </header>
  );
};

export default Header;