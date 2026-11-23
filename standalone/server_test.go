package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"testing/fstest"
	"time"
)

func testWebFS() fstest.MapFS {
	return fstest.MapFS{
		"index.html":            {Data: []byte("<!doctype html><html><body>SPA Root</body></html>")},
		"sw.js":                 {Data: []byte("console.log('sw');")},
		"manifest.webmanifest":  {Data: []byte(`{"name":"Certified Handmade"}`)},
		"favicon.svg":           {Data: []byte(`<svg xmlns="http://www.w3.org/2000/svg"></svg>`)},
		"pwa-192x192.png":       {Data: []byte{0x89, 0x50, 0x4e, 0x47}},
		"assets/app-abc123.js":  {Data: []byte("export const chm = 1;")},
		"assets/app-abc123.css": {Data: []byte("body{color:#fff}")},
	}
}

func TestIsAllowedHost(t *testing.T) {
	valid := []string{
		"127.0.0.1:43777",
		"localhost:43777",
		"LOCALHOST:43777",
	}
	for _, host := range valid {
		if !IsAllowedHost(host, 43777) {
			t.Errorf("expected Host %q to be allowed on port 43777", host)
		}
	}

	invalid := []string{
		"",
		"127.0.0.1",
		"localhost",
		"127.0.0.1:8080",
		"evil.com:43777",
		"localhost.evil.com:43777",
		"127.0.0.1:43777@evil.com",
		"0.0.0.0:43777",
		"[::1]:43777",
		"127.0.0.1:43777/path",
	}
	for _, host := range invalid {
		if IsAllowedHost(host, 43777) {
			t.Errorf("expected Host %q to be rejected (DNS rebinding protection)", host)
		}
	}
}

func TestHandlerSecurityHeadersAndDNSRebinding(t *testing.T) {
	h := NewHandler(testWebFS(), 43777, "test-1.0.0")

	// Reject DNS rebinding Host
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Host = "attacker.example:43777"
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("expected 403 for untrusted Host, got %d", rec.Code)
	}

	// Reject state-changing HTTP methods
	for _, method := range []string{http.MethodPost, http.MethodPut, http.MethodDelete, http.MethodPatch, http.MethodOptions} {
		req = httptest.NewRequest(method, "/", nil)
		req.Host = "127.0.0.1:43777"
		rec = httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		if rec.Code != http.StatusMethodNotAllowed {
			t.Fatalf("expected 405 for %s, got %d", method, rec.Code)
		}
		if rec.Header().Get("Allow") != "GET, HEAD" {
			t.Fatalf("expected Allow: GET, HEAD for %s, got %q", method, rec.Header().Get("Allow"))
		}
	}

	// Reject path traversal & null bytes
	for _, badURI := range []string{
		"/../etc/passwd",
		"/%2e%2e/etc/passwd",
		"/assets/%2e%2e/secret.js",
		`/assets\secret.js`,
		"/index%00.html",
	} {
		req = httptest.NewRequest(http.MethodGet, "http://127.0.0.1:43777/", nil)
		req.Host = "127.0.0.1:43777"
		req.URL.Path = badURI
		req.RequestURI = badURI
		rec = httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		if rec.Code != http.StatusBadRequest {
			t.Fatalf("expected 400 for unsafe URI %q, got %d", badURI, rec.Code)
		}
	}

	// Verify strict security headers on root response
	req = httptest.NewRequest(http.MethodGet, "/", nil)
	req.Host = "127.0.0.1:43777"
	rec = httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 for /, got %d", rec.Code)
	}
	if rec.Header().Get("X-Frame-Options") != "DENY" {
		t.Errorf("missing X-Frame-Options: DENY")
	}
	if rec.Header().Get("X-Content-Type-Options") != "nosniff" {
		t.Errorf("missing X-Content-Type-Options: nosniff")
	}
	if rec.Header().Get("Referrer-Policy") != "no-referrer" {
		t.Errorf("missing Referrer-Policy: no-referrer")
	}
	csp := rec.Header().Get("Content-Security-Policy")
	if !strings.Contains(csp, "connect-src 'self'") || !strings.Contains(csp, "script-src 'self'") {
		t.Errorf("unexpected CSP: %q", csp)
	}
}

