package main

import (
	"bytes"
	"crypto/ed25519"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"image"
	"image/color"
	"image/png"
	"io"
	"net/url"
	"os"
	"strings"
	"time"
	"unicode/utf8"
)

const (
	MaxProofBytes      = 2048
	MaxNoticeBytes     = 2048
	MaxInputChars      = 32768
	MaxOutputDimension = 10240
	MaxTotalPixels     = 33554432
	MaxPngFileBytes    = 50 * 1024 * 1024
)

var (
	domainProofPrefix  = []byte{'C', 'H', 'M', '1', 0x00}
	domainNoticePrefix = []byte{'C', 'H', 'M', '-', 'N', 'O', 'T', 'I', 'C', 'E', '1', 0x00}
)

var licenseNames = map[uint64]string{
	0: "ARR",
	1: "CC0-1.0",
	2: "CC-BY-4.0",
	3: "CC-BY-SA-4.0",
	4: "CC-BY-NC-4.0",
	5: "CC-BY-NC-SA-4.0",
	6: "CC-BY-ND-4.0",
	7: "CC-BY-NC-ND-4.0",
}

var policyNames = map[uint64]string{
	0: "unspecified",
	1: "allow",
	2: "disallow",
}

var noticeTypeNames = map[uint64]string{
	1: "revocation",
	2: "rotation",
}

var noticeReasonNames = map[uint64]string{
	1: "key-compromise",
	2: "key-superseded",
	3: "retired",
	4: "other",
}

type errUsage struct{ msg string }

func (e errUsage) Error() string { return e.msg }

type errUnsupported struct{ msg string }

func (e errUnsupported) Error() string { return e.msg }

type cborMapEntry struct {
	key    any
	rawKey []byte
	value  any
}

type cborDecoder struct {
	data []byte
	pos  int
}

func (d *cborDecoder) readByte() (byte, error) {
	if d.pos >= len(d.data) {
		return 0, errors.New("unexpected end of CBOR data")
	}
	b := d.data[d.pos]
	d.pos++
	return b, nil
}

func (d *cborDecoder) readBytes(n int) ([]byte, error) {
	if n < 0 || d.pos+n > len(d.data) {
		return nil, errors.New("unexpected end of CBOR bytes")
	}
	out := d.data[d.pos : d.pos+n]
	d.pos += n
	return out, nil
}

func (d *cborDecoder) readUintArg(ai byte) (uint64, error) {
	switch {
	case ai < 24:
		return uint64(ai), nil
	case ai == 24:
		b, err := d.readByte()
		if err != nil {
			return 0, err
		}
		if b < 24 {
			return 0, errors.New("non-canonical CBOR 1-byte uint")
		}
		return uint64(b), nil
	case ai == 25:
		bs, err := d.readBytes(2)
		if err != nil {
			return 0, err
		}
		v := binary.BigEndian.Uint16(bs)
		if v < 256 {
			return 0, errors.New("non-canonical CBOR 2-byte uint")
		}
		return uint64(v), nil
	case ai == 26:
		bs, err := d.readBytes(4)
		if err != nil {
			return 0, err
		}
		v := binary.BigEndian.Uint32(bs)
		if v < 65536 {
			return 0, errors.New("non-canonical CBOR 4-byte uint")
		}
		return uint64(v), nil
	case ai == 27:
		bs, err := d.readBytes(8)
		if err != nil {
			return 0, err
		}
		v := binary.BigEndian.Uint64(bs)
		if v <= 0xffffffff {
			return 0, errors.New("non-canonical CBOR 8-byte uint")
		}
		return v, nil
	case ai == 31:
		return 0, errors.New("indefinite-length CBOR items are disallowed")
	default:
		return 0, fmt.Errorf("reserved CBOR additional info %d", ai)
	}
}

func compareCanonicalCborKeys(a, b []byte) int {
	if len(a) != len(b) {
		if len(a) < len(b) {
			return -1
		}
		return 1
	}
	return bytes.Compare(a, b)
}

