import { Utils } from '../public/modules/utils.js';

// Mock DOM for tests
global.document = {
  createElement: () => ({
    textContent: '',
    innerHTML: ''
  })
};

// Whitebox Testing for Utils
describe('Utils', () => {
  test('generateDeviceName returns a string', () => {
    const name = Utils.generateDeviceName();
    expect(typeof name).toBe('string');
    expect(name.length).toBeGreaterThan(0);
  });

  test('formatFileSize formats bytes correctly', () => {
    expect(Utils.formatFileSize(1024)).toBe('1.00 KB');
    expect(Utils.formatFileSize(1024 * 1024)).toBe('1.00 MB');
    expect(Utils.formatFileSize(0)).toBe('0 Bytes');
  });

  test('getFileIcon returns appropriate icon', () => {
    expect(Utils.getFileIcon('pdf')).toBe('📕');
    expect(Utils.getFileIcon('txt')).toBe('📄');
    expect(Utils.getFileIcon('')).toBe('📎');
  });

  test('isConvertibleFile checks correctly', () => {
    expect(Utils.isConvertibleFile('test.docx')).toBe(true);
    expect(Utils.isConvertibleFile('test.pdf')).toBe(false);
    expect(Utils.isConvertibleFile('test.txt')).toBe(true);
  });

  test('getFileExtension extracts extension', () => {
    expect(Utils.getFileExtension('file.pdf')).toBe('pdf');
    expect(Utils.getFileExtension('file')).toBe('');
  });

  test('escapeHtml escapes HTML characters', () => {
    expect(Utils.escapeHtml('<script>')).toBe('&lt;script&gt;');
    expect(Utils.escapeHtml('normal')).toBe('normal');
  });
});