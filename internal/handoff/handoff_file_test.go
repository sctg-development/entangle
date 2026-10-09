package handoff

import (
	"strings"
	"testing"
)

func TestFileCommandPointsAtReceiveFile(t *testing.T) {
	if got, want := FileCommand(code), "entangle receive-file 6-pioneer-village"; got != want {
		t.Errorf("FileCommand() = %q, want %q", got, want)
	}
}

func TestFileInviteCarriesTheCode(t *testing.T) {
	if !strings.Contains(FileInvite(code), code) {
		t.Errorf("the code is missing from the file invite:\n%s", FileInvite(code))
	}
}

func TestFileInviteCarriesTheInstallLine(t *testing.T) {
	if !strings.Contains(FileInvite(code), InstallSh) {
		t.Errorf("no install line in the file invite:\n%s", FileInvite(code))
	}
}

func TestFileInviteCoversWindows(t *testing.T) {
	if !strings.Contains(FileInvite(code), InstallPS1) {
		t.Errorf("no Windows install line in the file invite:\n%s", FileInvite(code))
	}
}

func TestFileInviteDoesNotMentionProject(t *testing.T) {
	// Unlike Invite, FileInvite is for arbitrary files that have no project
	// directory, so the "inside your copy of the project" wording must not appear.
	if strings.Contains(FileInvite(code), "copy of the project") {
		t.Errorf("file invite should not mention a project directory:\n%s", FileInvite(code))
	}
}
