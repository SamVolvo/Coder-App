
export interface CodeFile {
  fileName: string; // This will now be a relative path
  code: string;
}

export type ModalType = 'none' | 'confirm' | 'settings' | 'rename' | 'newFile' | 'newFolder' | 'confirmDelete' | 'confirmClose';

// Specific context types for each modal
export type NewNodeModalContext = { path?: string };
export type RenameModalContext = { path: string; isFolder: boolean; initialValue: string };
export type ConfirmDeleteModalContext = { paths: Set<string> };
export type GenericConfirmModalContext = { title: string; message: string; onConfirm: () => void; };

export type ModalContext = 
  | NewNodeModalContext
  | RenameModalContext
  | ConfirmDeleteModalContext
  | GenericConfirmModalContext
  | null; // for modals that don't need context

// --- File System Types ---
export interface FileNode {
  type: 'file';
  name: string;
  path: string;
}

export interface FolderNode {
  type: 'folder';
  name: string;
  path: string;
  children: TreeNode[];
}

export type TreeNode = FileNode | FolderNode;

// --- AI Provider Types ---
export type AiProvider = 'gemini' | 'ollama';

export interface OllamaConfig {
  url: string;
  model: string;
}