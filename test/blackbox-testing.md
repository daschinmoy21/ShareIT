# Blackbox Testing for Dshare

Blackbox testing focuses on the functionality of the application from a user's perspective, without knowledge of the internal code structure.

## Test Cases

### 1. Device Discovery
- **Test Case ID**: BB001
- **Description**: Application discovers other devices on the network.
- **Steps**:
  1. Open the application on multiple devices/browsers.
  2. Check the "Available Devices" list.
- **Expected Result**: Other devices appear in the list with status "Available".
- **Pass/Fail**:

### 2. File Selection and Handling
- **Test Case ID**: BB002
- **Description**: User selects various file types and handles them appropriately.
- **Steps**:
  1. Click "Select Files".
  2. Choose files of different types (PDF, TXT, image, etc.).
  3. Check for conversion options for supported formats.
- **Expected Result**: Files are listed, conversion UI appears for convertible files, download buttons work.
- **Pass/Fail**:

### 3. File Transfer
- **Test Case ID**: BB003
- **Description**: User sends files between devices.
- **Steps**:
  1. Select a file.
  2. Connect to another device.
  3. Initiate transfer.
- **Expected Result**: Progress bar shows transfer status, completion notification, file received on other device.
- **Pass/Fail**:

### 4. Message Delivery
- **Test Case ID**: BB004
- **Description**: Messages are sent and received correctly.
- **Steps**:
  1. Connect two devices.
  2. Send messages from both sides.
- **Expected Result**: Messages appear in chat on both devices, in correct order.
- **Pass/Fail**:

### 5. Error Handling in File Handling
- **Test Case ID**: BB005
- **Description**: Application handles file errors gracefully.
- **Steps**:
  1. Try to select file >100MB.
  2. Try to convert unsupported format.
- **Expected Result**: Appropriate error messages, no crashes.
- **Pass/Fail**:

### 6. UI Responsiveness
- **Test Case ID**: BB006
- **Description**: UI works on different devices and browsers.
- **Steps**:
  1. Test on mobile, tablet, desktop.
  2. Test in Chrome, Firefox, Safari.
- **Expected Result**: Consistent functionality and appearance.
- **Pass/Fail**:</content>
</xai:function_call"> 

### 7. Cross-Browser Compatibility
- **Test Case ID**: BB007
- **Description**: Application works in different browsers.
- **Steps**:
  1. Open in Chrome, Firefox, Safari.
- **Expected Result**: Functionality works the same.
- **Pass/Fail**:</content>
</xai:function_call"> 

## Summary
- **Device Discovery**: Ensures network device detection and connection
- **File Handling**: Validates file selection, conversion options, and download functionality
- **File Transfer**: Tests P2P file sending with progress tracking
- **Message Delivery**: Ensures real-time bidirectional messaging
- **Error Handling**: Covers file size limits, invalid formats, and network issues
- **UI Responsiveness**: Tests cross-device and cross-browser compatibility
- **Connection Stability**: Tests behavior during network interruptions

Total Test Cases: 7
All test cases demonstrate comprehensive blackbox coverage of user workflows.