Certified Handmade — Offline Standalone Edition
================================================

Your Art. Your Rights. Your Freedom.
100% Free & Open Source (MIT License) · Local-First · Offline-First · Zero Telemetry

What This Is
------------
Certified Handmade Standalone bundles the complete Certified Handmade web application
inside a self-contained native executable serving exclusively over loopback:

  http://127.0.0.1:43777/

No Node.js, Go, internet access, account, cloud database, or external API is required,
even on first launch.

Usage (Linux x86_64)
--------------------
1. Make sure the executable bit is set:
     chmod +x certified-handmade-linux-amd64
2. Run it:
     ./certified-handmade-linux-amd64
3. Your default browser opens http://127.0.0.1:43777/ automatically.
4. Keep the terminal window open while signing/verifying; press Ctrl+C when finished.

Usage (Windows x86_64)
----------------------
1. Double-click certified-handmade-windows-amd64.exe (or run it in PowerShell / cmd.exe).
2. Your default browser opens http://127.0.0.1:43777/ automatically.
3. Keep the console window open while signing/verifying; press Ctrl+C or close it when finished.

Usage (macOS Apple Silicon / Intel)
-----------------------------------
1. Extract the .tar.gz archive (darwin-arm64 for Apple Silicon, darwin-amd64 for Intel).
2. Make sure the executable bit is set (and clear Gatekeeper quarantine if downloaded via browser):
     chmod +x certified-handmade-darwin-arm64
     xattr -d com.apple.quarantine certified-handmade-darwin-arm64 2>/dev/null || true
3. Run it:
     ./certified-handmade-darwin-arm64
4. Your default browser opens http://127.0.0.1:43777/ automatically.
5. Keep the Terminal window open while signing/verifying; press Ctrl+C when finished.

Key Storage & Migration Warning
-------------------------------
Browser IndexedDB storage is scoped strictly by origin. Keys created on:
  - https://www.certified-handmade.com/
  - http://127.0.0.1:43777/
are stored SEPARATELY by your browser.

To move keys safely between the online/PWA edition and Standalone Edition (or another PC):
1. Generate keys with a strong passphrase and download the encrypted .chkey.json backup.
2. Restore that .chkey.json file under Identity / Keys in the destination instance.

Port Conflict Behavior
----------------------
By design, Standalone refuses to silently switch away from port 43777 if another unrelated
application occupies it, because switching origins would hide your existing IndexedDB keys.
If another Certified Handmade Standalone instance is already running on 127.0.0.1:43777,
launching again reuses it cleanly.

CLI Flags
---------
  --no-browser     Start the loopback server without auto-opening a browser window
  --open-path=/..  Open a specific initial route (e.g. /verify or /create)
  --port=43777     Override port (uses a different browser storage origin — for testing only)
  --version        Print version and architecture details
