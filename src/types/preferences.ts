export interface Preferences {
  colorScheme: 'light' | 'dark' | 'system';
  language: string;
}

export const DEFAULT_PREFERENCES: Preferences = {
  colorScheme: 'system',
  language: 'en'
};
