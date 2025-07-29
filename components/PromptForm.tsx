


import React, { useState, useEffect, useRef } from 'react';
import { SparklesIcon, PaperclipIcon, XIcon } from './icons';

interface PromptFormProps {
  onSendMessage: (prompt: string, imageBase64: string | null) => void;
  isLoading: boolean;
  isSessionActive: boolean;
  isApiKeySet: boolean;
}

const PromptForm: React.FC<PromptFormProps> = ({ onSendMessage, isLoading, isSessionActive, isApiKeySet }) => {
  const [prompt, setPrompt] = useState<string>('');
  const [image, setImage] = useState<{ file: File, preview: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage({ file, preview: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImage(null);
    if(fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim() || image) {
      if (image) {
        // The preview is a data URL (data:image/png;base64,iVBORw0KGgo...)
        // We need to strip the prefix to get the raw base64 string
        const base64String = image.preview.split(',')[1];
        onSendMessage(prompt, base64String);
      } else {
        onSendMessage(prompt, null);
      }
      setPrompt('');
      removeImage();
    }
  };
  
  useEffect(() => {
      if (!isSessionActive) {
          setPrompt('');
          removeImage();
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

        {image && (
          <div className="mb-4 relative w-fit">
            <img src={image.preview} alt="Prompt preview" className="max-h-32 rounded-md border border-slate-600" />
            <button
              type="button"
              onClick={removeImage}
              className="absolute -top-2 -right-2 bg-slate-700 rounded-full p-1 text-slate-300 hover:bg-red-500 hover:text-white transition-colors"
              title="Remove image"
            >
              <XIcon className="w-4 h-4" />
            </button>
          </div>
        )}

        <textarea
          id="prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-slate-900 border border-slate-700 rounded-md p-3 text-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition duration-200 resize-none"
          rows={image ? 4 : 8}
          disabled={isFormDisabled}
        ></textarea>
        
        <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageChange}
            className="hidden"
            accept="image/png, image/jpeg"
        />

        <div className="mt-6 flex items-center justify-between gap-4">
            <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isFormDisabled}
                className="inline-flex items-center justify-center px-4 py-3 border border-slate-600 text-sm font-medium rounded-md shadow-sm text-slate-200 bg-slate-700 hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Attach an image to your prompt"
            >
                <PaperclipIcon className="w-5 h-5"/>
            </button>
            <button
              type="submit"
              disabled={isFormDisabled || (!prompt.trim() && !image)}
              className="flex-grow inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-indigo-500 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors duration-200"
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
        </div>
      </form>
    </div>
  );
};

export default PromptForm;