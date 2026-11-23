package main

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"io/fs"
	"net"
	"net/http"
	"os"
	"os/signal"
	"runtime"
	"strings"
	"syscall"
	"time"
)

// appVersion is overridden at release build time via -ldflags "-X main.appVersion=...".
var appVersion = "1.0.0-standalone"

var errPortConflict = errors.New("port already in use by another application")

type Options struct {
	Port      int
	NoBrowser bool
	OpenPath  string
	WebFS     fs.FS
	Stdout    io.Writer
	Stderr    io.Writer
}

func validateOpenPath(raw string) string {
	if raw == "" || !strings.HasPrefix(raw, "/") || strings.HasPrefix(raw, "//") {
		return "/"
	}
	if strings.ContainsAny(raw, "\r\n\x00\\") {
		return "/"
	}
	return raw
}

func probeExistingInstance(port int) (bool, HealthPayload) {
	var payload HealthPayload
	client := &http.Client{
		Timeout: 1200 * time.Millisecond,
		Transport: &http.Transport{
			Proxy: nil,
		},
	}
	healthURL := fmt.Sprintf("http://%s:%d%s", DefaultHost, port, HealthPath)
	req, err := http.NewRequest(http.MethodGet, healthURL, nil)
	if err != nil {
		return false, payload
	}
	resp, err := client.Do(req)
	if err != nil {
		return false, payload
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return false, payload
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, 4096))
	if err != nil {
		return false, payload
	}
	if err := json.Unmarshal(body, &payload); err != nil {
		return false, payload
	}
	if payload.App != AppIdentifier {
		return false, payload
	}
	return true, payload
}

func runStandalone(ctx context.Context, opts Options) error {
	if opts.Stdout == nil {
		opts.Stdout = os.Stdout
	}
	if opts.Stderr == nil {
		opts.Stderr = os.Stderr
	}
	if opts.Port < 1 || opts.Port > 65535 {
		return fmt.Errorf("invalid port %d: must be between 1 and 65535", opts.Port)
	}

	addr := fmt.Sprintf("%s:%d", DefaultHost, opts.Port)
	targetURL := fmt.Sprintf("http://%s%s", addr, validateOpenPath(opts.OpenPath))

	listener, err := net.Listen("tcp", addr)
	if err != nil {
		if ok, health := probeExistingInstance(opts.Port); ok {
			fmt.Fprintf(
				opts.Stdout,
				"Certified Handmade Standalone (%s) is already running at http://%s/\n",
				health.Version,
				addr,
			)
			if !opts.NoBrowser {
				if bErr := openBrowser(targetURL); bErr != nil {
					fmt.Fprintf(opts.Stderr, "Note: could not open browser automatically (%v)\n", bErr)
					fmt.Fprintf(opts.Stdout, "Open manually: %s\n", targetURL)
				}
			}
			return nil
		}

		return fmt.Errorf(
			"%w (%s): %v.\n"+
				"Certified Handmade refuses to silently switch ports because browser IndexedDB keys\n"+
				"and locally trusted artist keys are scoped to the http://%s origin.\n"+
				"Close the conflicting process on port %d, or back up/restore keys via .chkey.json.",
			errPortConflict,
			addr,
			err,
			addr,
			opts.Port,
		)
	}
	defer listener.Close()

	handler := NewHandler(opts.WebFS, opts.Port, appVersion)
	srv := &http.Server{
		Handler:           handler,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
		MaxHeaderBytes:    64 << 10,
	}

	fmt.Fprintf(opts.Stdout, "Certified Handmade Standalone (%s)\n", appVersion)
	fmt.Fprintf(opts.Stdout, "Local URL : %s\n", targetURL)
	fmt.Fprintf(opts.Stdout, "Security  : Loopback-only (%s), zero external requests, zero telemetry\n", addr)
	fmt.Fprintf(opts.Stdout, "Storage   : Keys stored in browser IndexedDB under http://%s\n", addr)
	fmt.Fprintf(opts.Stdout, "            Use encrypted .chkey.json backups to transfer keys between Web & Standalone.\n")
	fmt.Fprintf(opts.Stdout, "Stop      : Press Ctrl+C to shut down cleanly.\n")

	errCh := make(chan error, 1)
	go func() {
		if sErr := srv.Serve(listener); sErr != nil && !errors.Is(sErr, http.ErrServerClosed) {
			errCh <- sErr
		}
		close(errCh)
	}()

	if !opts.NoBrowser {
		go func() {
			time.Sleep(150 * time.Millisecond)
			if bErr := openBrowser(targetURL); bErr != nil {
				fmt.Fprintf(opts.Stderr, "Note: could not open browser automatically (%v)\n", bErr)
				fmt.Fprintf(opts.Stdout, "Please open %s in your browser.\n", targetURL)
			}
		}()
	}

	select {
	case sErr := <-errCh:
		if sErr != nil {
			return sErr
		}
		return nil
	case <-ctx.Done():
		fmt.Fprintln(opts.Stdout, "\nShutting down Certified Handmade Standalone...")
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()
		return srv.Shutdown(shutdownCtx)
	}
}

func waitBeforeExitOnWindowsError() {
	if runtime.GOOS != "windows" {
		return
	}
	fi, err := os.Stdin.Stat()
	if err != nil || (fi.Mode()&os.ModeCharDevice) == 0 {
		return
	}
	fmt.Fprint(os.Stderr, "\nPress Enter to exit...")
	_, _ = bufio.NewReader(os.Stdin).ReadString('\n')
}

func main() {
	portFlag := flag.Int("port", DefaultPort, "Loopback TCP port (fixed to keep browser IndexedDB origin stable)")
	noBrowserFlag := flag.Bool("no-browser", false, "Start local HTTP server without launching a browser window")
	openPathFlag := flag.String("open-path", "/", "Initial application path to open (e.g. / or /verify)")
	versionFlag := flag.Bool("version", false, "Print version information and exit")
	flag.Parse()

	if *versionFlag {
		fmt.Printf("certified-handmade-standalone %s (%s/%s)\n", appVersion, runtime.GOOS, runtime.GOARCH)
		return
	}

	webFS, err := loadEmbeddedWebFS()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to initialize embedded assets: %v\n", err)
		waitBeforeExitOnWindowsError()
		os.Exit(1)
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	if err := runStandalone(ctx, Options{
		Port:      *portFlag,
		NoBrowser: *noBrowserFlag,
		OpenPath:  *openPathFlag,
		WebFS:     webFS,
		Stdout:    os.Stdout,
		Stderr:    os.Stderr,
	}); err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		waitBeforeExitOnWindowsError()
		os.Exit(1)
	}
}
