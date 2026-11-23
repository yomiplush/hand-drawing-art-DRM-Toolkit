//go:build !linux && !windows

package main

import (
	"fmt"
	"os/exec"
	"runtime"
)

func openBrowser(targetURL string) error {
	if runtime.GOOS == "darwin" {
		cmd := exec.Command("open", targetURL)
		if err := cmd.Start(); err != nil {
			return fmt.Errorf("open failed: %w", err)
		}
		go func() {
			_ = cmd.Wait()
		}()
		return nil
	}
	return fmt.Errorf("automatic browser launch unsupported on %s; open %s manually", runtime.GOOS, targetURL)
}
