# Coder App - Your AI-Powered Coding Assistant

Coder App is a powerful and intuitive desktop application that acts as your personal AI coding assistant. It leverages Google's Gemini AI to generate complete, multi-file code projects in various programming languages based on simple, natural language prompts. Whether you're prototyping a new idea, learning a new technology, or just looking to accelerate your workflow, Coder App helps you go from idea to code faster than ever before.

![Coder App Screenshot](https://raw.githubusercontent.com/SamVolvo/Coder-App/main/assets/screenshot.png)

## Key Features

- **AI-Powered Code Generation**: Describe what you want to build, and let the AI generate the entire project structure and code.
- **Live File System Sync**: Works directly with folders on your computer. All changes—from the AI or you—are saved instantly to your local files.
- **Two-Way Syncing**: The app watches for external changes. Edit files in your favorite editor (like VS Code), and the app will update in real-time.
- **Interactive File Explorer**: Full drag-and-drop support, multi-select, and a context menu for creating, renaming, and deleting files and folders.
- **Live Code Previews**: Watch the AI write code character-by-character with a realistic typing animation and syntax highlighting.
- **Change Highlighting**: Instantly see what the AI has changed with visual indicators for new and modified files and lines.
- **AI Chat History**: Keep track of your entire conversation with the AI for each project.
- **Secure & Private**: Your API key and projects are stored locally on your machine and are never shared.

## Installation

Go to the [**Releases page**](https://github.com/SamVolvo/Coder-App/releases) on GitHub and download the appropriate installer for your operating system.

### Windows

1.  Download the `.exe` installer (e.g., `coder-app-x.x.x.exe`).
2.  Run the installer. You may see a Windows SmartScreen warning; click "More info" and then "Run anyway".
3.  Follow the on-screen instructions to complete the installation.

### macOS

1.  Download the `.dmg` file.
2.  Open the `.dmg` file.
3.  Drag the `Coder App` icon into your `Applications` folder.
4.  The first time you open the app, you may need to right-click the app icon and select "Open" due to Apple's security policies for apps from unidentified developers.

### Linux

There are several options for Linux users.

#### AppImage (Recommended)

This should work on most modern Linux distributions.
1.  Download the `.AppImage` file.
2.  Make it executable: `chmod +x coder-app-*.AppImage`
3.  Run it: `./coder-app-*.AppImage`

#### Debian/Ubuntu-based (`.deb`)

1.  Download the `.deb` file.
2.  Install it using your software center or via the terminal: `sudo dpkg -i coder-app-*.deb`
3.  Launch the app from your applications menu.

#### Fedora/Red Hat-based (`.rpm`)

1.  Download the `.rpm` file.
2.  Install it using your software center or via the terminal: `sudo rpm -i coder-app-*.rpm`
3.  Launch the app from your applications menu.

## Getting Started

1.  Launch Coder App after installing it.
2.  The "Settings" window will appear automatically if no API key is set. You can also open it at any time by clicking the gear icon in the header.
3.  Go to the [**Google AI Studio**](https://aistudio.google.com/app/apikey) to generate a free Gemini API key.
4.  Copy the key, paste it into the "Gemini API Key" field in the app's settings, and click "Save Settings".
5.  You're all set! Click "Open Project" in the header to select an empty or existing folder and start generating code.

## For Developers (Running Locally)

**Prerequisites:** [Node.js](https://nodejs.org/) (which includes npm).

1.  Clone the repository:
    ```bash
    git clone https://github.com/SamVolvo/Coder-App.git
    ```
2.  Navigate to the project directory:
    ```bash
    cd Coder-App
    ```
3.  Install dependencies:
    ```bash
    npm install
    ```
4.  Run the application in development mode:
    ```bash
    npm run dev
    ```
The application will launch with hot-reloading enabled. You will still need to set your Gemini API key via the in-app settings menu.
