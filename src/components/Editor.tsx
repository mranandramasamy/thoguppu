import React, { useEffect, useState } from 'react';
import { Save, RefreshCw, FileText, Check, AlertCircle, Eye, Edit } from 'lucide-react';
import { ActiveFile } from '../types';

interface EditorProps {
  activeFile: ActiveFile | null;
  onContentChange: (content: string) => void;
  onSave: () => void;
  onReload: () => void;
  isSaving: boolean;
}

export default function Editor({
  activeFile,
  onContentChange,
  onSave,
  onReload,
  isSaving
}: EditorProps) {
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Auto-save triggers or saved animation
  useEffect(() => {
    if (saveSuccess) {
      const timer = setTimeout(() => setSaveSuccess(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [saveSuccess]);

  // Trap Ctrl+S inside textarea
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      onSave();
      setSaveSuccess(true);
    }
    // Allow Tab character indent
    if (e.key === 'Tab') {
      e.preventDefault();
      const target = e.target as HTMLTextAreaElement;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const val = target.value;
      const newVal = val.substring(0, start) + '\t' + val.substring(end);
      onContentChange(newVal);
      // Put focus back at index + 1
      setTimeout(() => {
        target.selectionStart = target.selectionEnd = start + 1;
      }, 0);
    }
  };

  if (!activeFile) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400 bg-[#0E0E11] p-6 text-center">
        <FileText size={48} className="text-slate-700 mb-3 animate-pulse" />
        <h3 className="font-sans font-medium text-slate-200 text-lg">No Document Open</h3>
        <p className="text-sm text-slate-500 max-w-sm mt-1">
          Select an existing file from the sidebar explorer or click "File" to create a new one.
        </p>
      </div>
    );
  }

  // File size formatter
  const formatBytes = (bytes?: number) => {
    if (bytes === undefined) return '0 B';
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Humanize ISO timestamp
  const formatTimestamp = (timestamp?: string) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' ' + date.toLocaleDateString();
  };

  // Word and Char counts
  const wordCount = activeFile.content.trim() === '' ? 0 : activeFile.content.trim().split(/\s+/).length;
  const charCount = activeFile.content.length;

  return (
    <div className="flex flex-col h-full bg-[#0E0E11]">
      {/* Editor top-bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center px-4 py-3 border-b border-[#1F1F23] gap-2 shrink-0">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-semibold text-slate-200 truncate">
              {activeFile.path.split('/').pop()}
            </span>
            {activeFile.isDirty && (
              <span className="bg-amber-500/10 text-amber-400 text-[10px] font-semibold px-2 py-0.5 rounded flex items-center gap-1 shrink-0 border border-amber-500/20 animate-pulse">
                <AlertCircle size={10} />
                <span>Unsaved changes</span>
              </span>
            )}
            {saveSuccess && (
              <span className="bg-emerald-500/10 text-emerald-400 text-[10px] font-semibold px-2 py-0.5 rounded flex items-center gap-1 shrink-0 border border-emerald-500/20">
                <Check size={10} />
                <span>Saved successfully!</span>
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 font-mono mt-0.5 truncate select-all" title="Full Path">
            cms_data/{activeFile.path}
          </p>
        </div>

        {/* Editor controls */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Toggle View Mode */}
          <div className="flex items-center bg-[#0A0A0B] p-0.5 rounded-lg border border-[#1F1F23]">
            <button
              onClick={() => setViewMode('edit')}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded-md font-medium transition-colors cursor-pointer ${
                viewMode === 'edit'
                  ? 'bg-[#1F1F23] text-indigo-400 shadow-lg font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Edit size={12} />
              <span>Editor</span>
            </button>
            <button
              onClick={() => setViewMode('preview')}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded-md font-medium transition-colors cursor-pointer ${
                viewMode === 'preview'
                  ? 'bg-[#1F1F23] text-indigo-400 shadow-lg font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Eye size={12} />
              <span>Preview</span>
            </button>
          </div>

          <button
            onClick={onReload}
            title="Reload content from server"
            className="p-1.5 border border-[#1F1F23] rounded-md text-slate-400 hover:text-slate-200 hover:bg-[#1F1F23] cursor-pointer transition-colors"
          >
            <RefreshCw size={14} className={isSaving ? 'animate-spin' : ''} />
          </button>

          <button
            onClick={() => {
              onSave();
              setSaveSuccess(true);
            }}
            disabled={!activeFile.isDirty || isSaving}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md shadow-sm transition-colors cursor-pointer
              ${
                activeFile.isDirty 
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white' 
                  : 'bg-[#1F1F23] text-slate-500 border border-[#2A2A30] cursor-not-allowed'
              }
            `}
          >
            <Save size={13} />
            <span>{isSaving ? 'Saving...' : 'Save File'}</span>
          </button>
        </div>
      </div>

      {/* Editor Body */}
      <div className="flex-1 min-h-0 relative">
        {viewMode === 'edit' ? (
          <div className="flex h-full font-mono text-sm leading-relaxed">
            {/* Visual line counts */}
            <div className="w-10 bg-[#0A0A0B] border-r border-[#1F1F23] text-slate-600 select-none text-right py-4 pr-2 text-xs flex flex-col gap-0.5 select-none font-mono">
              {Array.from({ length: Math.max(activeFile.content.split('\n').length, 1) }).map((_, i) => (
                <div key={i}>{i + 1}</div>
              ))}
            </div>

            {/* Editing field */}
            <textarea
              className="flex-1 h-full py-4 px-4 border-0 focus:ring-0 focus:outline-none resize-none bg-[#0E0E11] font-mono text-sm text-slate-200 leading-relaxed overflow-y-auto"
              value={activeFile.content}
              onChange={(e) => onContentChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Start writing text or markdown..."
              spellCheck="false"
            />
          </div>
        ) : (
          <div className="h-full overflow-y-auto p-6 bg-[#0A0A0B]">
            <div className="max-w-3xl mx-auto bg-[#0E0E11] border border-[#1F1F23] rounded-xl p-8 shadow-xl">
              {/* Formatted Text or Markdown styling */}
              <article className="prose prose-invert max-w-none text-slate-300">
                {activeFile.content ? (
                  activeFile.path.endsWith('.md') || activeFile.content.includes('#') ? (
                    // Quick custom markdown-like renderer to make it beautiful
                    <div className="space-y-4">
                      {activeFile.content.split('\n').map((line, idx) => {
                        if (line.startsWith('# ')) {
                          return <h1 key={idx} className="text-2xl font-bold font-sans text-slate-100 border-b border-[#1F1F23] pb-2 mb-4">{line.replace('# ', '')}</h1>;
                        }
                        if (line.startsWith('## ')) {
                          return <h2 key={idx} className="text-xl font-bold font-sans text-slate-100 mt-6 mb-2">{line.replace('## ', '')}</h2>;
                        }
                        if (line.startsWith('### ')) {
                          return <h3 key={idx} className="text-lg font-semibold font-sans text-slate-200 mt-4 mb-1">{line.replace('### ', '')}</h3>;
                        }
                        if (line.startsWith('===')) {
                          return <hr key={idx} className="border-t-2 border-[#1F1F23] my-4" />;
                        }
                        if (line.startsWith('- ') || line.startsWith('* ')) {
                          return <li key={idx} className="list-disc ml-5 pl-1 text-sm leading-relaxed text-slate-300">{line.substring(2)}</li>;
                        }
                        if (line.trim().startsWith('```')) {
                          return null; // Skip code blocks in simple text parser or render nicely
                        }
                        return <p key={idx} className="text-sm leading-relaxed text-slate-300 whitespace-pre-wrap">{line}</p>;
                      })}
                    </div>
                  ) : (
                    // Plain-text monospace rendering
                    <pre className="font-mono text-xs whitespace-pre-wrap bg-[#0A0A0B] p-4 rounded-lg border border-[#1F1F23] text-indigo-400 leading-relaxed overflow-x-auto">
                      {activeFile.content}
                    </pre>
                  )
                ) : (
                  <p className="text-sm italic text-slate-500 text-center py-8">
                    This file is currently empty. Write some text or markdown to preview.
                  </p>
                )}
              </article>
            </div>
          </div>
        )}
      </div>

      {/* Editor footer metrics */}
      <div className="flex justify-between items-center px-4 py-2 bg-[#0A0A0B] border-t border-[#1F1F23] text-[11px] text-slate-400 font-mono shrink-0 select-none">
        <div className="flex gap-4">
          <span>Words: <b className="text-slate-200">{wordCount}</b></span>
          <span>Chars: <b className="text-slate-200">{charCount}</b></span>
          <span>Size: <b className="text-slate-200">{formatBytes(activeFile.size)}</b></span>
        </div>
        <div>
          <span>Modified: <b className="text-slate-200">{formatTimestamp(activeFile.updatedAt)}</b></span>
        </div>
      </div>
    </div>
  );
}