func (d *cborDecoder) decodeValue(depth int) (any, error) {
	if depth > 8 {
		return nil, errors.New("CBOR nesting depth limit exceeded")
	}
	ib, err := d.readByte()
	if err != nil {
		return nil, err
	}
	major := ib >> 5
	ai := ib & 0x1f

	switch major {
	case 0:
		val, err := d.readUintArg(ai)
		if err != nil {
			return nil, err
		}
		return val, nil
	case 1:
		return nil, errors.New("negative integers are not supported in canonical schema")
	case 2:
		n, err := d.readUintArg(ai)
		if err != nil {
			return nil, err
		}
		if n > uint64(len(d.data)-d.pos) {
			return nil, errors.New("CBOR byte string length exceeds remaining input")
		}
		bs, err := d.readBytes(int(n))
		if err != nil {
			return nil, err
		}
		cp := make([]byte, len(bs))
		copy(cp, bs)
		return cp, nil
	case 3:
		n, err := d.readUintArg(ai)
		if err != nil {
			return nil, err
		}
		if n > uint64(len(d.data)-d.pos) {
			return nil, errors.New("CBOR text string length exceeds remaining input")
		}
		bs, err := d.readBytes(int(n))
		if err != nil {
			return nil, err
		}
		if !utf8.Valid(bs) {
			return nil, errors.New("invalid UTF-8 in CBOR text string")
		}
		return string(bs), nil
	case 4:
		n, err := d.readUintArg(ai)
		if err != nil {
			return nil, err
		}
		if n > 64 {
			return nil, errors.New("CBOR array length exceeds schema bound")
		}
		arr := make([]any, 0, int(n))
		for i := 0; i < int(n); i++ {
			v, err := d.decodeValue(depth + 1)
			if err != nil {
				return nil, err
			}
			arr = append(arr, v)
		}
		return arr, nil
	case 5:
		n, err := d.readUintArg(ai)
		if err != nil {
			return nil, err
		}
		if n > 64 {
			return nil, errors.New("CBOR map size exceeds schema bound")
		}
		entries := make([]cborMapEntry, 0, int(n))
		var prevRawKey []byte
		for i := 0; i < int(n); i++ {
			keyStart := d.pos
			k, err := d.decodeValue(depth + 1)
			if err != nil {
				return nil, err
			}
			rawKey := d.data[keyStart:d.pos]
			if i > 0 {
				cmp := compareCanonicalCborKeys(prevRawKey, rawKey)
				if cmp == 0 {
					return nil, errors.New("duplicate CBOR map key")
				}
				if cmp > 0 {
					return nil, errors.New("CBOR map keys are not canonically sorted (RFC 8949)")
				}
			}
			prevRawKey = rawKey
			v, err := d.decodeValue(depth + 1)
			if err != nil {
				return nil, err
			}
			entries = append(entries, cborMapEntry{key: k, rawKey: rawKey, value: v})
		}
		return entries, nil
	default:
		return nil, fmt.Errorf("disallowed CBOR major type %d", major)
	}
}

func decodeCanonicalCBOR(raw []byte) (any, error) {
	d := &cborDecoder{data: raw, pos: 0}
	v, err := d.decodeValue(0)
	if err != nil {
		return nil, err
	}
	if d.pos != len(raw) {
		return nil, errors.New("trailing bytes after CBOR item")
	}
	return v, nil
}

