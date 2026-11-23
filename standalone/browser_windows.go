//go:build windows

package main

import (
	"fmt"
	"os/exec"
)

func openBrowser(targetURL string) error {
	cmd := exec.Command("rundll32", "url.dll,FileProtocolHandler", targetURL)
	if err := cmd.Start(); err != nil {
		return fmt.Errorf("rundll32 browser launch failed: %w", err)
	}
	go func() {
		_ = cmd.Wait()
	}()
	return nil
}
