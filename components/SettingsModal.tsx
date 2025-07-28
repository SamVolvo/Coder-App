
import React, { useState, useEffect, useRef } from 'react';
import { SettingsIcon, EyeIcon, EyeOffIcon } from './icons';
import { SyntaxTheme } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (settings: { apiKey: string, useTypingEffect: boolean, syntaxTheme: SyntaxTheme }) => void;
  currentApiKey?: string;
  currentUseTypingEffect: boolean;
  currentSyntaxTheme: SyntaxTheme;
}

type UpdateStatus = 'idle' | 'checking' | 'not-available' | 'available' | 'downloading' | 'downloaded' | 'error';

interface UpdateInfo {
  version?: string;
  error?: string;
  progress?: { percent: number };
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onSave, currentApiKey, currentUseTypingEffect, currentSyntaxTheme }) => {
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [isKeyVisible, setIsKeyVisible] = useState(false);
  const [useTypingEffect, setUseTypingEffect] = useState(true);
  const [syntaxTheme, setSyntaxTheme] = useState<SyntaxTheme>('vsc-dark-plus');
  
  const [appVersion, setAppVersion] = useState<string>('');
  const [allowPrerelease, setAllowPrerelease] = useState(false);
  
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>('idle');
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo>({});
  const timeoutRef = useRef<number | null>(null);

  const isModified = apiKeyInput.trim() !== (currentApiKey || '').trim() || useTypingEffect !== currentUseTypingEffect || syntaxTheme !== currentSyntaxTheme;

  useEffect(() => {
    if (isOpen) {
      const fetchInitialSettings = async () => {
        if (window.electronAPI) {
          const version = await window.electronAPI.getAppVersion();
          setAppVersion(version);
          const prereleaseSetting = await window.electronAPI.getAllowPrerelease();
          setAllowPrerelease(prereleaseSetting);
        }
      };
      
      fetchInitialSettings();
      setApiKeyInput(currentApiKey || '');
      setUseTypingEffect(currentUseTypingEffect);
      setSyntaxTheme(currentSyntaxTheme);
      setIsKeyVisible(false);

      setUpdateStatus('idle');
      setUpdateInfo({});
      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      if (window.electronAPI?.onUpdateStatus) {
          const removeListener = window.electronAPI.onUpdateStatus((data) => {
              setUpdateStatus(data.status);
              setUpdateInfo({
                  version: data.info?.version,
                  error: data.error,
                  progress: data.progress,
              });

              if (data.status === 'not-available' || data.status === 'error') {
                  if (timeoutRef.current) clearTimeout(timeoutRef.current);
                  timeoutRef.current = window.setTimeout(() => {
                      setUpdateStatus('idle');
                      setUpdateInfo({});
                  }, 10000);
              }
          });

          return () => {
              removeListener();
              if (timeoutRef.current) clearTimeout(timeoutRef.current);
          };
      }
    }
  }, [isOpen, currentApiKey, currentUseTypingEffect, currentSyntaxTheme]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      apiKey: apiKeyInput.trim(),
      useTypingEffect: useTypingEffect,
      syntaxTheme: syntaxTheme
    });
    onClose();
  };

  const handleKeydown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  const handleUpdateClick = () => {
      if (!window.electronAPI) return;
      
      switch (updateStatus) {
          case 'idle':
          case 'error':
          case 'not-available':
              window.electronAPI.checkForUpdates();
              break;
          case 'available':
              window.electronAPI.startUpdateDownload();
              break;
          case 'downloaded':
              window.electronAPI.quitAndInstall();
              break;
          default:
              // Do nothing while checking or downloading
      }
  }
  
  const handlePrereleaseToggle = async (checked: boolean) => {
    setAllowPrerelease(checked);
    if (window.electronAPI) {
      await window.electronAPI.setAllowPrerelease(checked);
    }
  };

  const getButtonProps = () => {
      switch (updateStatus) {
          case 'checking': return { text: 'Checking...', disabled: true, className: 'bg-slate-600' };
          case 'not-available': return { text: 'Latest Version', disabled: true, className: 'bg-slate-600' };
          case 'available': return { text: `Download Update ${updateInfo.version}`, disabled: false, className: 'bg-blue-600 hover:bg-blue-700' };
          case 'downloading': return { text: `Downloading... ${Math.round(updateInfo.progress?.percent || 0)}%`, disabled: true, className: 'bg-slate-600' };
          case 'downloaded': return { text: 'Restart to Update', disabled: false, className: 'bg-green-600 hover:bg-green-700' };
          case 'error': return { text: 'Update Error', disabled: false, className: 'bg-red-600 hover:bg-red-700' };
          case 'idle':
          default: return { text: 'Check for Updates', disabled: false, className: 'bg-indigo-600 hover:bg-indigo-700' };
      }
  };

  const buttonProps = getButtonProps();

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-50"
      aria-modal="true"
      role="dialog"
      onClick={onClose}
    >
      <form 
        onSubmit={handleSubmit}
        className="bg-slate-800 rounded-lg shadow-2xl max-w-lg w-full p-6 m-4 divide-y divide-slate-700"
        onClick={e => e.stopPropagation()}
        onKeyDown={handleKeydown}
      >
        <div className="pb-6">
            <div className="flex items-center mb-4">
                <SettingsIcon className="w-6 h-6 mr-3 text-indigo-400" />
                <h2 className="text-xl font-bold text-slate-100">Settings</h2>
            </div>
            
            <p className="text-slate-300 mb-2">
              Enter your Google Gemini API key. Your key is stored securely on your local machine and is never shared.
            </p>
            <p className="text-xs text-slate-400 mb-4">
                You can get a key from Google AI Studio.
            </p>

            <label htmlFor="apiKey" className="text-sm font-medium text-slate-400">
                Gemini API Key
            </label>
            <div className="relative mt-1">
                <input
                  id="apiKey"
                  type={isKeyVisible ? 'text' : 'password'}
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="Enter your API key here"
                  className="w-full bg-slate-900 border border-slate-700 rounded-md p-3 pr-10 text-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition duration-200"
                  autoFocus
                />
                <button
                    type="button"
                    onClick={() => setIsKeyVisible(!isKeyVisible)}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-200"
                    title={isKeyVisible ? 'Hide key' : 'Show key'}
                >
                    {isKeyVisible ? <EyeOffIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                </button>
            </div>
        </div>

        <div className="py-6">
            <h3 className="text-sm font-medium text-slate-400 mb-2">
                User Interface
            </h3>
            <div className="space-y-4">
                <label htmlFor="typing-effect-toggle" className="flex items-center cursor-pointer group w-fit">
                    <div className="relative">
                        <input 
                            id="typing-effect-toggle"
                            type="checkbox" 
                            className="sr-only peer" 
                            checked={useTypingEffect} 
                            onChange={(e) => setUseTypingEffect(e.target.checked)}
                        />
                        <div className="block w-12 h-7 bg-slate-600 rounded-full transition-colors duration-200 ease-in-out peer-checked:bg-indigo-600"></div>
                        <div className="dot absolute left-1 top-1 bg-white w-5 h-5 rounded-full transition-transform duration-200 ease-in-out peer-checked:translate-x-full"></div>
                    </div>
                    <div className="ml-3 text-sm text-slate-300 group-hover:text-white transition-colors">
                        Enable typing effect for AI output
                    </div>
                </label>
                <div>
                    <label htmlFor="syntax-theme" className="text-sm text-slate-300">
                        Syntax Highlighting Theme
                    </label>
                    <select
                        id="syntax-theme"
                        value={syntaxTheme}
                        onChange={(e) => setSyntaxTheme(e.target.value as SyntaxTheme)}
                        className="mt-1 w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition duration-200"
                    >
                        <option value="vsc-dark-plus">VS Code Dark+</option>
                        <option value="one-dark">One Dark</option>
                        <option value="vs">VS Light</option>
                        <option value="material-light">Material Light</option>
                    </select>
                </div>
            </div>
        </div>
        
        <div className="py-6">
            <label className="text-sm font-medium text-slate-400">
                Application Updates
            </label>
            <div className="flex items-center gap-4 mt-2">
                <button
                    type="button"
                    onClick={handleUpdateClick}
                    disabled={buttonProps.disabled}
                    className={`px-4 py-2 w-48 text-center text-sm font-medium rounded-md shadow-sm text-white transition-colors ${buttonProps.className} ${buttonProps.disabled ? 'opacity-70 cursor-not-allowed' : ''}`}
                >
                    {buttonProps.text}
                </button>
                <div className="text-xs text-slate-500">
                  {appVersion && `Current Version: ${appVersion}`}
                </div>
            </div>
            
            <div className="mt-4">
                <label htmlFor="prerelease-toggle" className="flex items-center cursor-pointer group w-fit">
                    <div className="relative">
                        <input 
                            id="prerelease-toggle"
                            type="checkbox" 
                            className="sr-only peer" 
                            checked={allowPrerelease} 
                            onChange={(e) => handlePrereleaseToggle(e.target.checked)}
                        />
                        <div className="block w-12 h-7 bg-slate-600 rounded-full transition-colors duration-200 ease-in-out peer-checked:bg-indigo-600"></div>
                        <div className="dot absolute left-1 top-1 bg-white w-5 h-5 rounded-full transition-transform duration-200 ease-in-out peer-checked:translate-x-full"></div>
                    </div>
                    <div className="ml-3 text-sm text-slate-300 group-hover:text-white transition-colors">
                        Check for pre-release versions
                    </div>
                </label>
                <p className="text-xs text-slate-500 mt-1">
                    Enable to receive beta and other test builds. May be unstable.
                </p>
            </div>

            {updateStatus === 'error' && (
                <div className="mt-2 text-xs text-red-400">
                    <p className="font-semibold">An error occurred during the update process.</p>
                    <p className="mt-1">More details are available in the log file.</p>
                    {window.electronAPI?.openLogFile && (
                        <button
                            type="button"
                            onClick={() => window.electronAPI.openLogFile()}
                            className="text-indigo-400 hover:underline mt-1 text-left"
                        >
                            Open Log File
                        </button>
                    )}
                </div>
            )}
        </div>

        <div className="flex justify-end items-center gap-4 pt-6">
          <div className="flex gap-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium rounded-md text-slate-200 hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-indigo-500 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isModified}
              className="px-4 py-2 text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-indigo-500 transition-colors disabled:bg-slate-600 disabled:opacity-50"
            >
              Save Settings
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default SettingsModal;
