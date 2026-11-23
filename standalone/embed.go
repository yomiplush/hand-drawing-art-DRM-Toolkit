package main

import (
	"embed"
	"io/fs"
)

//go:embed all:webdist
var embeddedWebDist embed.FS

func loadEmbeddedWebFS() (fs.FS, error) {
	return fs.Sub(embeddedWebDist, "webdist")
}
