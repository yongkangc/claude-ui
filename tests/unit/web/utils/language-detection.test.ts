import { detectLanguageFromPath, isCodeFile, getLanguageDisplayName } from '@/web/chat/utils/language-detection';

describe('Language Detection Utils', () => {
  describe('detectLanguageFromPath', () => {
    it('should detect common programming languages by extension', () => {
      expect(detectLanguageFromPath('/path/to/file.js')).toBe('javascript');
      expect(detectLanguageFromPath('/path/to/file.ts')).toBe('typescript');
      expect(detectLanguageFromPath('/path/to/file.tsx')).toBe('tsx');
      expect(detectLanguageFromPath('/path/to/file.py')).toBe('python');
      expect(detectLanguageFromPath('/path/to/file.java')).toBe('java');
      expect(detectLanguageFromPath('/path/to/file.go')).toBe('go');
      expect(detectLanguageFromPath('/path/to/file.rs')).toBe('rust');
      expect(detectLanguageFromPath('/path/to/file.cpp')).toBe('cpp');
    });

    it('should detect web languages', () => {
      expect(detectLanguageFromPath('/path/to/file.html')).toBe('html');
      expect(detectLanguageFromPath('/path/to/file.css')).toBe('css');
      expect(detectLanguageFromPath('/path/to/file.scss')).toBe('scss');
      expect(detectLanguageFromPath('/path/to/file.xml')).toBe('xml');
    });

    it('should detect data formats', () => {
      expect(detectLanguageFromPath('/path/to/file.json')).toBe('json');
      expect(detectLanguageFromPath('/path/to/file.yaml')).toBe('yaml');
      expect(detectLanguageFromPath('/path/to/file.yml')).toBe('yaml');
      expect(detectLanguageFromPath('/path/to/file.toml')).toBe('toml');
    });

    it('should detect shell scripts', () => {
      expect(detectLanguageFromPath('/path/to/file.sh')).toBe('bash');
      expect(detectLanguageFromPath('/path/to/file.bash')).toBe('bash');
      expect(detectLanguageFromPath('/path/to/file.zsh')).toBe('bash');
    });

    it('should handle case insensitive extensions', () => {
      expect(detectLanguageFromPath('/path/to/file.JS')).toBe('javascript');
      expect(detectLanguageFromPath('/path/to/file.PY')).toBe('python');
      expect(detectLanguageFromPath('/path/to/FILE.CPP')).toBe('cpp');
    });

    it('should detect languages by filename', () => {
      expect(detectLanguageFromPath('/path/to/Dockerfile')).toBe('dockerfile');
      expect(detectLanguageFromPath('/path/to/Makefile')).toBe('makefile');
      expect(detectLanguageFromPath('/path/to/.gitignore')).toBe('gitignore');
      expect(detectLanguageFromPath('/path/to/.bashrc')).toBe('bash');
      expect(detectLanguageFromPath('/path/to/nginx.conf')).toBe('nginx');
    });

    it('should handle files without extensions', () => {
      expect(detectLanguageFromPath('/path/to/README')).toBe('text');
      expect(detectLanguageFromPath('/path/to/LICENSE')).toBe('text');
      expect(detectLanguageFromPath('/path/to/unknown')).toBe('text');
    });

    it('should handle hidden files with extensions', () => {
      expect(detectLanguageFromPath('/path/to/.hidden.js')).toBe('javascript');
      expect(detectLanguageFromPath('/path/to/.config.json')).toBe('json');
    });

    it('should handle empty or invalid paths', () => {
      expect(detectLanguageFromPath('')).toBe('text');
      expect(detectLanguageFromPath(null as any)).toBe('text');
      expect(detectLanguageFromPath(undefined as any)).toBe('text');
    });

    it('should handle paths with multiple dots', () => {
      expect(detectLanguageFromPath('/path/to/file.test.js')).toBe('javascript');
      expect(detectLanguageFromPath('/path/to/file.spec.ts')).toBe('typescript');
      expect(detectLanguageFromPath('/path/to/jquery.min.js')).toBe('javascript');
    });

    it('should return text for unknown extensions', () => {
      expect(detectLanguageFromPath('/path/to/file.xyz')).toBe('text');
      expect(detectLanguageFromPath('/path/to/file.unknown')).toBe('text');
      expect(detectLanguageFromPath('/path/to/file.123')).toBe('text');
    });
  });

  describe('isCodeFile', () => {
    it('should return true for code files', () => {
      expect(isCodeFile('/path/to/file.js')).toBe(true);
      expect(isCodeFile('/path/to/file.py')).toBe(true);
      expect(isCodeFile('/path/to/file.java')).toBe(true);
      expect(isCodeFile('/path/to/Dockerfile')).toBe(true);
      expect(isCodeFile('/path/to/file.json')).toBe(true);
    });

    it('should return false for non-code files', () => {
      expect(isCodeFile('/path/to/README')).toBe(false);
      expect(isCodeFile('/path/to/file.txt')).toBe(false);
      expect(isCodeFile('/path/to/file.unknown')).toBe(false);
      expect(isCodeFile('')).toBe(false);
    });
  });

  describe('getLanguageDisplayName', () => {
    it('should return proper display names for common languages', () => {
      expect(getLanguageDisplayName('javascript')).toBe('JavaScript');
      expect(getLanguageDisplayName('typescript')).toBe('TypeScript');
      expect(getLanguageDisplayName('python')).toBe('Python');
      expect(getLanguageDisplayName('cpp')).toBe('C++');
      expect(getLanguageDisplayName('csharp')).toBe('C#');
      expect(getLanguageDisplayName('objectivec')).toBe('Objective-C');
    });

    it('should return proper display names for web languages', () => {
      expect(getLanguageDisplayName('html')).toBe('HTML');
      expect(getLanguageDisplayName('css')).toBe('CSS');
      expect(getLanguageDisplayName('scss')).toBe('SCSS');
      expect(getLanguageDisplayName('jsx')).toBe('JSX');
      expect(getLanguageDisplayName('tsx')).toBe('TSX');
    });

    it('should return proper display names for data formats', () => {
      expect(getLanguageDisplayName('json')).toBe('JSON');
      expect(getLanguageDisplayName('yaml')).toBe('YAML');
      expect(getLanguageDisplayName('xml')).toBe('XML');
      expect(getLanguageDisplayName('sql')).toBe('SQL');
    });

    it('should return proper display names for tools and configs', () => {
      expect(getLanguageDisplayName('dockerfile')).toBe('Dockerfile');
      expect(getLanguageDisplayName('makefile')).toBe('Makefile');
      expect(getLanguageDisplayName('nginx')).toBe('Nginx');
      expect(getLanguageDisplayName('gitignore')).toBe('Git Ignore');
    });

    it('should handle unknown languages gracefully', () => {
      expect(getLanguageDisplayName('unknown')).toBe('Unknown');
      expect(getLanguageDisplayName('customlang')).toBe('Customlang');
      expect(getLanguageDisplayName('test')).toBe('Test');
    });

    it('should return Plain Text for text', () => {
      expect(getLanguageDisplayName('text')).toBe('Plain Text');
    });
  });
});