import React, { useState, useEffect, useRef, useCallback } from 'react';
import LoadingSpinner from './LoadingSpinner';
import { CopyIcon, CheckIcon, CodeIcon, ExclamationIcon } from './icons';
import SyntaxHighlighter from 'react-syntax-highlighter/dist/esm/prism';
import { vscDarkPlus, vs, oneDark, materialLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { SyntaxTheme } from '../types';

type LineState = 'added' | 'modified' | 'unchanged';
interface DisplayLine {
  text: string;
  state: LineState;
}

interface CodeDisplayProps {
  code: string;
  isLoading: boolean;
  error: string | null;
  language: string;
  fileName: string | null;
  hasFiles: boolean;
  onCodeChange: (newCode: string) => void;
  useTypingEffect: boolean;
  syntaxTheme: SyntaxTheme;
  onAnimationComplete: (() => void) | null;
}

const themeMap = {
    'vsc-dark-plus': vscDarkPlus,
    'one-dark': oneDark,
    'vs': vs,
    'material-light': materialLight,
};

const usePreviousPerKey = <T, K>(value: T, key: K | null): T | undefined => {
    const ref = useRef<Map<K | null, T>>(new Map());
    useEffect(() => {
        if (key !== null) ref.current.set(key, value);
    }, [key, value]);
    return ref.current.get(key);
};

const diffLines = (oldText: string, newText: string): DisplayLine[] => {
    if (oldText === undefined) return newText.split('\n').map(text => ({ text, state: 'added' }));
    const oldLines = oldText.split('\n');
    const newLines = newText.split('\n');
    const oldLinesSet = new Set(oldLines);
    return newLines.map((line, index) => {
        if (oldLines[index] === line) return { text: line, state: 'unchanged' };
        if (oldLinesSet.has(line)) return { text: line, state: 'unchanged' };
        if (oldLines[index] !== undefined) return { text: line, state: 'modified' };
        return { text: line, state: 'added' };
    });
};

const CodeDisplay: React.FC<CodeDisplayProps> = ({ code, isLoading, error, language, fileName, hasFiles, onCodeChange, useTypingEffect, syntaxTheme, onAnimationComplete }) => {
  const [isCopied, setIsCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const [displayedContent, setDisplayedContent] = useState<DisplayLine[]>([]);
  const [isAnimating, setIsAnimating] = useState(false);
  
  const animationTimeoutRef = useRef<number | null>(null);
  const debounceTimeoutRef = useRef<number | null>(null);
  const oldCode = usePreviousPerKey(code, fileName);
  
  const cancelAnimation = useCallback(() => {
    if (animationTimeoutRef.current) clearTimeout(animationTimeoutRef.current);
  }, []);

  const debouncedCodeChange = useCallback((newCode: string) => {
      if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = window.setTimeout(() => {
          onCodeChange(newCode);
      }, 500); // 500ms debounce
  }, [onCodeChange]);

  useEffect(() => {
    setIsEditing(false);
    cancelAnimation();
    setIsAnimating(false);
  }, [fileName, cancelAnimation]);

  useEffect(() => {
    const shouldAnimate = useTypingEffect && isLoading && onAnimationComplete;

    if (shouldAnimate) {
      cancelAnimation();
      setIsAnimating(true);
      
      const diff = diffLines(oldCode || '', code);
      const linesToAnimate = diff.map(line => ({ ...line, words: line.text.split(/(\s+)/).filter(Boolean) }));
      let animatedLines = diff.map(l => ({ text: '', state: l.state }));
      setDisplayedContent(animatedLines);

      let lineIndex = 0;
      let wordIndex = 0;

      const typeWord = () => {
          if (lineIndex >= linesToAnimate.length) {
              setDisplayedContent(diff);
              setIsAnimating(false);
              onAnimationComplete?.();
              return;
          }
          const currentLine = linesToAnimate[lineIndex];
          if (wordIndex >= currentLine.words.length) {
              lineIndex++;
              wordIndex = 0;
              animationTimeoutRef.current = window.setTimeout(typeWord, 50);
              return;
          }
          animatedLines[lineIndex].text += currentLine.words[wordIndex];
          setDisplayedContent([...animatedLines]);
          wordIndex++;
          animationTimeoutRef.current = window.setTimeout(typeWord, Math.random() * 35 + 15);
      };
      
      typeWord();
    } else if (!isAnimating) {
        cancelAnimation();
        setDisplayedContent(diffLines(oldCode || '', code));
    }
    
    return () => { cancelAnimation(); };
  }, [code, fileName, isLoading, useTypingEffect, onAnimationComplete, oldCode, cancelAnimation]);

  useEffect(() => {
    if (isCopied) {
      const timer = setTimeout(() => setIsCopied(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [isCopied]);
  
  useEffect(() => { setIsCopied(false); }, [code, fileName]);

  const handleBlur = () => {
    setIsEditing(false);
    // Final save on blur, cancelling any pending debounce
    if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
    if(editText !== code) onCodeChange(editText);
  };

  const handleClickToEdit = () => {
    if (fileName && !isAnimating) {
        setEditText(code);
        setIsEditing(true);
    }
  };
  
  const handleTextAreaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setEditText(e.target.value);
      debouncedCodeChange(e.target.value);
  }

  const getLineClassName = (state: LineState) => {
    switch(state) {
      case 'added': return 'bg-green-500/10';
      case 'modified': return 'bg-yellow-500/10';
      default: return '';
    }
  }

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
          <p className="text-center text-red-300">{error}</p>
        </div>
      );
    }
    if (!fileName) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-slate-500 p-4 text-center">
          <CodeIcon className="w-24 h-24 mb-4" />
          <p className="text-xl font-medium">
            {hasFiles ? 'Select a file to view its content' : 'Open a project to get started'}
          </p>
        </div>
      );
    }

    if (isEditing) {
        return (
            <textarea
              className="w-full h-full p-4 font-mono text-sm bg-slate-900 text-slate-200 resize-none focus:outline-none"
              value={editText}
              onChange={handleTextAreaChange}
              onBlur={handleBlur}
              spellCheck="false"
              aria-label={`Code editor for ${fileName}`}
              autoFocus
            />
        );
    }
    
    const codeToDisplay = displayedContent.map(l => l.text).join('\n');

    return (
      <div className={`overflow-auto w-full h-full ${isAnimating ? 'cursor-default' : 'cursor-text'}`} onClick={handleClickToEdit}>
        <SyntaxHighlighter
          language={language}
          style={themeMap[syntaxTheme] || vscDarkPlus}
          customStyle={{ background: 'transparent', margin: 0, padding: '1rem' }}
          codeTagProps={{ style: { fontFamily: 'inherit' } }}
          wrapLines={true}
          lineProps={(lineNumber: number) => {
            const state = displayedContent[lineNumber - 1]?.state || 'unchanged';
            const className = `transition-colors duration-300 ${getLineClassName(state)}`;
            return { className, style: { display: 'block' } };
          }}
        >
          {codeToDisplay}
        </SyntaxHighlighter>
      </div>
    );
  };

  return (
    <div className="bg-slate-800 rounded-lg shadow-lg flex-grow flex flex-col relative overflow-hidden h-full">
        <div className="flex items-center justify-between bg-slate-900/50 px-4 py-2 border-b border-slate-700">
            <span className="text-sm font-medium text-slate-300 truncate">{fileName || 'No file selected'}</span>
            {code && !error && (
                 <button onClick={() => { navigator.clipboard.writeText(code); setIsCopied(true); }}
                    className="flex items-center text-sm px-3 py-1.5 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white transition-colors duration-200" >
                    {isCopied ? <><CheckIcon className="w-4 h-4 mr-1.5 text-green-400" />Copied!</> : <><CopyIcon className="w-4 h-4 mr-1.5" />Copy</>}
                </button>
            )}
        </div>
        <div className="flex-grow relative">
           {renderContent()}
        </div>
    </div>
  );
};

export default CodeDisplay;