import React, { useState, useCallback } from 'react';
import { FolderClosedIcon, FolderOpenIcon, FileCodeIcon, HtmlIcon, CssIcon, JsIcon, FilesIcon, FolderPlusIcon, PenLineIcon, TrashIcon, CopyDuplicateIcon, FilePlusIcon, DotIcon, UploadIcon } from './icons';
import LoadingSpinner from './LoadingSpinner';
import ContextMenu, { ContextMenuItem } from './ContextMenu';
import { TreeNode } from '../types';

type OnNodeAction = (context: { path: string; isFolder: boolean }) => void;
type OnPathAction = (path: string) => void;
type OnContainerAction = (context: { path?: string }) => void;
type OnVoidAction = () => void;

interface FileExplorerProps {
  fileTree: TreeNode[];
  activeFile: string | null;
  selectedNodes: Set<string>;
  recentlyUpdatedPaths: Set<string>;
  onSelectNode: (path: string, isCtrlOrMeta: boolean, isFolder: boolean) => void;
  isLoading: boolean;
  onAddFolder: OnContainerAction;
  onAddFile: OnContainerAction;
  onUploadFile: OnVoidAction;
  onDeleteNodes: (context: { paths: Set<string> }) => void;
  onRenameNode: OnNodeAction;
  onCopyPath: OnPathAction;
  onMoveNodes: (sourcePaths: string[], destinationPath: string | null) => void;
  projectRoot: string | null;
}

const getIconForFile = (fileName: string) => {
  const extension = fileName.split('.').pop()?.toLowerCase();
  switch (extension) {
    case 'html': return HtmlIcon;
    case 'css': return CssIcon;
    case 'js': case 'jsx': case 'ts': case 'tsx': return JsIcon;
    default: return FileCodeIcon;
  }
};

const sortTree = (a: TreeNode, b: TreeNode) => {
  if (a.type === 'folder' && b.type === 'file') return -1;
  if (a.type === 'file' && b.type === 'folder') return 1;
  return a.name.localeCompare(b.name);
};

interface TreeViewProps {
  tree: TreeNode[];
  activeFile: string | null;
  selectedNodes: Set<string>;
  recentlyUpdatedPaths: Set<string>;
  onSelectNode: (path: string, isCtrlOrMeta: boolean, isFolder: boolean) => void;
  openFolders: Set<string>;
  toggleFolder: (path: string) => void;
  onContextMenu: (event: React.MouseEvent, node: TreeNode) => void;
  onMoveNodes: (sourcePaths: string[], destinationPath: string | null) => void;
  level: number;
}

