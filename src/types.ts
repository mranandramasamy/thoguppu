export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  updatedAt?: string;
  children?: FileNode[];
}

export interface ActiveFile {
  path: string;
  content: string;
  originalContent: string;
  isDirty: boolean;
  size?: number;
  updatedAt?: string;
}

export interface OpenShiftConfig {
  namespace: string;
  pvcName: string;
  mountPath: string;
  replicaCount: number;
}
