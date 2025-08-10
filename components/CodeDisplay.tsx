import React, { useState, useEffect, useRef } from 'react';
import LoadingSpinner from './LoadingSpinner';
import { CopyIcon, CheckIcon, CodeIcon, ExclamationIcon } from './icons';

interface CodeDisplayProps {
  code: string;
  isLoading: boolean;
  error: string | null;
  fileName: string | null;
  hasFiles: boolean;
  onCodeChange: (newCode: string) => void;
}

const CodeDisplay: React.FC<CodeDisplayProps> = ({ code, isLoading, error, fileName, hasFiles, onCodeChange }) => {
  const [isCopied, setIsCopied] = useState(false);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setIsCopied(false);
  }, [fileName]);

  useEffect(() => {
    if (isCopied) {
      const timer = setTimeout(() => setIsCopied(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [isCopied]);
  
  const handleCodeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onCodeChange(e.target.value);
  };
  
  const renderContent = () => {
    if (isLoading && !hasFiles) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-slate-400">
          <LoadingSpinner />
          <p className="mt-4 text-lg">Generating Code...</p>
        </div>
      );
    }
    if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-red-400 p-4">
          <ExclamationIcon className="w-16 h-16 mb-4" />
          <p className="text-xl font-semibold mb-2">Error</p>
          <p className="text-center">{error}</p>
        </div>
      );
    }
    if (!fileName) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-slate-400 p-4 text-center">
          <CodeIcon className="w-24 h-24 mb-4" />
          <p className="text-xl font-medium">
            {hasFiles ? 'Select a file to view its content' : 'Open a project to get started'}
          </p>
        </div>
      );
    }
    
    return (
      <textarea
        ref={textAreaRef}
        value={code}
        onChange={handleCodeChange}
        spellCheck="false"
        autoCapitalize="off"
        autoComplete="off"
        autoCorrect="off"
        className="w-full h-full flex-grow bg-transparent text-slate-200 resize-none focus:outline-none p-4 font-mono text-sm"
      />
    );
  };

  return (
    <div className="bg-slate-900 rounded-lg shadow-lg flex-grow flex flex-col relative">
        <div className="flex items-center justify-between bg-slate-800 px-4 py-2 border-b border-slate-700">
            <span className="text-sm font-medium text-slate-400 truncate">{fileName || 'No file selected'}</span>
            {code && !error && (
                 <button onClick={() => { navigator.clipboard.writeText(code); setIsCopied(true); }}
                    className="flex items-center text-sm px-3 py-1.5 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white transition-colors duration-200" >
                    {isCopied ? <><CheckIcon className="w-4 h-4 mr-1.5 text-green-400" />Copied!</> : <><CopyIcon className="w-4 h-4 mr-1.5" />Copy</>}
                </button>
            )}
        </div>
        <div className="flex-grow relative min-h-0 flex flex-col">
           {renderContent()}
        </div>
    </div>
  );
};

export default CodeDisplay;