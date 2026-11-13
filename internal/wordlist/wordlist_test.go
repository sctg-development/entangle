package wordlist

import (
	"os"
	"strings"
	"testing"
)

func TestEmbeddedEFF(t *testing.T) {
	wl := EmbeddedEFF()
	if wl == nil {
		t.Fatal("EmbeddedEFF returned nil")
	}
	if len(wl.Words) != 7776 {
		t.Errorf("EFF wordlist has %d words, want 7776", len(wl.Words))
	}
	// Check a few known words
	expected := []string{"abacus", "abdomen", "abdominal", "abide", "abiding"}
	for _, exp := range expected {
		found := false
		for _, w := range wl.Words {
			if w == exp {
				found = true
				break
			}
		}
		if !found {
			t.Errorf("EFF wordlist missing expected word: %s", exp)
		}
	}
	// Ensure no empty words
	for _, w := range wl.Words {
		if w == "" {
			t.Error("EFF wordlist contains empty word")
		}
	}
}

func TestEmbeddedLanguages(t *testing.T) {
	want := map[string]int{"en": 7776, "fr": 7775, "de": 7776, "es": 8192, "it": 8192, "pt": 7776}
	for lang, n := range want {
		wl, ok := Embedded(lang)
		if !ok {
			t.Fatalf("%s: not embedded", lang)
		}
		if len(wl.Words) != n {
			t.Errorf("%s: %d words, want %d", lang, len(wl.Words), n)
		}
		seen := map[string]bool{}
		for _, w := range wl.Words {
			if len(w) < 3 || strings.Trim(w, "abcdefghijklmnopqrstuvwxyz-") != "" {
				t.Errorf("%s: bad word %q", lang, w)
			}
			if seen[w] {
				t.Errorf("%s: duplicate word %q", lang, w)
			}
			seen[w] = true
		}
	}
}

func TestForName(t *testing.T) {
	for _, n := range []string{"eff", "fr", "German", "español", "it", "pt-br"} {
		if _, ok := ForName(n); !ok {
			t.Errorf("ForName(%q) not found", n)
		}
	}
	if _, ok := ForName("/tmp/x.txt"); ok {
		t.Error("path must not resolve")
	}
}

func TestLoadEFFWithEmptyPath(t *testing.T) {
	wl, err := LoadEFF("")
	if err != nil {
		t.Fatalf("LoadEFF(\"\") returned error: %v", err)
	}
	if len(wl.Words) != 7776 {
		t.Errorf("LoadEFF(\"\") has %d words, want 7776", len(wl.Words))
	}
}

func TestLoadFrenchWithEmptyPath(t *testing.T) {
	wl, err := LoadFrench("")
	if err != nil {
		t.Fatalf("LoadFrench(\"\") returned error: %v", err)
	}
	if len(wl.Words) != 7775 {
		t.Errorf("LoadFrench(\"\") has %d words, expected 7775", len(wl.Words))
	}
}

func TestLoadEFFWithFile(t *testing.T) {
	// Create a temp file with EFF format
	tmpDir := t.TempDir()
	effFile := tmpDir + "/eff.txt"
	content := "11111\tabacus\n11112\tabdomen\n"
	if err := os.WriteFile(effFile, []byte(content), 0644); err != nil {
		t.Fatal(err)
	}
	wl, err := LoadEFF(effFile)
	if err != nil {
		t.Fatal(err)
	}
	if len(wl.Words) != 2 {
		t.Errorf("expected 2 words, got %d", len(wl.Words))
	}
	if wl.Words[0] != "abacus" || wl.Words[1] != "abdomen" {
		t.Errorf("unexpected words: %v", wl.Words)
	}
}

func TestLoadFrenchWithFile(t *testing.T) {
	tmpDir := t.TempDir()
	frFile := tmpDir + "/fr.txt"
	content := "11111 a\n11112 abat\n11113 test-word\n"
	if err := os.WriteFile(frFile, []byte(content), 0644); err != nil {
		t.Fatal(err)
	}
	wl, err := LoadFrench(frFile)
	if err != nil {
		t.Fatal(err)
	}
	if len(wl.Words) != 3 {
		t.Errorf("expected 3 words, got %d", len(wl.Words))
	}
}
