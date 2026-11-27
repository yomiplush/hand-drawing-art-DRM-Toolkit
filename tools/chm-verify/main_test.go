package main

import (
	"bytes"
	"compress/flate"
	"crypto/ed25519"
	"crypto/sha256"
	"encoding/base64"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"image"
	"image/color"
	"image/png"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

const (
	normativeV1Token = "gwFYk6gBUAEjRWeJq83vQSOBI0VniasCWCDXWpgBgrEKt9VL_tPJZAc6DuFy89qmIyWvAhpo9wdRGgNYIOYBn-Qcdjc2CrkMicM4sdyGR2bHrbtIuWCr2UY3JcV6BIQYGBgYAgIFGmsC6NIGhQQCAQJpWW9taVBsdXNoB2lZb21pUGx1c2gIb1Rlc3QgVmVjdG9yIDJ4MlhA3h7ocTKymomonxlUtWughyq7B7fzi78F3nP6fQBk8heiLtPIFoAA1VKwTpKs3J2TENjLeO-TLlmt63GsaWjUBA"
	normativeV2Token = "gwJYlakBUP7cuph2VEMhgSNFZ4mrze8CWCDXWpgBgrEKt9VL_tPJZAc6DuFy89qmIyWvAhpo9wdRGgNYIL4T1EuxOwqo0mye468j4PtYPeqalKJhFPOd7lqlJZjzBIQAABgYGBgFGmsC6NIGhAACAgIHaVlvbWlQbHVzaAh1VGVzdCBWZWN0b3IgdjIgTWFza2VkCYQCAhUVWECCwvqH-yEO5EbIQlDNGeWAaR5d2Qyvzmbmd4tsSiDL2Wn1GAD3TWlZMeuWQtoajg5gONB9W_C_5dAYSeXxZ34D"
)

func TestNormativeV1VectorAndPNGVerification(t *testing.T) {
	tmp := t.TempDir()
	// Exact SPEC.md Section 8 2x2 straight RGBA8 test vector (with alpha=0 non-zero RGB):
	// ff0000ff 00ff00ff 0000ffff 7b2d4300
	img := image.NewNRGBA(image.Rect(0, 0, 2, 2))
	img.SetNRGBA(0, 0, color.NRGBA{255, 0, 0, 255})
	img.SetNRGBA(1, 0, color.NRGBA{0, 255, 0, 255})
	img.SetNRGBA(0, 1, color.NRGBA{0, 0, 255, 255})
	img.SetNRGBA(1, 1, color.NRGBA{123, 45, 67, 0})

	pngPath := filepath.Join(tmp, "v1.png")
	f, err := os.Create(pngPath)
	if err != nil {
		t.Fatal(err)
	}
	if err := png.Encode(f, img); err != nil {
		t.Fatal(err)
	}
	_ = f.Close()

	var stdout, stderr bytes.Buffer
	code := run([]string{"--proof", "https://certified-handmade.com/verify#proof=" + normativeV1Token, "--artwork", pngPath}, &stdout, &stderr)
	if code != 0 {
		t.Fatalf("expected exit 0 for normative v1 PNG, got %d; stderr=%s stdout=%s", code, stderr.String(), stdout.String())
	}

	img.SetNRGBA(0, 0, color.NRGBA{254, 0, 0, 255})
	badPath := filepath.Join(tmp, "v1-bad.png")
	bf, _ := os.Create(badPath)
	_ = png.Encode(bf, img)
	_ = bf.Close()

	stdout.Reset()
	stderr.Reset()
	code = run([]string{"--proof", normativeV1Token, "--artwork", badPath}, &stdout, &stderr)
	if code != 1 {
		t.Fatalf("expected exit 1 for tampered v1 PNG, got %d", code)
	}
}

func TestNormativeV2MaskedVectorAndMaskBoundary(t *testing.T) {
	tmp := t.TempDir()
	img := image.NewNRGBA(image.Rect(0, 0, 24, 24))
	for y := 0; y < 24; y++ {
		for x := 0; x < 24; x++ {
			img.SetNRGBA(x, y, color.NRGBA{
				R: uint8((x*10 + y) & 0xff),
				G: uint8((x + y*10) & 0xff),
				B: uint8((x ^ y) & 0xff),
				A: 255,
			})
		}
	}
	// Mutating inside qrMask [2,2,21,21] MUST still pass v2 masked integrity
	img.SetNRGBA(6, 6, color.NRGBA{99, 88, 77, 255})
	v2Path := filepath.Join(tmp, "v2.png")
	f, _ := os.Create(v2Path)
	_ = png.Encode(f, img)
	_ = f.Close()

	var stdout, stderr bytes.Buffer
	code := run([]string{"--proof", normativeV2Token, "--artwork", v2Path}, &stdout, &stderr)
	if code != 0 {
		t.Fatalf("expected exit 0 for v2 masked vector, got %d; stderr=%s stdout=%s", code, stderr.String(), stdout.String())
	}

	// Mutating outside qrMask at (0,0) MUST fail with exit code 1
	img.SetNRGBA(0, 0, color.NRGBA{123, 0, 0, 255})
	v2BadPath := filepath.Join(tmp, "v2-bad.png")
	bf, _ := os.Create(v2BadPath)
	_ = png.Encode(bf, img)
	_ = bf.Close()

	stdout.Reset()
	stderr.Reset()
	code = run([]string{"--proof", normativeV2Token, "--artwork", v2BadPath}, &stdout, &stderr)
	if code != 1 {
		t.Fatalf("expected exit 1 for v2 pixel tampered outside mask, got %d", code)
	}
}

func TestNegativeCBORAndSignatureCases(t *testing.T) {
	var stdout, stderr bytes.Buffer

	nonCanon := base64.RawURLEncoding.EncodeToString([]byte{0x83, 0x18, 0x01, 0x41, 0x01, 0x58, 64})
	if code := run([]string{"--proof", nonCanon}, &stdout, &stderr); code != 1 {
		t.Fatalf("expected exit 1 for non-canonical CBOR, got %d", code)
	}

	indef := base64.RawURLEncoding.EncodeToString([]byte{0x9f, 0x01, 0xff})
	if code := run([]string{"--proof", indef}, &stdout, &stderr); code != 1 {
		t.Fatalf("expected exit 1 for indefinite CBOR, got %d", code)
	}

	if _, err := decodeCanonicalCBOR([]byte{0xa2, 0x01, 0x01, 0x01, 0x02}); err == nil {
		t.Fatalf("expected duplicate CBOR map keys to fail")
	}

	raw, _ := decodeStrictBase64Url(normativeV1Token)
	raw[len(raw)-1] ^= 0x01
	badSigToken := base64.RawURLEncoding.EncodeToString(raw)
	if code := run([]string{"--proof", badSigToken}, &stdout, &stderr); code != 1 {
		t.Fatalf("expected exit 1 for tampered signature, got %d", code)
	}
}

func TestNoticeVerificationAndForgedNoticeRejection(t *testing.T) {
	pub1, priv1, err := ed25519.GenerateKey(nil)
	if err != nil {
		t.Fatal(err)
	}
	pub2, priv2, err := ed25519.GenerateKey(nil)
	if err != nil {
		t.Fatal(err)
	}

	var payload bytes.Buffer
	payload.WriteByte(0xa6)
	payload.Write([]byte{0x01, 0x50})
	payload.Write(bytes.Repeat([]byte{0xaa}, 16))
	payload.Write([]byte{0x02, 0x02})
	payload.Write([]byte{0x03, 0x58, 32})
	payload.Write(pub1)
	payload.Write([]byte{0x04, 0x58, 32})
	payload.Write(pub2)
	payload.WriteByte(0x05)
	payload.WriteByte(0x1a)
	var ts [4]byte
	binary.BigEndian.PutUint32(ts[:], 1795352786)
	payload.Write(ts[:])
	payload.Write([]byte{0x06, 0x02})

	msg := append([]byte{}, domainNoticePrefix...)
	msg = append(msg, payload.Bytes()...)
	sig1 := ed25519.Sign(priv1, msg)
	sig2 := ed25519.Sign(priv2, msg)

	encodeBytesHeader := func(b *bytes.Buffer, n int) {
		if n < 24 {
			b.WriteByte(0x40 | byte(n))
		} else if n < 256 {
			b.WriteByte(0x58)
			b.WriteByte(byte(n))
		} else {
			b.WriteByte(0x59)
			var l [2]byte
			binary.BigEndian.PutUint16(l[:], uint16(n))
			b.Write(l[:])
		}
	}

	var env bytes.Buffer
	env.Write([]byte{0x84, 0x01})
	encodeBytesHeader(&env, payload.Len())
	env.Write(payload.Bytes())
	encodeBytesHeader(&env, 64)
	env.Write(sig1)
	encodeBytesHeader(&env, 64)
	env.Write(sig2)

	token := "chm-notice:" + base64.RawURLEncoding.EncodeToString(env.Bytes())
	var stdout, stderr bytes.Buffer
	if code := run([]string{"--notice", token}, &stdout, &stderr); code != 0 {
		t.Fatalf("expected exit 0 for valid rotation notice, got %d; stderr=%s", code, stderr.String())
	}

	badEnv := append([]byte{}, env.Bytes()...)
	badEnv[len(badEnv)-1] ^= 0xff
	badToken := "chm-notice:" + base64.RawURLEncoding.EncodeToString(badEnv)
	stdout.Reset()
	stderr.Reset()
	if code := run([]string{"--notice", badToken}, &stdout, &stderr); code != 1 {
		t.Fatalf("expected exit 1 for forged replacement signature, got %d", code)
	}
}

func cborWriteMajorUint(b *bytes.Buffer, major byte, n uint64) {
	prefix := major << 5
	switch {
	case n < 24:
		b.WriteByte(prefix | byte(n))
	case n < 256:
		b.WriteByte(prefix | 24)
		b.WriteByte(byte(n))
	case n < 65536:
		b.WriteByte(prefix | 25)
		var buf [2]byte
		binary.BigEndian.PutUint16(buf[:], uint16(n))
		b.Write(buf[:])
	case n <= 0xffffffff:
		b.WriteByte(prefix | 26)
		var buf [4]byte
		binary.BigEndian.PutUint32(buf[:], uint32(n))
		b.Write(buf[:])
	default:
		b.WriteByte(prefix | 27)
		var buf [8]byte
		binary.BigEndian.PutUint64(buf[:], n)
		b.Write(buf[:])
	}
}

func cborWriteBytes(b *bytes.Buffer, raw []byte) {
	cborWriteMajorUint(b, 2, uint64(len(raw)))
	b.Write(raw)
}

func cborWriteText(b *bytes.Buffer, s string) {
	cborWriteMajorUint(b, 3, uint64(len(s)))
	b.WriteString(s)
}

func TestEvidenceExtensionModesAndSecurity(t *testing.T) {
	tmp := t.TempDir()

	_, rawData, err := verifyProofWithRaw(normativeV1Token, "")
	if err != nil {
		t.Fatalf("verifyProofWithRaw failed: %v", err)
	}
	seed, _ := hex.DecodeString("9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60")
	priv := ed25519.NewKeyFromSeed(seed)
	if !bytes.Equal(priv.Public().(ed25519.PublicKey), rawData.publicKey) {
		t.Fatalf("normative seed public key mismatch")
	}

	sketchBytes := []byte("ROUGH-SKETCH-LAYER-DATA-FOR-CHM-EVIDENCE-PARITY")
	sketchPath := filepath.Join(tmp, "rough-sketch.kra")
	if err := os.WriteFile(sketchPath, sketchBytes, 0o600); err != nil {
		t.Fatal(err)
	}
	sketchSum := sha256.Sum256(sketchBytes)

	wrongPath := filepath.Join(tmp, "wrong.kra")
	if err := os.WriteFile(wrongPath, []byte("DIFFERENT-FILE"), 0o600); err != nil {
		t.Fatal(err)
	}

	proofSum := sha256.Sum256(rawData.proofBytes)
	evidenceID := bytes.Repeat([]byte{0x44}, 16)

	// Build canonical CBOR payload (keys 1..11)
	var payload bytes.Buffer
	cborWriteMajorUint(&payload, 5, 11)

	cborWriteMajorUint(&payload, 0, 1)
	cborWriteBytes(&payload, evidenceID)

	cborWriteMajorUint(&payload, 0, 2)
	cborWriteBytes(&payload, rawData.publicKey)

	cborWriteMajorUint(&payload, 0, 3)
	cborWriteBytes(&payload, proofSum[:])

	cborWriteMajorUint(&payload, 0, 4)
	cborWriteBytes(&payload, rawData.artworkID)

	cborWriteMajorUint(&payload, 0, 5)
	cborWriteBytes(&payload, rawData.artworkSha256)

	cborWriteMajorUint(&payload, 0, 6)
	cborWriteMajorUint(&payload, 0, 1795352800)

	// key 7: artworkMetadata {1: title, 2: artistName, 3: description}
	cborWriteMajorUint(&payload, 0, 7)
	cborWriteMajorUint(&payload, 5, 3)
	cborWriteMajorUint(&payload, 0, 1)
	cborWriteText(&payload, "月光のアトリエ 🎨")
	cborWriteMajorUint(&payload, 0, 2)
	cborWriteText(&payload, "Studio Yomi")
	cborWriteMajorUint(&payload, 0, 3)
	cborWriteText(&payload, "Line 1\nHand-drawn test study")

	// key 8: creatorProfile {1: displayName, 2: website, 3: [[url, label]]}
	cborWriteMajorUint(&payload, 0, 8)
	cborWriteMajorUint(&payload, 5, 3)
	cborWriteMajorUint(&payload, 0, 1)
	cborWriteText(&payload, "YomiPlush")
	cborWriteMajorUint(&payload, 0, 2)
	cborWriteText(&payload, "https://certified-handmade.com")
	cborWriteMajorUint(&payload, 0, 3)
	cborWriteMajorUint(&payload, 4, 1)
	cborWriteMajorUint(&payload, 4, 2)
	cborWriteText(&payload, "https://social.example/@yomi")
	cborWriteText(&payload, "Mastodon")

	// key 9: creationMethod = 1 (hand-drawn-no-ai)
	cborWriteMajorUint(&payload, 0, 9)
	cborWriteMajorUint(&payload, 0, 1)

	// key 10: creationEnvironment {1: software, 2: hardware, 3: inputDevice}
	cborWriteMajorUint(&payload, 0, 10)
	cborWriteMajorUint(&payload, 5, 3)
	cborWriteMajorUint(&payload, 0, 1)
	cborWriteText(&payload, "Krita")
	cborWriteMajorUint(&payload, 0, 2)
	cborWriteText(&payload, "Linux workstation")
	cborWriteMajorUint(&payload, 0, 3)
	cborWriteText(&payload, "Wacom pen")

	// key 11: evidenceRecords [{1: sha256, 2: byteLength, 3: label, 4: 1 (sketch)}]
	cborWriteMajorUint(&payload, 0, 11)
	cborWriteMajorUint(&payload, 4, 1)
	cborWriteMajorUint(&payload, 5, 4)
	cborWriteMajorUint(&payload, 0, 1)
	cborWriteBytes(&payload, sketchSum[:])
	cborWriteMajorUint(&payload, 0, 2)
	cborWriteMajorUint(&payload, 0, uint64(len(sketchBytes)))
	cborWriteMajorUint(&payload, 0, 3)
	cborWriteText(&payload, "rough-sketch.kra")
	cborWriteMajorUint(&payload, 0, 4)
	cborWriteMajorUint(&payload, 0, 1)

	signingMsg := append([]byte{}, domainEvidencePrefix...)
	signingMsg = append(signingMsg, payload.Bytes()...)
	sig := ed25519.Sign(priv, signingMsg)

	var env bytes.Buffer
	cborWriteMajorUint(&env, 4, 3)
	cborWriteMajorUint(&env, 0, 1)
	cborWriteBytes(&env, payload.Bytes())
	cborWriteBytes(&env, sig)

	token := base64.RawURLEncoding.EncodeToString(env.Bytes())
	bundleJSON, _ := json.Marshal(map[string]any{
		"format":            "certified-handmade-evidence",
		"version":           1,
		"evidenceBase64Url": token,
	})
	evPath := filepath.Join(tmp, "art.chmevidence")
	if err := os.WriteFile(evPath, bundleJSON, 0o600); err != nil {
		t.Fatal(err)
	}

	// 1. Mode B: proof + .chmevidence without supplied evidence files -> exit 0, unavailable=1
	var stdout, stderr bytes.Buffer
	code := run([]string{"--proof", normativeV1Token, "--evidence", evPath, "--json"}, &stdout, &stderr)
	if code != 0 {
		t.Fatalf("Mode B failed (%d): stdout=%s stderr=%s", code, stdout.String(), stderr.String())
	}
	var modeBReport ProofSummary
	if err := json.Unmarshal(stdout.Bytes(), &modeBReport); err != nil {
		t.Fatal(err)
	}
	if modeBReport.EvidenceExtension == nil || modeBReport.EvidenceExtension.Status != "valid" || modeBReport.EvidenceExtension.UnavailableRecordCount != 1 || modeBReport.EvidenceExtension.VerifiedRecordCount != 0 {
		t.Fatalf("unexpected Mode B summary: %+v", modeBReport.EvidenceExtension)
	}

	// 2. Mode C valid: proof + .chmevidence + matching sketch -> exit 0, verified=1
	stdout.Reset()
	stderr.Reset()
	code = run([]string{"--proof", normativeV1Token, "--evidence", evPath, "--evidence-file", sketchPath, "--json"}, &stdout, &stderr)
	if code != 0 {
		t.Fatalf("Mode C valid failed (%d): stdout=%s stderr=%s", code, stdout.String(), stderr.String())
	}
	var modeCReport ProofSummary
	if err := json.Unmarshal(stdout.Bytes(), &modeCReport); err != nil {
		t.Fatal(err)
	}
	if modeCReport.EvidenceExtension == nil || modeCReport.EvidenceExtension.Status != "valid" || modeCReport.EvidenceExtension.VerifiedRecordCount != 1 || modeCReport.EvidenceExtension.UnavailableRecordCount != 0 {
		t.Fatalf("unexpected Mode C summary: %+v", modeCReport.EvidenceExtension)
	}

	// 3. Mode C mismatch: wrong evidence file supplied -> exit 1
	stdout.Reset()
	stderr.Reset()
	code = run([]string{"--proof", normativeV1Token, "--evidence", evPath, "--evidence-file", wrongPath, "--json"}, &stdout, &stderr)
	if code != 1 {
		t.Fatalf("expected exit 1 for mismatched evidence file, got %d", code)
	}
	var mismatchReport ProofSummary
	if err := json.Unmarshal(stdout.Bytes(), &mismatchReport); err != nil {
		t.Fatal(err)
	}
	if mismatchReport.EvidenceExtension == nil || len(mismatchReport.EvidenceExtension.MismatchedSuppliedFiles) != 1 {
		t.Fatalf("expected 1 mismatched file, got %+v", mismatchReport.EvidenceExtension)
	}

	// 4. Cross-proof binding mismatch against normativeV2Token -> exit 1, status=binding-mismatch
	stdout.Reset()
	stderr.Reset()
	code = run([]string{"--proof", normativeV2Token, "--evidence", evPath, "--json"}, &stdout, &stderr)
	if code != 1 {
		t.Fatalf("expected exit 1 for cross-proof mismatch, got %d", code)
	}
	var replayReport ProofSummary
	if err := json.Unmarshal(stdout.Bytes(), &replayReport); err != nil {
		t.Fatal(err)
	}
	if replayReport.EvidenceExtension == nil || replayReport.EvidenceExtension.Status != "binding-mismatch" {
		t.Fatalf("expected binding-mismatch, got %+v", replayReport.EvidenceExtension)
	}

	// 5. Tampered signature -> exit 1, status=invalid
	badEnv := append([]byte{}, env.Bytes()...)
	badEnv[len(badEnv)-1] ^= 0x01
	badToken := "chm-evidence:" + base64.RawURLEncoding.EncodeToString(badEnv)
	stdout.Reset()
	stderr.Reset()
	code = run([]string{"--proof", normativeV1Token, "--evidence", badToken, "--json"}, &stdout, &stderr)
	if code != 1 {
		t.Fatalf("expected exit 1 for tampered evidence signature, got %d", code)
	}
	var sigFailReport ProofSummary
	if err := json.Unmarshal(stdout.Bytes(), &sigFailReport); err != nil {
		t.Fatal(err)
	}
	if sigFailReport.EvidenceExtension == nil || sigFailReport.EvidenceExtension.Status != "invalid" {
		t.Fatalf("expected invalid signature status, got %+v", sigFailReport.EvidenceExtension)
	}

	// 6. Standalone --evidence without primary proof -> exit 1
	stdout.Reset()
	stderr.Reset()
	if code := run([]string{"--evidence", evPath}, &stdout, &stderr); code != 1 {
		t.Fatalf("expected exit 1 for standalone --evidence, got %d", code)
	}

	// 7. Non-canonical CBOR in evidence envelope -> exit 1
	nonCanonEv := base64.RawURLEncoding.EncodeToString([]byte{0x83, 0x18, 0x01, 0x41, 0x01, 0x58, 64})
	stdout.Reset()
	stderr.Reset()
	if code := run([]string{"--proof", normativeV1Token, "--evidence", nonCanonEv}, &stdout, &stderr); code != 1 {
		t.Fatalf("expected exit 1 for non-canonical CBOR evidence, got %d", code)
	}
}

func TestProtocolV3AndBombDefense(t *testing.T) {
	seed, _ := hex.DecodeString("9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60")
	priv := ed25519.NewKeyFromSeed(seed)
	pub := priv.Public().(ed25519.PublicKey)

	// Pack policyFlags: commercial=disallow(2), redistribution=disallow(2), aiTraining=disallow(2),
	// allowsDerivatives=allow(1), allowsModifications=disallow(2), hasAttr(0x400), attrVal(0x800)
	policyFlags := uint64(2 | (2 << 2) | (2 << 4) | (1 << 6) | (2 << 8) | 0x400 | 0x800)
	artworkHash := sha256.Sum256([]byte("v3-go-test-pixels"))
	artworkID := bytes.Repeat([]byte{0x12}, 16)

	var payload bytes.Buffer
	cborWriteMajorUint(&payload, 5, 12) // keys: 1,2,3,4,5,6,7,8,11,12,14,17

	cborWriteMajorUint(&payload, 0, 1) // artworkId
	cborWriteBytes(&payload, artworkID)

	cborWriteMajorUint(&payload, 0, 2) // publicKey
	cborWriteBytes(&payload, pub)

	cborWriteMajorUint(&payload, 0, 3) // sha256
	cborWriteBytes(&payload, artworkHash[:])

	cborWriteMajorUint(&payload, 0, 4) // region
	cborWriteMajorUint(&payload, 4, 4)
	cborWriteMajorUint(&payload, 0, 10)
	cborWriteMajorUint(&payload, 0, 10)
	cborWriteMajorUint(&payload, 0, 80)
	cborWriteMajorUint(&payload, 0, 80)

	cborWriteMajorUint(&payload, 0, 5) // issuedAt
	cborWriteMajorUint(&payload, 0, 1795352800)

	cborWriteMajorUint(&payload, 0, 6) // license [code, flags]
	cborWriteMajorUint(&payload, 4, 2)
	cborWriteMajorUint(&payload, 0, 0) // ARR
	cborWriteMajorUint(&payload, 0, policyFlags)

	cborWriteMajorUint(&payload, 0, 7) // authorName
	cborWriteText(&payload, "Yomi")

	cborWriteMajorUint(&payload, 0, 8) // artworkTitle
	cborWriteText(&payload, "Go Parity Sketch")

	cborWriteMajorUint(&payload, 0, 11) // website
	cborWriteMajorUint(&payload, 4, 2)
	cborWriteMajorUint(&payload, 0, 1) // https://
	cborWriteText(&payload, "certified-handmade.com")

	cborWriteMajorUint(&payload, 0, 12) // snsLinks
	cborWriteMajorUint(&payload, 4, 1)
	cborWriteMajorUint(&payload, 4, 3)
	cborWriteMajorUint(&payload, 0, 3) // https://x.com/
	cborWriteText(&payload, "yomi_art")
	cborWriteMajorUint(&payload, 0, 1) // x

	cborWriteMajorUint(&payload, 0, 14) // creationMethod
	cborWriteMajorUint(&payload, 0, 1)  // hand-drawn-no-ai

	cborWriteMajorUint(&payload, 0, 17) // policyNote
	cborWriteText(&payload, "Personal study only")

	// Sign CHM3\0 || canonical payload
	signingMsg := append([]byte{}, domainProofPrefixV3...)
	signingMsg = append(signingMsg, payload.Bytes()...)
	sig := ed25519.Sign(priv, signingMsg)

	var compressed bytes.Buffer
	fw, err := flate.NewWriter(&compressed, flate.DefaultCompression)
	if err != nil {
		t.Fatal(err)
	}
	_, _ = fw.Write(payload.Bytes())
	_ = fw.Close()

	var env bytes.Buffer
	cborWriteMajorUint(&env, 4, 4)
	cborWriteMajorUint(&env, 0, 3)
	cborWriteMajorUint(&env, 0, 1) // deflate flag
	cborWriteBytes(&env, compressed.Bytes())
	cborWriteBytes(&env, sig)

	token := base64.RawURLEncoding.EncodeToString(env.Bytes())
	var stdout, stderr bytes.Buffer
	if code := run([]string{"--proof", token, "--json"}, &stdout, &stderr); code != 0 {
		t.Fatalf("expected v3 deflated proof exit 0, got %d; stderr=%s", code, stderr.String())
	}
	var report ProofSummary
	if err := json.Unmarshal(stdout.Bytes(), &report); err != nil {
		t.Fatal(err)
	}
	if report.ProtocolVersion != 3 || !report.UsedDeflate || !report.SignatureValid {
		t.Fatalf("unexpected v3 flags: %+v", report)
	}
	if report.ArtworkTitle != "Go Parity Sketch" || report.Website != "https://certified-handmade.com" {
		t.Fatalf("unexpected v3 metadata: %+v", report)
	}
	if len(report.SnsLinks) != 1 || report.SnsLinks[0].URL != "https://x.com/yomi_art" || report.SnsLinks[0].Platform != "x" {
		t.Fatalf("unexpected v3 SNS link: %+v", report.SnsLinks)
	}
	if report.AllowsDerivatives != "allow" || report.AllowsModifications != "disallow" || report.RequiresAttribution == nil || !*report.RequiresAttribution {
		t.Fatalf("unexpected v3 policy flags: %+v", report)
	}
	if report.PolicyNote != "Personal study only" {
		t.Fatalf("unexpected v3 policy note: %s", report.PolicyNote)
	}

	// Text output should include v3 deflate label
	stdout.Reset()
	stderr.Reset()
	if code := run([]string{"--proof", token}, &stdout, &stderr); code != 0 {
		t.Fatalf("expected v3 text exit 0, got %d", code)
	}
	if !strings.Contains(stdout.String(), "Protocol: v3 (deflate)") {
		t.Fatalf("expected Protocol: v3 (deflate) in output, got: %s", stdout.String())
	}

	// Non-canonical URL prefix code (using code 1 https:// for x.com/ instead of code 3) must fail
	if _, err := decodeV3CompactURL([]any{uint64(1), "x.com/yomi_art"}, "snsLinks[0].url"); err == nil {
		t.Fatalf("expected non-canonical URL prefix to be rejected")
	}

	// Decompression bomb (> 8192 bytes) must be bounded and rejected
	bombRaw := bytes.Repeat([]byte("A"), MaxV3DecompressedBytes+64)
	var bombDef bytes.Buffer
	bw, _ := flate.NewWriter(&bombDef, flate.BestCompression)
	_, _ = bw.Write(bombRaw)
	_ = bw.Close()
	if _, err := inflateRawBoundedGo(bombDef.Bytes(), MaxV3DecompressedBytes); err == nil {
		t.Fatalf("expected decompression bomb > %d bytes to fail", MaxV3DecompressedBytes)
	}
}

func TestProtocolVectors(t *testing.T) {
	type proofVector struct {
		ID              string `json:"id"`
		ProtocolVersion int    `json:"protocolVersion"`
		ExpectedValid   bool   `json:"expectedValid"`
		ProofBase64URL  string `json:"proofBase64Url"`
	}
	type evidenceVector struct {
		ID                string `json:"id"`
		PrimaryProofID    string `json:"primaryProofId"`
		ExpectedValid     bool   `json:"expectedValid"`
		ExpectedStatus    string `json:"expectedStatus"`
		EvidenceBase64URL string `json:"evidenceBase64Url"`
	}
	type vectorSuite struct {
		SchemaVersion   int              `json:"schemaVersion"`
		ProofVectors    []proofVector    `json:"proofVectors"`
		EvidenceVectors []evidenceVector `json:"evidenceVectors"`
	}

	raw, err := os.ReadFile("../../tests/vectors/protocol-vectors.json")
	if err != nil {
		t.Fatalf("failed to read protocol-vectors.json: %v", err)
	}
	var suite vectorSuite
	if err := json.Unmarshal(raw, &suite); err != nil {
		t.Fatalf("failed to parse protocol-vectors.json: %v", err)
	}
	if len(suite.ProofVectors) < 9 || len(suite.EvidenceVectors) < 2 {
		t.Fatalf("unexpected vector counts: proofs=%d evidence=%d", len(suite.ProofVectors), len(suite.EvidenceVectors))
	}

	proofTokenByID := make(map[string]string, len(suite.ProofVectors))

	for _, vec := range suite.ProofVectors {
		proofTokenByID[vec.ID] = vec.ProofBase64URL

		var stdout, stderr bytes.Buffer
		code := run([]string{"--proof", vec.ProofBase64URL, "--json"}, &stdout, &stderr)
		if vec.ExpectedValid {
			if code != 0 {
				t.Fatalf("Go CLI rejected valid vector %s (code=%d, stderr=%s)", vec.ID, code, stderr.String())
			}
		} else {
			if code == 0 {
				t.Fatalf("Go CLI accepted invalid vector %s (stdout=%s)", vec.ID, stdout.String())
			}
		}
	}

	for _, ev := range suite.EvidenceVectors {
		primaryToken, ok := proofTokenByID[ev.PrimaryProofID]
		if !ok {
			t.Fatalf("missing primary proof %s", ev.PrimaryProofID)
		}
		evToken := "chm-evidence:" + ev.EvidenceBase64URL

		var stdout, stderr bytes.Buffer
		code := run([]string{"--proof", primaryToken, "--evidence", evToken, "--json"}, &stdout, &stderr)
		if ev.ExpectedValid {
			if code != 0 {
				t.Fatalf("Go CLI rejected valid evidence vector %s (code=%d, stderr=%s)", ev.ID, code, stderr.String())
			}
		} else {
			if code == 0 {
				t.Fatalf("Go CLI accepted invalid evidence vector %s (stdout=%s)", ev.ID, stdout.String())
			}
		}
	}
}
