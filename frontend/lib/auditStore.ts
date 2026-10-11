import type { AuditEntry } from './types';

const STORAGE_KEY = 'credence.audit.v1';
const listeners = new Set<() => void>();
let memoryEntries: AuditEntry[] = [];

function readEntries(): AuditEntry[] {
  if (typeof window === 'undefined') return memoryEntries;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return memoryEntries;
  }
}

function writeEntries(entries: AuditEntry[]) {
  memoryEntries = entries;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Private browsing or storage quota failures fall back to memory.
  }
  listeners.forEach((listener) => listener());
}

export const auditStore = {
  get(): AuditEntry[] {
    return readEntries();
  },
  add(entry: AuditEntry) {
    writeEntries([entry, ...readEntries()].slice(0, 100));
  },
  clear() {
    writeEntries([]);
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  exportJson() {
    return JSON.stringify(readEntries(), null, 2);
  },
};
