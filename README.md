# Playlist Checker

A small local tool to fetch and inspect M3U / M3U8 (IPTV) playlists. It runs a tiny Node.js server on your PC, opens a web UI in your browser, and uses `curl` so you can see the exact request, headers, redirects and playlist contents.

No `npm install` needed. There are no dependencies.

## Features

- One-click launch on Windows, macOS and Linux
- Full `curl -v` trace of every request
- Custom User-Agent with presets (OTT Navigator, TiviMate, VLC, ExoPlayer)
- Follow-redirects toggle, token/query field, custom headers
- **Auto User-Agent:** if a server redirects, blocks, or hides the playlist, the app retries with common player agents and keeps the one that works
- **AES decrypt:** decrypts encrypted playlists with your own key (CBC, ECB, CTR, GCM, OpenSSL/CryptoJS)
- Smart paste: `URL[tag]|User-Agent=...&Cache-Control=...` fills the fields for you
- Smart diagnostics for redirects, Telegram landing pages and bad responses
- Channel directory with search, playlist filter, copy, and save as `playlist.m3u`
- Light and dark theme; remembers your inputs (`Ctrl + Enter` to fetch)

## Requirements

- **Node.js 14+**
- **curl**
- A modern web browser
- Windows 10/11, macOS, or Linux

**Jump to your install steps:** [Windows](#windows) | [macOS](#macos) | [Linux](#linux)

## Setup

Put these files together in one folder first:

```
playlist-checker/
├── app.js        # server (serves the UI and runs curl)
├── index.html    # web interface
├── launch.vbs    # Windows: start
├── stop.vbs      # Windows: stop
├── launch.sh     # macOS / Linux: start
├── stop.sh       # macOS / Linux: stop
└── README.md
```

### Windows

1. Install Node.js LTS from <https://nodejs.org> (keep "Add to PATH" enabled). curl is already built into Windows 10 (1803+) and Windows 11.
2. Check in Command Prompt: `node --version` and `curl.exe --version`.
3. **Start:** double-click `launch.vbs`. Your browser opens `http://localhost:8765`.
4. **Stop:** double-click `stop.vbs`.

If Windows blocks a `.vbs` file: right-click it > Properties > **Unblock**.

### macOS

1. Install [Homebrew](https://brew.sh) if you do not have it, then in Terminal run:

   ```bash
   brew install node
   ```

   (Or download the macOS installer from <https://nodejs.org>.) curl is already included with macOS.
2. Check: `node --version` and `curl --version`.
3. In Terminal, go to the project folder and make the scripts runnable (one time only):

   ```bash
   cd ~/playlist-checker
   chmod +x launch.sh stop.sh
   ```

4. **Start:** `./launch.sh` (or `./launch.sh -b` to run in the background). Your browser opens `http://localhost:8765`.
5. **Stop:** press `Ctrl + C`, or run `./stop.sh` if you used `-b`.

If macOS says the script cannot be opened, run it from Terminal as shown above.

### Linux

1. Install Node.js and curl for your distro:

   ```bash
   # Ubuntu / Debian
   sudo apt update && sudo apt install -y curl nodejs

   # Fedora
   sudo dnf install -y curl nodejs

   # Arch
   sudo pacman -S curl nodejs
   ```

   Some distros ship an old Node.js. If `node --version` shows lower than 14, install a newer LTS from <https://nodejs.org> or with [nvm](https://github.com/nvm-sh/nvm).
2. Check: `node --version` and `curl --version`.
3. Go to the project folder and make the scripts runnable (one time only):

   ```bash
   cd ~/playlist-checker
   chmod +x launch.sh stop.sh
   ```

4. **Start:** `./launch.sh` (or `./launch.sh -b` to run in the background). The browser opens through `xdg-open`; on a server or if nothing opens, browse to `http://localhost:8765` yourself.
5. **Stop:** press `Ctrl + C`, or run `./stop.sh` if you used `-b`.

### Any system (terminal)

`node app.js` works everywhere and shows errors in the terminal.

## Usage

1. Paste the playlist URL. Optionally add a token, User-Agent, or headers.
2. Turn on **Follow HTTP Redirects** if the link redirects.
3. Click **Run Fetch** (or press `Ctrl + Enter`).
4. Check the payload, click the channel badge to browse channels, and use the trace panel for the full curl log.

## Locked or Encrypted Playlists

Some servers only return the playlist to a known player, or return it AES-encrypted.

- **Wrong User-Agent / redirect to a landing page:** leave **Auto-detect User-Agent** on. If the first request fails, the app tries several player agents and saves the working one in the User-Agent field.
- **Encrypted (Base64/hex) response:** open **AES Decrypt**, enter the key or passphrase from your provider, and fetch again (or press **Decrypt payload**). Leave Format and Mode on **Auto** unless you know them; set the IV only if it is not stored at the start of the data.

The app cannot guess a missing key, and it does not include keys for any third-party app.

## Configuration

Change the port by editing `const PORT = 8765;` at the top of `app.js`, then restart the app.

## Troubleshooting

| Problem | Fix |
|---|---|
| Nothing happens on launch | Make sure Node.js is installed (`node --version`), or run `node app.js` to see the error |
| `Permission denied` on macOS / Linux | Run `chmod +x launch.sh stop.sh` once |
| `node: command not found` on Linux | Install Node.js (see [Linux](#linux)) and open a new terminal |
| Page won't load | Port 8765 may be in use; change `PORT` in `app.js` |
| curl not found | Install curl and add it to your PATH |
| Got an HTML page instead of a playlist | Try the **OTT Nav** User-Agent and/or enable redirects |
| Status shows `ENCRYPTED` | Enter the correct key in **AES Decrypt**. A wrong key, mode or IV cannot be decrypted |

## Privacy and Security

- Everything runs locally. The server accepts connections from your own PC only, and only `http://` / `https://` URLs.
- Playlist URLs often contain private tokens. Your last inputs are saved in your browser, so remove tokens before sharing screenshots or traces (the **Reset** button clears them).

## Disclaimer

This is a generic viewer for M3U/M3U8 text files. It does not host, provide, or stream any content and does not decrypt protected data. You are responsible for the sources you use and for following your provider's terms and your local laws.

## License

MIT License. Copyright (c) 2026 YOUR NAME

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
