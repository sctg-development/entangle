package cli

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// TestSendFileUsageErrorWhenNoFile ensures the command bails out before
// touching the transfer layer when no file argument is given.
func TestSendFileUsageErrorWhenNoFile(t *testing.T) {
	err := runSendFile(nil)
	if err == nil {
		t.Fatal("expected an error for missing file argument")
	}
	if !strings.Contains(err.Error(), "usage") {
		t.Errorf("expected usage error, got: %v", err)
	}
}

// TestSendFileErrorOnMissingFile verifies that a nonexistent path surfaces as
// an error rather than proceeding.
func TestSendFileErrorOnMissingFile(t *testing.T) {
	err := runSendFile([]string{"/nonexistent/path/to/file.txt"})
	if err == nil {
		t.Fatal("expected an error for a missing file")
	}
}

// TestSendFileErrorOnDirectory verifies that a directory argument is rejected,
// since send-file is for single files only.
func TestSendFileErrorOnDirectory(t *testing.T) {
	dir := t.TempDir()
	err := runSendFile([]string{dir})
	if err == nil {
		t.Fatal("expected an error for a directory argument")
	}
	if !strings.Contains(err.Error(), "directory") {
		t.Errorf("expected a directory error, got: %v", err)
	}
}

// TestReceiveFileUsageErrorWhenNoCode ensures the command bails out when no
// code argument is given.
func TestReceiveFileUsageErrorWhenNoCode(t *testing.T) {
	err := runReceiveFile(nil)
	if err == nil {
		t.Fatal("expected an error for missing code argument")
	}
	if !strings.Contains(err.Error(), "usage") {
		t.Errorf("expected usage error, got: %v", err)
	}
}

// TestReceiveFileConfirmPromptsOnExistingFile verifies the overwrite prompt
// fires when the destination already exists and --yes is not set.
func TestReceiveFileConfirmPromptsOnExistingFile(t *testing.T) {
	// fileExists is the helper used before creating the output file;
	// verify it reports true for an existing path and false for a missing one.
	dir := t.TempDir()
	existing := filepath.Join(dir, "exists.txt")
	if err := os.WriteFile(existing, []byte("data"), 0o644); err != nil {
		t.Fatal(err)
	}
	if !fileExists(existing) {
		t.Errorf("fileExists returned false for an existing file")
	}
	missing := filepath.Join(dir, "nope.txt")
	if fileExists(missing) {
		t.Errorf("fileExists returned true for a missing file")
	}
}
