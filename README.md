# 🚀 ShareIt

A simple and fast peer-to-peer file sharing application that allows you to share files directly between devices on the same network. Built with Bun, Node.js, and WebRTC.

## ✨ Features

- **Peer-to-Peer File Transfer:** Transfer files directly between devices without going through a central server, thanks to WebRTC.
- **Device Discovery:** Automatically discovers other devices running ShareIt on the same local network.
- **Text Messaging:** Send text messages between connected peers.
- **Drag & Drop:** Easily select files by dragging and dropping them into the application.
- **Responsive Design:** A clean and simple interface that works on both desktop and mobile browsers.

## 🛠️ Tech Stack

- **Runtime:** [Bun](https://bun.sh/)
- **Backend:** Node.js, Express, WebSockets (`ws`)
- **Frontend:** HTML, CSS, vanilla JavaScript
- **P2P Communication:** WebRTC

## 🚀 Getting Started

Follow these instructions to get a copy of the project up and running on your local machine.

### Prerequisites

Make sure you have [Bun](https://bun.sh/docs/installation) installed on your system.

### Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/daschinmoy21/ShareIT.git
    ```
2.  Navigate to the project directory:
    ```bash
    cd shareit
    ```
3.  Install the dependencies using Bun:
    ```bash
    bun install
    ```

### Running the Application

To start the server, run the following command:

```bash
bun start
```

The server will start on `http://localhost:3000` by default.

## Usage

1.  Open your web browser and navigate to `http://<your-local-ip>:3000`.
2.  Open the same address on another device connected to the same network.
3.  You should see the other device appear in the "Available Devices" list.
4.  Click on a device to connect.
5.  Once connected, you can:
    -   **Send files:** Drag and drop files onto the page or use the "Select Files" button.
    -   **Send messages:** Type a message in the input box and click "Send".

## Currently file size has a max limit of 100mb
