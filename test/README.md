# Testing Documentation for Dshare

## Overview
This testing suite covers both blackbox and whitebox testing approaches for the Dshare file sharing application.

## Blackbox Testing
Blackbox testing validates the application from a user's perspective, focusing on functionality without knowledge of internal code.

### Key Areas Covered:
- **Device Discovery**: Network device detection and listing
- **File Handling**: File selection, validation, conversion, and download
- **File Transfer**: P2P file sending between devices
- **Message Delivery**: Real-time messaging functionality
- **Error Handling**: Graceful handling of invalid inputs and network issues
- **UI Responsiveness**: Cross-device and cross-browser compatibility

### Test Cases
See `blackbox-testing.md` for detailed test scenarios.

## Whitebox Testing
Whitebox testing examines internal code structures and logic.

### Key Areas Covered:
- **Utils Functions**: Core utility functions (file formatting, validation, etc.)
- **WebRTC**: Peer-to-peer connection management
- **WebSocket**: Server communication and signaling
- **Error Handling**: Exception scenarios and edge cases

### Test Files:
- `utils.test.js`: Unit tests for utility functions (6 tests)
- `error-handling.test.js`: Error scenario tests (4 tests)

## Test Coverage Summary
- **Blackbox**: 7 comprehensive user workflow tests in `blackbox-testing.md`
- **Whitebox**: 10 passing unit tests covering core utilities and error handling
- **Integration**: Tests for WebRTC and WebSocket interactions

This testing strategy ensures both user experience quality and code reliability.