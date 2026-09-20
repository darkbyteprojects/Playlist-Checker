# Playlist Checker

A local tool to fetch and inspect M3U / M3U8 playlists from a URL. It runs a small Node.js server on your PC and opens a web page in your browser.

## Installation

**Requirements:** Node.js 14+, curl, and a web browser. No `npm install` is needed.

**Jump to:** [Windows](#windows) | [macOS](#macos) | [Linux](#linux)

Put `app.js` and `index.html` together in one folder (Windows also uses `launch.vbs` and `stop.vbs`).

### Windows

1. Install Node.js LTS from <https://nodejs.org> (keep "Add to PATH" enabled). curl is already built in.
2. Check in Command Prompt: `node --version` and `curl.exe --version`.
3. **Start:** double-click `launch.vbs`. Your browser opens `http://localhost:8765`.
4. **Stop:** double-click `stop.vbs`.

### macOS

1. Install Node.js (curl is already included):

   ```bash
   brew install node
   ```

   Or download the installer from <https://nodejs.org>.
2. Check: `node --version` and `curl --version`.
3. **Start:**

   ```bash
   cd ~/playlist-checker
   node app.js
   ```

   Your browser opens `http://localhost:8765`.
4. **Stop:** press `Ctrl + C` in the Terminal window.

### Linux

1. Install Node.js and curl:

   ```bash
   # Ubuntu / Debian
   sudo apt update && sudo apt install -y curl nodejs

   # Fedora
   sudo dnf install -y curl nodejs

   # Arch
   sudo pacman -S curl nodejs
   ```

   If `node --version` shows lower than 14, install a newer LTS from <https://nodejs.org>.
2. Check: `node --version` and `curl --version`.
3. **Start:**

   ```bash
   cd ~/playlist-checker
   node app.js
   ```

   Your browser opens `http://localhost:8765`. If nothing opens, go to that address yourself.
4. **Stop:** press `Ctrl + C` in the terminal.

## Usage

1. Paste the playlist URL. Optionally add a token, User-Agent, or extra headers.
2. Turn on **Follow HTTP Redirects** if the link redirects.
3. Click **Run Fetch** (or press `Ctrl + Enter`).
4. Read the playlist in the payload panel. Click the channel badge to browse and search channels, and use **Save** or **Copy** to keep the playlist.
5. Use the trace panel at the bottom to see the full curl log.

**If the server blocks or redirects the request:** leave **Auto-detect User-Agent** on. The app tries common player agents and keeps the one that works.

**If the playlist is AES-encrypted:** open **AES Decrypt**, enter your key or passphrase, and fetch again (or click **Decrypt payload**).
