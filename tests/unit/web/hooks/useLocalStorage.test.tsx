/**
 * @jest-environment jsdom
 */
import { renderHook, act } from '@testing-library/react';
import { useLocalStorage } from '@/web/common/hooks/useLocalStorage';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  
  const mock = {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: jest.fn((index: number) => {
      const keys = Object.keys(store);
      return keys[index] || null;
    }),
  };
  
  return mock;
})();

// Override the jsdom localStorage
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

describe('useLocalStorage hook', () => {
  beforeEach(() => {
    localStorageMock.clear();
    jest.clearAllMocks();
  });

  it('should initialize with default value when no stored value exists', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 'default'));
    expect(result.current[0]).toBe('default');
  });

  it('should initialize with stored value when it exists', () => {
    localStorageMock.setItem('test-key', JSON.stringify('stored-value'));
    const { result } = renderHook(() => useLocalStorage('test-key', 'default'));
    expect(result.current[0]).toBe('stored-value');
  });

  it('should update localStorage when setting a new value', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));
    
    act(() => {
      result.current[1]('new-value');
    });
    
    expect(result.current[0]).toBe('new-value');
    expect(localStorageMock.setItem).toHaveBeenCalledWith('test-key', '"new-value"');
  });

  it('should support function updates', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 1));
    
    act(() => {
      result.current[1]((prev: number) => prev + 1);
    });
    
    expect(result.current[0]).toBe(2);
    expect(localStorageMock.setItem).toHaveBeenCalledWith('test-key', '2');
  });

  it('should handle complex objects', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', { count: 0 }));
    
    act(() => {
      result.current[1]({ count: 5 });
    });
    
    expect(result.current[0]).toEqual({ count: 5 });
    expect(localStorageMock.setItem).toHaveBeenCalledWith('test-key', '{"count":5}');
  });

  it('should sync across multiple hook instances', () => {
    const { result: result1 } = renderHook(() => useLocalStorage('test-key', 'initial'));
    const { result: result2 } = renderHook(() => useLocalStorage('test-key', 'initial'));
    
    act(() => {
      result1.current[1]('updated');
    });
    
    // Simulate storage event
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'test-key',
        newValue: '"updated"'
      }));
    });
    
    expect(result2.current[0]).toBe('updated');
  });

  it('should ignore storage events for other keys', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));
    
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'other-key',
        newValue: '"other-value"'
      }));
    });
    
    expect(result.current[0]).toBe('initial');
  });

  it('should handle invalid JSON in storage events', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));
    
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'test-key',
        newValue: 'invalid json'
      }));
    });
    
    expect(result.current[0]).toBe('initial');
  });

  it('should cleanup event listeners on unmount', () => {
    const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => useLocalStorage('test-key', 'initial'));
    
    unmount();
    
    expect(removeEventListenerSpy).toHaveBeenCalledWith('storage', expect.any(Function));
  });
});