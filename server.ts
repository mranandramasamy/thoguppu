import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';

const PORT = 3000;
const DATA_DIR = path.resolve(process.cwd(), 'cms_data');

const USERS_FILE = path.join(DATA_DIR, '.db_users.json');
const OWNERSHIP_FILE = path.join(DATA_DIR, '.db_ownership.json');
const SESSIONS_FILE = path.join(DATA_DIR, '.db_sessions.json');

function loadJSONFile(filePath: string, defaultVal: any) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch (e) {
    console.error(`Error reading file ${filePath}`, e);
  }
  return defaultVal;
}

function saveJSONFile(filePath: string, data: any) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error(`Error saving file ${filePath}`, e);
  }
}

function ensureDatabase() {
  const usersData = loadJSONFile(USERS_FILE, { users: [] });
  const adminIndex = usersData.users.findIndex((u: any) => u.username.toLowerCase() === 'admin');
  
  if (adminIndex === -1) {
    usersData.users.push({
      username: 'admin',
      passwordHash: '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918', // SHA-256 of "admin"
      role: 'admin'
    });
    saveJSONFile(USERS_FILE, usersData);
  } else {
    // Force the admin user's password hash to be "admin" (SHA-256 of "admin")
    usersData.users[adminIndex].passwordHash = '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918';
    saveJSONFile(USERS_FILE, usersData);
  }

  if (!fs.existsSync(OWNERSHIP_FILE)) {
    saveJSONFile(OWNERSHIP_FILE, {
      ownership: {
        'welcome.txt': 'admin',
        'api-guide.txt': 'admin'
      }
    });
  }

  if (!fs.existsSync(SESSIONS_FILE)) {
    saveJSONFile(SESSIONS_FILE, { sessions: {} });
  }
}

function isOwner(username: string, relPath: string, ownership: Record<string, string>): boolean {
  if (!relPath) return false;
  const cleanPath = relPath.replace(/^\/+|\/+$/g, '');
  
  if (ownership[cleanPath] === username) return true;

  const parts = cleanPath.split('/');
  for (let i = 1; i < parts.length; i++) {
    const parentPath = parts.slice(0, i).join('/');
    if (ownership[parentPath] === username) {
      return true;
    }
  }

  return false;
}

function getSession(req: any) {
  const token = req.headers.authorization?.replace('Bearer ', '') || (req.query.token as string);
  if (!token) return null;

  const sessionsData = loadJSONFile(SESSIONS_FILE, { sessions: {} });
  const session = sessionsData.sessions[token];
  if (!session) return null;

  if (session.expiresAt < Date.now()) {
    delete sessionsData.sessions[token];
    saveJSONFile(SESSIONS_FILE, sessionsData);
    return null;
  }

  return session;
}

// Ensure data directory and default files exist
function ensureDataDirectory() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const welcomePath = path.join(DATA_DIR, 'welcome.txt');
  if (!fs.existsSync(welcomePath)) {
    fs.writeFileSync(
      welcomePath,
      `Welcome to thoguppu - a modern Content Management System!

This system lets you organize and edit text documents through a familiar file-system layout.
All files are saved persistently on the server inside the directory: ./cms_data

Key Features:
- Create files and nested directories.
- Edit text files in real-time.
- Fetch any file's contents as a clean JSON response via the REST API.
- Instant integration client snippets (cURL, fetch, Python) directly in the UI.`,
      'utf-8'
    );
  }

  const apiPath = path.join(DATA_DIR, 'api-guide.txt');
  if (!fs.existsSync(apiPath)) {
    fs.writeFileSync(
      apiPath,
      `=== Content Management JSON API Guide ===

This CMS exposes a simple REST API to retrieve your content in JSON format, making it easy to consume from external services.

1. Fetch File Content:
   GET /api/content/<filepath>
   
   Example:
   GET /api/content/welcome.txt

   JSON Response:
   {
     "success": true,
     "path": "welcome.txt",
     "content": "Welcome to your...",
     "size": 420,
     "updatedAt": "2026-07-05T12:00:00.000Z"
   }

2. Fetch Directory Tree:
   GET /api/files
   
   Returns the full recursive tree structure of your content.`,
      'utf-8'
    );
  }
  ensureDatabase();
}

// Ensure the directory exists
ensureDataDirectory();

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  updatedAt?: string;
  children?: FileNode[];
}

