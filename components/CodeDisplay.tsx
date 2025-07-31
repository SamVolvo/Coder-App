
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import LoadingSpinner from './LoadingSpinner';
import { CopyIcon, CheckIcon, CodeIcon, ExclamationIcon } from './icons';
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, vs, oneDark, materialLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { SyntaxTheme } from '../types';

// --- Language Registration ---
// By using PrismLight, we need to manually register the languages we want to support.
// This keeps the bundle size down.
import jsx from 'react-syntax-highlighter/dist/esm/languages/prism/jsx';
import typescript from 'react-syntax-highlighter/dist/esm/languages/prism/typescript';
import python from 'react-syntax-highlighter/dist/esm/languages/prism/python';
import java_lang from 'react-syntax-highlighter/dist/esm/languages/prism/java';
import csharp from 'react-syntax-highlighter/dist/esm/languages/prism/csharp';
import go from 'react-syntax-highlighter/dist/esm/languages/prism/go';
import rust from 'react-syntax-highlighter/dist/esm/languages/prism/rust';
import css from 'react-syntax-highlighter/dist/esm/languages/prism/css';
import sql from 'react-syntax-highlighter/dist/esm/languages/prism/sql';
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json';
import markdown from 'react-syntax-highlighter/dist/esm/languages/prism/markdown';
import clike from 'react-syntax-highlighter/dist/esm/languages/prism/clike';