const TreeView: React.FC<TreeViewProps> = (props) => {
  const { tree, level, ...rest } = props;
  const [dragOverPath, setDragOverPath] = useState<string | null>(null);
  
  const handleDragStart = (e: React.DragEvent, node: TreeNode) => {
    const pathsToDrag = rest.selectedNodes.has(node.path) ? [...rest.selectedNodes] : [node.path];
    e.dataTransfer.setData('application/coder-app-paths', JSON.stringify(pathsToDrag));
    e.dataTransfer.effectAllowed = 'move';
  };
  
  const handleDrop = (e: React.DragEvent, targetNode: TreeNode | null) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverPath(null);
    const sourcePaths = JSON.parse(e.dataTransfer.getData('application/coder-app-paths'));
    const destinationPath = targetNode?.type === 'folder' ? targetNode.path : null;

    if (targetNode) {
        for(const sourcePath of sourcePaths) {
            if (targetNode.path.startsWith(`${sourcePath}/`) || targetNode.path === sourcePath) return;
        }
    }
    rest.onMoveNodes(sourcePaths, destinationPath);
  };
  
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  return (
    <ul className="space-y-1">
      {tree.sort(sortTree).map((node) => {
        const isSelected = rest.selectedNodes.has(node.path);
        const isActive = rest.activeFile === node.path;
        
        let nodeBgClass = 'text-slate-300 hover:bg-slate-700';
        if (isActive) nodeBgClass = 'bg-indigo-600 text-white';
        else if (isSelected) nodeBgClass = 'bg-slate-600 text-white';
        if (dragOverPath === node.path) nodeBgClass += ' outline outline-2 outline-indigo-500';
        
        const isUpdated = rest.recentlyUpdatedPaths.has(node.path);
        
        if (node.type === 'folder') {
          const isOpen = rest.openFolders.has(node.path);
          return (
            <li key={node.path}
                onDragEnter={() => setDragOverPath(node.path)}
                onDragLeave={() => setDragOverPath(null)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, node)}
            >
              <div
                onClick={(e) => { e.stopPropagation(); rest.onSelectNode(node.path, e.ctrlKey || e.metaKey, true); rest.toggleFolder(node.path); }}
                onContextMenu={(e) => rest.onContextMenu(e, node)}
                draggable="true"
                onDragStart={(e) => handleDragStart(e, node)}
                className={`w-full flex items-center justify-between text-left px-3 py-2 rounded-md text-sm transition-colors cursor-pointer ${nodeBgClass}`}
                style={{ paddingLeft: `${0.75 + level * 1}rem` }}
                title={node.name}
              >
                <div className="flex items-center truncate">
                    <span className="mr-3">
                        {isOpen ? <FolderOpenIcon className="w-4 h-4 flex-shrink-0 text-indigo-400" /> : <FolderClosedIcon className="w-4 h-4 flex-shrink-0 text-indigo-400" />}
                    </span>
                    <span className="truncate">{node.name}</span>
                </div>
                {isUpdated && <DotIcon className="w-2 h-2 text-indigo-500 flex-shrink-0 animate-pulse" />}
              </div>
              {isOpen && <TreeView tree={node.children} level={level + 1} {...rest} />}
            </li>
          );
        } else {
          const FileIcon = getIconForFile(node.path);
          return (
            <li key={node.path} 
                onClick={(e) => { e.stopPropagation(); rest.onSelectNode(node.path, e.ctrlKey || e.metaKey, false); }}
                onContextMenu={(e) => rest.onContextMenu(e, node)}
                draggable="true"
                onDragStart={(e) => handleDragStart(e, node)}
                className={`w-full flex items-center justify-between text-left px-3 py-2 rounded-md text-sm transition-colors cursor-pointer ${nodeBgClass}`}
                style={{ paddingLeft: `${0.75 + level * 1}rem` }}
                title={node.path}
                aria-current={isActive}
            >
              <div className="flex items-center truncate">
                <FileIcon className="w-4 h-4 mr-3 flex-shrink-0" />
                <span className="truncate">{node.name}</span>
              </div>
              {isUpdated && <DotIcon className="w-2 h-2 text-indigo-500 flex-shrink-0 animate-pulse" />}
            </li>
          );
        }
      })}
    </ul>
  );
};