func decodeStrictBase64Url(token string) ([]byte, error) {
	if token == "" {
		return nil, errors.New("empty base64url token")
	}
	for i := 0; i < len(token); i++ {
		c := token[i]
		if !((c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '-' || c == '_') {
			return nil, errors.New("token contains non-base64url characters")
		}
	}
	decoded, err := base64.RawURLEncoding.Strict().DecodeString(token)
	if err != nil {
		return nil, fmt.Errorf("invalid base64url encoding: %w", err)
	}
	if base64.RawURLEncoding.EncodeToString(decoded) != token {
		return nil, errors.New("non-canonical base64url padding bits")
	}
	return decoded, nil
}

func computeFingerprint(pub32 []byte) (string, string) {
	sum := sha256.Sum256(pub32)
	fullHex := hex.EncodeToString(sum[:])
	upper := strings.ToUpper(fullHex[:16])
	short := fmt.Sprintf("CHM-%s-%s-%s-%s", upper[0:4], upper[4:8], upper[8:12], upper[12:16])
	return fullHex, short
}

func formatUUID(b []byte) string {
	h := hex.EncodeToString(b)
	return fmt.Sprintf("%s-%s-%s-%s-%s", h[0:8], h[8:12], h[12:16], h[16:20], h[20:32])
}

func sanitizeTextValid(s string, maxBytes int) error {
	trimmed := strings.TrimSpace(s)
	if trimmed == "" {
		return errors.New("text field cannot be empty or whitespace-only when present")
	}
	if trimmed != s {
		return errors.New("text field contains un-trimmed whitespace (non-canonical)")
	}
	if len(s) > maxBytes {
		return fmt.Errorf("text field exceeds %d UTF-8 bytes", maxBytes)
	}
	for i := 0; i < len(s); i++ {
		if s[i] < 0x20 || s[i] == 0x7f {
			return errors.New("text field contains disallowed control characters")
		}
	}
	return nil
}

type ProofSummary struct {
	ProtocolVersion           uint64   `json:"protocolVersion"`
	SignatureValid            bool     `json:"signatureValid"`
	IntegrityStatus           string   `json:"integrityStatus"`
	MatchedMode               string   `json:"matchedMode,omitempty"`
	ArtworkID                 string   `json:"artworkId"`
	PublicKeyFingerprintHex   string   `json:"publicKeyFingerprintHex"`
	PublicKeyFingerprintShort string   `json:"publicKeyFingerprintShort"`
	DeclaredSha256Hex         string   `json:"declaredSha256Hex"`
	ComputedSha256Hex         string   `json:"computedSha256Hex,omitempty"`
	Region                    [4]int   `json:"region"`
	QrMask                    *[4]int  `json:"qrMask,omitempty"`
	QrMaskCoveragePct         *float64 `json:"qrMaskCoveragePct,omitempty"`
	IssuedAtUnix              uint64   `json:"issuedAtUnix"`
	IssuedAtISO               string   `json:"issuedAtIso"`
	License                   string   `json:"license"`
	CommercialUse             string   `json:"commercialUse"`
	Redistribution            string   `json:"redistribution"`
	AiTraining                string   `json:"aiTraining"`
	AttributionName           string   `json:"attributionName,omitempty"`
	AuthorName                string   `json:"authorName,omitempty"`
	ArtworkTitle              string   `json:"artworkTitle,omitempty"`
	Errors                    []string `json:"errors,omitempty"`
}

func extractProofBytes(rawInput string) ([]byte, error) {
	trimmed := strings.TrimSpace(rawInput)
	if trimmed == "" || len(trimmed) > MaxInputChars {
		return nil, errors.New("proof input is empty or exceeds maximum length")
	}

	var token string
	if strings.HasPrefix(trimmed, "{") {
		var bundle struct {
			Format         string `json:"format"`
			Version        int    `json:"version"`
			ProofBase64Url string `json:"proofBase64Url"`
		}
		if err := json.Unmarshal([]byte(trimmed), &bundle); err != nil {
			return nil, fmt.Errorf("malformed proof bundle JSON: %w", err)
		}
		if bundle.Format != "certified-handmade-proof-bundle" || bundle.Version != 1 {
			return nil, errors.New("unsupported proof bundle format or version")
		}
		token = bundle.ProofBase64Url
	} else if idx := strings.IndexByte(trimmed, '#'); idx >= 0 {
		q, err := url.ParseQuery(trimmed[idx+1:])
		if err != nil {
			return nil, errors.New("malformed proof fragment query")
		}
		token = q.Get("proof")
	} else if idx := strings.Index(trimmed, "?proof="); idx >= 0 {
		q, err := url.ParseQuery(trimmed[idx+1:])
		if err != nil {
			return nil, errors.New("malformed proof URL query")
		}
		token = q.Get("proof")
	} else if strings.Contains(trimmed, "%23proof%3D") || strings.Contains(trimmed, "%23proof=") {
		unescaped, err := url.PathUnescape(trimmed)
		if err != nil {
			return nil, errors.New("malformed percent-encoded URL")
		}
		if hashIdx := strings.IndexByte(unescaped, '#'); hashIdx >= 0 {
			q, err := url.ParseQuery(unescaped[hashIdx+1:])
			if err != nil {
				return nil, errors.New("malformed proof fragment")
			}
			token = q.Get("proof")
		}
	} else if strings.HasPrefix(trimmed, "proof=") {
		q, err := url.ParseQuery(trimmed)
		if err != nil {
			return nil, errors.New("malformed proof query")
		}
		token = q.Get("proof")
	} else {
		token = trimmed
	}

	if token == "" {
		return nil, errors.New("missing proof token")
	}
	proofBytes, err := decodeStrictBase64Url(token)
	if err != nil {
		return nil, err
	}
	if len(proofBytes) == 0 || len(proofBytes) > MaxProofBytes {
		return nil, fmt.Errorf("proof bytes out of bounds (%d)", len(proofBytes))
	}
	return proofBytes, nil
}

func parseUintSlice4(val any, label string) ([4]int, error) {
	var out [4]int
	arr, ok := val.([]any)
	if !ok || len(arr) != 4 {
		return out, fmt.Errorf("%s must be a 4-element integer array", label)
	}
	for i := 0; i < 4; i++ {
		u, ok := arr[i].(uint64)
		if !ok || u > MaxOutputDimension {
			return out, fmt.Errorf("%s element out of range", label)
		}
		out[i] = int(u)
	}
	if out[2] < 1 || out[3] < 1 || out[0]+out[2] > MaxOutputDimension || out[1]+out[3] > MaxOutputDimension {
		return out, fmt.Errorf("%s exceeds valid image bounds", label)
	}
	return out, nil
}

func verifyProof(proofInput string, artworkPath string) (ProofSummary, error) {
	var summary ProofSummary
	summary.IntegrityStatus = "not-checked"

	proofBytes, err := extractProofBytes(proofInput)
	if err != nil {
		return summary, err
	}
	outerRaw, err := decodeCanonicalCBOR(proofBytes)
	if err != nil {
		return summary, fmt.Errorf("invalid proof envelope CBOR: %w", err)
	}
	outer, ok := outerRaw.([]any)
	if !ok || len(outer) != 3 {
		return summary, errors.New("proof envelope must be a 3-element CBOR array")
	}
	ver, ok := outer[0].(uint64)
	if !ok {
		return summary, errors.New("proof version must be an unsigned integer")
	}
	if ver != 1 && ver != 2 {
		return summary, errUnsupported{msg: fmt.Sprintf("unsupported protocol version: %d", ver)}
	}
	payloadBytes, ok := outer[1].([]byte)
	if !ok || len(payloadBytes) == 0 {
		return summary, errors.New("manifest payload must be a non-empty byte string")
	}
	sig, ok := outer[2].([]byte)
	if !ok || len(sig) != ed25519.SignatureSize {
		return summary, errors.New("signature must be a 64-byte byte string")
	}

	payloadRaw, err := decodeCanonicalCBOR(payloadBytes)
	if err != nil {
		return summary, fmt.Errorf("invalid manifest payload CBOR: %w", err)
	}
	entries, ok := payloadRaw.([]cborMapEntry)
	if !ok {
		return summary, errors.New("manifest payload must be a CBOR map")
	}

	fields := make(map[uint64]any, len(entries))
	for _, e := range entries {
		k, ok := e.key.(uint64)
		if !ok || k < 1 || k > 9 || (ver == 1 && k == 9) {
			return summary, fmt.Errorf("invalid or disallowed manifest field key: %v", e.key)
		}
		fields[k] = e.value
	}

	artworkID, ok := fields[1].([]byte)
	if !ok || len(artworkID) != 16 {
		return summary, errors.New("artworkId must be 16 bytes")
	}
	pubKey, ok := fields[2].([]byte)
	if !ok || len(pubKey) != ed25519.PublicKeySize {
		return summary, errors.New("publicKey must be 32 bytes")
	}
	shaBytes, ok := fields[3].([]byte)
	if !ok || len(shaBytes) != 32 {
		return summary, errors.New("sha256 must be 32 bytes")
	}
	region, err := parseUintSlice4(fields[4], "region")
	if err != nil {
		return summary, err
	}
	issuedAt, ok := fields[5].(uint64)
	if !ok {
		return summary, errors.New("issuedAt must be an unsigned integer")
	}

	licArr, ok := fields[6].([]any)
	if !ok || (len(licArr) != 4 && len(licArr) != 5) {
		return summary, errors.New("license must be a 4 or 5-element array")
	}
	licCode, ok1 := licArr[0].(uint64)
	commCode, ok2 := licArr[1].(uint64)
	redCode, ok3 := licArr[2].(uint64)
	aiCode, ok4 := licArr[3].(uint64)
	licName, lok := licenseNames[licCode]
	commName, cok := policyNames[commCode]
	redName, rok := policyNames[redCode]
	aiName, aok := policyNames[aiCode]
	if !ok1 || !ok2 || !ok3 || !ok4 || !lok || !cok || !rok || !aok {
		return summary, errors.New("invalid license or policy code")
	}

	var attrib string
	if len(licArr) == 5 {
		s, ok := licArr[4].(string)
		if !ok {
			return summary, errors.New("attributionName must be a string")
		}
		if err := sanitizeTextValid(s, 48); err != nil {
			return summary, fmt.Errorf("attributionName: %w", err)
		}
		attrib = s
	}

	var authorName string
	if rawAuthor, exists := fields[7]; exists {
		s, ok := rawAuthor.(string)
		if !ok {
			return summary, errors.New("authorName must be a string")
		}
		if err := sanitizeTextValid(s, 48); err != nil {
			return summary, fmt.Errorf("authorName: %w", err)
		}
		authorName = s
	}

	var artworkTitle string
	if rawTitle, exists := fields[8]; exists {
		s, ok := rawTitle.(string)
		if !ok {
			return summary, errors.New("artworkTitle must be a string")
		}
		if err := sanitizeTextValid(s, 64); err != nil {
			return summary, fmt.Errorf("artworkTitle: %w", err)
		}
		artworkTitle = s
	}

	var qrMask *[4]int
	if rawMask, exists := fields[9]; exists {
		m, err := parseUintSlice4(rawMask, "qrMask")
		if err != nil {
			return summary, err
		}
		if m[2] < 21 || m[3] < 21 {
			return summary, errors.New("qrMask dimensions must be at least 21x21")
		}
		if m[0]+m[2] > region[2] || m[1]+m[3] > region[3] {
			return summary, errors.New("qrMask exceeds region bounds")
		}
		qrMask = &m
		cov := float64(m[2]*m[3]) / float64(region[2]*region[3]) * 100.0
		covRounded := float64(int(cov*10+0.5)) / 10.0
		summary.QrMaskCoveragePct = &covRounded
	}

	signingMsg := make([]byte, len(domainProofPrefix)+len(payloadBytes))
	copy(signingMsg, domainProofPrefix)
	copy(signingMsg[len(domainProofPrefix):], payloadBytes)
	sigValid := ed25519.Verify(ed25519.PublicKey(pubKey), signingMsg, sig)

	fpHex, fpShort := computeFingerprint(pubKey)
	summary.ProtocolVersion = ver
	summary.SignatureValid = sigValid
	summary.ArtworkID = formatUUID(artworkID)
	summary.PublicKeyFingerprintHex = fpHex
	summary.PublicKeyFingerprintShort = fpShort
	summary.DeclaredSha256Hex = hex.EncodeToString(shaBytes)
	summary.Region = region
	summary.QrMask = qrMask
	summary.IssuedAtUnix = issuedAt
	summary.IssuedAtISO = time.Unix(int64(issuedAt), 0).UTC().Format(time.RFC3339)
	summary.License = licName
	summary.CommercialUse = commName
	summary.Redistribution = redName
	summary.AiTraining = aiName
	summary.AttributionName = attrib
	summary.AuthorName = authorName
	summary.ArtworkTitle = artworkTitle

	if !sigValid {
		summary.Errors = append(summary.Errors, "Ed25519 signature verification failed")
	}

	if artworkPath != "" {
		computed, mode, err := computeArtworkSha256(artworkPath, region, qrMask)
		if err != nil {
			summary.IntegrityStatus = "mismatched"
			summary.Errors = append(summary.Errors, err.Error())
		} else {
			summary.ComputedSha256Hex = hex.EncodeToString(computed)
			summary.MatchedMode = mode
			if subtle.ConstantTimeCompare(computed, shaBytes) == 1 {
				summary.IntegrityStatus = "matched"
			} else {
				summary.IntegrityStatus = "mismatched"
				summary.Errors = append(summary.Errors, "artwork SHA-256 digest does not match signed manifest")
			}
		}
	}

	return summary, nil
}

func decodePngToCanonicalRGBA8(pngBytes []byte) (int, int, []byte, error) {
	if len(pngBytes) > MaxPngFileBytes {
		return 0, 0, nil, fmt.Errorf("PNG file exceeds %d byte limit", MaxPngFileBytes)
	}
	cfg, err := png.DecodeConfig(bytes.NewReader(pngBytes))
	if err != nil {
		return 0, 0, nil, fmt.Errorf("invalid PNG header: %w", err)
	}
	if cfg.Width < 1 || cfg.Height < 1 || cfg.Width > MaxOutputDimension || cfg.Height > MaxOutputDimension {
		return 0, 0, nil, fmt.Errorf("PNG dimensions %dx%d exceed allowed bounds", cfg.Width, cfg.Height)
	}
	if cfg.Width*cfg.Height > MaxTotalPixels {
		return 0, 0, nil, fmt.Errorf("PNG total pixels exceed %d limit", MaxTotalPixels)
	}
	img, err := png.Decode(bytes.NewReader(pngBytes))
	if err != nil {
		return 0, 0, nil, fmt.Errorf("failed to decode PNG pixels: %w", err)
	}

	b := img.Bounds()
	w, h := b.Dx(), b.Dy()
	rgba := make([]byte, w*h*4)

	switch src := img.(type) {
	case *image.NRGBA:
		for y := 0; y < h; y++ {
			off := src.PixOffset(b.Min.X, b.Min.Y+y)
			copy(rgba[y*w*4:(y+1)*w*4], src.Pix[off:off+w*4])
		}
	case *image.RGBA:
		for y := 0; y < h; y++ {
			for x := 0; x < w; x++ {
				off := src.PixOffset(b.Min.X+x, b.Min.Y+y)
				r, g, bl, a := src.Pix[off], src.Pix[off+1], src.Pix[off+2], src.Pix[off+3]
				dst := (y*w + x) * 4
				if a == 0 || a == 255 {
					rgba[dst], rgba[dst+1], rgba[dst+2], rgba[dst+3] = r, g, bl, a
				} else {
					rgba[dst] = uint8((uint32(r) * 255) / uint32(a))
					rgba[dst+1] = uint8((uint32(g) * 255) / uint32(a))
					rgba[dst+2] = uint8((uint32(bl) * 255) / uint32(a))
					rgba[dst+3] = a
				}
			}
		}
	default:
		for y := 0; y < h; y++ {
			for x := 0; x < w; x++ {
				c := color.NRGBAModel.Convert(img.At(b.Min.X+x, b.Min.Y+y)).(color.NRGBA)
				dst := (y*w + x) * 4
				rgba[dst], rgba[dst+1], rgba[dst+2], rgba[dst+3] = c.R, c.G, c.B, c.A
			}
		}
	}
	return w, h, rgba, nil
}

func computeArtworkSha256(artworkPath string, region [4]int, qrMask *[4]int) ([]byte, string, error) {
	f, err := os.Open(artworkPath)
	if err != nil {
		return nil, "", errUsage{msg: fmt.Sprintf("failed to open artwork %s: %v", artworkPath, err)}
	}
	defer f.Close()
	raw, err := io.ReadAll(io.LimitReader(f, MaxPngFileBytes+1))
	if err != nil {
		return nil, "", errUsage{msg: fmt.Sprintf("failed to read artwork %s: %v", artworkPath, err)}
	}
	w, h, rgba, err := decodePngToCanonicalRGBA8(raw)
	if err != nil {
		return nil, "", err
	}

	rx, ry, rw, rh := region[0], region[1], region[2], region[3]
	extractRegion := func(ox, oy, ow, oh int) []byte {
		if ox == 0 && oy == 0 && ow == w && oh == h {
			cp := make([]byte, len(rgba))
			copy(cp, rgba)
			return cp
		}
		out := make([]byte, ow*oh*4)
		for row := 0; row < oh; row++ {
			srcOff := ((oy+row)*w + ox) * 4
			dstOff := row * ow * 4
			copy(out[dstOff:dstOff+ow*4], rgba[srcOff:srcOff+ow*4])
		}
		return out
	}

	if qrMask != nil {
		matchesExactSize := w == rw && h == rh
		fitsRegion := rx+rw <= w && ry+rh <= h
		if !matchesExactSize && !fitsRegion {
			return nil, "", fmt.Errorf("image dimensions (%dx%d) smaller than declared region", w, h)
		}
		var target []byte
		if matchesExactSize {
			target = extractRegion(0, 0, rw, rh)
		} else {
			target = extractRegion(rx, ry, rw, rh)
		}
		mx, my, mw, mh := qrMask[0], qrMask[1], qrMask[2], qrMask[3]
		stride := rw * 4
		for row := 0; row < mh; row++ {
			start := (my+row)*stride + mx*4
			clear(target[start : start+mw*4])
		}
		sum := sha256.Sum256(target)
		return sum[:], "in-image-masked", nil
	}

	if w == rw && h == rh {
		sum := sha256.Sum256(rgba)
		return sum[:], "full-artwork", nil
	}
	if rx+rw <= w && ry+rh <= h {
		regBytes := extractRegion(rx, ry, rw, rh)
		sum := sha256.Sum256(regBytes)
		return sum[:], "embedded-region", nil
	}
	return nil, "", fmt.Errorf("image dimensions (%dx%d) smaller than declared region", w, h)
}

type NoticeSummary struct {
	Valid                     bool     `json:"valid"`
	NoticeID                  string   `json:"noticeId"`
	NoticeType                string   `json:"noticeType"`
	Reason                    string   `json:"reason"`
	SubjectFingerprintHex     string   `json:"subjectFingerprintHex"`
	SubjectFingerprintShort   string   `json:"subjectFingerprintShort"`
	ReplacementFingerprintHex string   `json:"replacementFingerprintHex,omitempty"`
	ReplacementFpShort        string   `json:"replacementFingerprintShort,omitempty"`
	NoticeIssuedAtUnix        uint64   `json:"noticeIssuedAtUnix"`
	NoticeIssuedAtISO         string   `json:"noticeIssuedAtIso"`
	VerifiedAtUnix            int64    `json:"verifiedAtUnix"`
	Note                      string   `json:"note,omitempty"`
	Errors                    []string `json:"errors,omitempty"`
}

func verifyNotice(rawInput string) (NoticeSummary, error) {
	var res NoticeSummary
	res.VerifiedAtUnix = time.Now().Unix()

	trimmed := strings.TrimSpace(rawInput)
	if trimmed == "" || len(trimmed) > MaxInputChars {
		return res, errors.New("key notice input is empty or exceeds size limit")
	}
	token := trimmed
	if strings.HasPrefix(trimmed, "{") {
		var bundle struct {
			Format          string `json:"format"`
			Version         int    `json:"version"`
			NoticeBase64Url string `json:"noticeBase64Url"`
			Token           string `json:"token"`
		}
		if err := json.Unmarshal([]byte(trimmed), &bundle); err != nil {
			return res, fmt.Errorf("malformed key notice JSON: %w", err)
		}
		if bundle.Format != "certified-handmade-key-notice" || bundle.Version != 1 {
			return res, errors.New("unsupported key notice bundle format or version")
		}
		if bundle.NoticeBase64Url != "" {
			token = bundle.NoticeBase64Url
		} else {
			token = bundle.Token
		}
	}
	token = strings.TrimPrefix(token, "chm-notice:")
	noticeBytes, err := decodeStrictBase64Url(token)
	if err != nil {
		return res, err
	}
	if len(noticeBytes) == 0 || len(noticeBytes) > MaxNoticeBytes {
		return res, errors.New("key notice bytes out of bounds")
	}

	outerRaw, err := decodeCanonicalCBOR(noticeBytes)
	if err != nil {
		return res, err
	}
	outer, ok := outerRaw.([]any)
	if !ok || (len(outer) != 3 && len(outer) != 4) {
		return res, errors.New("key notice envelope must be a 3 or 4-element CBOR array")
	}
	ver, ok := outer[0].(uint64)
	if !ok || ver != 1 {
		return res, errors.New("unsupported key notice version")
	}
	payloadBytes, ok := outer[1].([]byte)
	if !ok || len(payloadBytes) == 0 {
		return res, errors.New("key notice payload must be non-empty bytes")
	}
	subjSig, ok := outer[2].([]byte)
	if !ok || len(subjSig) != ed25519.SignatureSize {
		return res, errors.New("subjectSignature must be 64 bytes")
	}

	payloadRaw, err := decodeCanonicalCBOR(payloadBytes)
	if err != nil {
		return res, err
	}
	entries, ok := payloadRaw.([]cborMapEntry)
	if !ok {
		return res, errors.New("key notice payload must be a CBOR map")
	}
	fields := make(map[uint64]any, len(entries))
	for _, e := range entries {
		k, ok := e.key.(uint64)
		if !ok || k < 1 || k > 7 {
			return res, fmt.Errorf("unknown notice payload key: %v", e.key)
		}
		fields[k] = e.value
	}

	noticeID, ok := fields[1].([]byte)
	if !ok || len(noticeID) != 16 {
		return res, errors.New("noticeId must be 16 bytes")
	}
	typeCode, ok := fields[2].(uint64)
	noticeType, tok := noticeTypeNames[typeCode]
	if !ok || !tok {
		return res, errors.New("unknown noticeType code")
	}
	subjPub, ok := fields[3].([]byte)
	if !ok || len(subjPub) != ed25519.PublicKeySize {
		return res, errors.New("subjectPublicKey must be 32 bytes")
	}
	issuedAt, ok := fields[5].(uint64)
	if !ok {
		return res, errors.New("noticeIssuedAt must be an unsigned integer")
	}
	reasonCode, ok := fields[6].(uint64)
	reasonName, rok := noticeReasonNames[reasonCode]
	if !ok || !rok {
		return res, errors.New("unknown notice reason code")
	}
	var note string
	if rawNote, exists := fields[7]; exists {
		s, ok := rawNote.(string)
		if !ok {
			return res, errors.New("notice note must be a string")
		}
		if err := sanitizeTextValid(s, 160); err != nil {
			return res, err
		}
		note = s
	}

	var replPub []byte
	var replSig []byte
	if noticeType == "rotation" {
		if len(outer) != 4 {
			return res, errors.New("rotation notice requires replacementSignature")
		}
		replSig, ok = outer[3].([]byte)
		if !ok || len(replSig) != ed25519.SignatureSize {
			return res, errors.New("replacementSignature must be 64 bytes")
		}
		replPub, ok = fields[4].([]byte)
		if !ok || len(replPub) != ed25519.PublicKeySize {
			return res, errors.New("rotation notice requires 32-byte replacementPublicKey")
		}
		if bytes.Equal(subjPub, replPub) {
			return res, errors.New("replacementPublicKey must differ from subjectPublicKey")
		}
	} else {
		if len(outer) != 3 {
			return res, errors.New("revocation notice must not carry replacementSignature")
		}
		if _, has := fields[4]; has {
			return res, errors.New("revocation notice must not carry replacementPublicKey")
		}
	}

	signingMsg := make([]byte, len(domainNoticePrefix)+len(payloadBytes))
	copy(signingMsg, domainNoticePrefix)
	copy(signingMsg[len(domainNoticePrefix):], payloadBytes)

	subjOk := ed25519.Verify(ed25519.PublicKey(subjPub), signingMsg, subjSig)
	if !subjOk {
		res.Errors = append(res.Errors, "subject key signature verification failed")
	}
	if noticeType == "rotation" {
		if !ed25519.Verify(ed25519.PublicKey(replPub), signingMsg, replSig) {
			res.Errors = append(res.Errors, "replacement key signature verification failed")
		}
	}

	sHex, sShort := computeFingerprint(subjPub)
	res.Valid = len(res.Errors) == 0
	res.NoticeID = formatUUID(noticeID)
	res.NoticeType = noticeType
	res.Reason = reasonName
	res.SubjectFingerprintHex = sHex
	res.SubjectFingerprintShort = sShort
	res.NoticeIssuedAtUnix = issuedAt
	res.NoticeIssuedAtISO = time.Unix(int64(issuedAt), 0).UTC().Format(time.RFC3339)
	res.Note = note
	if len(replPub) == 32 {
		rHex, rShort := computeFingerprint(replPub)
		res.ReplacementFingerprintHex = rHex
		res.ReplacementFpShort = rShort
	}
	return res, nil
}

func readInputOrFile(arg string) (string, error) {
	if _, err := os.Stat(arg); err == nil {
		bs, err := os.ReadFile(arg)
		if err != nil {
			return "", errUsage{msg: fmt.Sprintf("failed to read file %s: %v", arg, err)}
		}
		return string(bs), nil
	}
	return arg, nil
}

func run(args []string, stdout, stderr io.Writer) int {
	fs := flag.NewFlagSet("chm-verify", flag.ContinueOnError)
	fs.SetOutput(stderr)
	proofFlag := fs.String("proof", "", "Verification URL, #proof= token, or .chproof.json file path")
	artworkFlag := fs.String("artwork", "", "Optional lossless PNG artwork path to verify pixel SHA-256")
	noticeFlag := fs.String("notice", "", "Optional chm-notice: token or .chnotice.json file path")
	jsonFlag := fs.Bool("json", false, "Emit machine-readable JSON output")

	if err := fs.Parse(args); err != nil {
		return 2
	}

	proofInput := *proofFlag
	noticeInput := *noticeFlag
	if proofInput == "" && noticeInput == "" && fs.NArg() > 0 {
		proofInput = fs.Arg(0)
	}

	if proofInput == "" && noticeInput == "" {
		fmt.Fprintln(stderr, "Usage: chm-verify --proof <url|token|.chproof.json> [--artwork <image.png>] [--json]")
		fmt.Fprintln(stderr, "       chm-verify --notice <token|.chnotice.json> [--json]")
		return 2
	}

	if noticeInput != "" {
		raw, err := readInputOrFile(noticeInput)
		if err != nil {
			fmt.Fprintln(stderr, err)
			return 2
		}
		summary, err := verifyNotice(raw)
		if err != nil {
			fmt.Fprintf(stderr, "INVALID NOTICE: %v\n", err)
			return 1
		}
		if *jsonFlag {
			enc := json.NewEncoder(stdout)
			enc.SetIndent("", "  ")
			_ = enc.Encode(summary)
		} else {
			status := "VALID"
			if !summary.Valid {
				status = "INVALID"
			}
			fmt.Fprintf(stdout, "Key Notice: %s (%s / %s)\n", status, summary.NoticeType, summary.Reason)
			fmt.Fprintf(stdout, "Subject Key: %s (%s)\n", summary.SubjectFingerprintShort, summary.SubjectFingerprintHex)
			if summary.ReplacementFpShort != "" {
				fmt.Fprintf(stdout, "Replacement Key: %s (%s)\n", summary.ReplacementFpShort, summary.ReplacementFingerprintHex)
			}
			fmt.Fprintf(stdout, "Notice Declared At: %s (unix %d)\n", summary.NoticeIssuedAtISO, summary.NoticeIssuedAtUnix)
			fmt.Fprintf(stdout, "Verified Locally At: %s\n", time.Unix(summary.VerifiedAtUnix, 0).UTC().Format(time.RFC3339))
			if summary.Note != "" {
				fmt.Fprintf(stdout, "Note: %s\n", summary.Note)
			}
			fmt.Fprintln(stdout, "Warning: If the old private key was leaked, an attacker could also sign key notices; confirm replacements out-of-band.")
		}
		if !summary.Valid {
			return 1
		}
		return 0
	}

	rawProof, err := readInputOrFile(proofInput)
	if err != nil {
		fmt.Fprintln(stderr, err)
		return 2
	}
	summary, err := verifyProof(rawProof, *artworkFlag)
	if err != nil {
		var uErr errUsage
		if errors.As(err, &uErr) {
			fmt.Fprintln(stderr, uErr.msg)
			return 2
		}
		fmt.Fprintf(stderr, "VERIFICATION FAILED: %v\n", err)
		return 1
	}

	if *jsonFlag {
		enc := json.NewEncoder(stdout)
		enc.SetIndent("", "  ")
		_ = enc.Encode(summary)
	} else {
		sigLabel := "INVALID"
		if summary.SignatureValid {
			sigLabel = "VALID"
		}
		fmt.Fprintf(stdout, "Protocol: v%d\n", summary.ProtocolVersion)
		fmt.Fprintf(stdout, "Cryptographic Signature (Ed25519): %s\n", sigLabel)
		fmt.Fprintf(stdout, "Artwork Integrity (SHA-256 RGBA8): %s", strings.ToUpper(summary.IntegrityStatus))
		if summary.MatchedMode != "" {
			fmt.Fprintf(stdout, " (%s)", summary.MatchedMode)
		}
		fmt.Fprintln(stdout)
		fmt.Fprintf(stdout, "Signer Key Fingerprint: %s (%s)\n", summary.PublicKeyFingerprintShort, summary.PublicKeyFingerprintHex)
		fmt.Fprintf(stdout, "Artwork ID: %s\n", summary.ArtworkID)
		fmt.Fprintf(stdout, "License: %s (commercial=%s, redistribution=%s, aiTraining=%s)\n", summary.License, summary.CommercialUse, summary.Redistribution, summary.AiTraining)
		if summary.QrMask != nil && summary.QrMaskCoveragePct != nil {
			fmt.Fprintf(stdout, "Excluded qrMask: [%d, %d, %d, %d] (%.1f%% of artwork)\n", summary.QrMask[0], summary.QrMask[1], summary.QrMask[2], summary.QrMask[3], *summary.QrMaskCoveragePct)
		}
		fmt.Fprintln(stdout, "Trust Note: Independent CLI checks cryptography and PNG pixel hashes only; confirm key ownership out-of-band.")
	}

	if !summary.SignatureValid || summary.IntegrityStatus == "mismatched" {
		return 1
	}
	return 0
}

func main() {
	os.Exit(run(os.Args[1:], os.Stdout, os.Stderr))
}
