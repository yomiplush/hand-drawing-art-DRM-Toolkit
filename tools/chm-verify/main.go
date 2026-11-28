package main

import (
	"bytes"
	"compress/flate"
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
	"math/big"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"
)

const (
	MaxProofBytes          = 2048
	MaxV3DecompressedBytes = 8192
	MaxNoticeBytes       = 2048
	MaxInputChars        = 32768
	MaxEvidenceBytes     = 32768
	MaxEvidenceChars     = 131072
	MaxEvidenceFileBytes = 512 * 1024 * 1024
	MaxOutputDimension   = 10240
	MaxTotalPixels       = 33554432
	MaxPngFileBytes      = 50 * 1024 * 1024

	MaxExtTitleBytes       = 256
	MaxExtArtistBytes      = 128
	MaxExtDescriptionBytes = 4000
	MaxCreatorDisplayBytes = 128
	MaxProfileURLBytes     = 512
	MaxProfileLabelBytes   = 64
	MaxProfileLinks        = 12
	MaxEnvFieldBytes       = 128
	MaxEnvNotesBytes       = 1000
	MaxEvidenceRecords     = 24
	MaxEvidenceLabelBytes  = 128
	MaxEvidenceMimeBytes   = 96
)

var (
	domainProofPrefix    = []byte{'C', 'H', 'M', '1', 0x00}
	domainProofPrefixV3  = []byte{'C', 'H', 'M', '3', 0x00}
	domainNoticePrefix   = []byte{'C', 'H', 'M', '-', 'N', 'O', 'T', 'I', 'C', 'E', '1', 0x00}
	domainEvidencePrefix = []byte{'C', 'H', 'M', '-', 'E', 'V', 'I', 'D', 'E', 'N', 'C', 'E', '1', 0x00}
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

var creationMethodNames = map[uint64]string{
	1: "hand-drawn-no-ai",
	2: "hand-drawn-ai-assisted",
	3: "ai-generated",
	4: "other",
	5: "prefer-not-to-disclose",
}

var v3UrlPrefixDict = map[uint64]string{
	1:  "https://",
	2:  "http://",
	3:  "https://x.com/",
	4:  "https://bsky.app/profile/",
	5:  "https://www.pixiv.net/users/",
	6:  "https://skeb.jp/@",
	7:  "https://vgen.co/",
	8:  "https://mastodon.social/@",
	9:  "https://misskey.io/@",
	10: "https://njump.me/",
	11: "https://www.furaffinity.net/user/",
	12: "https://www.deviantart.com/",
	13: "https://www.instagram.com/",
	14: "https://www.youtube.com/@",
	15: "https://github.com/",
}

var v3SnsPlatformNames = map[uint64]string{
	0:  "custom",
	1:  "x",
	2:  "bluesky",
	3:  "mastodon",
	4:  "misskey",
	5:  "nostr",
	6:  "pixiv",
	7:  "skeb",
	8:  "booth",
	9:  "vgen",
	10: "furaffinity",
	11: "deviantart",
	12: "tumblr",
	13: "instagram",
	14: "youtube",
	15: "github",
}

var evidenceCategoryNames = map[uint64]string{
	1: "sketch",
	2: "wip",
	3: "intermediate",
	4: "timelapse",
	5: "project-file",
	6: "other",
}

type stringSliceFlag []string

func (s *stringSliceFlag) String() string { return strings.Join(*s, ",") }
func (s *stringSliceFlag) Set(val string) error {
	*s = append(*s, val)
	return nil
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

// Ed25519 field/group constants (RFC 8032 §5.1).
var (
	edP  = mustBigInt("57896044618658097711785492504343953926634992332820282019728792003956564819949") // 2^255-19
	edD  = mustBigInt("37095705934669439343138083508754565189542113879843219016388785533085940283555") // -121665/121666
	edSQ = mustBigInt("19681161376707505956807079304988542015446066515923890162744021073123829784752") // sqrt(-1)
)

func mustBigInt(s string) *big.Int {
	v, ok := new(big.Int).SetString(s, 10)
	if !ok {
		panic("invalid bignum constant")
	}
	return v
}

// ed25519Point is an extended twisted-Edwards coordinate point (X:Y:Z:T).
type ed25519Point struct{ x, y, z, t *big.Int }

func ed25519Identity() ed25519Point {
	zero, one := big.NewInt(0), big.NewInt(1)
	return ed25519Point{zero, one, one, zero}
}

func (p ed25519Point) add(q ed25519Point) ed25519Point {
	// Unified addition for a = -1 (add-2008-hwcd-3); valid for doubling too.
	mul := func(a, b *big.Int) *big.Int { return new(big.Int).Mul(a, b) }
	sub := func(a, b *big.Int) *big.Int { return new(big.Int).Sub(a, b) }
	add := func(a, b *big.Int) *big.Int { return new(big.Int).Add(a, b) }
	mod := func(a *big.Int) *big.Int { return a.Mod(a, edP) }

	a := mod(mul(sub(p.y, p.x), sub(q.y, q.x)))
	b := mod(mul(add(p.y, p.x), add(q.y, q.x)))
	twoD := mod(new(big.Int).Mul(big.NewInt(2), edD))
	c := mod(mul(mul(p.t, twoD), q.t))
	d := mod(mul(mul(big.NewInt(2), p.z), q.z))
	e := sub(b, a)
	f := sub(d, c)
	g := add(d, c)
	h := add(b, a)
	return ed25519Point{
		x: mod(mul(e, f)),
		y: mod(mul(g, h)),
		t: mod(mul(e, h)),
		z: mod(mul(f, g)),
	}
}

// decodeEd25519Point decompresses a 32-byte encoding; false if not on the curve.
func decodeEd25519Point(b []byte) (ed25519Point, bool) {
	if len(b) != 32 {
		return ed25519Point{}, false
	}
	enc := make([]byte, 32)
	copy(enc, b)
	sign := (enc[31] >> 7) & 1
	enc[31] &= 0x7f

	rev := make([]byte, 32)
	for i := 0; i < 32; i++ {
		rev[i] = enc[31-i]
	}
	y := new(big.Int).SetBytes(rev)
	if y.Cmp(edP) >= 0 {
		return ed25519Point{}, false
	}

	// x^2 = (y^2 - 1) / (d*y^2 + 1)
	y2 := new(big.Int).Mul(y, y)
	y2.Mod(y2, edP)
	u := new(big.Int).Sub(y2, big.NewInt(1))
	u.Mod(u, edP)
	v := new(big.Int).Mul(edD, y2)
	v.Add(v, big.NewInt(1))
	v.Mod(v, edP)

	// x = u*v^3 * (u*v^7)^((p-5)/8)
	v3 := new(big.Int).Mul(v, v)
	v3.Mul(v3, v)
	v3.Mod(v3, edP)
	v7 := new(big.Int).Mul(v3, v3)
	v7.Mul(v7, v)
	v7.Mod(v7, edP)
	uv7 := new(big.Int).Mul(u, v7)
	uv7.Mod(uv7, edP)

	exp := new(big.Int).Sub(edP, big.NewInt(5))
	exp.Rsh(exp, 3)
	x := new(big.Int).Exp(uv7, exp, edP)
	x.Mul(x, u)
	x.Mul(x, v3)
	x.Mod(x, edP)

	vx2 := new(big.Int).Mul(v, x)
	vx2.Mul(vx2, x)
	vx2.Mod(vx2, edP)
	if vx2.Cmp(u) != 0 {
		if vx2.Cmp(new(big.Int).Neg(u).Mod(new(big.Int).Neg(u), edP)) == 0 {
			x.Mul(x, edSQ)
			x.Mod(x, edP)
		} else {
			return ed25519Point{}, false
		}
	}

	if x.Bit(0) != uint(sign) {
		x.Sub(edP, x)
	}

	z := big.NewInt(1)
	t := new(big.Int).Mul(x, y)
	t.Mod(t, edP)
	return ed25519Point{x: x, y: y, z: z, t: t}, true
}

func (p ed25519Point) isIdentity() bool {
	xIsZero := p.x.Sign() == 0
	yEqZ := new(big.Int).Sub(p.y, p.z).Mod(new(big.Int).Sub(p.y, p.z), edP).Sign() == 0
	return xIsZero && yEqZ
}

// isStrictEd25519PublicKey rejects all-zero and small-order (order dividing 8)
// public keys. Node's OpenSSL and Go's crypto/ed25519 both accept some of these,
// which would let a forged signature verify, so callers must gate on this first.
func isStrictEd25519PublicKey(pub []byte) bool {
	if len(pub) != ed25519.PublicKeySize {
		return false
	}
	allZero := true
	for _, b := range pub {
		if b != 0 {
			allZero = false
			break
		}
	}
	if allZero {
		return false
	}
	pt, ok := decodeEd25519Point(pub)
	if !ok {
		return false
	}
	// Additive order divides 8 exactly when [8]P is the identity.
	eightP := pt.add(pt).add(pt.add(pt)).add(pt.add(pt).add(pt.add(pt)))
	return !eightP.isIdentity()
}

func verifyEd25519Sig(pub, msg, sig []byte) bool {
	if !isStrictEd25519PublicKey(pub) {
		return false
	}
	return ed25519.Verify(ed25519.PublicKey(pub), msg, sig)
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

func isDisallowedEvidenceRune(r rune, allowMultiline bool) bool {
	if r >= 0x202a && r <= 0x202e {
		return true
	}
	if r >= 0x2066 && r <= 0x2069 {
		return true
	}
	if r == 0x7f || (r >= 0x80 && r <= 0x9f) {
		return true
	}
	if r < 0x20 {
		if allowMultiline && (r == '\t' || r == '\n') {
			return false
		}
		return true
	}
	return false
}

func validateEvidenceText(s string, maxBytes int, allowMultiline bool, field string) error {
	trimmed := strings.TrimSpace(s)
	if trimmed == "" {
		return fmt.Errorf("%s cannot be empty", field)
	}
	if trimmed != s {
		return fmt.Errorf("%s contains non-canonical leading/trailing whitespace", field)
	}
	if allowMultiline && strings.ContainsRune(s, '\r') {
		return fmt.Errorf("%s contains non-canonical CR line endings", field)
	}
	if len(s) > maxBytes {
		return fmt.Errorf("%s exceeds %d UTF-8 bytes", field, maxBytes)
	}
	for _, r := range s {
		if isDisallowedEvidenceRune(r, allowMultiline) {
			return fmt.Errorf("%s contains disallowed control or bidi characters", field)
		}
	}
	return nil
}

func validateEvidenceProfileURL(s string, field string) error {
	trimmed := strings.TrimSpace(s)
	if trimmed == "" || trimmed != s {
		return fmt.Errorf("%s must be a non-empty trimmed URL", field)
	}
	if len(s) > MaxProfileURLBytes {
		return fmt.Errorf("%s exceeds %d UTF-8 bytes", field, MaxProfileURLBytes)
	}
	for _, r := range s {
		if isDisallowedEvidenceRune(r, false) || unicode.IsSpace(r) {
			return fmt.Errorf("%s contains disallowed whitespace or control characters", field)
		}
	}
	u, err := url.Parse(s)
	if err != nil {
		return fmt.Errorf("%s must be a valid https:// or http:// URL", field)
	}
	scheme := strings.ToLower(u.Scheme)
	if (scheme != "https" && scheme != "http") || !strings.Contains(s, "://") {
		return fmt.Errorf("%s must use https:// or http://", field)
	}
	if u.User != nil {
		return fmt.Errorf("%s must not contain credentials", field)
	}
	if u.Hostname() == "" {
		return fmt.Errorf("%s must include a valid hostname", field)
	}
	return nil
}

type ExtendedArtworkMetadata struct {
	Title       string `json:"title,omitempty"`
	ArtistName  string `json:"artistName,omitempty"`
	Description string `json:"description,omitempty"`
}

type CreatorProfileLink struct {
	URL   string `json:"url"`
	Label string `json:"label,omitempty"`
}

type CreatorProfileData struct {
	DisplayName string               `json:"displayName,omitempty"`
	Website     string               `json:"website,omitempty"`
	Links       []CreatorProfileLink `json:"links,omitempty"`
}

type CreationEnvironmentData struct {
	Software    string `json:"software,omitempty"`
	Hardware    string `json:"hardware,omitempty"`
	InputDevice string `json:"inputDevice,omitempty"`
	Notes       string `json:"notes,omitempty"`
}

type EvidenceRecordCheck struct {
	Index           int     `json:"index"`
	Sha256Hex       string  `json:"sha256Hex"`
	ByteLength      uint64  `json:"byteLength"`
	Label           string  `json:"label,omitempty"`
	Category        string  `json:"category,omitempty"`
	MimeType        string  `json:"mimeType,omitempty"`
	Status          string  `json:"status"`
	MatchedFileName *string `json:"matchedFileName"`
}

type MismatchedSuppliedEvidence struct {
	FileName          string `json:"fileName"`
	ByteLength        uint64 `json:"byteLength"`
	ComputedSha256Hex string `json:"computedSha256Hex"`
}

type EvidenceExtensionSummary struct {
	Status                    string                       `json:"status"`
	SignatureValid            bool                         `json:"signatureValid"`
	ProofBindingValid         bool                         `json:"proofBindingValid"`
	PublicKeyMatchesProof     bool                         `json:"publicKeyMatchesProof"`
	ArtworkIDMatchesProof     bool                         `json:"artworkIdMatchesProof"`
	ArtworkSha256MatchesProof bool                         `json:"artworkSha256MatchesProof"`
	ProofSha256MatchesProof   bool                         `json:"proofSha256MatchesProof"`
	EvidenceBytesLength       int                          `json:"evidenceBytesLength"`
	EvidenceID                string                       `json:"evidenceId"`
	ProofSha256Hex            string                       `json:"proofSha256Hex"`
	IssuedAtUnix              uint64                       `json:"issuedAtUnix"`
	IssuedAtISO               string                       `json:"issuedAtIso"`
	ArtworkMetadata           *ExtendedArtworkMetadata     `json:"artworkMetadata"`
	CreatorProfile            *CreatorProfileData          `json:"creatorProfile"`
	CreationMethod            *string                      `json:"creationMethod"`
	CreationEnvironment       *CreationEnvironmentData     `json:"creationEnvironment"`
	RecordChecks              []EvidenceRecordCheck        `json:"recordChecks"`
	VerifiedRecordCount       int                          `json:"verifiedRecordCount"`
	UnavailableRecordCount    int                          `json:"unavailableRecordCount"`
	MismatchedSuppliedFiles   []MismatchedSuppliedEvidence `json:"mismatchedSuppliedFiles"`
	Errors                    []string                     `json:"errors"`
	Warnings                  []string                     `json:"warnings"`
}

type CompactSnsLink struct {
	URL      string `json:"url"`
	Platform string `json:"platform,omitempty"`
	Label    string `json:"label,omitempty"`
}

type CompactEvidenceHash struct {
	Sha256Hex  string `json:"sha256Hex"`
	ByteLength uint64 `json:"byteLength"`
	Category   string `json:"category,omitempty"`
	Label      string `json:"label,omitempty"`
	MimeType   string `json:"mimeType,omitempty"`
}

type ProofSummary struct {
	ProtocolVersion           uint64                    `json:"protocolVersion"`
	UsedDeflate               bool                      `json:"usedDeflate,omitempty"`
	SignatureValid            bool                      `json:"signatureValid"`
	IntegrityStatus           string                    `json:"integrityStatus"`
	MatchedMode               string                    `json:"matchedMode,omitempty"`
	ArtworkID                 string                    `json:"artworkId"`
	PublicKeyFingerprintHex   string                    `json:"publicKeyFingerprintHex"`
	PublicKeyFingerprintShort string                    `json:"publicKeyFingerprintShort"`
	DeclaredSha256Hex         string                    `json:"declaredSha256Hex"`
	ComputedSha256Hex         string                    `json:"computedSha256Hex,omitempty"`
	Region                    [4]int                    `json:"region"`
	QrMask                    *[4]int                   `json:"qrMask,omitempty"`
	QrMaskCoveragePct         *float64                  `json:"qrMaskCoveragePct,omitempty"`
	IssuedAtUnix              uint64                    `json:"issuedAtUnix"`
	IssuedAtISO               string                    `json:"issuedAtIso"`
	License                   string                    `json:"license"`
	CommercialUse             string                    `json:"commercialUse"`
	Redistribution            string                    `json:"redistribution"`
	AiTraining                string                    `json:"aiTraining"`
	AttributionName           string                    `json:"attributionName,omitempty"`
	AllowsDerivatives         string                    `json:"allowsDerivatives,omitempty"`
	AllowsModifications       string                    `json:"allowsModifications,omitempty"`
	RequiresAttribution       *bool                     `json:"requiresAttribution,omitempty"`
	AuthorName                string                    `json:"authorName,omitempty"`
	ArtworkTitle              string                    `json:"artworkTitle,omitempty"`
	Description               string                    `json:"description,omitempty"`
	Website                   string                    `json:"website,omitempty"`
	SnsLinks                  []CompactSnsLink          `json:"snsLinks,omitempty"`
	PortfolioLinks            []CreatorProfileLink      `json:"portfolioLinks,omitempty"`
	CreationMethod            string                    `json:"creationMethod,omitempty"`
	CreationEnvironment       *CreationEnvironmentData  `json:"creationEnvironment,omitempty"`
	EvidenceHashes            []CompactEvidenceHash     `json:"evidenceHashes,omitempty"`
	PolicyNote                string                    `json:"policyNote,omitempty"`
	EvidenceExtension         *EvidenceExtensionSummary `json:"evidenceExtension,omitempty"`
	Errors                    []string                  `json:"errors,omitempty"`
}

type proofRawData struct {
	proofBytes    []byte
	publicKey     []byte
	artworkID     []byte
	artworkSha256 []byte
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
	summary, _, err := verifyProofWithRaw(proofInput, artworkPath)
	return summary, err
}

func inflateRawBoundedGo(compressed []byte, maxBytes int) ([]byte, error) {
	if len(compressed) == 0 {
		return nil, errors.New("empty compressed v3 payload")
	}
	r := flate.NewReader(bytes.NewReader(compressed))
	defer r.Close()
	limited := io.LimitReader(r, int64(maxBytes)+1)
	out, err := io.ReadAll(limited)
	if err != nil {
		return nil, fmt.Errorf("corrupt v3 deflate payload: %w", err)
	}
	if len(out) > maxBytes {
		return nil, fmt.Errorf("decompressed v3 payload exceeds maximum (%d bytes)", maxBytes)
	}
	return out, nil
}

func decodeV3CompactURL(raw any, field string) (string, error) {
	arr, ok := raw.([]any)
	if !ok || len(arr) != 2 {
		return "", fmt.Errorf("%s compact URL must be a 2-element array", field)
	}
	code, ok := arr[0].(uint64)
	if !ok {
		return "", fmt.Errorf("%s URL prefix code must be unsigned int", field)
	}
	prefix, exists := v3UrlPrefixDict[code]
	if !exists {
		return "", fmt.Errorf("%s unknown URL prefix code %d", field, code)
	}
	suffix, ok := arr[1].(string)
	if !ok {
		return "", fmt.Errorf("%s URL suffix must be a string", field)
	}
	full := prefix + suffix
	if err := validateEvidenceProfileURL(full, field); err != nil {
		return "", err
	}
	var bestCode uint64
	bestLen := 0
	for k, p := range v3UrlPrefixDict {
		if strings.HasPrefix(full, p) && len(p) > bestLen {
			bestLen = len(p)
			bestCode = k
		}
	}
	if bestCode != code {
		return "", fmt.Errorf("%s does not use canonical longest URL prefix code", field)
	}
	return full, nil
}

func verifyProofWithRaw(proofInput string, artworkPath string) (ProofSummary, proofRawData, error) {
	var summary ProofSummary
	var rawData proofRawData
	summary.IntegrityStatus = "not-checked"

	proofBytes, err := extractProofBytes(proofInput)
	if err != nil {
		return summary, rawData, err
	}
	outerRaw, err := decodeCanonicalCBOR(proofBytes)
	if err != nil {
		return summary, rawData, fmt.Errorf("invalid proof envelope CBOR: %w", err)
	}
	outer, ok := outerRaw.([]any)
	if !ok || len(outer) < 3 {
		return summary, rawData, errors.New("proof envelope must be a CBOR array")
	}
	ver, ok := outer[0].(uint64)
	if !ok {
		return summary, rawData, errors.New("proof version must be an unsigned integer")
	}
	if ver != 1 && ver != 2 && ver != 3 {
		return summary, rawData, errUnsupported{msg: fmt.Sprintf("unsupported protocol version: %d", ver)}
	}

	var payloadBytes []byte
	var sig []byte
	if ver == 3 {
		if len(outer) != 4 {
			return summary, rawData, errors.New("protocol v3 proof envelope must be a 4-element CBOR array")
		}
		compFlag, ok := outer[1].(uint64)
		if !ok || (compFlag != 0 && compFlag != 1) {
			return summary, rawData, errors.New("protocol v3 compression flag must be 0 or 1")
		}
		transportBytes, ok := outer[2].([]byte)
		if !ok || len(transportBytes) == 0 {
			return summary, rawData, errors.New("protocol v3 payload must be a non-empty byte string")
		}
		sig, ok = outer[3].([]byte)
		if !ok || len(sig) != ed25519.SignatureSize {
			return summary, rawData, errors.New("signature must be a 64-byte byte string")
		}
		if compFlag == 1 {
			summary.UsedDeflate = true
			payloadBytes, err = inflateRawBoundedGo(transportBytes, MaxV3DecompressedBytes)
			if err != nil {
				return summary, rawData, err
			}
			if len(transportBytes) >= len(payloadBytes) {
				return summary, rawData, errors.New("compressed v3 payload is not strictly smaller than uncompressed payload")
			}
		} else {
			if len(transportBytes) > MaxV3DecompressedBytes {
				return summary, rawData, errors.New("protocol v3 payload exceeds maximum size")
			}
			payloadBytes = transportBytes
		}
	} else {
		if len(outer) != 3 {
			return summary, rawData, errors.New("proof envelope must be a 3-element CBOR array")
		}
		payloadBytes, ok = outer[1].([]byte)
		if !ok || len(payloadBytes) == 0 {
			return summary, rawData, errors.New("manifest payload must be a non-empty byte string")
		}
		sig, ok = outer[2].([]byte)
		if !ok || len(sig) != ed25519.SignatureSize {
			return summary, rawData, errors.New("signature must be a 64-byte byte string")
		}
	}

	payloadRaw, err := decodeCanonicalCBOR(payloadBytes)
	if err != nil {
		return summary, rawData, fmt.Errorf("invalid manifest payload CBOR: %w", err)
	}
	entries, ok := payloadRaw.([]cborMapEntry)
	if !ok {
		return summary, rawData, errors.New("manifest payload must be a CBOR map")
	}

	maxKey := uint64(8)
	if ver == 2 {
		maxKey = 9
	} else if ver == 3 {
		maxKey = 17
	}
	fields := make(map[uint64]any, len(entries))
	for _, e := range entries {
		k, ok := e.key.(uint64)
		if !ok || k < 1 || k > maxKey {
			return summary, rawData, fmt.Errorf("invalid or disallowed manifest field key: %v", e.key)
		}
		fields[k] = e.value
	}

	artworkID, ok := fields[1].([]byte)
	if !ok || len(artworkID) != 16 {
		return summary, rawData, errors.New("artworkId must be 16 bytes")
	}
	pubKey, ok := fields[2].([]byte)
	if !ok || len(pubKey) != ed25519.PublicKeySize {
		return summary, rawData, errors.New("publicKey must be 32 bytes")
	}
	shaBytes, ok := fields[3].([]byte)
	if !ok || len(shaBytes) != 32 {
		return summary, rawData, errors.New("sha256 must be 32 bytes")
	}
	region, err := parseUintSlice4(fields[4], "region")
	if err != nil {
		return summary, rawData, err
	}
	issuedAt, ok := fields[5].(uint64)
	if !ok {
		return summary, rawData, errors.New("issuedAt must be an unsigned integer")
	}

	licArr, ok := fields[6].([]any)
	if !ok {
		return summary, rawData, errors.New("license must be a CBOR array")
	}
	var licName, commName, redName, aiName, attrib string
	if ver == 3 {
		if len(licArr) != 2 && len(licArr) != 3 {
			return summary, rawData, errors.New("v3 license must be a 2 or 3-element array")
		}
		licCode, ok1 := licArr[0].(uint64)
		flags, ok2 := licArr[1].(uint64)
		var lok bool
		licName, lok = licenseNames[licCode]
		if !ok1 || !ok2 || !lok || flags > 0xfff {
			return summary, rawData, errors.New("invalid v3 license code or policy flags")
		}
		cok := false
		rok := false
		aok := false
		dok := false
		mok := false
		commName, cok = policyNames[flags&0x3]
		redName, rok = policyNames[(flags>>2)&0x3]
		aiName, aok = policyNames[(flags>>4)&0x3]
		dName, dValid := policyNames[(flags>>6)&0x3]
		mName, mValid := policyNames[(flags>>8)&0x3]
		dok, mok = dValid, mValid
		if !cok || !rok || !aok || !dok || !mok {
			return summary, rawData, errors.New("invalid 2-bit policy signal in v3 policyFlags")
		}
		if (flags>>6)&0x3 != 0 {
			summary.AllowsDerivatives = dName
		}
		if (flags>>8)&0x3 != 0 {
			summary.AllowsModifications = mName
		}
		hasAttr := (flags & 0x400) != 0
		attrVal := (flags & 0x800) != 0
		if !hasAttr && attrVal {
			return summary, rawData, errors.New("v3 policyFlags attribution value set without presence bit")
		}
		if hasAttr {
			summary.RequiresAttribution = &attrVal
		}
		if len(licArr) == 3 {
			s, ok := licArr[2].(string)
			if !ok {
				return summary, rawData, errors.New("attributionName must be a string")
			}
			if err := sanitizeTextValid(s, 48); err != nil {
				return summary, rawData, fmt.Errorf("attributionName: %w", err)
			}
			attrib = s
		}
	} else {
		if len(licArr) != 4 && len(licArr) != 5 {
			return summary, rawData, errors.New("license must be a 4 or 5-element array")
		}
		licCode, ok1 := licArr[0].(uint64)
		commCode, ok2 := licArr[1].(uint64)
		redCode, ok3 := licArr[2].(uint64)
		aiCode, ok4 := licArr[3].(uint64)
		var lok, cok, rok, aok bool
		licName, lok = licenseNames[licCode]
		commName, cok = policyNames[commCode]
		redName, rok = policyNames[redCode]
		aiName, aok = policyNames[aiCode]
		if !ok1 || !ok2 || !ok3 || !ok4 || !lok || !cok || !rok || !aok {
			return summary, rawData, errors.New("invalid license or policy code")
		}
		if len(licArr) == 5 {
			s, ok := licArr[4].(string)
			if !ok {
				return summary, rawData, errors.New("attributionName must be a string")
			}
			if err := sanitizeTextValid(s, 48); err != nil {
				return summary, rawData, fmt.Errorf("attributionName: %w", err)
			}
			attrib = s
		}
	}

	maxAuthorBytes := 48
	maxTitleBytes := 64
	if ver == 3 {
		maxAuthorBytes = 64
		maxTitleBytes = 128
	}

	var authorName string
	if rawAuthor, exists := fields[7]; exists {
		s, ok := rawAuthor.(string)
		if !ok {
			return summary, rawData, errors.New("authorName must be a string")
		}
		if err := validateEvidenceText(s, maxAuthorBytes, false, "authorName"); err != nil {
			return summary, rawData, err
		}
		authorName = s
	}

	var artworkTitle string
	if rawTitle, exists := fields[8]; exists {
		s, ok := rawTitle.(string)
		if !ok {
			return summary, rawData, errors.New("artworkTitle must be a string")
		}
		if err := validateEvidenceText(s, maxTitleBytes, false, "artworkTitle"); err != nil {
			return summary, rawData, err
		}
		artworkTitle = s
	}

	var qrMask *[4]int
	if rawMask, exists := fields[9]; exists {
		m, err := parseUintSlice4(rawMask, "qrMask")
		if err != nil {
			return summary, rawData, err
		}
		if m[2] < 21 || m[3] < 21 {
			return summary, rawData, errors.New("qrMask dimensions must be at least 21x21")
		}
		if m[0]+m[2] > region[2] || m[1]+m[3] > region[3] {
			return summary, rawData, errors.New("qrMask exceeds region bounds")
		}
		qrMask = &m
		cov := float64(m[2]*m[3]) / float64(region[2]*region[3]) * 100.0
		covRounded := float64(int(cov*10+0.5)) / 10.0
		summary.QrMaskCoveragePct = &covRounded
	}

	if ver == 3 {
		if v, ok := fields[10]; ok {
			s, ok := v.(string)
			if !ok {
				return summary, rawData, errors.New("description must be a string")
			}
			if err := validateEvidenceText(s, 600, true, "description"); err != nil {
				return summary, rawData, err
			}
			summary.Description = s
		}
		if v, ok := fields[11]; ok {
			u, err := decodeV3CompactURL(v, "website")
			if err != nil {
				return summary, rawData, err
			}
			summary.Website = u
		}
		if v, ok := fields[12]; ok {
			arr, ok := v.([]any)
			if !ok || len(arr) == 0 || len(arr) > 12 {
				return summary, rawData, errors.New("snsLinks must be a non-empty bounded array")
			}
			links := make([]CompactSnsLink, 0, len(arr))
			for idx, rawEntry := range arr {
				entry, ok := rawEntry.([]any)
				if !ok || len(entry) < 2 || len(entry) > 4 {
					return summary, rawData, fmt.Errorf("snsLinks[%d] must be a 2..4 element array", idx)
				}
				u, err := decodeV3CompactURL(entry[:2], fmt.Sprintf("snsLinks[%d].url", idx))
				if err != nil {
					return summary, rawData, err
				}
				item := CompactSnsLink{URL: u}
				if len(entry) >= 3 {
					pCode, ok := entry[2].(uint64)
					pName, pOk := v3SnsPlatformNames[pCode]
					if !ok || !pOk || (len(entry) == 3 && pCode == 0) {
						return summary, rawData, fmt.Errorf("snsLinks[%d] invalid platform code", idx)
					}
					if pCode != 0 {
						item.Platform = pName
					}
				}
				if len(entry) == 4 {
					lbl, ok := entry[3].(string)
					if !ok {
						return summary, rawData, fmt.Errorf("snsLinks[%d].label must be a string", idx)
					}
					if err := validateEvidenceText(lbl, 48, false, fmt.Sprintf("snsLinks[%d].label", idx)); err != nil {
						return summary, rawData, err
					}
					item.Label = lbl
				}
				links = append(links, item)
			}
			summary.SnsLinks = links
		}
		if v, ok := fields[13]; ok {
			arr, ok := v.([]any)
			if !ok || len(arr) == 0 || len(arr) > 8 {
				return summary, rawData, errors.New("portfolioLinks must be a non-empty bounded array")
			}
			links := make([]CreatorProfileLink, 0, len(arr))
			for idx, rawEntry := range arr {
				entry, ok := rawEntry.([]any)
				if !ok || len(entry) < 2 || len(entry) > 3 {
					return summary, rawData, fmt.Errorf("portfolioLinks[%d] must be a 2 or 3 element array", idx)
				}
				u, err := decodeV3CompactURL(entry[:2], fmt.Sprintf("portfolioLinks[%d].url", idx))
				if err != nil {
					return summary, rawData, err
				}
				link := CreatorProfileLink{URL: u}
				if len(entry) == 3 {
					lbl, ok := entry[2].(string)
					if !ok {
						return summary, rawData, fmt.Errorf("portfolioLinks[%d].label must be a string", idx)
					}
					if err := validateEvidenceText(lbl, 48, false, fmt.Sprintf("portfolioLinks[%d].label", idx)); err != nil {
						return summary, rawData, err
					}
					link.Label = lbl
				}
				links = append(links, link)
			}
			summary.PortfolioLinks = links
		}
		if v, ok := fields[14]; ok {
			mc, ok := v.(uint64)
			mName, mOk := creationMethodNames[mc]
			if !ok || !mOk {
				return summary, rawData, errors.New("invalid creationMethod code")
			}
			summary.CreationMethod = mName
		}
		if v, ok := fields[15]; ok {
			envMap, err := mapEntriesToUintMap(v, 1, 4, "creationEnvironment")
			if err != nil {
				return summary, rawData, err
			}
			if len(envMap) == 0 {
				return summary, rawData, errors.New("creationEnvironment must be non-empty")
			}
			env := &CreationEnvironmentData{}
			if rawSw, ok := envMap[1]; ok {
				s, ok := rawSw.(string)
				if !ok {
					return summary, rawData, errors.New("creationEnvironment.software must be string")
				}
				if err := validateEvidenceText(s, 96, false, "creationEnvironment.software"); err != nil {
					return summary, rawData, err
				}
				env.Software = s
			}
			if rawHw, ok := envMap[2]; ok {
				s, ok := rawHw.(string)
				if !ok {
					return summary, rawData, errors.New("creationEnvironment.hardware must be string")
				}
				if err := validateEvidenceText(s, 96, false, "creationEnvironment.hardware"); err != nil {
					return summary, rawData, err
				}
				env.Hardware = s
			}
			if rawInp, ok := envMap[3]; ok {
				s, ok := rawInp.(string)
				if !ok {
					return summary, rawData, errors.New("creationEnvironment.inputDevice must be string")
				}
				if err := validateEvidenceText(s, 96, false, "creationEnvironment.inputDevice"); err != nil {
					return summary, rawData, err
				}
				env.InputDevice = s
			}
			if rawNotes, ok := envMap[4]; ok {
				s, ok := rawNotes.(string)
				if !ok {
					return summary, rawData, errors.New("creationEnvironment.notes must be string")
				}
				if err := validateEvidenceText(s, 240, true, "creationEnvironment.notes"); err != nil {
					return summary, rawData, err
				}
				env.Notes = s
			}
			summary.CreationEnvironment = env
		}
		if v, ok := fields[16]; ok {
			arr, ok := v.([]any)
			if !ok || len(arr) == 0 || len(arr) > 8 {
				return summary, rawData, errors.New("evidenceHashes must be a non-empty bounded array")
			}
			hashes := make([]CompactEvidenceHash, 0, len(arr))
			for idx, rawEntry := range arr {
				entry, ok := rawEntry.([]any)
				if !ok || len(entry) < 2 || len(entry) > 5 {
					return summary, rawData, fmt.Errorf("evidenceHashes[%d] invalid tuple length", idx)
				}
				hBytes, ok := entry[0].([]byte)
				if !ok || len(hBytes) != 32 {
					return summary, rawData, fmt.Errorf("evidenceHashes[%d].sha256 invalid", idx)
				}
				bl, ok := entry[1].(uint64)
				if !ok {
					return summary, rawData, fmt.Errorf("evidenceHashes[%d].byteLength invalid", idx)
				}
				rec := CompactEvidenceHash{Sha256Hex: hex.EncodeToString(hBytes), ByteLength: bl}
				if len(entry) >= 3 {
					catCode, ok := entry[2].(uint64)
					if !ok || (len(entry) == 3 && catCode == 0) {
						return summary, rawData, fmt.Errorf("evidenceHashes[%d] invalid category", idx)
					}
					if catCode != 0 {
						catName, cOk := evidenceCategoryNames[catCode]
						if !cOk {
							return summary, rawData, fmt.Errorf("evidenceHashes[%d] unknown category", idx)
						}
						rec.Category = catName
					}
				}
				if len(entry) >= 4 {
					lbl, ok := entry[3].(string)
					if !ok || (len(entry) == 4 && lbl == "") {
						return summary, rawData, fmt.Errorf("evidenceHashes[%d] invalid label", idx)
					}
					if lbl != "" {
						if err := validateEvidenceText(lbl, 96, false, fmt.Sprintf("evidenceHashes[%d].label", idx)); err != nil {
							return summary, rawData, err
						}
						rec.Label = lbl
					}
				}
				if len(entry) == 5 {
					mime, ok := entry[4].(string)
					if !ok {
						return summary, rawData, fmt.Errorf("evidenceHashes[%d].mimeType must be string", idx)
					}
					if err := validateEvidenceText(mime, 64, false, fmt.Sprintf("evidenceHashes[%d].mimeType", idx)); err != nil {
						return summary, rawData, err
					}
					rec.MimeType = mime
				}
				hashes = append(hashes, rec)
			}
			summary.EvidenceHashes = hashes
		}
		if v, ok := fields[17]; ok {
			s, ok := v.(string)
			if !ok {
				return summary, rawData, errors.New("policyNote must be a string")
			}
			if err := validateEvidenceText(s, 240, true, "policyNote"); err != nil {
				return summary, rawData, err
			}
			summary.PolicyNote = s
		}
	}

	activeDomain := domainProofPrefix
	if ver == 3 {
		activeDomain = domainProofPrefixV3
	}
	signingMsg := make([]byte, len(activeDomain)+len(payloadBytes))
	copy(signingMsg, activeDomain)
	copy(signingMsg[len(activeDomain):], payloadBytes)
	sigValid := verifyEd25519Sig(pubKey, signingMsg, sig)

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

	rawData = proofRawData{
		proofBytes:    proofBytes,
		publicKey:     pubKey,
		artworkID:     artworkID,
		artworkSha256: shaBytes,
	}

	return summary, rawData, nil
}

func extractEvidenceBytes(rawInput string) ([]byte, error) {
	trimmed := strings.TrimSpace(rawInput)
	if trimmed == "" || len(trimmed) > MaxEvidenceChars {
		return nil, errors.New("evidence extension input is empty or exceeds size limit")
	}

	token := trimmed
	if strings.HasPrefix(trimmed, "{") {
		var bundle struct {
			Format            string `json:"format"`
			Version           int    `json:"version"`
			EvidenceBase64Url string `json:"evidenceBase64Url"`
		}
		if err := json.Unmarshal([]byte(trimmed), &bundle); err != nil {
			return nil, fmt.Errorf("malformed .chmevidence JSON: %w", err)
		}
		if bundle.Format != "certified-handmade-evidence" {
			return nil, errors.New("unsupported evidence extension format")
		}
		if bundle.Version != 1 {
			return nil, errUnsupported{msg: fmt.Sprintf("unsupported evidence extension version: %d", bundle.Version)}
		}
		token = bundle.EvidenceBase64Url
	} else if strings.HasPrefix(trimmed, "chm-evidence:") {
		token = strings.TrimSpace(strings.TrimPrefix(trimmed, "chm-evidence:"))
	}

	if token == "" {
		return nil, errors.New("missing evidenceBase64Url token")
	}
	evidenceBytes, err := decodeStrictBase64Url(token)
	if err != nil {
		return nil, err
	}
	if len(evidenceBytes) == 0 || len(evidenceBytes) > MaxEvidenceBytes {
		return nil, fmt.Errorf("evidence extension bytes out of bounds (%d)", len(evidenceBytes))
	}
	return evidenceBytes, nil
}

func mapEntriesToUintMap(val any, minKey, maxKey uint64, label string) (map[uint64]any, error) {
	entries, ok := val.([]cborMapEntry)
	if !ok {
		return nil, fmt.Errorf("%s must be a CBOR map", label)
	}
	out := make(map[uint64]any, len(entries))
	for _, e := range entries {
		k, ok := e.key.(uint64)
		if !ok || k < minKey || k > maxKey {
			return nil, fmt.Errorf("unknown or invalid %s key: %v", label, e.key)
		}
		out[k] = e.value
	}
	return out, nil
}

type hashedEvidenceFile struct {
	fileName   string
	byteLength uint64
	digest     []byte
	hex        string
}

func hashEvidenceFileStreamed(path string) (hashedEvidenceFile, error) {
	var out hashedEvidenceFile
	st, err := os.Stat(path)
	if err != nil {
		return out, errUsage{msg: fmt.Sprintf("evidence file not found: %s (%v)", path, err)}
	}
	if !st.Mode().IsRegular() {
		return out, errUsage{msg: fmt.Sprintf("evidence path is not a regular file: %s", path)}
	}
	if st.Size() > MaxEvidenceFileBytes {
		return out, fmt.Errorf("evidence file exceeds %d byte limit: %s", MaxEvidenceFileBytes, path)
	}
	f, err := os.Open(path)
	if err != nil {
		return out, errUsage{msg: fmt.Sprintf("failed to open evidence file %s: %v", path, err)}
	}
	defer f.Close()

	h := sha256.New()
	buf := make([]byte, 256*1024)
	n, err := io.CopyBuffer(h, io.LimitReader(f, MaxEvidenceFileBytes+1), buf)
	if err != nil {
		return out, errUsage{msg: fmt.Sprintf("failed to hash evidence file %s: %v", path, err)}
	}
	if n > MaxEvidenceFileBytes {
		return out, fmt.Errorf("evidence file exceeded %d byte limit: %s", MaxEvidenceFileBytes, path)
	}
	sum := h.Sum(nil)
	return hashedEvidenceFile{
		fileName:   filepath.Base(path),
		byteLength: uint64(n),
		digest:     sum,
		hex:        hex.EncodeToString(sum),
	}, nil
}

func verifyEvidenceExtension(rawInput string, proof proofRawData, suppliedPaths []string) (EvidenceExtensionSummary, error) {
	summary := EvidenceExtensionSummary{
		RecordChecks:            []EvidenceRecordCheck{},
		MismatchedSuppliedFiles: []MismatchedSuppliedEvidence{},
		Errors:                  []string{},
		Warnings:                []string{},
	}

	evidenceBytes, err := extractEvidenceBytes(rawInput)
	if err != nil {
		return summary, err
	}
	summary.EvidenceBytesLength = len(evidenceBytes)

	outerRaw, err := decodeCanonicalCBOR(evidenceBytes)
	if err != nil {
		return summary, fmt.Errorf("invalid evidence extension envelope CBOR: %w", err)
	}
	outer, ok := outerRaw.([]any)
	if !ok || len(outer) != 3 {
		return summary, errors.New("evidence extension envelope must be a 3-element CBOR array")
	}
	ver, ok := outer[0].(uint64)
	if !ok {
		return summary, errors.New("evidence extension version must be an integer")
	}
	if ver != 1 {
		return summary, errUnsupported{msg: fmt.Sprintf("unsupported evidence extension version: %d", ver)}
	}
	payloadBytes, ok := outer[1].([]byte)
	if !ok || len(payloadBytes) == 0 {
		return summary, errors.New("evidence extension payload must be non-empty bytes")
	}
	sig, ok := outer[2].([]byte)
	if !ok || len(sig) != ed25519.SignatureSize {
		return summary, errors.New("evidence extension signature must be 64 bytes")
	}

	payloadRaw, err := decodeCanonicalCBOR(payloadBytes)
	if err != nil {
		return summary, fmt.Errorf("invalid evidence extension payload CBOR: %w", err)
	}
	fields, err := mapEntriesToUintMap(payloadRaw, 1, 11, "evidencePayload")
	if err != nil {
		return summary, err
	}

	evidenceID, ok := fields[1].([]byte)
	if !ok || len(evidenceID) != 16 {
		return summary, errors.New("evidenceId must be 16 bytes")
	}
	pubKey, ok := fields[2].([]byte)
	if !ok || len(pubKey) != ed25519.PublicKeySize {
		return summary, errors.New("evidence publicKey must be 32 bytes")
	}
	proofSha, ok := fields[3].([]byte)
	if !ok || len(proofSha) != 32 {
		return summary, errors.New("evidence proofSha256 must be 32 bytes")
	}
	artworkID, ok := fields[4].([]byte)
	if !ok || len(artworkID) != 16 {
		return summary, errors.New("evidence artworkId must be 16 bytes")
	}
	artworkSha, ok := fields[5].([]byte)
	if !ok || len(artworkSha) != 32 {
		return summary, errors.New("evidence artworkSha256 must be 32 bytes")
	}
	issuedAt, ok := fields[6].(uint64)
	if !ok {
		return summary, errors.New("evidence issuedAt must be an unsigned integer")
	}

	summary.EvidenceID = formatUUID(evidenceID)
	summary.ProofSha256Hex = hex.EncodeToString(proofSha)
	summary.IssuedAtUnix = issuedAt
	summary.IssuedAtISO = time.Unix(int64(issuedAt), 0).UTC().Format(time.RFC3339)

	if rawMeta, exists := fields[7]; exists {
		m, err := mapEntriesToUintMap(rawMeta, 1, 3, "artworkMetadata")
		if err != nil {
			return summary, err
		}
		if len(m) == 0 {
			return summary, errors.New("artworkMetadata must be a non-empty CBOR map")
		}
		meta := &ExtendedArtworkMetadata{}
		if v, ok := m[1]; ok {
			s, ok := v.(string)
			if !ok {
				return summary, errors.New("artworkMetadata.title must be a string")
			}
			if err := validateEvidenceText(s, MaxExtTitleBytes, false, "artworkMetadata.title"); err != nil {
				return summary, err
			}
			meta.Title = s
		}
		if v, ok := m[2]; ok {
			s, ok := v.(string)
			if !ok {
				return summary, errors.New("artworkMetadata.artistName must be a string")
			}
			if err := validateEvidenceText(s, MaxExtArtistBytes, false, "artworkMetadata.artistName"); err != nil {
				return summary, err
			}
			meta.ArtistName = s
		}
		if v, ok := m[3]; ok {
			s, ok := v.(string)
			if !ok {
				return summary, errors.New("artworkMetadata.description must be a string")
			}
			if err := validateEvidenceText(s, MaxExtDescriptionBytes, true, "artworkMetadata.description"); err != nil {
				return summary, err
			}
			meta.Description = s
		}
		summary.ArtworkMetadata = meta
	}

	if rawProf, exists := fields[8]; exists {
		m, err := mapEntriesToUintMap(rawProf, 1, 3, "creatorProfile")
		if err != nil {
			return summary, err
		}
		if len(m) == 0 {
			return summary, errors.New("creatorProfile must be a non-empty CBOR map")
		}
		prof := &CreatorProfileData{}
		if v, ok := m[1]; ok {
			s, ok := v.(string)
			if !ok {
				return summary, errors.New("creatorProfile.displayName must be a string")
			}
			if err := validateEvidenceText(s, MaxCreatorDisplayBytes, false, "creatorProfile.displayName"); err != nil {
				return summary, err
			}
			prof.DisplayName = s
		}
		if v, ok := m[2]; ok {
			s, ok := v.(string)
			if !ok {
				return summary, errors.New("creatorProfile.website must be a string")
			}
			if err := validateEvidenceProfileURL(s, "creatorProfile.website"); err != nil {
				return summary, err
			}
			prof.Website = s
		}
		if v, ok := m[3]; ok {
			arr, ok := v.([]any)
			if !ok || len(arr) == 0 || len(arr) > MaxProfileLinks {
				return summary, errors.New("creatorProfile.links must be a non-empty bounded array")
			}
			links := make([]CreatorProfileLink, 0, len(arr))
			for idx, rawEntry := range arr {
				entry, ok := rawEntry.([]any)
				if !ok || (len(entry) != 1 && len(entry) != 2) {
					return summary, fmt.Errorf("creatorProfile.links[%d] must be a 1 or 2-element array", idx)
				}
				u, ok := entry[0].(string)
				if !ok {
					return summary, fmt.Errorf("creatorProfile.links[%d][0] must be a URL string", idx)
				}
				if err := validateEvidenceProfileURL(u, fmt.Sprintf("creatorProfile.links[%d].url", idx)); err != nil {
					return summary, err
				}
				link := CreatorProfileLink{URL: u}
				if len(entry) == 2 {
					lbl, ok := entry[1].(string)
					if !ok {
						return summary, fmt.Errorf("creatorProfile.links[%d][1] must be a string", idx)
					}
					if err := validateEvidenceText(lbl, MaxProfileLabelBytes, false, fmt.Sprintf("creatorProfile.links[%d].label", idx)); err != nil {
						return summary, err
					}
					link.Label = lbl
				}
				links = append(links, link)
			}
			prof.Links = links
		}
		summary.CreatorProfile = prof
	}

	if rawMethod, exists := fields[9]; exists {
		code, ok := rawMethod.(uint64)
		name, valid := creationMethodNames[code]
		if !ok || !valid {
			return summary, errors.New("creationMethod contains an invalid code")
		}
		summary.CreationMethod = &name
	}

	if rawEnv, exists := fields[10]; exists {
		m, err := mapEntriesToUintMap(rawEnv, 1, 4, "creationEnvironment")
		if err != nil {
			return summary, err
		}
		if len(m) == 0 {
			return summary, errors.New("creationEnvironment must be a non-empty CBOR map")
		}
		env := &CreationEnvironmentData{}
		if v, ok := m[1]; ok {
			s, ok := v.(string)
			if !ok {
				return summary, errors.New("creationEnvironment.software must be a string")
			}
			if err := validateEvidenceText(s, MaxEnvFieldBytes, false, "creationEnvironment.software"); err != nil {
				return summary, err
			}
			env.Software = s
		}
		if v, ok := m[2]; ok {
			s, ok := v.(string)
			if !ok {
				return summary, errors.New("creationEnvironment.hardware must be a string")
			}
			if err := validateEvidenceText(s, MaxEnvFieldBytes, false, "creationEnvironment.hardware"); err != nil {
				return summary, err
			}
			env.Hardware = s
		}
		if v, ok := m[3]; ok {
			s, ok := v.(string)
			if !ok {
				return summary, errors.New("creationEnvironment.inputDevice must be a string")
			}
			if err := validateEvidenceText(s, MaxEnvFieldBytes, false, "creationEnvironment.inputDevice"); err != nil {
				return summary, err
			}
			env.InputDevice = s
		}
		if v, ok := m[4]; ok {
			s, ok := v.(string)
			if !ok {
				return summary, errors.New("creationEnvironment.notes must be a string")
			}
			if err := validateEvidenceText(s, MaxEnvNotesBytes, true, "creationEnvironment.notes"); err != nil {
				return summary, err
			}
			env.Notes = s
		}
		summary.CreationEnvironment = env
	}

	type parsedEvidenceRec struct {
		sha256     []byte
		sha256Hex  string
		byteLength uint64
		label      string
		category   string
		mimeType   string
	}
	var parsedRecords []parsedEvidenceRec
	if rawRecords, exists := fields[11]; exists {
		arr, ok := rawRecords.([]any)
		if !ok || len(arr) == 0 || len(arr) > MaxEvidenceRecords {
			return summary, errors.New("evidenceRecords must be a non-empty bounded array")
		}
		parsedRecords = make([]parsedEvidenceRec, 0, len(arr))
		for idx, item := range arr {
			m, err := mapEntriesToUintMap(item, 1, 5, fmt.Sprintf("evidenceRecords[%d]", idx))
			if err != nil {
				return summary, err
			}
			recSha, ok := m[1].([]byte)
			if !ok || len(recSha) != 32 {
				return summary, fmt.Errorf("evidenceRecords[%d].sha256 must be 32 bytes", idx)
			}
			byteLength, ok := m[2].(uint64)
			if !ok {
				return summary, fmt.Errorf("evidenceRecords[%d].byteLength must be a non-negative integer", idx)
			}
			var label, catName, mime string
			if v, has := m[3]; has {
				s, ok := v.(string)
				if !ok {
					return summary, fmt.Errorf("evidenceRecords[%d].label must be a string", idx)
				}
				if err := validateEvidenceText(s, MaxEvidenceLabelBytes, false, fmt.Sprintf("evidenceRecords[%d].label", idx)); err != nil {
					return summary, err
				}
				label = s
			}
			if v, has := m[4]; has {
				code, ok := v.(uint64)
				name, valid := evidenceCategoryNames[code]
				if !ok || !valid {
					return summary, fmt.Errorf("evidenceRecords[%d].category is invalid", idx)
				}
				catName = name
			}
			if v, has := m[5]; has {
				s, ok := v.(string)
				if !ok {
					return summary, fmt.Errorf("evidenceRecords[%d].mimeType must be a string", idx)
				}
				if err := validateEvidenceText(s, MaxEvidenceMimeBytes, false, fmt.Sprintf("evidenceRecords[%d].mimeType", idx)); err != nil {
					return summary, err
				}
				mime = s
			}
			parsedRecords = append(parsedRecords, parsedEvidenceRec{
				sha256:     recSha,
				sha256Hex:  hex.EncodeToString(recSha),
				byteLength: byteLength,
				label:      label,
				category:   catName,
				mimeType:   mime,
			})
		}
	}

	signingMsg := make([]byte, len(domainEvidencePrefix)+len(payloadBytes))
	copy(signingMsg, domainEvidencePrefix)
	copy(signingMsg[len(domainEvidencePrefix):], payloadBytes)
	sigValid := verifyEd25519Sig(pubKey, signingMsg, sig)

	expectedProofSum := sha256.Sum256(proof.proofBytes)
	pubMatch := subtle.ConstantTimeCompare(pubKey, proof.publicKey) == 1
	idMatch := subtle.ConstantTimeCompare(artworkID, proof.artworkID) == 1
	artShaMatch := subtle.ConstantTimeCompare(artworkSha, proof.artworkSha256) == 1
	proofShaMatch := subtle.ConstantTimeCompare(proofSha, expectedProofSum[:]) == 1
	bindingValid := pubMatch && idMatch && artShaMatch && proofShaMatch

	summary.SignatureValid = sigValid
	summary.PublicKeyMatchesProof = pubMatch
	summary.ArtworkIDMatchesProof = idMatch
	summary.ArtworkSha256MatchesProof = artShaMatch
	summary.ProofSha256MatchesProof = proofShaMatch
	summary.ProofBindingValid = bindingValid

	if !sigValid {
		summary.Errors = append(summary.Errors, "Evidence extension Ed25519 signature verification failed")
	}
	if !pubMatch {
		summary.Errors = append(summary.Errors, "Evidence extension publicKey does not match primary proof")
	}
	if !idMatch {
		summary.Errors = append(summary.Errors, "Evidence extension artworkId does not match primary proof")
	}
	if !artShaMatch {
		summary.Errors = append(summary.Errors, "Evidence extension artworkSha256 does not match primary proof")
	}
	if !proofShaMatch {
		summary.Errors = append(summary.Errors, "Evidence extension proofSha256 does not match primary proof")
	}

	if !sigValid {
		summary.Status = "invalid"
	} else if !bindingValid {
		summary.Status = "binding-mismatch"
	} else {
		summary.Status = "valid"
	}

	hashedSupplied := make([]hashedEvidenceFile, 0, len(suppliedPaths))
	for _, p := range suppliedPaths {
		h, err := hashEvidenceFileStreamed(p)
		if err != nil {
			return summary, err
		}
		hashedSupplied = append(hashedSupplied, h)
	}

	matchedIndices := make(map[int]bool, len(hashedSupplied))
	for idx, rec := range parsedRecords {
		matchIdx := -1
		for sIdx, sup := range hashedSupplied {
			if sup.byteLength == rec.byteLength && subtle.ConstantTimeCompare(sup.digest, rec.sha256) == 1 {
				matchIdx = sIdx
				break
			}
		}
		if matchIdx >= 0 {
			matchedIndices[matchIdx] = true
			name := hashedSupplied[matchIdx].fileName
			summary.RecordChecks = append(summary.RecordChecks, EvidenceRecordCheck{
				Index:           idx,
				Sha256Hex:       rec.sha256Hex,
				ByteLength:      rec.byteLength,
				Label:           rec.label,
				Category:        rec.category,
				MimeType:        rec.mimeType,
				Status:          "verified",
				MatchedFileName: &name,
			})
			summary.VerifiedRecordCount++
		} else {
			summary.RecordChecks = append(summary.RecordChecks, EvidenceRecordCheck{
				Index:           idx,
				Sha256Hex:       rec.sha256Hex,
				ByteLength:      rec.byteLength,
				Label:           rec.label,
				Category:        rec.category,
				MimeType:        rec.mimeType,
				Status:          "unavailable",
				MatchedFileName: nil,
			})
			summary.UnavailableRecordCount++
		}
	}

	for sIdx, sup := range hashedSupplied {
		if !matchedIndices[sIdx] {
			summary.MismatchedSuppliedFiles = append(summary.MismatchedSuppliedFiles, MismatchedSuppliedEvidence{
				FileName:          sup.fileName,
				ByteLength:        sup.byteLength,
				ComputedSha256Hex: sup.hex,
			})
		}
	}
	if len(summary.MismatchedSuppliedFiles) > 0 {
		summary.Warnings = append(summary.Warnings, fmt.Sprintf("%d supplied local evidence file(s) did not match any record in .chmevidence", len(summary.MismatchedSuppliedFiles)))
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

	subjOk := verifyEd25519Sig(subjPub, signingMsg, subjSig)
	if !subjOk {
		res.Errors = append(res.Errors, "subject key signature verification failed")
	}
	if noticeType == "rotation" {
		if !verifyEd25519Sig(replPub, signingMsg, replSig) {
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
	if st, err := os.Stat(arg); err == nil && !st.IsDir() {
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
	evidenceFlag := fs.String("evidence", "", "Optional .chmevidence extension file or chm-evidence: token")
	var evidenceFileFlags stringSliceFlag
	fs.Var(&evidenceFileFlags, "evidence-file", "Optional local evidence file path to SHA-256 verify against .chmevidence (repeatable)")
	noticeFlag := fs.String("notice", "", "Optional chm-notice: token or .chnotice.json file path")
	jsonFlag := fs.Bool("json", false, "Emit machine-readable JSON output")

	if err := fs.Parse(args); err != nil {
		return 2
	}

	proofInput := *proofFlag
	noticeInput := *noticeFlag
	evidenceInput := *evidenceFlag
	if proofInput == "" && noticeInput == "" && fs.NArg() > 0 {
		proofInput = fs.Arg(0)
	}

	if evidenceInput != "" && proofInput == "" && noticeInput == "" {
		fmt.Fprintln(stderr, "VERIFICATION FAILED: Standalone .chmevidence cannot verify an artwork without the original proof (--proof).")
		return 1
	}

	if proofInput == "" && noticeInput == "" {
		fmt.Fprintln(stderr, "Usage: chm-verify --proof <url|token|.chproof.json> [--artwork <image.png>] [--evidence <.chmevidence>] [--evidence-file <path>...] [--json]")
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
	summary, rawData, err := verifyProofWithRaw(rawProof, *artworkFlag)
	if err != nil {
		var uErr errUsage
		if errors.As(err, &uErr) {
			fmt.Fprintln(stderr, uErr.msg)
			return 2
		}
		fmt.Fprintf(stderr, "VERIFICATION FAILED: %v\n", err)
		return 1
	}

	if evidenceInput != "" {
		rawEvidence, err := readInputOrFile(evidenceInput)
		if err != nil {
			fmt.Fprintln(stderr, err)
			return 2
		}
		extSummary, err := verifyEvidenceExtension(rawEvidence, rawData, evidenceFileFlags)
		if err != nil {
			var uErr errUsage
			if errors.As(err, &uErr) {
				fmt.Fprintln(stderr, uErr.msg)
				return 2
			}
			fmt.Fprintf(stderr, "EVIDENCE EXTENSION FAILED: %v\n", err)
			return 1
		}
		summary.EvidenceExtension = &extSummary
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
		if summary.UsedDeflate {
			fmt.Fprintf(stdout, "Protocol: v%d (deflate)\n", summary.ProtocolVersion)
		} else {
			fmt.Fprintf(stdout, "Protocol: v%d\n", summary.ProtocolVersion)
		}
		fmt.Fprintf(stdout, "Cryptographic Signature (Ed25519): %s\n", sigLabel)
		fmt.Fprintf(stdout, "Artwork Integrity (SHA-256 RGBA8): %s", strings.ToUpper(summary.IntegrityStatus))
		if summary.MatchedMode != "" {
			fmt.Fprintf(stdout, " (%s)", summary.MatchedMode)
		}
		fmt.Fprintln(stdout)
		fmt.Fprintf(stdout, "Signer Key Fingerprint: %s (%s)\n", summary.PublicKeyFingerprintShort, summary.PublicKeyFingerprintHex)
		fmt.Fprintf(stdout, "Artwork ID: %s\n", summary.ArtworkID)
		fmt.Fprintf(stdout, "License: %s (commercial=%s, redistribution=%s, aiTraining=%s)\n", summary.License, summary.CommercialUse, summary.Redistribution, summary.AiTraining)
		if summary.AllowsDerivatives != "" || summary.AllowsModifications != "" || summary.RequiresAttribution != nil {
			reqAttr := "unspecified"
			if summary.RequiresAttribution != nil {
				reqAttr = fmt.Sprintf("%t", *summary.RequiresAttribution)
			}
			fmt.Fprintf(stdout, "Extended Policy: derivatives=%s, modifications=%s, attributionRequired=%s\n", summary.AllowsDerivatives, summary.AllowsModifications, reqAttr)
		}
		if summary.ArtworkTitle != "" {
			fmt.Fprintf(stdout, "Title: %s\n", summary.ArtworkTitle)
		}
		if summary.AuthorName != "" {
			fmt.Fprintf(stdout, "Author: %s\n", summary.AuthorName)
		}
		if summary.Website != "" {
			fmt.Fprintf(stdout, "Creator Website (self-declared): %s\n", summary.Website)
		}
		if summary.CreationMethod != "" {
			fmt.Fprintf(stdout, "Creation Method: %s (declared by creator; not independently proved)\n", summary.CreationMethod)
		}
		if len(summary.EvidenceHashes) > 0 {
			fmt.Fprintf(stdout, "Embedded Evidence Hashes: %d record(s)\n", len(summary.EvidenceHashes))
		}
		if summary.PolicyNote != "" {
			fmt.Fprintf(stdout, "Policy Note: %s\n", summary.PolicyNote)
		}
		if summary.QrMask != nil && summary.QrMaskCoveragePct != nil {
			fmt.Fprintf(stdout, "Excluded qrMask: [%d, %d, %d, %d] (%.1f%% of artwork)\n", summary.QrMask[0], summary.QrMask[1], summary.QrMask[2], summary.QrMask[3], *summary.QrMaskCoveragePct)
		}
		if summary.EvidenceExtension != nil {
			ext := summary.EvidenceExtension
			fmt.Fprintf(stdout, "Evidence Extension (.chmevidence): %s (%d bytes)\n", strings.ToUpper(ext.Status), ext.EvidenceBytesLength)
			if ext.ArtworkMetadata != nil && ext.ArtworkMetadata.Title != "" {
				fmt.Fprintf(stdout, "Extended Title: %s\n", ext.ArtworkMetadata.Title)
			}
			if ext.ArtworkMetadata != nil && ext.ArtworkMetadata.ArtistName != "" {
				fmt.Fprintf(stdout, "Extended Artist: %s\n", ext.ArtworkMetadata.ArtistName)
			}
			if ext.CreatorProfile != nil && ext.CreatorProfile.Website != "" {
				fmt.Fprintf(stdout, "Creator Website (self-declared): %s\n", ext.CreatorProfile.Website)
			}
			if ext.CreationMethod != nil {
				fmt.Fprintf(stdout, "Creation Method: %s (declared by creator; not independently proved)\n", *ext.CreationMethod)
			}
			if len(ext.RecordChecks) > 0 {
				fmt.Fprintf(stdout, "Evidence Records: %d verified, %d unavailable\n", ext.VerifiedRecordCount, ext.UnavailableRecordCount)
			}
			for _, w := range ext.Warnings {
				fmt.Fprintf(stderr, "Evidence Warning: %s\n", w)
			}
			for _, e := range ext.Errors {
				fmt.Fprintf(stderr, "Evidence Error: %s\n", e)
			}
		}
		fmt.Fprintln(stdout, "Trust Note: Independent CLI checks cryptography and PNG pixel hashes only; confirm key ownership out-of-band.")
	}

	if !summary.SignatureValid || summary.IntegrityStatus == "mismatched" {
		return 1
	}
	if summary.EvidenceExtension != nil && (summary.EvidenceExtension.Status != "valid" || len(summary.EvidenceExtension.MismatchedSuppliedFiles) > 0) {
		return 1
	}
	return 0
}

func main() {
	os.Exit(run(os.Args[1:], os.Stdout, os.Stderr))
}
