export interface CodeFile {
  fileName: string; // This will now be a relative path
  code: string;
}

export type ModalType = 'none' | 'confirm' | 'settings' | 'rename' | 'newFile' | 'newFolder' | 'confirmDelete';

export type ModalContext = 
  | { // for newFile, newFolder
      path?: string; // parent directory path
    }
  | { // for rename
      path: string;
      isFolder: boolean;
      initialValue: string;
    }
  | { // for confirmDelete
      paths: Set<string>;
    }
  | { // for generic confirm
      title: string;
      message: string;
      onConfirm: () => void;
    }
  | null; // for modals that don't need context

export type SyntaxTheme = 'vsc-dark-plus' | 'one-dark' | 'vs' | 'material-light';

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