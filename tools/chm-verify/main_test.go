package main

import (
	"bytes"
	"crypto/ed25519"
	"encoding/base64"
	"encoding/binary"
	"image"
	"image/color"
	"image/png"
	"os"
	"path/filepath"
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
