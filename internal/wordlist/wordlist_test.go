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

func TestEmbeddedFrench(t *testing.T) {
	wl := EmbeddedFrench()
	if wl == nil {
		t.Fatal("EmbeddedFrench returned nil")
	}
	if len(wl.Words) < 7000 {
		t.Errorf("French wordlist has %d words, expected at least 7000", len(wl.Words))
	}
	// Check a few known words
	expected := []string{"a", "ab", "abat", "abats", "abatte"}
	for _, exp := range expected {
		found := false
		for _, w := range wl.Words {
			if w == exp {
				found = true
				break
			}
		}
		if !found {
			t.Errorf("French wordlist missing expected word: %s", exp)
		}
	}
	// Ensure no empty words
	for _, w := range wl.Words {
		if w == "" {
			t.Error("French wordlist contains empty word")
		}
	}
	// Ensure no punctuation-only words
	for _, w := range wl.Words {
		if strings.ContainsAny(w, "=;:!@#$%^&*()_+[]{}|\\\"'<>,.?/0123456789") && !strings.ContainsAny(w, "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ") {
			t.Errorf("French wordlist contains invalid word: %s", w)
		}
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
	if len(wl.Words) < 7000 {
		t.Errorf("LoadFrench(\"\") has %d words, expected at least 7000", len(wl.Words))
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