const FileExplorer: React.FC<FileExplorerProps> = (props) => {
  const { fileTree, isLoading, onAddFolder, onAddFile, onDeleteNodes, onRenameNode, onCopyPath, onMoveNodes, projectRoot, onUploadFile } = props;
  const [openFolders, setOpenFolders] = useState(new Set<string>());
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, node: TreeNode | null } | null>(null);
  
  const toggleFolder = useCallback((folderPath: string) => {
    setOpenFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(folderPath)) newSet.delete(folderPath);
      else newSet.add(folderPath);
      return newSet;
    });
  }, []);

  const handleContextMenu = useCallback((event: React.MouseEvent, node: TreeNode | null = null) => {
    event.preventDefault();
    event.stopPropagation();
    if (node && !props.selectedNodes.has(node.path)) {
      props.onSelectNode(node.path, false, node.type === 'folder');
    }
    setContextMenu({ x: event.clientX, y: event.clientY, node });
  }, [props.selectedNodes, props.onSelectNode]);

  const closeContextMenu = () => setContextMenu(null);

  const getContextMenuItems = (): ContextMenuItem[] => {
    if (!contextMenu) return [];
    const { node } = contextMenu;
    const selectionSize = props.selectedNodes.size;

    if (selectionSize > 1 && node && props.selectedNodes.has(node.path)) {
      return [{ type: 'action', label: `Delete ${selectionSize} items`, icon: TrashIcon, action: () => onDeleteNodes({ paths: props.selectedNodes }) }];
    }
    
    const folderActions: ContextMenuItem[] = [
      { type: 'action', label: 'New File', icon: FilePlusIcon, action: () => onAddFile({ path: node?.path }) },
      { type: 'action', label: 'New Folder', icon: FolderPlusIcon, action: () => onAddFolder({ path: node?.path }) },
    ];

    if (node) {
      const isFolder = node.type === 'folder';
      const commonActions: ContextMenuItem[] = [
        { type: 'separator' },
        { type: 'action', label: 'Rename', icon: PenLineIcon, action: () => onRenameNode({ path: node.path, isFolder }) },
        { type: 'action', label: 'Delete', icon: TrashIcon, action: () => onDeleteNodes({ paths: new Set([node.path]) }) },
        { type: 'separator' },
        { type: 'action', label: 'Copy Path', icon: CopyDuplicateIcon, action: () => onCopyPath(node.path) },
      ];
      return isFolder ? [...folderActions, ...commonActions] : commonActions;
    } else {
      return [
        { type: 'action', label: 'Upload File', icon: UploadIcon, action: onUploadFile },
        { type: 'separator' },
        { type: 'action', label: 'New File', icon: FilePlusIcon, action: () => onAddFile({}) },
        { type: 'action', label: 'New Folder', icon: FolderPlusIcon, action: () => onAddFolder({}) },
      ];
    }
  };
  
  const handleDropOnContainer = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const sourcePaths = JSON.parse(e.dataTransfer.getData('application/coder-app-paths'));
    onMoveNodes(sourcePaths, null); // null destination means root
  };

  const renderContent = () => {
    if (!projectRoot) {
        return <div className="text-slate-400 p-4 text-sm">Open a project folder to get started.</div>;
    }
    if (isLoading) {
      return <div className="flex flex-col items-center justify-center h-full text-slate-400 p-4"><LoadingSpinner /><p className="mt-2 text-sm">Loading project...</p></div>;
    }
    if (fileTree.length === 0) {
      return <div className="text-slate-400 p-4 text-sm">This folder is empty. Use the prompt to generate files.</div>;
    }
    return (
      <div className="p-2">
        <TreeView tree={fileTree} onContextMenu={handleContextMenu} openFolders={openFolders} toggleFolder={toggleFolder} level={0} {...props} />
      </div>
    );
  };

  return (
    <div className="bg-slate-800 rounded-lg shadow-lg flex-1 min-h-0 flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between bg-slate-900 px-4 py-2 border-b border-slate-700 flex-shrink-0">
        <div className="flex items-center">
            <FilesIcon className="w-5 h-5 mr-3 text-indigo-400" />
            <h3 className="text-md font-semibold text-slate-200">File Explorer</h3>
        </div>
        <div className="flex items-center gap-1">
            <button
                onClick={onUploadFile}
                title="Upload File"
                disabled={!projectRoot}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <UploadIcon className="w-4 h-4" />
            </button>
            <button
                onClick={() => onAddFile({})}
                title="New File"
                disabled={!projectRoot}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <FilePlusIcon className="w-4 h-4" />
            </button>
            <button
                onClick={() => onAddFolder({})}
                title="New Folder"
                disabled={!projectRoot}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <FolderPlusIcon className="w-4 h-4" />
            </button>
        </div>
      </div>
      <div className="flex-grow overflow-auto" onContextMenu={(e) => handleContextMenu(e)} onDragOver={(e) => e.preventDefault()} onDrop={handleDropOnContainer}>
        {renderContent()}
      </div>
      {contextMenu && <ContextMenu items={getContextMenuItems()} position={{ x: contextMenu.x, y: contextMenu.y }} onClose={closeContextMenu} />}
    </div>
  );
};

export default FileExplorer;