import React, { useState, useEffect, useRef, useCallback } from 'react';
import { SettingsIcon, EyeIcon, EyeOffIcon } from './icons';
import { AiProvider, OllamaConfig } from '../types';
import LoadingSpinner from './LoadingSpinner';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (settings: { apiKey?: string; aiProvider?: AiProvider; ollamaConfig?: OllamaConfig }) => void;
  currentApiKey?: string;
  currentAiProvider?: AiProvider;
  currentOllamaConfig?: OllamaConfig;
}

type UpdateStatus = 'idle' | 'checking' | 'not-available' | 'available' | 'downloading' | 'downloaded' | 'error';
type FeedbackType = 'bug' | 'idea';
type FeedbackStatus = 'idle' | 'sending' | 'sent' | 'error';

interface UpdateInfo {
  version?: string;
  error?: string;
  progress?: { percent: number };
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onSave, currentApiKey, currentAiProvider, currentOllamaConfig }) => {
  // General state
  const [appVersion, setAppVersion] = useState<string>('');

  // Settings state
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [isKeyVisible, setIsKeyVisible] = useState(false);
  const [provider, setProvider] = useState<AiProvider>('gemini');
  const [ollamaUrl, setOllamaUrl] = useState('');
  const [ollamaModel, setOllamaModel] = useState('');
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [modelFetchError, setModelFetchError] = useState<string | null>(null);

  // Updater state
  const [allowPrerelease, setAllowPrerelease] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>('idle');
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo>({});
  const timeoutRef = useRef<number | null>(null);

  // Feedback state
  const [feedbackType, setFeedbackType] = useState<FeedbackType>('bug');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackStatus, setFeedbackStatus] = useState<FeedbackStatus>('idle');
  const [feedbackResponse, setFeedbackResponse] = useState('');

  const ollamaModelRef = useRef(ollamaModel);
  ollamaModelRef.current = ollamaModel;

  const handleFetchModels = useCallback(async (urlToFetch: string) => {
    if (!urlToFetch.trim() || !window.electronAPI) {
      setOllamaModels([]);
      setOllamaModel('');
      return;
    }
    
    setIsFetchingModels(true);
    setModelFetchError(null);
    try {
      const models = await window.electronAPI.getOllamaModels(urlToFetch.trim());
      setOllamaModels(models);
      if (models.length > 0) {
        if (!models.includes(ollamaModelRef.current)) {
          setOllamaModel(models[0]);
        }
      } else {
        setOllamaModel('');
        setModelFetchError("No models found on this server.");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "An unknown error occurred.";
      setModelFetchError(message);
      setOllamaModels([]);
      setOllamaModel('');
    } finally {
      setIsFetchingModels(false);
    }
  }, []);

  // Effect to populate state when modal opens and manage listeners
  useEffect(() => {
    if (!isOpen) return;

    const fetchInitialSettings = async () => {
      if (window.electronAPI) {
        setAppVersion(await window.electronAPI.getAppVersion());
        setAllowPrerelease(await window.electronAPI.getAllowPrerelease());
      }
    };
    fetchInitialSettings();

    setProvider(currentAiProvider || 'gemini');
    setApiKeyInput(currentApiKey || '');
    setOllamaUrl(currentOllamaConfig?.url || 'http://localhost:11434');
    setOllamaModel(currentOllamaConfig?.model || '');

    setIsKeyVisible(false);
    setUpdateStatus('idle');
    setUpdateInfo({});
    setFeedbackMessage('');
    setFeedbackStatus('idle');
    setFeedbackResponse('');
    setModelFetchError(null);

    const removeUpdateListener = window.electronAPI?.onUpdateStatus((data) => {
      setUpdateStatus(data.status);
      setUpdateInfo({ version: data.info?.version, error: data.error, progress: data.progress });
      if (data.status === 'not-available' || data.status === 'error') {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = window.setTimeout(() => setUpdateStatus('idle'), 10000);
      }
    });
    
    return () => {
      if (removeUpdateListener) removeUpdateListener();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [isOpen, currentApiKey, currentAiProvider, currentOllamaConfig]);
  
  // Debounced effect to fetch Ollama models when URL changes
  useEffect(() => {
    if (!isOpen || provider !== 'ollama') return;
    
    const handler = setTimeout(() => {
      handleFetchModels(ollamaUrl);
    }, 500);

    return () => clearTimeout(handler);
  }, [isOpen, provider, ollamaUrl, handleFetchModels]);


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ 
        apiKey: apiKeyInput.trim(),
        aiProvider: provider,
        ollamaConfig: { url: ollamaUrl.trim(), model: ollamaModel.trim() }
    });
    onClose();
  };

  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackMessage.trim() || !window.electronAPI) return;

    setFeedbackStatus('sending');
    try {
        const result = await window.electronAPI.sendFeedback({ type: feedbackType, message: feedbackMessage, version: appVersion });
        setFeedbackStatus(result.success ? 'sent' : 'error');
        setFeedbackResponse(result.message);
        if (result.success) setFeedbackMessage('');
    } catch(err) {
        setFeedbackStatus('error');
        setFeedbackResponse(err instanceof Error ? err.message : 'An unknown error occurred.');
    }
  };

  const handleKeydown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  };

  const handleUpdateClick = () => {
      if (!window.electronAPI) return;
      switch (updateStatus) {
          case 'idle': case 'error': case 'not-available': window.electronAPI.checkForUpdates(); break;
          case 'available': window.electronAPI.startUpdateDownload(); break;
          case 'downloaded': window.electronAPI.quitAndInstall(); break;
      }
  }
  
  const handlePrereleaseToggle = async (checked: boolean) => {
    setAllowPrerelease(checked);
    if (window.electronAPI) await window.electronAPI.setAllowPrerelease(checked);
  };

  const getButtonProps = () => {
      switch (updateStatus) {
          case 'checking': return { text: 'Checking...', disabled: true, className: 'bg-slate-500' };
          case 'not-available': return { text: 'Latest Version', disabled: true, className: 'bg-slate-500' };
          case 'available': return { text: `Download Update ${updateInfo.version}`, disabled: false, className: 'bg-blue-600 hover:bg-blue-700' };
          case 'downloading': return { text: `Downloading... ${Math.round(updateInfo.progress?.percent || 0)}%`, disabled: true, className: 'bg-slate-500' };
          case 'downloaded': return { text: 'Restart to Update', disabled: false, className: 'bg-green-600 hover:bg-green-700' };
          case 'error': return { text: 'Update Error', disabled: false, className: 'bg-red-600 hover:bg-red-700' };
          default: return { text: 'Check for Updates', disabled: false, className: 'bg-indigo-600 hover:bg-indigo-700' };
      }
  };

  const buttonProps = getButtonProps();
  const isSaveDisabled = provider === 'ollama' && (!ollamaUrl.trim() || !ollamaModel.trim());


  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-slate-800 rounded-lg shadow-2xl max-w-lg w-full m-4 overflow-hidden" onClick={e => e.stopPropagation()} onKeyDown={handleKeydown}>
        <form onSubmit={handleSubmit} className="p-6 max-h-[90vh] overflow-y-auto no-scrollbar">
            <div className="pb-6 border-b border-slate-700">
                <div className="flex items-center mb-4">
                    <SettingsIcon className="w-6 h-6 mr-3 text-indigo-400" />
                    <h2 className="text-xl font-bold text-slate-100">Settings</h2>
                </div>
                
                <label className="text-sm font-medium text-slate-400">AI Provider</label>
                <div className="flex gap-4 mt-2 mb-4 rounded-md bg-slate-900 p-1">
                    {(['gemini', 'ollama'] as AiProvider[]).map(p => (
                        <button type="button" key={p} onClick={() => setProvider(p)} className={`flex-1 capitalize text-center text-sm rounded py-1.5 transition-colors ${provider === p ? 'bg-indigo-600 text-white font-semibold' : 'text-slate-300 hover:bg-slate-700'}`}>
                            {p}
                        </button>
                    ))}
                </div>

                {provider === 'gemini' && (
                    <div>
                        <p className="text-slate-300 mb-2 text-sm">
                          Enter your Google Gemini API key. Your key is stored securely on your local machine.
                        </p>
                        <label htmlFor="apiKey" className="text-sm font-medium text-slate-400">Gemini API Key</label>
                        <div className="relative mt-1">
                            <input id="apiKey" type={isKeyVisible ? 'text' : 'password'} value={apiKeyInput} onChange={(e) => setApiKeyInput(e.target.value)} placeholder="Enter your API key here" className="w-full bg-slate-900 border border-slate-600 rounded-md p-3 pr-10 text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition duration-200" autoFocus/>
                            <button type="button" onClick={() => setIsKeyVisible(!isKeyVisible)} className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-200" title={isKeyVisible ? 'Hide key' : 'Show key'}>
                                {isKeyVisible ? <EyeOffIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>
                )}

                {provider === 'ollama' && (
                    <div>
                         <p className="text-slate-300 mb-2 text-sm">
                          Configure your local or remote Ollama server. Models will be fetched automatically.
                        </p>
                        <div className="grid grid-cols-1 gap-4">
                             <div>
                                <label htmlFor="ollamaUrl" className="text-sm font-medium text-slate-400">Server URL</label>
                                <div className="mt-1">
                                    <input id="ollamaUrl" type="text" value={ollamaUrl} onChange={(e) => setOllamaUrl(e.target.value)} placeholder="http://localhost:11434" className="w-full bg-slate-900 border border-slate-600 rounded-md p-3 text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition duration-200" />
                                </div>
                            </div>
                            <div>
                                <label htmlFor="ollamaModel" className="text-sm font-medium text-slate-400">Model Name</label>
                                <select id="ollamaModel" value={ollamaModel} onChange={(e) => setOllamaModel(e.target.value)} disabled={isFetchingModels || ollamaModels.length === 0} className="mt-1 w-full bg-slate-900 border border-slate-600 rounded-md p-3 text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition duration-200 disabled:opacity-50">
                                    {ollamaModels.length > 0 ? (
                                        ollamaModels.map(model => <option key={model} value={model}>{model}</option>)
                                    ) : (
                                        <option disabled value="">{isFetchingModels ? 'Loading models...' : (modelFetchError ? 'Check URL' : 'No models found')}</option>
                                    )}
                                </select>
                                {modelFetchError && <p className="text-xs text-red-400 mt-1">{modelFetchError}</p>}
                            </div>
                        </div>
                    </div>
                )}
            </div>
            
            <div className="py-6 border-b border-slate-700">
                <form onSubmit={handleFeedbackSubmit}>
                    <label className="text-sm font-medium text-slate-400">Feedback & Support</label>
                    <p className="text-xs text-slate-500 mt-1 mb-3">Found a bug or have an idea? Let us know!</p>
                    <div className="flex gap-2 mb-3">
                        <select value={feedbackType} onChange={(e) => setFeedbackType(e.target.value as FeedbackType)} className="bg-slate-700 border border-slate-600 rounded-md p-2 text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition duration-200">
                            <option value="bug">Bug Report</option>
                            <option value="idea">Idea / Feedback</option>
                        </select>
                        <textarea value={feedbackMessage} onChange={(e) => setFeedbackMessage(e.target.value)} placeholder="Describe the issue or your idea..." rows={3} className="flex-grow w-full bg-slate-900 border border-slate-600 rounded-md p-2 text-slate-200 placeholder:text-slate-500 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition duration-200 resize-y" />
                    </div>
                    <div className="flex justify-between items-center">
                         <div className="text-xs h-4">
                            {feedbackStatus === 'sent' && <p className="text-green-400">{feedbackResponse}</p>}
                            {feedbackStatus === 'error' && <p className="text-red-400">{feedbackResponse}</p>}
                         </div>
                        <button type="submit" disabled={!feedbackMessage.trim() || feedbackStatus === 'sending'} className="px-4 py-2 text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-indigo-500 transition-colors disabled:bg-indigo-300 disabled:cursor-not-allowed">
                            {feedbackStatus === 'sending' ? 'Sending...' : 'Submit Feedback'}
                        </button>
                    </div>
                </form>
            </div>

            <div className="py-6">
                <label className="text-sm font-medium text-slate-400">Application Updates</label>
                <div className="flex items-center gap-4 mt-2">
                    <button type="button" onClick={handleUpdateClick} disabled={buttonProps.disabled} className={`px-4 py-2 w-48 text-center text-sm font-medium rounded-md shadow-sm text-white transition-colors ${buttonProps.className} ${buttonProps.disabled ? 'opacity-70 cursor-not-allowed' : ''}`}>
                        {buttonProps.text}
                    </button>
                    <div className="text-xs text-slate-400">{appVersion && `Current Version: ${appVersion}`}</div>
                </div>
                
                <div className="mt-4">
                    <label htmlFor="prerelease-toggle" className="flex items-center cursor-pointer group w-fit">
                        <div className="relative">
                            <input id="prerelease-toggle" type="checkbox" className="sr-only peer" checked={allowPrerelease} onChange={(e) => handlePrereleaseToggle(e.target.checked)} />
                            <div className="block w-12 h-7 bg-slate-600 rounded-full transition-colors duration-200 ease-in-out peer-checked:bg-indigo-600"></div>
                            <div className="dot absolute left-1 top-1 bg-white w-5 h-5 rounded-full transition-transform duration-200 ease-in-out peer-checked:translate-x-full"></div>
                        </div>
                        <div className="ml-3 text-sm text-slate-300 group-hover:text-white transition-colors">Check for pre-release versions</div>
                    </label>
                    <p className="text-xs text-slate-500 mt-1">Enable to receive beta and other test builds. May be unstable.</p>
                </div>

                {updateStatus === 'error' && (
                    <div className="mt-2 text-xs text-red-500">
                        <p className="font-semibold">An error occurred during the update process.</p>
                        <p className="mt-1">More details are available in the log file.</p>
                        {window.electronAPI?.openLogFile && ( <button type="button" onClick={() => window.electronAPI.openLogFile()} className="text-indigo-400 hover:underline mt-1 text-left">Open Log File</button>)}
                    </div>
                )}
            </div>
            <div className="flex justify-end items-center gap-4 pt-6 mt-6 border-t border-slate-700">
                <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium rounded-md text-slate-300 bg-slate-700 border border-slate-600 hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-indigo-500 transition-colors">Cancel</button>
                <button type="submit" disabled={isSaveDisabled} className="px-4 py-2 text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">Save Settings</button>
            </div>
        </form>
      </div>
    </div>
  );
};

export default SettingsModal;