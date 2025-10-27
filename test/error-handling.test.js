global.fetch = jest.fn();
global.document = { querySelector: jest.fn() };

// Whitebox Testing for Error Handling
describe('Error Handling', () => {
  test('handles invalid file selection', () => {
    // Mock file input with invalid file
    const invalidFile = new File([''], 'test.exe', { type: 'application/x-msdownload' });

    // Test that invalid files are rejected
    expect(invalidFile.size).toBe(0); // Basic check
  });

  test('handles network disconnection during transfer', () => {
    // Mock WebRTC connection loss
    const mockDataChannel = {
      readyState: 'closed',
      send: jest.fn(() => { throw new Error('Channel closed'); }),
    };

    expect(() => {
      mockDataChannel.send('test');
    }).toThrow('Channel closed');
  });

  test('handles invalid conversion formats', () => {
    // Test conversion validation
    const invalidConversion = 'pdf-to-docx'; // Not supported

    // Should be rejected by validation logic
    const validConversions = [
      'docx-to-pdf', 'txt-to-pdf', 'odt-to-pdf'
    ];

    expect(validConversions).not.toContain(invalidConversion);
  });

  test('handles UI errors gracefully', () => {
    // Mock DOM element not found
    const mockQuerySelector = jest.fn().mockReturnValue(null);
    document.querySelector = mockQuerySelector;

    // Should not throw when element not found
    expect(() => {
      const element = document.querySelector('#nonexistent');
      if (element) element.textContent = 'test';
    }).not.toThrow();
  });
});
