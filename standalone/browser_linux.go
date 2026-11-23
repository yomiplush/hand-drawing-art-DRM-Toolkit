//go:build linux

package main

import (
	"fmt"
	"os/exec"
)

func openBrowser(targetURL string) error {
	cmd := exec.Command("xdg-open", targetURL)
	if err := cmd.Start(); err != nil {
		return fmt.Errorf("xdg-open failed: %w", err)
	}
	// Reap child process asynchronously so it does not linger as a zombie.
	go func() {
		_ = cmd.Wait()
	}()
	return nil
}
