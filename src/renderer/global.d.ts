// Type declarations for window.electronAPI exposed via preload
export {};

declare global {
  interface Window {
    electronAPI: {
      getTheme: () => Promise<string>;
      setTheme: (theme: 'dark' | 'light' | 'system') => Promise<string>;
      getAdapters: () => Promise<unknown>;
      onNetworkChange: (callback: (data: unknown) => void) => void;
      removeNetworkListeners: () => void;
    };
  }
}
