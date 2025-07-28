
/// <reference types="vite/client" />
import { Content } from '@google/genai';
import { TreeNode, SyntaxTheme } from './types';

// --- Main API Definition ---
declare global {
  interface Window {
    electronAPI: {
      // Settings
      getApiKey: () => Promise<string | undefined>;
      setApiKey: (key: string) => Promise<void>;
      getTypingEffect: () => Promise<boolean>;
      setTypingEffect: (value: boolean) => Promise<void>;
      getSyntaxTheme: () => Promise<SyntaxTheme>;
      setSyntaxTheme: (theme: SyntaxTheme) => Promise<void>;
      
      // App Info
      getAppVersion: () => Promise<string>;

      // Project & File System
      openProject: () => Promise<string | null>; // Returns project root path
      readProjectTree: (projectRoot: string) => Promise<TreeNode[] | null>;
      readFile: (projectRoot: string, relativePath: string) => Promise<string>;
      writeFile: (projectRoot: string, relativePath: string, content: string) => Promise<void>;
      deleteNode: (projectRoot: string, relativePath: string) => Promise<void>;
      renameNode: (projectRoot: string, oldRelativePath: string, newRelativePath: string) => Promise<void>;
      createFile: (projectRoot: string, relativePath: string) => Promise<void>;
      createFolder: (projectRoot: string, relativePath: string) => Promise<void>;
      onProjectUpdate: (callback: () => void) => () => void; // Listener for external changes

      // Chat History
      readChatHistory: (projectRoot: string) => Promise<Content[]>;
      writeChatHistory: (projectRoot: string, history: Content[]) => Promise<void>;
      
      // Updater
      getAllowPrerelease: () => Promise<boolean>;
      setAllowPrerelease: (value: boolean) => Promise<void>;
      checkForUpdates: () => void;
      startUpdateDownload: () => void;
      quitAndInstall: () => void;
      onUpdateStatus: (callback: (data: {
        status: 'idle' | 'checking' | 'not-available' | 'available' | 'downloading' | 'downloaded' | 'error';
        info?: { version?: string };
        error?: string;
        progress?: { percent: number };
      }) => void) => () => void;
      openLogFile: () => void;
    };
  }
}

// This export statement is needed to turn this file into a module
export {};
