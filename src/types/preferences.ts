export interface Preferences {
  colorScheme: 'light' | 'dark';
  language: string;
}

export const DEFAULT_PREFERENCES: Preferences = {
  colorScheme: 'light',
  language: 'en'
};
