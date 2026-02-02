import {
  KNOWN_FUNCTIONS,
  isKnownFunction,
  JS_KEYWORDS,
  isJsKeyword,
} from '../src/knownFunctions';

describe('knownFunctions', () => {
  describe('KNOWN_FUNCTIONS', () => {
    it('should be a Set', () => {
      expect(KNOWN_FUNCTIONS).toBeInstanceOf(Set);
    });

    it('should contain all documented Prisme.ai functions', () => {
      // Date
      expect(KNOWN_FUNCTIONS.has('date')).toBe(true);

      // UUID
      expect(KNOWN_FUNCTIONS.has('uuid')).toBe(true);

      // Math
      expect(KNOWN_FUNCTIONS.has('rand')).toBe(true);
      expect(KNOWN_FUNCTIONS.has('round')).toBe(true);
      expect(KNOWN_FUNCTIONS.has('ceil')).toBe(true);
      expect(KNOWN_FUNCTIONS.has('floor')).toBe(true);
      expect(KNOWN_FUNCTIONS.has('abs')).toBe(true);
      expect(KNOWN_FUNCTIONS.has('min')).toBe(true);
      expect(KNOWN_FUNCTIONS.has('max')).toBe(true);

      // String
      expect(KNOWN_FUNCTIONS.has('lower')).toBe(true);
      expect(KNOWN_FUNCTIONS.has('upper')).toBe(true);
      expect(KNOWN_FUNCTIONS.has('truncate')).toBe(true);
      expect(KNOWN_FUNCTIONS.has('split')).toBe(true);
      expect(KNOWN_FUNCTIONS.has('join')).toBe(true);
      expect(KNOWN_FUNCTIONS.has('replace')).toBe(true);
      expect(KNOWN_FUNCTIONS.has('sanitize')).toBe(true);
      expect(KNOWN_FUNCTIONS.has('trim')).toBe(true);
      expect(KNOWN_FUNCTIONS.has('startsWith')).toBe(true);
      expect(KNOWN_FUNCTIONS.has('endsWith')).toBe(true);
      expect(KNOWN_FUNCTIONS.has('includes')).toBe(true);
      expect(KNOWN_FUNCTIONS.has('indexOf')).toBe(true);
      expect(KNOWN_FUNCTIONS.has('slice')).toBe(true);
      expect(KNOWN_FUNCTIONS.has('substring')).toBe(true);
      expect(KNOWN_FUNCTIONS.has('padStart')).toBe(true);
      expect(KNOWN_FUNCTIONS.has('padEnd')).toBe(true);
      expect(KNOWN_FUNCTIONS.has('repeat')).toBe(true);
      expect(KNOWN_FUNCTIONS.has('match')).toBe(true);

      // JSON
      expect(KNOWN_FUNCTIONS.has('json')).toBe(true);
      expect(KNOWN_FUNCTIONS.has('unsafejson')).toBe(true);

      // Object
      expect(KNOWN_FUNCTIONS.has('deepmerge')).toBe(true);
      expect(KNOWN_FUNCTIONS.has('keys')).toBe(true);
      expect(KNOWN_FUNCTIONS.has('values')).toBe(true);
      expect(KNOWN_FUNCTIONS.has('entries')).toBe(true);
      expect(KNOWN_FUNCTIONS.has('fromEntries')).toBe(true);
      expect(KNOWN_FUNCTIONS.has('assign')).toBe(true);

      // URL
      expect(KNOWN_FUNCTIONS.has('URLSearchParams')).toBe(true);
      expect(KNOWN_FUNCTIONS.has('URL')).toBe(true);
      expect(KNOWN_FUNCTIONS.has('encodeURIComponent')).toBe(true);
      expect(KNOWN_FUNCTIONS.has('decodeURIComponent')).toBe(true);
      expect(KNOWN_FUNCTIONS.has('encodeURI')).toBe(true);
      expect(KNOWN_FUNCTIONS.has('decodeURI')).toBe(true);

      // Type checking
      expect(KNOWN_FUNCTIONS.has('isArray')).toBe(true);
      expect(KNOWN_FUNCTIONS.has('isObject')).toBe(true);
      expect(KNOWN_FUNCTIONS.has('isString')).toBe(true);
      expect(KNOWN_FUNCTIONS.has('isNumber')).toBe(true);
      expect(KNOWN_FUNCTIONS.has('isBoolean')).toBe(true);
      expect(KNOWN_FUNCTIONS.has('isNull')).toBe(true);
      expect(KNOWN_FUNCTIONS.has('isUndefined')).toBe(true);
      expect(KNOWN_FUNCTIONS.has('typeof')).toBe(true);

      // Pattern matching
      expect(KNOWN_FUNCTIONS.has('regex')).toBe(true);
      expect(KNOWN_FUNCTIONS.has('jsonmatch')).toBe(true);

      // Array
      expect(KNOWN_FUNCTIONS.has('filter')).toBe(true);
      expect(KNOWN_FUNCTIONS.has('map')).toBe(true);
      expect(KNOWN_FUNCTIONS.has('reduce')).toBe(true);
      expect(KNOWN_FUNCTIONS.has('find')).toBe(true);
      expect(KNOWN_FUNCTIONS.has('findIndex')).toBe(true);
      expect(KNOWN_FUNCTIONS.has('some')).toBe(true);
      expect(KNOWN_FUNCTIONS.has('every')).toBe(true);
      expect(KNOWN_FUNCTIONS.has('flat')).toBe(true);
      expect(KNOWN_FUNCTIONS.has('flatMap')).toBe(true);
      expect(KNOWN_FUNCTIONS.has('sort')).toBe(true);
      expect(KNOWN_FUNCTIONS.has('reverse')).toBe(true);
      expect(KNOWN_FUNCTIONS.has('concat')).toBe(true);
      expect(KNOWN_FUNCTIONS.has('length')).toBe(true);

      // Conversion
      expect(KNOWN_FUNCTIONS.has('Number')).toBe(true);
      expect(KNOWN_FUNCTIONS.has('String')).toBe(true);
      expect(KNOWN_FUNCTIONS.has('Boolean')).toBe(true);
      expect(KNOWN_FUNCTIONS.has('parseInt')).toBe(true);
      expect(KNOWN_FUNCTIONS.has('parseFloat')).toBe(true);

      // Object/Array utilities
      expect(KNOWN_FUNCTIONS.has('Array')).toBe(true);
      expect(KNOWN_FUNCTIONS.has('Object')).toBe(true);
      expect(KNOWN_FUNCTIONS.has('JSON')).toBe(true);
    });
  });

  describe('isKnownFunction', () => {
    it('should return true for known functions', () => {
      expect(isKnownFunction('date')).toBe(true);
      expect(isKnownFunction('uuid')).toBe(true);
      expect(isKnownFunction('json')).toBe(true);
      expect(isKnownFunction('lower')).toBe(true);
      expect(isKnownFunction('URLSearchParams')).toBe(true);
    });

    it('should return false for unknown functions', () => {
      expect(isKnownFunction('now')).toBe(false);
      expect(isKnownFunction('unknownFunc')).toBe(false);
      expect(isKnownFunction('myCustomFunction')).toBe(false);
      expect(isKnownFunction('')).toBe(false);
    });
  });

  describe('JS_KEYWORDS', () => {
    it('should be a Set', () => {
      expect(JS_KEYWORDS).toBeInstanceOf(Set);
    });

    it('should contain JavaScript literals and keywords', () => {
      // Literals
      expect(JS_KEYWORDS.has('true')).toBe(true);
      expect(JS_KEYWORDS.has('false')).toBe(true);
      expect(JS_KEYWORDS.has('null')).toBe(true);
      expect(JS_KEYWORDS.has('undefined')).toBe(true);
      expect(JS_KEYWORDS.has('NaN')).toBe(true);
      expect(JS_KEYWORDS.has('Infinity')).toBe(true);

      // Reserved words
      expect(JS_KEYWORDS.has('this')).toBe(true);
      expect(JS_KEYWORDS.has('new')).toBe(true);
      expect(JS_KEYWORDS.has('typeof')).toBe(true);
      expect(JS_KEYWORDS.has('instanceof')).toBe(true);
    });
  });

  describe('isJsKeyword', () => {
    it('should return true for JavaScript keywords', () => {
      expect(isJsKeyword('true')).toBe(true);
      expect(isJsKeyword('false')).toBe(true);
      expect(isJsKeyword('null')).toBe(true);
      expect(isJsKeyword('undefined')).toBe(true);
      expect(isJsKeyword('this')).toBe(true);
    });

    it('should return false for non-keywords', () => {
      expect(isJsKeyword('myVar')).toBe(false);
      expect(isJsKeyword('date')).toBe(false);
      expect(isJsKeyword('someIdentifier')).toBe(false);
      expect(isJsKeyword('')).toBe(false);
    });
  });
});