// Path security check
function safeResolve(relativePath: string): string {
  const absolutePath = path.resolve(DATA_DIR, relativePath);
  if (!absolutePath.startsWith(DATA_DIR)) {
    throw new Error('Access denied: Path is outside content directory');
  }
  return absolutePath;
}

// Build directory tree with permission checks
function buildTree(
  currentDir: string,
  relativePath = '',
  username: string,
  isAdmin: boolean,
  ownership: Record<string, string>
): FileNode[] {
  const items = fs.readdirSync(currentDir, { withFileTypes: true });
  const nodes: FileNode[] = [];

  for (const item of items) {
    const itemRelativePath = relativePath ? `${relativePath}/${item.name}` : item.name;
    const itemAbsolutePath = path.join(currentDir, item.name);

    if (item.name.startsWith('.')) continue; // skip hidden system database files

    const hasAccess = isAdmin || isOwner(username, itemRelativePath, ownership);

    if (item.isDirectory()) {
      const children = buildTree(itemAbsolutePath, itemRelativePath, username, isAdmin, ownership);
      if (isAdmin || hasAccess || children.length > 0) {
        nodes.push({
          name: item.name,
          path: itemRelativePath,
          type: 'directory',
          children
        });
      }
    } else if (item.isFile()) {
      if (hasAccess) {
        const stats = fs.statSync(itemAbsolutePath);
        nodes.push({
          name: item.name,
          path: itemRelativePath,
          type: 'file',
          size: stats.size,
          updatedAt: stats.mtime.toISOString()
        });
      }
    }
  }

  // Sort directories first, then files alphabetically
  return nodes.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === 'directory' ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
}

// Build clean, simplified JSON tree representing folders and files recursively (no metadata like name, size, type etc)
function buildSimpleTree(
  currentDir: string,
  relativePath = '',
  username: string,
  isAdmin: boolean,
  ownership: Record<string, string>
): any {
  const items = fs.readdirSync(currentDir, { withFileTypes: true });
  const result: any = {};

  for (const item of items) {
    const itemRelativePath = relativePath ? `${relativePath}/${item.name}` : item.name;
    const itemAbsolutePath = path.join(currentDir, item.name);

    if (item.name.startsWith('.')) continue; // skip system database files

    const hasAccess = isAdmin || isOwner(username, itemRelativePath, ownership);

    if (item.isDirectory()) {
      const subTree = buildSimpleTree(itemAbsolutePath, itemRelativePath, username, isAdmin, ownership);
      if (isAdmin || hasAccess || Object.keys(subTree).length > 0) {
        result[item.name] = subTree;
      }
    } else if (item.isFile()) {
      if (hasAccess) {
        try {
          const content = fs.readFileSync(itemAbsolutePath, 'utf-8');
          result[item.name] = content;
        } catch (e) {
          result[item.name] = '';
        }
      }
    }
  }

  return result;
}

