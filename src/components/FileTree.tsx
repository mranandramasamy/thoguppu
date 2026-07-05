import React, { useState } from 'react';
import { 
  Folder, 
  FolderOpen, 
  FileText, 
  Plus, 
  Trash2, 
  Edit3, 
  ChevronRight, 
  ChevronDown, 
  Search, 
  FolderPlus,
  FilePlus,
  X
} from 'lucide-react';
import { FileNode } from '../types';

interface FileTreeProps {
  tree: FileNode[];
  activePath: string | null;
  onSelectFile: (path: string) => void;
  onCreateFile: (parentPath: string | null, name: string) => void;
  onCreateFolder: (parentPath: string | null, name: string) => void;
  onRename: (oldPath: string, newPath: string) => void;
  onDelete: (path: string) => void;
  selectedFolder?: string | null;
  onSelectFolder?: (path: string | null) => void;
}

export default function FileTree({
  tree,
  activePath,
  onSelectFile,
  onCreateFile,
  onCreateFolder,
  onRename,
  onDelete,
  selectedFolder: propSelectedFolder,
  onSelectFolder
}: FileTreeProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedPaths, setCollapsedPaths] = useState<Record<string, boolean>>({});
  const [internalSelectedFolder, setInternalSelectedFolder] = useState<string | null>(null);

  const selectedFolder = propSelectedFolder !== undefined ? propSelectedFolder : internalSelectedFolder;
  const setSelectedFolder = (folder: string | null) => {
    if (onSelectFolder) {
      onSelectFolder(folder);
    } else {
      setInternalSelectedFolder(folder);
    }
  };
  
  // Inline actions states
  const [isCreatingFile, setIsCreatingFile] = useState<string | null>(null); // path of parent folder, or 'root'
  const [isCreatingFolder, setIsCreatingFolder] = useState<string | null>(null); // path of parent folder, or 'root'
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  
  const [newItemName, setNewItemName] = useState('');
  const [renameValue, setRenameValue] = useState('');

  const toggleCollapse = (path: string) => {
    setCollapsedPaths(prev => ({
      ...prev,
      [path]: !prev[path]
    }));
  };

  const handleStartCreateFile = (parent: string | null) => {
    setIsCreatingFile(parent || 'root');
    setIsCreatingFolder(null);
    setNewItemName('');
  };

  const handleStartCreateFolder = (parent: string | null) => {
    setIsCreatingFolder(parent || 'root');
    setIsCreatingFile(null);
    setNewItemName('');
  };

  const handleStartRename = (node: FileNode) => {
    setRenamingPath(node.path);
    setRenameValue(node.name);
  };

  const submitCreateFile = (parent: string | null) => {
    if (!newItemName.trim()) return;
    // Ensure text file ends with .txt or let it be
    let name = newItemName.trim();
    if (name.indexOf('.') === -1) {
      name += '.txt';
    }
    onCreateFile(parent, name);
    setIsCreatingFile(null);
    setNewItemName('');
  };

  const submitCreateFolder = (parent: string | null) => {
    if (!newItemName.trim()) return;
    onCreateFolder(parent, newItemName.trim());
    setIsCreatingFolder(null);
    setNewItemName('');
  };

  const submitRename = (oldPath: string) => {
    if (!renameValue.trim() || renameValue.trim() === oldPath.split('/').pop()) {
      setRenamingPath(null);
      return;
    }
    const parts = oldPath.split('/');
    parts[parts.length - 1] = renameValue.trim();
    const newPath = parts.join('/');
    onRename(oldPath, newPath);
    setRenamingPath(null);
  };

  // Check if a node should be visible based on search query
  const matchesSearch = (node: FileNode, query: string): boolean => {
    if (!query) return true;
    if (node.name.toLowerCase().includes(query.toLowerCase())) return true;
    if (node.children) {
      return node.children.some(child => matchesSearch(child, query));
    }
    return false;
  };

  // Render search-filtered nodes recursively
  const renderTree = (nodes: FileNode[], depth = 0, parentPath: string | null = null) => {
    const filteredNodes = nodes.filter(node => matchesSearch(node, searchQuery));

    return (
      <div className="flex flex-col gap-0.5">
        {filteredNodes.map(node => {
          const isDir = node.type === 'directory';
          const isCollapsed = collapsedPaths[node.path] || false;
          const isActive = activePath === node.path;
          const isFolderSelected = selectedFolder === node.path;
          const isEditingName = renamingPath === node.path;

          return (
            <div key={node.path} className="flex flex-col">
              {/* Item row */}
              <div 
                className={`
                  group flex items-center justify-between px-2 py-1.5 rounded-md transition-all text-sm cursor-pointer
                  ${isActive ? 'bg-[#1F1F23] text-indigo-400 font-medium border-l-2 border-indigo-500' : 'text-slate-300 hover:bg-[#1F1F23]'}
                  ${isFolderSelected ? 'bg-[#2A2A30]' : ''}
                `}
                style={{ paddingLeft: `${depth * 12 + 8}px` }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (isDir) {
                    toggleCollapse(node.path);
                    setSelectedFolder(node.path === selectedFolder ? null : node.path);
                  } else {
                    onSelectFile(node.path);
                  }
                }}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {/* Chevron or spacing */}
                  {isDir ? (
                    <span className="text-slate-500 hover:text-slate-300 p-0.5">
                      {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                    </span>
                  ) : (
                    <span className="w-5" />
                  )}

                  {/* Icon */}
                  <span className={isActive ? 'text-indigo-400' : isDir ? 'text-slate-400' : 'text-slate-500'}>
                    {isDir ? (
                      isCollapsed ? <Folder size={16} /> : <FolderOpen size={16} />
                    ) : (
                      <FileText size={16} />
                    )}
                  </span>

                  {/* Name or Rename Input */}
                  {isEditingName ? (
                    <input
                      type="text"
                      className="bg-[#0A0A0B] border border-[#1F1F23] text-xs px-1 py-0.5 rounded focus:outline-indigo-500 font-mono flex-1 text-slate-100"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') submitRename(node.path);
                        if (e.key === 'Escape') setRenamingPath(null);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                    />
                  ) : (
                    <span className="truncate font-mono text-xs">{node.name}</span>
                  )}
                </div>

                {/* Hover Actions */}
                {!isEditingName && (
                  <div className="hidden group-hover:flex items-center gap-1 ml-2 shrink-0 bg-transparent">
                    {isDir && (
                      <>
                        <button
                          title="New File inside"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartCreateFile(node.path);
                            setCollapsedPaths(prev => ({ ...prev, [node.path]: false }));
                          }}
                          className="p-1 hover:bg-[#2A2A30] text-slate-400 hover:text-white rounded transition-colors"
                        >
                          <FilePlus size={12} />
                        </button>
                        <button
                          title="New Folder inside"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartCreateFolder(node.path);
                            setCollapsedPaths(prev => ({ ...prev, [node.path]: false }));
                          }}
                          className="p-1 hover:bg-[#2A2A30] text-slate-400 hover:text-white rounded transition-colors"
                        >
                          <FolderPlus size={12} />
                        </button>
                      </>
                    )}
                    <button
                      title="Rename"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartRename(node);
                      }}
                      className="p-1 hover:bg-[#2A2A30] text-slate-400 hover:text-white rounded transition-colors"
                    >
                      <Edit3 size={12} />
                    </button>
                    <button
                      title="Delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Are you sure you want to delete ${node.name}?`)) {
                          onDelete(node.path);
                        }
                      }}
                      className="p-1 hover:bg-rose-950 text-slate-400 hover:text-rose-400 rounded transition-colors"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                )}
              </div>

              {/* Inline Create Input for Directory children */}
              {isDir && !isCollapsed && (
                <>
                  {isCreatingFile === node.path && (
                    <div className="flex items-center gap-1 py-1" style={{ paddingLeft: `${(depth + 1) * 12 + 20}px` }}>
                      <FileText size={14} className="text-indigo-400" />
                      <input
                        type="text"
                        placeholder="new-file.txt"
                        className="bg-[#0A0A0B] border border-[#1F1F23] text-xs px-1.5 py-0.5 rounded focus:outline-indigo-500 font-mono flex-1 text-slate-100"
                        value={newItemName}
                        onChange={(e) => setNewItemName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') submitCreateFile(node.path);
                          if (e.key === 'Escape') setIsCreatingFile(null);
                        }}
                        autoFocus
                      />
                      <button onClick={() => submitCreateFile(node.path)} className="text-xs bg-indigo-600 text-white rounded px-1.5 py-0.5 font-medium hover:bg-indigo-700">Add</button>
                      <button onClick={() => setIsCreatingFile(null)} className="text-slate-500 hover:text-slate-300"><X size={12} /></button>
                    </div>
                  )}

                  {isCreatingFolder === node.path && (
                    <div className="flex items-center gap-1 py-1" style={{ paddingLeft: `${(depth + 1) * 12 + 20}px` }}>
                      <Folder size={14} className="text-indigo-400" />
                      <input
                        type="text"
                        placeholder="New folder"
                        className="bg-[#0A0A0B] border border-[#1F1F23] text-xs px-1.5 py-0.5 rounded focus:outline-indigo-500 font-mono flex-1 text-slate-100"
                        value={newItemName}
                        onChange={(e) => setNewItemName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') submitCreateFolder(node.path);
                          if (e.key === 'Escape') setIsCreatingFolder(null);
                        }}
                        autoFocus
                      />
                      <button onClick={() => submitCreateFolder(node.path)} className="text-xs bg-indigo-600 text-white rounded px-1.5 py-0.5 font-medium hover:bg-indigo-700">Add</button>
                      <button onClick={() => setIsCreatingFolder(null)} className="text-slate-500 hover:text-slate-300"><X size={12} /></button>
                    </div>
                  )}

                  {/* Children recursive list */}
                  {node.children && node.children.length > 0 ? (
                    renderTree(node.children, depth + 1, node.path)
                  ) : (
                    <div 
                      className="text-[10px] text-slate-500 italic" 
                      style={{ paddingLeft: `${(depth + 1) * 12 + 28}px` }}
                    >
                      (empty folder)
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-[#0E0E11] border-r border-[#1F1F23]">
      {/* Search and root operations header */}
      <div className="p-4 border-b border-[#1F1F23] flex flex-col gap-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search content..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#0A0A0B] border border-[#1F1F23] rounded-md py-1.5 pl-8 pr-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-300"
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* Root additions */}
        <div className="flex gap-2 justify-between items-center text-xs pt-1">
          <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Explorer</span>
          <div className="flex gap-1.5">
            <button
              onClick={() => handleStartCreateFile(selectedFolder)}
              className="flex items-center gap-1 px-2 py-1 bg-indigo-600/10 text-indigo-400 hover:bg-indigo-600/20 font-medium rounded border border-indigo-500/20 cursor-pointer transition-colors"
              title={selectedFolder ? `Create File inside '${selectedFolder.split('/').pop()}'` : 'Create File at Root'}
            >
              <Plus size={12} />
              <span>File</span>
            </button>
            <button
              onClick={() => handleStartCreateFolder(selectedFolder)}
              className="flex items-center gap-1 px-2 py-1 bg-[#1F1F23] text-slate-300 hover:bg-[#2A2A30] font-medium rounded border border-[#2A2A30] cursor-pointer transition-colors"
              title={selectedFolder ? `Create Folder inside '${selectedFolder.split('/').pop()}'` : 'Create Folder at Root'}
            >
              <Plus size={12} />
              <span>Folder</span>
            </button>
          </div>
        </div>
      </div>

      {/* Root creations form directly below header */}
      {(isCreatingFile === 'root' || isCreatingFolder === 'root') && (
        <div className="p-3 bg-[#1F1F23]/40 border-b border-[#1F1F23] flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Creating at <b className="font-mono text-indigo-400">{selectedFolder || 'Root'}</b></span>
            <button onClick={() => { setIsCreatingFile(null); setIsCreatingFolder(null); }} className="text-slate-500 hover:text-slate-300">
              <X size={12} />
            </button>
          </div>
          <div className="flex gap-1">
            <input
              type="text"
              placeholder={isCreatingFile ? "new-file.txt" : "New folder"}
              className="bg-[#0A0A0B] border border-[#1F1F23] text-xs px-2 py-1 rounded focus:outline-indigo-500 font-mono flex-1 text-slate-100"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (isCreatingFile) submitCreateFile(selectedFolder);
                  else submitCreateFolder(selectedFolder);
                }
                if (e.key === 'Escape') {
                  setIsCreatingFile(null);
                  setIsCreatingFolder(null);
                }
              }}
              autoFocus
            />
            <button
              onClick={() => {
                if (isCreatingFile) submitCreateFile(selectedFolder);
                else submitCreateFolder(selectedFolder);
              }}
              className="px-3 py-1 bg-indigo-600 text-white hover:bg-indigo-700 text-xs rounded font-medium shrink-0 cursor-pointer"
            >
              Create
            </button>
          </div>
        </div>
      )}

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-3">
        {tree.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-slate-500 h-32 text-xs text-center">
            <Folder size={24} className="mb-2 opacity-30" />
            <p>No files found</p>
            <p className="text-[10px] opacity-50 mt-0.5">Click "File" or "Folder" to add some</p>
          </div>
        ) : (
          renderTree(tree, 0, null)
        )}
      </div>

      {/* Active folder status footer */}
      {selectedFolder && (
        <div className="p-2 bg-[#0A0A0B] border-t border-[#1F1F23] flex items-center justify-between text-[11px] text-slate-400 px-3">
          <span className="truncate">Active folder: <strong className="font-mono text-[10px] text-indigo-400">{selectedFolder}</strong></span>
          <button 
            onClick={() => setSelectedFolder(null)} 
            className="text-slate-500 hover:text-slate-300 underline text-[10px]"
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
