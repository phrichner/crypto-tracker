/**
 * Debounce Hook
 *
 * Provides debounced values and callbacks for search inputs.
 * Prevents excessive re-renders and API calls during rapid input.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Hook that returns a debounced value
 * The value only updates after the specified delay of no changes
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // Set up a timer to update the debounced value
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Clean up the timer if value changes before delay completes
    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Hook that returns a debounced callback function
 * Useful for event handlers that shouldn't fire on every keystroke
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number = 300
): (...args: Parameters<T>) => void {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const debouncedCallback = useCallback(
    (...args: Parameters<T>) => {
      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Set new timeout
      timeoutRef.current = setTimeout(() => {
        callback(...args);
      }, delay);
    },
    [callback, delay]
  );

  return debouncedCallback;
}

/**
 * Search input state management with debouncing
 * Provides both immediate value (for input display) and debounced value (for filtering)
 */
export function useSearchInput(initialValue: string = '', delay: number = 300) {
  const [inputValue, setInputValue] = useState(initialValue);
  const debouncedValue = useDebounce(inputValue, delay);

  const handleChange = useCallback((value: string) => {
    setInputValue(value);
  }, []);

  const clear = useCallback(() => {
    setInputValue('');
  }, []);

  const reset = useCallback(() => {
    setInputValue(initialValue);
  }, [initialValue]);

  return {
    // The current input value (updates immediately for responsive UI)
    inputValue,
    // The debounced value (updates after delay, use for filtering)
    debouncedValue,
    // Handler for input changes
    handleChange,
    // Clear the input
    clear,
    // Reset to initial value
    reset,
    // Whether the debounced value is "catching up" to input value
    isDebouncing: inputValue !== debouncedValue,
  };
}
