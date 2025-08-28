/**
 * Jest Setup File
 * Configures testing environment for React components
 */

import '@testing-library/jest-dom';

// Add TextEncoder and TextDecoder for Node.js environment
if (typeof global.TextEncoder === 'undefined') {
  global.TextEncoder = require('util').TextEncoder;
}
if (typeof global.TextDecoder === 'undefined') {
  global.TextDecoder = require('util').TextDecoder;
}

// Mock localStorage and sessionStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: key => store[key] || null,
    setItem: (key, value) => { store[key] = value.toString(); },
    removeItem: key => { delete store[key]; },
    clear: () => { store = {}; }
  };
})();

const sessionStorageMock = (() => {
  let store = {};
  return {
    getItem: key => store[key] || null,
    setItem: (key, value) => { store[key] = value.toString(); },
    removeItem: key => { delete store[key]; },
    clear: () => { store = {}; }
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock
});

// Mock window.confirm and window.alert
global.confirm = jest.fn(() => true);
global.alert = jest.fn(() => {});

// Mock URL search params
Object.defineProperty(window, 'location', {
  value: {
    search: '',
    pathname: '/onboarding',
    href: 'http://localhost:3000/onboarding'
  },
  writable: true
});

// Mock console methods to reduce noise in tests
const originalError = console.error;
const originalWarn = console.warn;

beforeAll(() => {
  console.error = jest.fn((message) => {
    // Only log actual errors, not React warnings
    if (typeof message === 'string' && message.includes('Warning:')) {
      return;
    }
    originalError(message);
  });
  
  console.warn = jest.fn((message) => {
    // Only log important warnings
    if (typeof message === 'string' && (
      message.includes('deprecated') ||
      message.includes('React')
    )) {
      return;
    }
    originalWarn(message);
  });
});

afterAll(() => {
  console.error = originalError;
  console.warn = originalWarn;
});

// Clean up after each test
afterEach(() => {
  localStorageMock.clear();
  sessionStorageMock.clear();
  jest.clearAllMocks();
});