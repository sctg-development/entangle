package cli

import (
	"strings"
	"testing"

	"github.com/gowtham-sai-yadav/entangle/internal/handoff"
)

// TestSendFileOutputWorksForATeammateWhoHasNothing covers the invite text that
// gets forwarded to a receiver who has never installed entangle. Like send, but
// for files: no "copy of the project" wording.
func TestSendFileOutputWorksForATeammateWhoHasNothing(t *testing.T) {
	const code = "6-pioneer-village"
	const filename = "report.pdf"
	out := captureStdout(t, func() error {
		printFileSendCode(filename)(code)
		return nil
	})

	for _, want := range []string{
		code,                      // the code, to read aloud
		handoff.FileCommand(code), // the command, for someone who already has it
		handoff.InstallSh,         // the install line, for someone who does not
		handoff.InstallPS1,        // ...on Windows
		"Waiting for them",        // that the sender should now sit still
	} {
		if !strings.Contains(out, want) {
			t.Errorf("send-file output is missing %q:\n%s", want, out)
		}
	}

	// Unlike the session send, file send must NOT mention a project directory.
	if strings.Contains(out, "copy of the project") {
		t.Errorf("send-file output should not mention a project directory:\n%s", out)
	}
}