async function startServer() {
  const app = express();
  app.use(express.json());

  // === CMS AUTH ENDPOINTS ===

  app.post('/api/auth/register', (req, res) => {
    const { username, passwordHash } = req.body;
    if (!username || !passwordHash) {
      return res.status(400).json({ success: false, error: 'Username and password hash are required' });
    }

    const cleanedUsername = username.trim().toLowerCase();
    if (cleanedUsername.length < 3) {
      return res.status(400).json({ success: false, error: 'Username must be at least 3 characters' });
    }

    const usersData = loadJSONFile(USERS_FILE, { users: [] });
    if (usersData.users.some((u: any) => u.username.toLowerCase() === cleanedUsername)) {
      return res.status(400).json({ success: false, error: 'Username already exists' });
    }

    usersData.users.push({
      username: cleanedUsername,
      passwordHash,
      role: 'user'
    });

    saveJSONFile(USERS_FILE, usersData);
    res.json({ success: true, message: 'User registered successfully!' });
  });

  app.post('/api/auth/login', (req, res) => {
    const { username, passwordHash } = req.body;
    if (!username || !passwordHash) {
      return res.status(400).json({ success: false, error: 'Username and password hash are required' });
    }

    const cleanedUsername = username.trim().toLowerCase();
    const usersData = loadJSONFile(USERS_FILE, { users: [] });
    const user = usersData.users.find((u: any) => u.username.toLowerCase() === cleanedUsername);

    if (!user || user.passwordHash !== passwordHash) {
      return res.status(401).json({ success: false, error: 'Invalid username or password' });
    }

    const token = crypto.randomBytes(24).toString('hex');
    const sessionsData = loadJSONFile(SESSIONS_FILE, { sessions: {} });
    
    sessionsData.sessions[token] = {
      token,
      username: user.username,
      role: user.role,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
    };

    saveJSONFile(SESSIONS_FILE, sessionsData);

    res.json({
      success: true,
      token,
      user: {
        username: user.username,
        role: user.role
      }
    });
  });

  app.post('/api/auth/logout', (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '') || (req.query.token as string);
    if (token) {
      const sessionsData = loadJSONFile(SESSIONS_FILE, { sessions: {} });
      delete sessionsData.sessions[token];
      saveJSONFile(SESSIONS_FILE, sessionsData);
    }
    res.json({ success: true, message: 'Logged out successfully' });
  });

  app.get('/api/auth/me', (req, res) => {
    const session = getSession(req);
    if (!session) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }
    res.json({
      success: true,
      user: {
        username: session.username,
        role: session.role
      }
    });
  });

  // === CMS API ENDPOINTS ===

  // 1. Get entire directory tree
  app.get('/api/files', (req, res) => {
    const session = getSession(req);
    if (!session) {
      return res.status(401).json({ success: false, error: 'Not authenticated. Please log in.' });
    }

    try {
      const ownership = loadJSONFile(OWNERSHIP_FILE, { ownership: {} }).ownership;
      const isAdmin = session.role === 'admin';

      if (req.query.verbose === 'true') {
        const tree = buildTree(DATA_DIR, '', session.username, isAdmin, ownership);
        res.json({ success: true, tree });
      } else {
        const simpleTree = buildSimpleTree(DATA_DIR, '', session.username, isAdmin, ownership);
        res.json(simpleTree);
      }
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 2. Save a file (create or update content)
  app.post('/api/files/save', (req, res) => {
    const session = getSession(req);
    if (!session) {
      return res.status(401).json({ success: false, error: 'Not authenticated. Please log in.' });
    }

    const { path: relPath, content } = req.body;
    if (typeof relPath !== 'string') {
      return res.status(400).json({ success: false, error: 'Path is required' });
    }

    try {
      const cleanPath = relPath.replace(/^\/+|\/+$/g, '');
      const ownershipData = loadJSONFile(OWNERSHIP_FILE, { ownership: {} });
      const isAdmin = session.role === 'admin';

      // If file already exists, check write permission
      const absPath = safeResolve(cleanPath);
      if (fs.existsSync(absPath)) {
        const hasAccess = isAdmin || isOwner(session.username, cleanPath, ownershipData.ownership);
        if (!hasAccess) {
          return res.status(403).json({ success: false, error: 'Permission denied. You do not own this file.' });
        }
      } else {
        // New file! Check if user can create in the directory
        const parentRel = path.dirname(cleanPath);
        if (parentRel && parentRel !== '.' && parentRel !== '') {
          const parentOwner = ownershipData.ownership[parentRel];
          if (parentOwner && parentOwner !== session.username && !isAdmin) {
            return res.status(403).json({ success: false, error: 'Permission denied. Parent directory is owned by another user.' });
          }
        }
      }

      const parentDir = path.dirname(absPath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }

      fs.writeFileSync(absPath, content || '', 'utf-8');
      
      // Register ownership if not already set
      if (!ownershipData.ownership[cleanPath]) {
        ownershipData.ownership[cleanPath] = session.username;
        saveJSONFile(OWNERSHIP_FILE, ownershipData);
      }

      const stats = fs.statSync(absPath);
      res.json({
        success: true,
        message: 'File saved successfully',
        file: {
          name: path.basename(absPath),
          path: cleanPath,
          type: 'file',
          size: stats.size,
          updatedAt: stats.mtime.toISOString()
        }
      });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // 3. Create a folder
  app.post('/api/files/create-folder', (req, res) => {
    const session = getSession(req);
    if (!session) {
      return res.status(401).json({ success: false, error: 'Not authenticated. Please log in.' });
    }

    const { path: relPath } = req.body;
    if (typeof relPath !== 'string' || !relPath.trim()) {
      return res.status(400).json({ success: false, error: 'Path is required' });
    }

    try {
      const cleanPath = relPath.replace(/^\/+|\/+$/g, '');
      const absPath = safeResolve(cleanPath);
      if (fs.existsSync(absPath)) {
        return res.status(400).json({ success: false, error: 'Directory or file already exists' });
      }

      const ownershipData = loadJSONFile(OWNERSHIP_FILE, { ownership: {} });
      const isAdmin = session.role === 'admin';

      // Check if parent directory is owned by someone else
      const parentRel = path.dirname(cleanPath);
      if (parentRel && parentRel !== '.' && parentRel !== '') {
        const parentOwner = ownershipData.ownership[parentRel];
        if (parentOwner && parentOwner !== session.username && !isAdmin) {
          return res.status(403).json({ success: false, error: 'Permission denied. Parent directory is owned by another user.' });
        }
      }

      fs.mkdirSync(absPath, { recursive: true });

      // Register ownership of the new folder
      ownershipData.ownership[cleanPath] = session.username;
      saveJSONFile(OWNERSHIP_FILE, ownershipData);

      res.json({
        success: true,
        message: 'Folder created successfully',
        folder: {
          name: path.basename(absPath),
          path: cleanPath,
          type: 'directory',
          children: []
        }
      });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // 4. Delete file or folder
  app.post('/api/files/delete', (req, res) => {
    const session = getSession(req);
    if (!session) {
      return res.status(401).json({ success: false, error: 'Not authenticated. Please log in.' });
    }

    const { path: relPath } = req.body;
    if (typeof relPath !== 'string') {
      return res.status(400).json({ success: false, error: 'Path is required' });
    }

    try {
      const cleanPath = relPath.replace(/^\/+|\/+$/g, '');
      const absPath = safeResolve(cleanPath);
      if (!fs.existsSync(absPath)) {
        return res.status(404).json({ success: false, error: 'File or directory not found' });
      }

      const ownershipData = loadJSONFile(OWNERSHIP_FILE, { ownership: {} });
      const isAdmin = session.role === 'admin';

      // Verify delete access
      const hasAccess = isAdmin || isOwner(session.username, cleanPath, ownershipData.ownership);
      if (!hasAccess) {
        return res.status(403).json({ success: false, error: 'Permission denied. You do not own this file/folder.' });
      }

      const stat = fs.statSync(absPath);
      if (stat.isDirectory()) {
        fs.rmSync(absPath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(absPath);
      }

      // Cleanup ownership registry
      delete ownershipData.ownership[cleanPath];
      for (const key of Object.keys(ownershipData.ownership)) {
        if (key.startsWith(cleanPath + '/')) {
          delete ownershipData.ownership[key];
        }
      }
      saveJSONFile(OWNERSHIP_FILE, ownershipData);

      res.json({ success: true, message: 'Deleted successfully' });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // 5. Rename or move file/folder
  app.post('/api/files/rename', (req, res) => {
    const session = getSession(req);
    if (!session) {
      return res.status(401).json({ success: false, error: 'Not authenticated. Please log in.' });
    }

    const { oldPath, newPath } = req.body;
    if (typeof oldPath !== 'string' || typeof newPath !== 'string') {
      return res.status(400).json({ success: false, error: 'oldPath and newPath are required' });
    }

    try {
      const cleanOld = oldPath.replace(/^\/+|\/+$/g, '');
      const cleanNew = newPath.replace(/^\/+|\/+$/g, '');

      const absOldPath = safeResolve(cleanOld);
      const absNewPath = safeResolve(cleanNew);

      if (!fs.existsSync(absOldPath)) {
        return res.status(404).json({ success: false, error: 'Source file or folder not found' });
      }
      if (fs.existsSync(absNewPath)) {
        return res.status(400).json({ success: false, error: 'Destination already exists' });
      }

      const ownershipData = loadJSONFile(OWNERSHIP_FILE, { ownership: {} });
      const isAdmin = session.role === 'admin';

      // Check edit permission on original
      const hasAccess = isAdmin || isOwner(session.username, cleanOld, ownershipData.ownership);
      if (!hasAccess) {
        return res.status(403).json({ success: false, error: 'Permission denied. You do not own this item.' });
      }

      // Check create permission in new parent directory
      const newParentRel = path.dirname(cleanNew);
      if (newParentRel && newParentRel !== '.' && newParentRel !== '') {
        const parentOwner = ownershipData.ownership[newParentRel];
        if (parentOwner && parentOwner !== session.username && !isAdmin) {
          return res.status(403).json({ success: false, error: 'Permission denied. Target directory is owned by another user.' });
        }
      }

      const parentDir = path.dirname(absNewPath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }

      fs.renameSync(absOldPath, absNewPath);

      // Update ownership registry
      if (ownershipData.ownership[cleanOld]) {
        ownershipData.ownership[cleanNew] = ownershipData.ownership[cleanOld];
        delete ownershipData.ownership[cleanOld];
      } else {
        ownershipData.ownership[cleanNew] = session.username;
      }

      for (const key of Object.keys(ownershipData.ownership)) {
        if (key.startsWith(cleanOld + '/')) {
          const nestedNew = key.replace(cleanOld + '/', cleanNew + '/');
          ownershipData.ownership[nestedNew] = ownershipData.ownership[key];
          delete ownershipData.ownership[key];
        }
      }
      saveJSONFile(OWNERSHIP_FILE, ownershipData);

      res.json({ success: true, message: 'Renamed successfully' });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // 6. Direct clean content fetching API route (GET /api/content/<filepath>)
  app.get('/api/content/*', (req, res) => {
    const session = getSession(req);
    if (!session) {
      return res.status(401).json({ success: false, error: 'Not authenticated. Please log in.' });
    }

    const fileRelPath = req.params[0];
    if (!fileRelPath) {
      return res.status(400).json({ success: false, error: 'File path is required' });
    }

    try {
      const cleanPath = fileRelPath.replace(/^\/+|\/+$/g, '');
      const absPath = safeResolve(cleanPath);
      if (!fs.existsSync(absPath)) {
        return res.status(404).json({ success: false, error: `File not found: ${cleanPath}` });
      }

      const stat = fs.statSync(absPath);
      if (stat.isDirectory()) {
        return res.status(400).json({ success: false, error: 'Path is a directory, not a file' });
      }

      const ownership = loadJSONFile(OWNERSHIP_FILE, { ownership: {} }).ownership;
      const isAdmin = session.role === 'admin';

      const hasAccess = isAdmin || isOwner(session.username, cleanPath, ownership);
      if (!hasAccess) {
        return res.status(403).json({ success: false, error: 'Permission denied. You do not own this file.' });
      }

      const content = fs.readFileSync(absPath, 'utf-8');

      if (req.query.verbose === 'true') {
        res.json({
          success: true,
          path: cleanPath,
          content,
          size: stat.size,
          updatedAt: stat.mtime.toISOString()
        });
      } else {
        res.json({
          content
        });
      }
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // 7. Get sub-directories and files of a specific folder as a whole JSON tree (GET /api/directory/*)
  app.get('/api/directory/*', (req, res) => {
    const session = getSession(req);
    if (!session) {
      return res.status(401).json({ success: false, error: 'Not authenticated. Please log in.' });
    }

    const folderRelPath = (req.params[0] || '').replace(/^\/+|\/+$/g, '');
    try {
      const absPath = safeResolve(folderRelPath);
      if (!fs.existsSync(absPath)) {
        return res.status(404).json({ success: false, error: `Directory not found: ${folderRelPath}` });
      }

      const stat = fs.statSync(absPath);
      if (!stat.isDirectory()) {
        return res.status(400).json({ success: false, error: 'Path is a file, not a directory' });
      }

      const ownership = loadJSONFile(OWNERSHIP_FILE, { ownership: {} }).ownership;
      const isAdmin = session.role === 'admin';

      // Compute contents recursively based on the access filter
      if (req.query.verbose === 'true') {
        const contents = buildTree(absPath, folderRelPath, session.username, isAdmin, ownership);
        res.json({
          success: true,
          path: folderRelPath,
          name: path.basename(absPath) || 'root',
          contents
        });
      } else {
        const simpleTree = buildSimpleTree(absPath, folderRelPath, session.username, isAdmin, ownership);
        res.json(simpleTree);
      }
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // === VITE / FRONTEND ASSET ROUTING ===
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CMS Server running on http://localhost:${PORT}`);
  });
}

startServer();
