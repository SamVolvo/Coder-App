
import React, { useState, useEffect } from 'react';
import { SparklesIcon } from './icons';

interface PromptFormProps {
  onSendMessage: (prompt: string) => void;
  isLoading: boolean;
  isSessionActive: boolean;
  isApiKeySet: boolean;
}

const PromptForm: React.FC<PromptFormProps> = ({ onSendMessage, isLoading, isSessionActive, isApiKeySet }) => {
  const [prompt, setPrompt] = useState<string>('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim() && isApiKeySet) {
      onSendMessage(prompt);
      setPrompt('');
    }
  };
  
  useEffect(() => {
      if (!isSessionActive) {
          setPrompt('');
      }
  }, [isSessionActive]);

  const mainLabel = isSessionActive ? "What changes do you need?" : "What do you want to build?";
  const subLabel = isSessionActive ? "Describe the update or new feature to add." : "Describe the component, function, or entire application you need.";
  const placeholder = isSessionActive ? "e.g., add error handling for the network request" : "e.g., a simple todo list app with HTML, CSS, and JS";
  const buttonText = isSessionActive ? "Send Update" : "Generate Project";

  const isFormDisabled = isLoading || !isApiKeySet;

  return (
    <div className="bg-slate-800 rounded-lg shadow-lg p-6 flex flex-col relative">
      {!isApiKeySet && (
        <div 
          className="absolute inset-0 bg-slate-800/80 backdrop-blur-sm z-10 flex items-center justify-center p-4 text-center rounded-lg"
          title="Please set your API key in the settings menu."
        >
          <p className="text-slate-300">API Key required. Please configure it in the Settings.</p>
        </div>
      )}
      <form onSubmit={handleSubmit} className="flex flex-col">
        <label htmlFor="prompt" className="text-lg font-semibold text-slate-200 mb-2">
          {mainLabel}
        </label>
        <p className="text-sm text-slate-400 mb-4">
          {subLabel}
        </p>
        <textarea
          id="prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-slate-900 border border-slate-700 rounded-md p-3 text-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition duration-200 resize-none"
          rows={8}
          disabled={isFormDisabled}
        ></textarea>

        <button
          type="submit"
          disabled={isFormDisabled || !prompt.trim()}
          className="mt-6 w-full inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-indigo-500 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors duration-200"
        >
          {isLoading ? (
            'Generating...'
          ) : (
            <>
              <SparklesIcon className="w-5 h-5 mr-2" />
              {buttonText}
            </>
          )}
        </button>
      </form>
    </div>
  );
};

export default PromptForm;