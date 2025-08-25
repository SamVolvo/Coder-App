import React, { useState, useEffect } from 'react';
import type { CodeFile } from '../types';

interface CodeDisplayProps {
  files: CodeFile[];
  onRemoveFile: (fileName: string) => void;
  onChangeFile: (file: CodeFile) => void;
}

const CodeDisplay: React.FC<CodeDisplayProps> = ({ files, onRemoveFile, onChangeFile }) => {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (files.length === 0) {
      setActiveIndex(0);
    } else if (activeIndex >= files.length) {
      setActiveIndex(files.length - 1);
    }
  }, [files.length, activeIndex]);

  if (files.length === 0) return null;

  const safeIndex = Math.min(activeIndex, files.length - 1);
  const activeFile = files[safeIndex];

  const handleRemove = (index: number, fileName: string) => {
    onRemoveFile(fileName);
    if (index === safeIndex && files.length > 1) {
      // Select previous file if possible
      setActiveIndex(index > 0 ? index - 1 : 0);
    } else if (files.length === 1) {
      setActiveIndex(0);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex overflow-x-auto border-b border-neutral-800">
        {files.map((f, i) => (
          <div
            key={f.fileName}
            className={`flex items-center gap-2 px-3 py-2 text-sm cursor-pointer whitespace-nowrap ${
              i === safeIndex ? 'bg-neutral-800 text-neutral-200' : 'bg-neutral-900 text-neutral-400'
            }`}
            onClick={() => setActiveIndex(i)}
          >
            <span>{f.fileName}</span>
            <button
              className="text-neutral-500 hover:text-neutral-300"
              onClick={(e) => {
                e.stopPropagation();
                handleRemove(i, f.fileName);
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <textarea
        className="flex-grow w-full resize-none bg-neutral-950 p-4 font-mono text-sm text-neutral-200 outline-none"
        value={activeFile.code}
        onChange={(e) => onChangeFile({ fileName: activeFile.fileName, code: e.target.value })}
      />
    </div>
  );
};

export default CodeDisplay;

