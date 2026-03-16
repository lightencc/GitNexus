import { describe, it, expect } from 'vitest';
import { extractElementTypeFromString } from '../../src/core/ingestion/type-extractors/shared.js';

describe('extractElementTypeFromString', () => {
  describe('array suffix (TypeScript / Java / C#)', () => {
    it('User[] → User', () => {
      expect(extractElementTypeFromString('User[]')).toBe('User');
    });

    it('string[] → string', () => {
      expect(extractElementTypeFromString('string[]')).toBe('string');
    });

    it('int[] → int', () => {
      expect(extractElementTypeFromString('int[]')).toBe('int');
    });
  });

  describe('Go slice prefix', () => {
    it('[]User → User', () => {
      expect(extractElementTypeFromString('[]User')).toBe('User');
    });

    it('[]string → string', () => {
      expect(extractElementTypeFromString('[]string')).toBe('string');
    });
  });

  describe('Swift array sugar', () => {
    it('[User] → User', () => {
      expect(extractElementTypeFromString('[User]')).toBe('User');
    });

    it('[String] → String', () => {
      expect(extractElementTypeFromString('[String]')).toBe('String');
    });
  });

  describe('generic angle-bracket containers', () => {
    it('Array<User> → User', () => {
      expect(extractElementTypeFromString('Array<User>')).toBe('User');
    });

    it('Vec<User> → User (Rust)', () => {
      expect(extractElementTypeFromString('Vec<User>')).toBe('User');
    });

    it('vector<User> → User (C++)', () => {
      expect(extractElementTypeFromString('vector<User>')).toBe('User');
    });

    it('Set<User> → User', () => {
      expect(extractElementTypeFromString('Set<User>')).toBe('User');
    });

    it('List<User> → User', () => {
      expect(extractElementTypeFromString('List<User>')).toBe('User');
    });

    it('IEnumerable<User> → User (C#)', () => {
      expect(extractElementTypeFromString('IEnumerable<User>')).toBe('User');
    });
  });

  describe('Python subscript-style generics', () => {
    it('List[User] → User', () => {
      expect(extractElementTypeFromString('List[User]')).toBe('User');
    });

    it('Set[User] → User', () => {
      expect(extractElementTypeFromString('Set[User]')).toBe('User');
    });
  });

  describe('multi-argument generics — returns first arg only', () => {
    it('Map<String, User> → String', () => {
      expect(extractElementTypeFromString('Map<String, User>')).toBe('String');
    });

    it('Map<String, List<User>> → String (nested second arg ignored)', () => {
      expect(extractElementTypeFromString('Map<String, List<User>>')).toBe('String');
    });

    it('Dict[str, User] → str (Python)', () => {
      expect(extractElementTypeFromString('Dict[str, User]')).toBe('str');
    });
  });

  describe('nested generics as element type — returns undefined', () => {
    it('Array<List<User>> → undefined (element is itself generic)', () => {
      // The element "List<User>" is not a plain word, so return undefined.
      expect(extractElementTypeFromString('Array<List<User>>')).toBeUndefined();
    });

    it('Vec<Option<User>> → undefined (element is itself generic)', () => {
      expect(extractElementTypeFromString('Vec<Option<User>>')).toBeUndefined();
    });
  });

  describe('edge cases — return undefined', () => {
    it('empty string → undefined', () => {
      expect(extractElementTypeFromString('')).toBeUndefined();
    });

    it('plain type name (no container) → undefined', () => {
      expect(extractElementTypeFromString('User')).toBeUndefined();
    });

    it('bare angle bracket with no close → undefined (malformed)', () => {
      expect(extractElementTypeFromString('Array<User')).toBeUndefined();
    });

    it('bare [] prefix with spaces only → undefined', () => {
      expect(extractElementTypeFromString('[]')).toBeUndefined();
    });

    it('empty array suffix → undefined', () => {
      expect(extractElementTypeFromString('[]')).toBeUndefined();
    });

    it('[] suffix with no base → undefined', () => {
      expect(extractElementTypeFromString('[]')).toBeUndefined();
    });

    it('empty Swift sugar [] → undefined', () => {
      // starts with '[' and ends with ']' but inner is empty
      expect(extractElementTypeFromString('[ ]')).toBeUndefined();
    });
  });
});
