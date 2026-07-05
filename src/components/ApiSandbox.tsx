import React, { useEffect, useState } from 'react';
import { Terminal, Copy, Check, ExternalLink, RefreshCw } from 'lucide-react';

interface ApiSandboxProps {
  activePath: string | null;
  selectedFolder?: string | null;
  lastSaved: number; // timestamp to force updates
  token: string | null;
  username: string | null;
}

export default function ApiSandbox({ activePath, selectedFolder, lastSaved, token, username }: ApiSandboxProps) {
  const [activeTab, setActiveTab] = useState<'response' | 'directory' | 'client'>('client');
  const [activeLang, setActiveLang] = useState<'fetch' | 'curl' | 'python'>('fetch');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [jsonResponse, setJsonResponse] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [verboseMode, setVerboseMode] = useState(false);
  const [showCodeSnippets, setShowCodeSnippets] = useState(false);

  // Derive target paths and URLs
  const targetPath = activePath || 'welcome.txt';
  const targetFolder = selectedFolder || '';
  
  const apiEndpointUrl = `${window.location.origin}/api/content/${targetPath}?token=${token || ''}${verboseMode ? '&verbose=true' : ''}`;
  const folderEndpointUrl = `${window.location.origin}/api/directory/${targetFolder}?token=${token || ''}${verboseMode ? '&verbose=true' : ''}`;
  const filesTreeUrl = `${window.location.origin}/api/files?token=${token || ''}${verboseMode ? '&verbose=true' : ''}`;

  // Auto-switch tabs to show corresponding clicked item in left explorer
  useEffect(() => {
    if (activePath) {
      setActiveTab('response');
    }
  }, [activePath]);

  useEffect(() => {
    if (selectedFolder !== undefined && selectedFolder !== null) {
      setActiveTab('directory');
    }
  }, [selectedFolder]);

  // Fetch raw JSON response from endpoint
  const fetchRawJson = async () => {
    if (!token) {
      setError('Please sign in to fetch content API responses.');
      setJsonResponse(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      let url = '/api/files';
      if (activeTab === 'response') {
        url = `/api/content/${targetPath}`;
      } else if (activeTab === 'directory') {
        url = `/api/directory/${targetFolder}`;
      }

      // Add verbose mode flag
      url += verboseMode ? '?verbose=true' : '';
      
      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) {
        throw new Error(`HTTP Error ${res.status}: ${res.statusText}`);
      }
      const data = await res.json();
      setJsonResponse(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch content JSON');
      setJsonResponse(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRawJson();
  }, [activePath, selectedFolder, lastSaved, activeTab, verboseMode, token]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Generate Integration Code snippets
  const getCodeSnippet = () => {
    let url = filesTreeUrl;
    if (activeTab === 'response') {
      url = apiEndpointUrl;
    } else if (activeTab === 'directory') {
      url = folderEndpointUrl;
    }

    switch (activeLang) {
      case 'curl':
        return `curl -X GET "${url}"`;
      case 'python':
        return `import requests

url = "${url}"
response = requests.get(url)
data = response.json()

print(data) # Print clean JSON structure`;
      case 'fetch':
      default:
        if (activeTab === 'response') {
          return `// Retrieve CMS file content via client-side fetch
const fetchCMSContent = async () => {
  try {
    const response = await fetch("${url}");
    const data = await response.json();
    
    // Process response payload
    console.log(data);
  } catch (error) {
    console.error("Error fetching content:", error);
  }
};

fetchCMSContent();`;
        } else if (activeTab === 'directory') {
          return `// Retrieve CMS directory specific files and subfolders via fetch
const fetchCMSDirectory = async () => {
  try {
    const response = await fetch("${url}");
    const data = await response.json();
    
    // Process directory dictionary
    console.log(data);
  } catch (error) {
    console.error("Error fetching directory:", error);
  }
};

fetchCMSDirectory();`;
        } else {
          return `// Retrieve CMS full file tree via client-side fetch
const fetchCMSTree = async () => {
  try {
    const response = await fetch("${url}");
    const data = await response.json();
    
    // Process custom JSON tree
    console.log(data);
  } catch (error) {
    console.error("Error fetching tree:", error);
  }
};

fetchCMSTree();`;
        }
    }
  };

  const renderHighlightedJson = (obj: any) => {
    if (!obj) return null;
    const jsonString = JSON.stringify(obj, null, 2);
    
    const highlighted = jsonString
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g, (match) => {
        let cls = 'text-amber-400'; // number
        if (/^"/.test(match)) {
          if (/:$/.test(match)) {
            cls = 'text-indigo-400 font-medium'; // key
          } else {
            cls = 'text-emerald-400'; // string
          }
        } else if (/true|false/.test(match)) {
          cls = 'text-purple-400 font-semibold'; // boolean
        } else if (/null/.test(match)) {
          cls = 'text-slate-500 italic'; // null
        }
        return `<span class="${cls}">${match}</span>`;
      });

    return (
      <pre 
        className="font-mono text-xs overflow-x-auto bg-[#0A0A0B] text-slate-100 p-4 rounded-lg border border-[#1F1F23] leading-relaxed max-h-[280px]"
        dangerouslySetInnerHTML={{ __html: highlighted }}
      />
    );
  };

  return (
    <div className="bg-[#0E0E11] border border-[#1F1F23] rounded-xl p-4 shadow-xl flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#1F1F23] pb-3 shrink-0 gap-2">
        <div className="flex items-center gap-2">
          <Terminal size={16} className="text-indigo-400 animate-pulse" />
          <h4 className="font-sans font-semibold text-slate-200 text-sm">JSON API Sandbox</h4>
        </div>
        <div className="flex items-center gap-2 self-end sm:self-auto">
          {/* Code Toggle Switch */}
          <button
            onClick={() => setShowCodeSnippets(!showCodeSnippets)}
            className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border ${
              showCodeSnippets 
                ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' 
                : 'bg-slate-500/5 text-slate-400 border-transparent hover:text-slate-300'
            }`}
            title="Toggle client integration code snippets (cURL, fetch, Python)"
          >
            <span className={`w-1.5 h-1.5 rounded-full ${showCodeSnippets ? 'bg-indigo-400' : 'bg-slate-400'}`} />
            <span>Show API Code</span>
          </button>

          {/* Verbose Switch */}
          <button
            onClick={() => setVerboseMode(!verboseMode)}
            className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border ${
              verboseMode 
                ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' 
                : 'bg-slate-500/5 text-slate-400 border-transparent hover:text-slate-300'
            }`}
            title="Toggle between clean simplified values vs full verbose file metadata"
          >
            <span className={`w-1.5 h-1.5 rounded-full ${verboseMode ? 'bg-indigo-400' : 'bg-slate-400'}`} />
            <span>verbose=true</span>
          </button>

          <div className="flex gap-1.5 p-0.5 bg-[#0A0A0B] border border-[#1F1F23] rounded-md text-xs font-medium">
            <button
              onClick={() => setActiveTab('response')}
              className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${activeTab === 'response' ? 'bg-[#1F1F23] text-indigo-400 shadow-sm font-bold' : 'text-slate-400 hover:text-slate-200'}`}
            >
              File Content
            </button>
            <button
              onClick={() => setActiveTab('directory')}
              className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${activeTab === 'directory' ? 'bg-[#1F1F23] text-indigo-400 shadow-sm font-bold' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Folder
            </button>
            <button
              onClick={() => setActiveTab('client')}
              className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${activeTab === 'client' ? 'bg-[#1F1F23] text-indigo-400 shadow-sm font-bold' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Tree
            </button>
          </div>
        </div>
      </div>

      {/* Info Route */}
      <div className="my-3 flex items-center bg-[#0A0A0B] border border-[#1F1F23] rounded-lg p-2 gap-2 text-xs font-mono select-all shrink-0">
        <span className="bg-emerald-500/10 text-emerald-400 font-bold px-1.5 py-0.5 rounded border border-emerald-500/20 text-[10px]">
          GET
        </span>
        <span className="text-slate-300 truncate flex-1">
          {activeTab === 'response' ? `/api/content/${targetPath}` : activeTab === 'directory' ? `/api/directory/${targetFolder}` : '/api/files'}
          {verboseMode ? '?verbose=true' : ''}
        </span>
        <button
          onClick={fetchRawJson}
          disabled={loading}
          className="text-slate-400 hover:text-slate-200 shrink-0 cursor-pointer p-1 rounded-md hover:bg-[#1F1F23] transition-colors"
          title="Refresh JSON Response"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>
        <a 
          href={activeTab === 'response' ? `/api/content/${targetPath}?token=${token || ''}${verboseMode ? '&verbose=true' : ''}` : activeTab === 'directory' ? `/api/directory/${targetFolder}?token=${token || ''}${verboseMode ? '&verbose=true' : ''}` : `/api/files?token=${token || ''}${verboseMode ? '&verbose=true' : ''}`}
          target="_blank" 
          rel="noreferrer"
          className="text-slate-400 hover:text-indigo-400 shrink-0 cursor-pointer p-1"
          title="Open API Endpoint in New Tab with Authorization"
        >
          <ExternalLink size={13} />
        </a>
      </div>

      {/* Grid Content */}
      <div className={`grid grid-cols-1 ${showCodeSnippets ? 'lg:grid-cols-2' : ''} gap-4 flex-1 min-h-0`}>
        {/* Left: JSON Response Viewer */}
        <div className="flex flex-col min-h-0 h-full">
          <div className="flex justify-between items-center mb-1.5 shrink-0">
            <span className="text-[10px] font-bold tracking-wider uppercase text-slate-500 font-sans">
              {verboseMode ? 'VERBOSE HTTP RESPONSE' : 'SIMPLIFIED HTTP RESPONSE'}
            </span>
            <button
              onClick={() => jsonResponse && handleCopy(JSON.stringify(jsonResponse, null, 2))}
              disabled={!jsonResponse}
              className="text-[11px] text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1 cursor-pointer transition-colors"
            >
              {copied ? <Check size={11} /> : <Copy size={11} />}
              <span>{copied ? 'Copied' : 'Copy Response'}</span>
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto">
            {loading ? (
              <div className="h-full bg-[#0A0A0B] border border-[#1F1F23] rounded-lg flex items-center justify-center text-slate-400 font-mono text-xs">
                <RefreshCw size={18} className="animate-spin mr-2 text-indigo-400" />
                <span>Fetching payload...</span>
              </div>
            ) : error ? (
              <div className="h-full bg-[#0A0A0B] border border-[#1F1F23] rounded-lg flex flex-col items-center justify-center p-4 text-center text-rose-400 font-mono text-xs">
                <span>Error fetching endpoint:</span>
                <span className="text-[11px] opacity-75 mt-1">{error}</span>
              </div>
            ) : (
              renderHighlightedJson(jsonResponse)
            )}
          </div>
        </div>

        {/* Right: Code Generator */}
        {showCodeSnippets && (
          <div className="flex flex-col min-h-0 h-full">
            <div className="flex justify-between items-center mb-1.5 shrink-0">
              <span className="text-[10px] font-bold tracking-wider uppercase text-slate-500 font-sans">CONSUMER INTEGRATION CODE</span>
              <div className="flex gap-2">
                <button
                  onClick={() => handleCopy(getCodeSnippet())}
                  className="text-[11px] text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                >
                  {copied ? <Check size={11} /> : <Copy size={11} />}
                  <span>{copied ? 'Copied' : 'Copy Code'}</span>
                </button>
              </div>
            </div>

            <div className="flex-1 bg-[#0A0A0B] border border-[#1F1F23] rounded-lg p-3 flex flex-col min-h-0">
              {/* Lang Tabs */}
              <div className="flex gap-2 border-b border-[#1F1F23] pb-2 mb-2 shrink-0">
                <button
                  onClick={() => setActiveLang('fetch')}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium transition-colors cursor-pointer ${activeLang === 'fetch' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
                >
                  JS Fetch
                </button>
                <button
                  onClick={() => setActiveLang('curl')}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium transition-colors cursor-pointer ${activeLang === 'curl' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
                >
                  cURL
                </button>
                <button
                  onClick={() => setActiveLang('python')}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium transition-colors cursor-pointer ${activeLang === 'python' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
                >
                  Python
                </button>
              </div>

              {/* Code Output */}
              <div className="flex-1 overflow-y-auto">
                <pre className="font-mono text-[11px] text-emerald-400 whitespace-pre-wrap leading-relaxed select-all">
                  {getCodeSnippet()}
                </pre>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