func TestMimeTypesCachingAndSpaFallback(t *testing.T) {
	h := NewHandler(testWebFS(), 43777, "test-1.0.0")

	cases := []struct {
		path          string
		wantCode      int
		wantMime      string
		wantCachePart string
		wantBodyPart  string
	}{
		{"/", 200, "text/html; charset=utf-8", "no-store", "SPA Root"},
		{"/create", 200, "text/html; charset=utf-8", "no-store", "SPA Root"},
		{"/verify", 200, "text/html; charset=utf-8", "no-store", "SPA Root"},
		{"/keys", 200, "text/html; charset=utf-8", "no-store", "SPA Root"},
		{"/sw.js", 200, "application/javascript; charset=utf-8", "no-store", "console.log"},
		{"/manifest.webmanifest", 200, "application/manifest+json; charset=utf-8", "no-store", "Certified Handmade"},
		{"/assets/app-abc123.js", 200, "application/javascript; charset=utf-8", "immutable", "export const"},
		{"/assets/app-abc123.css", 200, "text/css; charset=utf-8", "immutable", "color:#fff"},
		{"/favicon.svg", 200, "image/svg+xml", "no-cache", "<svg"},
		{"/pwa-192x192.png", 200, "image/png", "no-cache", "PNG"},
		{"/assets/missing-chunk.js", 404, "text/plain", "", "Not Found"},
	}

	for _, tc := range cases {
		req := httptest.NewRequest(http.MethodGet, tc.path, nil)
		req.Host = "127.0.0.1:43777"
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)

		if rec.Code != tc.wantCode {
			t.Errorf("GET %s status = %d, want %d", tc.path, rec.Code, tc.wantCode)
			continue
		}
		if ct := rec.Header().Get("Content-Type"); !strings.Contains(ct, tc.wantMime) {
			t.Errorf("GET %s Content-Type = %q, want %q", tc.path, ct, tc.wantMime)
		}
		if tc.wantCachePart != "" {
			if cc := rec.Header().Get("Cache-Control"); !strings.Contains(cc, tc.wantCachePart) {
				t.Errorf("GET %s Cache-Control = %q, want %q", tc.path, cc, tc.wantCachePart)
			}
		}
		if !strings.Contains(rec.Body.String(), tc.wantBodyPart) {
			t.Errorf("GET %s body %q missing %q", tc.path, rec.Body.String(), tc.wantBodyPart)
		}
	}

	// HEAD returns headers cleanly with empty body
	req := httptest.NewRequest(http.MethodHead, "/assets/app-abc123.js", nil)
	req.Host = "127.0.0.1:43777"
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK || rec.Body.Len() != 0 {
		t.Errorf("HEAD expected 200 + empty body, got %d len=%d", rec.Code, rec.Body.Len())
	}

	// Health endpoint returns CHM app identifier
	req = httptest.NewRequest(http.MethodGet, HealthPath, nil)
	req.Host = "127.0.0.1:43777"
	rec = httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	var hp HealthPayload
	if err := json.Unmarshal(rec.Body.Bytes(), &hp); err != nil {
		t.Fatalf("failed to decode health payload: %v", err)
	}
	if hp.App != AppIdentifier || hp.Status != "ok" {
		t.Fatalf("unexpected health payload: %+v", hp)
	}
}

func TestPortConflictNeverSilentlyChangesOrigin(t *testing.T) {
	// Start an unrelated dummy server on an ephemeral loopback port
	dummyLn, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen dummy: %v", err)
	}
	defer dummyLn.Close()
	busyPort := dummyLn.Addr().(*net.TCPAddr).Port

	dummySrv := &http.Server{
		Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
			_, _ = io.WriteString(w, "not-certified-handmade")
		}),
	}
	go func() {
		_ = dummySrv.Serve(dummyLn)
	}()
	defer dummySrv.Close()

	var stdout, stderr bytes.Buffer
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	err = runStandalone(ctx, Options{
		Port:      busyPort,
		NoBrowser: true,
		WebFS:     testWebFS(),
		Stdout:    &stdout,
		Stderr:    &stderr,
	})
	if !errors.Is(err, errPortConflict) {
		t.Fatalf("expected errPortConflict when another app owns port %d, got: %v", busyPort, err)
	}
}

func TestExistingStandaloneInstanceDetection(t *testing.T) {
	// Reserve an ephemeral port, then release and launch runStandalone on it
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("ephemeral listen: %v", err)
	}
	port := ln.Addr().(*net.TCPAddr).Port
	_ = ln.Close()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	var stdout, stderr bytes.Buffer
	doneCh := make(chan error, 1)
	go func() {
		doneCh <- runStandalone(ctx, Options{
			Port:      port,
			NoBrowser: true,
			WebFS:     testWebFS(),
			Stdout:    &stdout,
			Stderr:    &stderr,
		})
	}()

	// Wait until /__chm_health responds
	deadline := time.Now().Add(3 * time.Second)
	healthy := false
	for time.Now().Before(deadline) {
		if ok, _ := probeExistingInstance(port); ok {
			healthy = true
			break
		}
		time.Sleep(25 * time.Millisecond)
	}
	if !healthy {
		t.Fatalf("standalone server did not become healthy on port %d", port)
	}

	// Launching a second instance on the same port detects the existing CHM server and exits 0 cleanly
	var secondOut bytes.Buffer
	if err := runStandalone(context.Background(), Options{
		Port:      port,
		NoBrowser: true,
		WebFS:     testWebFS(),
		Stdout:    &secondOut,
		Stderr:    &stderr,
	}); err != nil {
		t.Fatalf("expected second instance on same CHM port to return nil, got: %v", err)
	}
	if !strings.Contains(secondOut.String(), fmt.Sprintf("already running at http://127.0.0.1:%d/", port)) {
		t.Errorf("unexpected second instance output: %q", secondOut.String())
	}

	cancel()
	if err := <-doneCh; err != nil {
		t.Fatalf("primary standalone shutdown error: %v", err)
	}
}
