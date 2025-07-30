export interface Preferences {
  colorScheme: 'light' | 'dark' | 'system';
  language: string;
  notifications?: {
    enabled: boolean;
    ntfyUrl?: string;
  };
}

export const DEFAULT_PREFERENCES: Preferences = {
  colorScheme: 'system',
  language: 'en',
};