SyntaxHighlighter.registerLanguage('javascript', jsx);
SyntaxHighlighter.registerLanguage('jsx', jsx);
SyntaxHighlighter.registerLanguage('typescript', typescript);
SyntaxHighlighter.registerLanguage('tsx', typescript);
SyntaxHighlighter.registerLanguage('python', python);
SyntaxHighlighter.registerLanguage('java', java_lang);
SyntaxHighlighter.registerLanguage('csharp', csharp);
SyntaxHighlighter.registerLanguage('go', go);
SyntaxHighlighter.registerLanguage('rust', rust);
SyntaxHighlighter.registerLanguage('html', jsx); // HTML is handled by the markup in JSX
SyntaxHighlighter.registerLanguage('css', css);
SyntaxHighlighter.registerLanguage('sql', sql);
SyntaxHighlighter.registerLanguage('json', json);
SyntaxHighlighter.registerLanguage('markdown', markdown);
SyntaxHighlighter.registerLanguage('plaintext', clike); // A basic fallback

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
  const [editText, setEditText] = useState('');
  const [displayedContent, setDisplayedContent] = useState<DisplayLine[]>([]);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  const animationTimeoutRef = useRef<number | null>(null);
  const editTextAreaRef = useRef<HTMLTextAreaElement>(null);
  const internalUpdateRef = useRef(false);
  
  const normalizedCode = useMemo(() => code.replace(/\r\n/g, '\n'), [code]);
  const oldCode = usePreviousPerKey(normalizedCode, fileName);

  const cancelAnimation = useCallback(() => {
    if (animationTimeoutRef.current) clearTimeout(animationTimeoutRef.current);
  }, []);

  useEffect(() => {
    if (isEditing) {
        editTextAreaRef.current?.focus();
    }
  }, [isEditing]);

  useEffect(() => {
    // If the update came from this component's textarea, the ref will be true.
    // We skip this effect run to prevent an infinite loop and allow the user to continue typing.
    // We then reset the flag for the next potential external update.
    if (internalUpdateRef.current) {
        internalUpdateRef.current = false;
        return;
    }

    // This effect handles updates from props (e.g., new file selected, AI update)
    // It should not run if the code from props is the same as the local editor text
    if (normalizedCode === editText.replace(/\r\n/g, '\n')) {
        return;
    }
    
    const shouldAnimate = useTypingEffect && isLoading && onAnimationComplete;
    cancelAnimation();
    setIsEditing(false); // Always exit edit mode on a genuine external change

    if (shouldAnimate) {
      setIsAnimating(true);
      const diff = diffLines(oldCode || '', normalizedCode);
      const linesToAnimate = diff.map(line => ({ ...line, words: line.text.split(/(\s+)/).filter(Boolean) }));
      let animatedLines = diff.map(l => ({ text: '', state: l.state }));
      setDisplayedContent(animatedLines);
      let lineIndex = 0;
      let wordIndex = 0;
      const typeWord = () => {
          if (lineIndex >= linesToAnimate.length) {
              setDisplayedContent(diff);
              setEditText(normalizedCode);
              setIsAnimating(false);
              onAnimationComplete?.();
              return;
          }
          const currentLine = linesToAnimate[lineIndex];
          if (wordIndex >= currentLine.words.length) {
              lineIndex++;
              wordIndex = 0;
              animationTimeoutRef.current = window.setTimeout(typeWord, 25);
              return;
          }
          animatedLines[lineIndex].text += currentLine.words[wordIndex];
          const newText = animatedLines.map(l => l.text).join('\n');
          setDisplayedContent([...animatedLines]);
          setEditText(newText);
          wordIndex++;
          animationTimeoutRef.current = window.setTimeout(typeWord, Math.random() * 17.5 + 7.5);
      };
      typeWord();
    } else {
        setIsAnimating(false);
        const diff = diffLines(oldCode || '', normalizedCode);
        setDisplayedContent(diff);
        setEditText(normalizedCode);
    }
    
    return () => { cancelAnimation(); };
  }, [normalizedCode, oldCode, fileName, isLoading, useTypingEffect, onAnimationComplete, cancelAnimation]);


  useEffect(() => {
    if (isCopied) {
      const timer = setTimeout(() => setIsCopied(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [isCopied]);
  
  useEffect(() => { setIsCopied(false); setIsEditing(false); }, [fileName]);
  
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    // Flag that this update is from user input, not an external prop change.
    internalUpdateRef.current = true;
    const newText = e.target.value; // Keep original line endings for the textarea
    setEditText(newText);
    const normalizedNewText = newText.replace(/\r\n/g, '\n');
    const diff = diffLines(oldCode || '', normalizedNewText);
    setDisplayedContent(diff);
    onCodeChange(normalizedNewText);
  };
  
  const getLineClassName = (state: LineState) => {
    switch(state) {
      case 'added': return 'bg-emerald-900/50';
      case 'modified': return 'bg-amber-900/50';
      default: return '';
    }
  }
  
  const editorSharedStyles: React.CSSProperties = {
    fontFamily: `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace`,
    fontSize: '14px',
    lineHeight: 1.5,
    padding: '1rem',
    boxSizing: 'border-box',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
    margin: 0,
    border: 'none',
    width: '100%',
    height: '100%',
    overflow: 'auto',
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
    
    if (isEditing) {
      return (
        <textarea
          ref={editTextAreaRef}
          value={editText}
          onChange={handleTextChange}
          onBlur={() => setIsEditing(false)}
          spellCheck="false"
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          className="resize-none focus:outline-none bg-transparent text-slate-200"
          style={{
            ...editorSharedStyles,
            caretColor: '#e2e8f0', // slate-200
          }}
        />
      );
    }

    const codeForHighlighter = isAnimating ? displayedContent.map(l => l.text).join('\n') : editText.replace(/\r\n/g, '\n');

    return (
        <div 
          className="w-full h-full cursor-text"
          onClick={() => !isAnimating && setIsEditing(true)}
        >
            <SyntaxHighlighter
                language={language}
                style={themeMap[syntaxTheme] || vscDarkPlus}
                customStyle={{...editorSharedStyles, background: 'transparent'}}
                codeTagProps={{ style: { fontFamily: 'inherit', display: 'block' } }}
                wrapLines={true}
                wrapLongLines={true}
                lineProps={(lineNumber: number) => {
                    // In edit mode, don't show highlights. Show them during animation or static display.
                    const state = displayedContent[lineNumber - 1]?.state || 'unchanged';
                    const className = `transition-colors duration-300 ${getLineClassName(state)}`;
                    return { className, style: { display: 'block' } };
                }}
            >
                {codeForHighlighter + '\n'}
            </SyntaxHighlighter>
        </div>
    );
  };

  return (
    <div className="bg-slate-900 rounded-lg shadow-lg flex-grow flex flex-col relative overflow-hidden">
        <div className="flex items-center justify-between bg-slate-800 px-4 py-2 border-b border-slate-700">
            <span className="text-sm font-medium text-slate-400 truncate">{fileName || 'No file selected'}</span>
            {code && !error && (
                 <button onClick={() => { navigator.clipboard.writeText(normalizedCode); setIsCopied(true); }}
                    className="flex items-center text-sm px-3 py-1.5 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white transition-colors duration-200" >
                    {isCopied ? <><CheckIcon className="w-4 h-4 mr-1.5 text-green-400" />Copied!</> : <><CopyIcon className="w-4 h-4 mr-1.5" />Copy</>}
                </button>
            )}
        </div>
        <div className="flex-grow relative font-mono text-sm">
           {renderContent()}
        </div>
    </div>
  );
};

export default CodeDisplay;
