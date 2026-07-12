import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  value: ResizeObserverStub,
});
Object.defineProperty(globalThis, 'ResizeObserver', {
  writable: true,
  value: ResizeObserverStub,
});

const originalGetComputedStyle = window.getComputedStyle;
window.getComputedStyle = (element: Element) => originalGetComputedStyle(element);

afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
});
