import React, { useEffect, useState } from 'react';
import { 
  Database, 
  Terminal, 
  RefreshCw, 
  Layers, 
  FileCode, 
  HardDrive, 
  FileText, 
  Folder,
  Server,
  CloudLightning,
  ChevronRight,
  Info,
  Lock,
  User,
  Key,
  LogOut,
  UserPlus,
  Shield
} from 'lucide-react';
import FileTree from './components/FileTree';
import Editor from './components/Editor';
import ApiSandbox from './components/ApiSandbox';
import { FileNode, ActiveFile } from './types';

// Browser-compatible SHA-256 hashing helper
async function hashPassword(password: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export default function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('cms_session_token'));
  const [user, setUser] = useState<{ username: string; role: string } | null>(null);

  // Auth screen inputs
  const [isRegistering, setIsRegistering] = useState(false);
  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [activeFile, setActiveFile] = useState<ActiveFile | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  
  // Loading and action indicators
  const [loadingTree, setLoadingTree] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<number>(Date.now());
  const [globalError, setGlobalError] = useState<string | null>(null);

  // Validate session on load / change of token
  useEffect(() => {
    if (token) {
      fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      .then(res => {
        if (res.ok) {
          return res.json();
        } else {
          throw new Error('Session expired');
        }
      })
      .then(data => {
        if (data.success) {
          setUser(data.user);
        } else {
          handleLogout();
        }
      })
      .catch(() => {
        handleLogout();
      });
    } else {
      setUser(null);
    }
  }, [token]);

  // Load the directory structure when authenticated
  const fetchFileTree = async () => {
    if (!token) return;
    setLoadingTree(true);
    setGlobalError(null);
    try {
      // Always pass verbose=true to the management UI so it has path/name/size metadata for layout
      const res = await fetch('/api/files?verbose=true', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.status === 401 || res.status === 403) {
        handleLogout();
        return;
      }
      const data = await res.json();
      if (data.success) {
        setFileTree(data.tree);
      } else {
        setGlobalError(data.error || 'Failed to load file manager structure');
      }
    } catch (err: any) {
      setGlobalError('Could not connect to Express back-end server');
    } finally {
      setLoadingTree(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchFileTree();
    }
  }, [token]);

  // Authentication Handlers
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authUsername.trim() || !authPassword) {
      setAuthError('Please fill in all fields');
      return;
    }
    setAuthLoading(true);
    setAuthError(null);
    try {
      const passwordHash = await hashPassword(authPassword);
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: authUsername, passwordHash })
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem('cms_session_token', data.token);
        setToken(data.token);
        setUser(data.user);
        setAuthUsername('');
        setAuthPassword('');
      } else {
        setAuthError(data.error || 'Invalid username or password');
      }
    } catch (err) {
      setAuthError('Network error connecting to authentication service');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authUsername.trim() || !authPassword) {
      setAuthError('Please fill in all fields');
      return;
    }
    if (authUsername.trim().length < 3) {
      setAuthError('Username must be at least 3 characters');
      return;
    }
    setAuthLoading(true);
    setAuthError(null);
    try {
      const passwordHash = await hashPassword(authPassword);
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: authUsername.trim(), passwordHash })
      });
      const data = await res.json();
      if (data.success) {
        // Automatically login
        const loginRes = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: authUsername.trim(), passwordHash })
        });
        const loginData = await loginRes.json();
        if (loginData.success) {
          localStorage.setItem('cms_session_token', loginData.token);
          setToken(loginData.token);
          setUser(loginData.user);
          setAuthUsername('');
          setAuthPassword('');
          setIsRegistering(false);
        } else {
          setAuthError('Registered successfully! Please sign in.');
          setIsRegistering(false);
        }
      } else {
        setAuthError(data.error || 'Registration failed');
      }
    } catch (err) {
      setAuthError('Network error creating new user');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    if (token) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
      } catch (e) {
        // Safe to ignore network issues on logout
      }
    }
    localStorage.removeItem('cms_session_token');
    setToken(null);
    setUser(null);
    setFileTree([]);
    setActiveFile(null);
    setSelectedFolder(null);
    setGlobalError(null);
  };

  // Fetch the active file's raw content
  const handleSelectFile = async (filePath: string) => {
    if (!token) return;
    setGlobalError(null);
    try {
      const res = await fetch(`/api/content/${filePath}?verbose=true`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.status === 401 || res.status === 403) {
        handleLogout();
        return;
      }
      const data = await res.json();
      if (data.success) {
        setActiveFile({
          path: data.path,
          content: data.content,
          originalContent: data.content,
          isDirty: false,
          size: data.size,
          updatedAt: data.updatedAt
        });
      } else {
        alert(`Error opening file: ${data.error}`);
      }
    } catch (err: any) {
      alert('Error fetching file content from server');
    }
  };

  // Change tracker for editor
  const handleContentChange = (newContent: string) => {
    if (!activeFile) return;
    setActiveFile(prev => {
      if (!prev) return null;
      return {
        ...prev,
        content: newContent,
        isDirty: newContent !== prev.originalContent
      };
    });
  };

  // Save the currently active file content
  const handleSaveFile = async () => {
    if (!activeFile || !token) return;
    setIsSaving(true);
    setGlobalError(null);
    try {
      const res = await fetch('/api/files/save', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          path: activeFile.path,
          content: activeFile.content
        })
      });
      if (res.status === 401 || res.status === 403) {
        handleLogout();
        return;
      }
      const data = await res.json();
      if (data.success) {
        setActiveFile(prev => {
          if (!prev) return null;
          return {
            ...prev,
            originalContent: prev.content,
            isDirty: false,
            size: data.file.size,
            updatedAt: data.file.updatedAt
          };
        });
        setLastSaved(Date.now());
        fetchFileTree(); // refresh directory tree stats
      } else {
        alert(`Save failed: ${data.error}`);
      }
    } catch (err) {
      alert('Network error saving file');
    } finally {
      setIsSaving(false);
    }
  };

  // Reload the active file's raw state from server
  const handleReloadFile = () => {
    if (!activeFile) return;
    if (activeFile.isDirty && !confirm('Discard unsaved local changes?')) {
      return;
    }
    handleSelectFile(activeFile.path);
  };

  // Create a new text file inside a folder (or at root)
  const handleCreateFile = async (parentPath: string | null, name: string) => {
    if (!token) return;
    const fullPath = parentPath ? `${parentPath}/${name}` : name;
    try {
      const res = await fetch('/api/files/save', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          path: fullPath,
          content: `New document content for ${name}`
        })
      });
      if (res.status === 401 || res.status === 403) {
        handleLogout();
        return;
      }
      const data = await res.json();
      if (data.success) {
        await fetchFileTree();
        handleSelectFile(fullPath); // auto-open created files
      } else {
        alert(`Create failed: ${data.error}`);
      }
    } catch (err) {
      alert('Network error creating file');
    }
  };

  // Create a nested folder
  const handleCreateFolder = async (parentPath: string | null, name: string) => {
    if (!token) return;
    const fullPath = parentPath ? `${parentPath}/${name}` : name;
    try {
      const res = await fetch('/api/files/create-folder', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ path: fullPath })
      });
      if (res.status === 401 || res.status === 403) {
        handleLogout();
        return;
      }
      const data = await res.json();
      if (data.success) {
        fetchFileTree();
      } else {
        alert(`Folder creation failed: ${data.error}`);
      }
    } catch (err) {
      alert('Network error creating folder');
    }
  };

  // Rename or move file/folder
  const handleRename = async (oldPath: string, newPath: string) => {
    if (!token) return;
    try {
      const res = await fetch('/api/files/rename', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ oldPath, newPath })
      });
      if (res.status === 401 || res.status === 403) {
        handleLogout();
        return;
      }
      const data = await res.json();
      if (data.success) {
        // If current active file was renamed, update its path
        if (activeFile && activeFile.path === oldPath) {
          setActiveFile(prev => {
            if (!prev) return null;
            return { ...prev, path: newPath };
          });
        }
        fetchFileTree();
      } else {
        alert(`Rename failed: ${data.error}`);
      }
    } catch (err) {
      alert('Network error renaming item');
    }
  };

  // Delete file or folder
  const handleDelete = async (filePath: string) => {
    if (!token) return;
    try {
      const res = await fetch('/api/files/delete', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ path: filePath })
      });
      if (res.status === 401 || res.status === 403) {
        handleLogout();
        return;
      }
      const data = await res.json();
      if (data.success) {
        // If current active file was deleted, close editor
        if (activeFile && (activeFile.path === filePath || activeFile.path.startsWith(filePath + '/'))) {
          setActiveFile(null);
        }
        fetchFileTree();
      } else {
        alert(`Deletion failed: ${data.error}`);
      }
    } catch (err) {
      alert('Network error deleting item');
    }
  };

  // Traverses tree to calculate files, folders, and sizes
  const computeStats = (nodes: FileNode[]) => {
    let files = 0;
    let folders = 0;
    let bytes = 0;

    const traverse = (list: FileNode[]) => {
      for (const item of list) {
        if (item.type === 'file') {
          files++;
          bytes += item.size || 0;
        } else {
          folders++;
          if (item.children) traverse(item.children);
        }
      }
    };
    traverse(nodes);
    return { files, folders, bytes };
  };

  const stats = computeStats(fileTree);

  // File size formatter helper
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Authentication Gateway Screen
  if (!token || !user) {
    return (
      <div className="min-h-screen bg-[#0A0A0B] flex items-center justify-center font-sans antialiased text-slate-300 p-4 relative overflow-hidden">
        {/* Backdrop lights */}
        <div className="absolute -right-32 -top-32 w-96 h-96 bg-indigo-600 rounded-full blur-[120px] opacity-10"></div>
        <div className="absolute -left-32 -bottom-32 w-96 h-96 bg-emerald-600 rounded-full blur-[120px] opacity-10"></div>

        <div className="w-full max-w-md bg-[#0E0E11] border border-[#1F1F23] rounded-2xl p-6 md:p-8 shadow-2xl relative z-10">
          <div className="flex flex-col items-center mb-6">
            <div className="bg-indigo-600 text-white p-3 rounded-xl shadow-lg mb-4">
              <Layers size={28} className="stroke-[2.5]" />
            </div>
            <h2 className="text-xl font-bold text-slate-100 tracking-tight">thoguppu</h2>
            <p className="text-xs text-slate-400 font-mono mt-1">Modern Document Content Collection System</p>
          </div>

          <div className="flex p-0.5 bg-[#0A0A0B] border border-[#1F1F23] rounded-lg mb-6 text-xs">
            <button
              onClick={() => {
                setIsRegistering(false);
                setAuthError(null);
              }}
              className={`flex-1 py-2 rounded-md font-medium transition-all ${!isRegistering ? 'bg-[#1F1F23] text-indigo-400 font-bold shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Sign In
            </button>
            <button
              onClick={() => {
                setIsRegistering(true);
                setAuthError(null);
              }}
              className={`flex-1 py-2 rounded-md font-medium transition-all ${isRegistering ? 'bg-[#1F1F23] text-indigo-400 font-bold shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Create Tenant
            </button>
          </div>

          <form onSubmit={isRegistering ? handleRegister : handleLogin} className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Username</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                  <User size={15} />
                </span>
                <input
                  type="text"
                  required
                  value={authUsername}
                  onChange={(e) => setAuthUsername(e.target.value)}
                  placeholder="e.g. admin, developer, content_team"
                  className="w-full bg-[#0A0A0B] border border-[#1F1F23] rounded-lg pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Password</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                  <Key size={15} />
                </span>
                <input
                  type="password"
                  required
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-[#0A0A0B] border border-[#1F1F23] rounded-lg pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors font-mono"
                />
              </div>
            </div>

            {authError && (
              <div className="p-3 bg-rose-950/20 border border-rose-900/40 text-rose-400 rounded-lg text-xs font-mono leading-normal">
                {authError}
              </div>
            )}

            <button
              type="submit"
              disabled={authLoading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-55 text-white py-2 rounded-lg text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {authLoading && <RefreshCw size={12} className="animate-spin" />}
              <span>{isRegistering ? 'Register Tenant & Log In' : 'Sign Securely'}</span>
            </button>
          </form>

          {/* Guidelines info */}
          <div className="mt-6 border-t border-[#1F1F23] pt-4 text-[11px] text-slate-500 leading-relaxed space-y-2">
            <p className="flex items-start gap-1.5 font-mono">
              <span className="text-amber-500">💡</span>
              <span>
                <strong>System Defaults:</strong> Admin account is pre-registered. Use <code className="bg-[#0A0A0B] text-indigo-400 px-1 rounded">admin</code> for both username & password.
              </span>
            </p>
            <p className="flex items-start gap-1.5">
              <Shield size={12} className="text-emerald-500 shrink-0 mt-0.5" />
              <span>
                <strong>Sandbox Security:</strong> Passwords are hashed locally using client-side SHA-256 before transmission and compared securely in memory against disk hash values.
              </span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Authenticated workspace
  return (
    <div className="min-h-screen bg-[#0A0A0B] flex flex-col font-sans antialiased text-slate-300">
      
      {/* Top Main Navigation Header */}
      <header className="bg-[#0E0E11] border-b border-[#1F1F23] px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between sticky top-0 z-10 shrink-0 gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 text-white p-2 rounded-lg shadow-lg">
            <Layers size={20} className="stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-100 tracking-tight flex items-center gap-2">
              thoguppu
              <span className="text-[10px] uppercase font-mono tracking-wider bg-[#1F1F23] text-indigo-400 px-2 py-0.5 rounded border border-[#2A2A30]">
                v1.0.0 (Collection Mode)
              </span>
            </h1>
            <p className="text-xs text-slate-400 font-mono flex items-center gap-1.5">
              <span>Volume: </span>
              <strong className="text-slate-200">./cms_data</strong>
              <span className="text-slate-600">|</span>
              <span className="text-indigo-400 font-bold flex items-center gap-1">
                <Shield size={10} />
                {user.role === 'admin' ? 'Admin Access' : `Tenant: ${user.username}`}
              </span>
            </p>
          </div>
        </div>

        {/* Action Header Links */}
        <div className="flex items-center gap-3 self-end sm:self-auto">
          {globalError && (
            <span className="text-xs text-rose-400 bg-rose-950/20 border border-rose-900/40 px-3 py-1 rounded-md animate-pulse">
              {globalError}
            </span>
          )}

          <button
            onClick={fetchFileTree}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-[#1F1F23] text-xs font-semibold text-slate-300 bg-[#1F1F23] hover:bg-[#2A2A30] rounded-lg cursor-pointer transition-all"
            title="Reload repository statistics & file tree"
          >
            <RefreshCw size={13} className={loadingTree ? 'animate-spin' : ''} />
            <span>Reload Tree</span>
          </button>

          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-[#1F1F23] text-xs font-semibold text-rose-400 bg-rose-950/10 hover:bg-rose-950/20 rounded-lg cursor-pointer transition-all border-rose-900/20"
            title="Disconnect current session"
          >
            <LogOut size={13} />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <main className="flex-1 flex flex-col md:flex-row overflow-hidden max-w-full">
        
        {/* Left Column: Recursive File Explorer */}
        <section className="w-full md:w-80 shrink-0 border-r border-[#1F1F23] flex flex-col overflow-hidden bg-[#0E0E11] md:h-[calc(100vh-73px)]">
          <FileTree
            tree={fileTree}
            activePath={activeFile ? activeFile.path : null}
            onSelectFile={handleSelectFile}
            onCreateFile={handleCreateFile}
            onCreateFolder={handleCreateFolder}
            onRename={handleRename}
            onDelete={handleDelete}
            selectedFolder={selectedFolder}
            onSelectFolder={setSelectedFolder}
          />
        </section>

        {/* Center / Right Multi-Panel Area */}
        <section className="flex-1 flex flex-col overflow-y-auto bg-[#0A0A0B] md:h-[calc(100vh-73px)]">
          <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto w-full">
            
            {/* Split row: Editor (Left 3/5ths) and API Inspector (Right 2/5ths) when active file */}
            {activeFile ? (
              <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 items-start">
                
                {/* Visual Editor Section */}
                <div className="xl:col-span-3 border border-[#1F1F23] rounded-xl overflow-hidden shadow-2xl bg-[#0E0E11] h-[620px] flex flex-col">
                  <Editor
                    activeFile={activeFile}
                    onContentChange={handleContentChange}
                    onSave={handleSaveFile}
                    onReload={handleReloadFile}
                    isSaving={isSaving}
                  />
                </div>

                {/* API Sandbox Section */}
                <div className="xl:col-span-2 h-[620px]">
                  <ApiSandbox 
                    activePath={activeFile.path} 
                    selectedFolder={selectedFolder} 
                    lastSaved={lastSaved} 
                    token={token}
                    username={user.username}
                  />
                </div>

              </div>
            ) : (
              /* Landing Workspace Dashboard when no file is active */
              <div className="space-y-6">
                
                {/* Greeting banner */}
                <div className="bg-[#0E0E11] border border-[#1F1F23] rounded-2xl p-6 md:p-8 text-white relative overflow-hidden shadow-md">
                  {/* Backdrop lights */}
                  <div className="absolute -right-16 -top-16 w-64 h-64 bg-indigo-500 rounded-full blur-3xl opacity-5"></div>
                  <div className="absolute -left-16 -bottom-16 w-64 h-64 bg-emerald-500 rounded-full blur-3xl opacity-5"></div>
                  
                  <div className="relative z-10 max-w-2xl">
                    <span className="text-[10px] font-bold tracking-wider uppercase text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-md border border-indigo-500/20">
                      தொகுப்பு • Thoguppu CMS Active
                    </span>
                    <h2 className="text-xl md:text-2xl font-bold font-sans tracking-tight mt-3 text-slate-100">
                      Document Content Management Workspace
                    </h2>
                    <p className="text-xs md:text-sm text-slate-400 mt-2 leading-relaxed">
                      Welcome to <strong>thoguppu</strong> (Tamil: தொகுப்பு, meaning <em>collection</em> or <em>compilation</em>) — a highly performant, developer-first content store. Organize folders, edit document entries, and consume structured contents instantaneously via REST APIs.
                    </p>
                  </div>
                </div>

                {/* Live Stats Bento Row */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Stat Card 1 */}
                  <div className="bg-[#0E0E11] border border-[#1F1F23] rounded-xl p-4 flex items-center gap-3 shadow-md">
                    <div className="bg-indigo-950/30 text-indigo-400 p-2.5 rounded-lg border border-indigo-900/20">
                      <Folder size={18} />
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide">CMS FOLDERS</span>
                      <span className="text-lg font-bold text-slate-100">{stats.folders}</span>
                    </div>
                  </div>

                  {/* Stat Card 2 */}
                  <div className="bg-[#0E0E11] border border-[#1F1F23] rounded-xl p-4 flex items-center gap-3 shadow-md">
                    <div className="bg-amber-950/30 text-amber-400 p-2.5 rounded-lg border border-amber-900/20">
                      <FileText size={18} />
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide">TEXT DOCUMENTS</span>
                      <span className="text-lg font-bold text-slate-100">{stats.files}</span>
                    </div>
                  </div>

                  {/* Stat Card 3 */}
                  <div className="bg-[#0E0E11] border border-[#1F1F23] rounded-xl p-4 flex items-center gap-3 shadow-md">
                    <div className="bg-emerald-950/30 text-emerald-400 p-2.5 rounded-lg border border-emerald-900/20">
                      <HardDrive size={18} />
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide">TOTAL SIZE ON DISK</span>
                      <span className="text-lg font-bold text-slate-100">{formatBytes(stats.bytes)}</span>
                    </div>
                  </div>
                </div>

                {/* Prompt instructions */}
                <div className="bg-[#1F1F23]/40 border border-[#2A2A30] rounded-xl p-4 flex items-start gap-3 text-slate-400">
                  <Info className="text-indigo-400 shrink-0 mt-0.5" size={16} />
                  <div className="text-xs leading-relaxed">
                    <strong className="text-slate-200">Quick start:</strong> Click on any file in the sidebar explorer (such as <code className="bg-[#0A0A0B] text-indigo-400 border border-[#1F1F23] px-1.5 py-0.5 rounded font-mono text-xs">welcome.txt</code>) to open the interactive editor, edit its contents, save, and immediately preview the live JSON output.
                  </div>
                </div>

                {/* Tree JSON Sandbox View (Always visible on landing screen to show tree api) */}
                <div className="border border-[#1F1F23] rounded-xl overflow-hidden bg-[#0E0E11]">
                  <ApiSandbox 
                    activePath={null} 
                    selectedFolder={selectedFolder} 
                    lastSaved={lastSaved} 
                    token={token}
                    username={user.username}
                  />
                </div>

              </div>
            )}

          </div>
        </section>
      </main>
    </div>
  );
}
