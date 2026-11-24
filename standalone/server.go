package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"net"
	"net/http"
	"path"
	"strconv"
	"strings"
)

const (
	DefaultHost   = "127.0.0.1"
	DefaultPort   = 43777
	HealthPath    = "/__chm_health"
	AppIdentifier = "certified-handmade-standalone"
)

const cspPolicy = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self'; connect-src 'self' wss: https:; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"

type HealthPayload struct {
	App     string `json:"app"`
	Status  string `json:"status"`
	Version string `json:"version"`
}

// IsAllowedHost validates that the HTTP Host header matches strictly
// loopback (127.0.0.1:<port> or localhost:<port>) to block DNS rebinding.
func IsAllowedHost(hostHeader string, expectedPort int) bool {
	trimmed := strings.TrimSpace(hostHeader)
	if trimmed == "" || strings.ContainsAny(trimmed, "/\\@\t\r\n ") {
		return false
	}

	host, portStr, err := net.SplitHostPort(trimmed)
	if err != nil {
		// Permit portless host header only if running on standard port 80
		if expectedPort == 80 {
			lower := strings.ToLower(trimmed)
			return lower == "127.0.0.1" || lower == "localhost"
		}
		return false
	}

	if portStr != strconv.Itoa(expectedPort) {
		return false
	}

	lowerHost := strings.ToLower(host)
	return lowerHost == "127.0.0.1" || lowerHost == "localhost"
}

// IsSafeURLPath blocks null bytes, backslashes, and encoded or raw parent-directory traversal.
func IsSafeURLPath(urlPath string, requestURI string) bool {
	reqPath := requestURI
	if idx := strings.IndexByte(reqPath, '?'); idx >= 0 {
		reqPath = reqPath[:idx]
	}

	for _, candidate := range []string{urlPath, reqPath} {
		if candidate == "" {
			continue
		}
		lower := strings.ToLower(candidate)
		if strings.ContainsRune(candidate, '\x00') ||
			strings.ContainsRune(candidate, '\\') ||
			strings.Contains(lower, "%00") ||
			strings.Contains(lower, "%5c") ||
			strings.Contains(lower, "%2e%2e") ||
			strings.Contains(lower, ".%2e") ||
			strings.Contains(lower, "%2e.") {
			return false
		}
		for _, seg := range strings.Split(candidate, "/") {
			if seg == ".." {
				return false
			}
		}
	}
	return true
}

// MimeTypeForPath maps static web extensions explicitly so minimal OS environments
// without /etc/mime.types never misclassify JS modules, CSS, SVG, or manifests.
func MimeTypeForPath(p string) string {
	switch strings.ToLower(path.Ext(p)) {
	case ".html", ".htm":
		return "text/html; charset=utf-8"
	case ".js", ".mjs":
		return "application/javascript; charset=utf-8"
	case ".css":
		return "text/css; charset=utf-8"
	case ".svg":
		return "image/svg+xml"
	case ".png":
		return "image/png"
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".webp":
		return "image/webp"
	case ".ico":
		return "image/x-icon"
	case ".json":
		return "application/json; charset=utf-8"
	case ".webmanifest":
		return "application/manifest+json; charset=utf-8"
	case ".wasm":
		return "application/wasm"
	case ".txt":
		return "text/plain; charset=utf-8"
	case ".xml":
		return "application/xml; charset=utf-8"
	default:
		return "application/octet-stream"
	}
}

func WriteSecurityHeaders(w http.ResponseWriter) {
	h := w.Header()
	h.Set("X-Content-Type-Options", "nosniff")
	h.Set("X-Frame-Options", "DENY")
	h.Set("Referrer-Policy", "no-referrer")
	h.Set("Permissions-Policy", "camera=(self), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()")
	h.Set("Cross-Origin-Opener-Policy", "same-origin")
	h.Set("Cross-Origin-Resource-Policy", "same-origin")
	h.Set("Content-Security-Policy", cspPolicy)
}

func cacheControlForAsset(cleanPath string) string {
	if cleanPath == "" ||
		cleanPath == "index.html" ||
		cleanPath == "sw.js" ||
		cleanPath == "sw.mjs" ||
		cleanPath == "manifest.webmanifest" ||
		strings.HasSuffix(cleanPath, ".html") {
		return "no-store"
	}
	if strings.HasPrefix(cleanPath, "assets/") {
		return "public, max-age=31536000, immutable"
	}
	return "no-cache"
}

// NewHandler creates the hardened loopback-only HTTP handler serving embedded Vite assets.
func NewHandler(webFS fs.FS, expectedPort int, version string) http.Handler {
	if version == "" {
		version = "dev"
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		WriteSecurityHeaders(w)

		if !IsAllowedHost(r.Host, expectedPort) {
			http.Error(w, "Forbidden: invalid Host header for loopback origin", http.StatusForbidden)
			return
		}

		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			w.Header().Set("Allow", "GET, HEAD")
			http.Error(w, "Method Not Allowed: standalone server is strictly read-only", http.StatusMethodNotAllowed)
			return
		}

		if !IsSafeURLPath(r.URL.Path, r.RequestURI) {
			http.Error(w, "Bad Request: unsafe path", http.StatusBadRequest)
			return
		}

		if r.URL.Path == HealthPath {
			payload, err := json.Marshal(HealthPayload{
				App:     AppIdentifier,
				Status:  "ok",
				Version: version,
			})
			if err != nil {
				http.Error(w, "Internal Server Error", http.StatusInternalServerError)
				return
			}
			w.Header().Set("Content-Type", "application/json; charset=utf-8")
			w.Header().Set("Cache-Control", "no-store")
			w.Header().Set("Content-Length", strconv.Itoa(len(payload)))
			w.WriteHeader(http.StatusOK)
			if r.Method != http.MethodHead {
				_, _ = w.Write(payload)
			}
			return
		}

		cleaned := path.Clean("/" + r.URL.Path)
		relPath := strings.TrimPrefix(cleaned, "/")
		if relPath == "" {
			relPath = "index.html"
		}

		targetPath := relPath
		if info, err := fs.Stat(webFS, targetPath); err != nil || info.IsDir() {
			// Missing file with an explicit asset extension -> 404 rather than serving HTML as JS/CSS
			if path.Ext(relPath) != "" && !strings.HasSuffix(strings.ToLower(relPath), ".html") {
				http.Error(w, "Not Found", http.StatusNotFound)
				return
			}
			// SPA fallback to index.html (mirrors Cloudflare Pages _redirects)
			targetPath = "index.html"
		}

		data, err := fs.ReadFile(webFS, targetPath)
		if err != nil {
			if errors.Is(err, fs.ErrNotExist) {
				http.Error(w, "Not Found", http.StatusNotFound)
				return
			}
			http.Error(w, fmt.Sprintf("Failed to read embedded asset: %v", err), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", MimeTypeForPath(targetPath))
		w.Header().Set("Cache-Control", cacheControlForAsset(targetPath))
		w.Header().Set("Content-Length", strconv.Itoa(len(data)))
		w.WriteHeader(http.StatusOK)
		if r.Method != http.MethodHead {
			_, _ = w.Write(data)
		}
	})
}
