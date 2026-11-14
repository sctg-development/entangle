package cli

import (
	"testing"
	"time"
)

func TestRateMeterUsesRecentWindow(t *testing.T) {
	clock := time.Unix(0, 0)
	m := newRateMeter(func() time.Time { return clock })
	m.Observe(0)
	clock = clock.Add(time.Second)
	if r := m.Observe(1000); r != 1000 {
		t.Fatalf("rate after 1s = %v, want 1000", r)
	}
	// Transfer slows down: after the window only the recent rate counts.
	for i := 0; i < 10; i++ {
		clock = clock.Add(time.Second)
		m.Observe(int64(1000 + 10*(i+1)))
	}
	if r := m.Observe(1110 + 10); r > 15 || r < 5 {
		t.Fatalf("recent rate = %v, want about 10 B/s", r)
	}
}

func TestRateMeterUnknownAtStart(t *testing.T) {
	clock := time.Unix(0, 0)
	m := newRateMeter(func() time.Time { return clock })
	if r := m.Observe(0); r != 0 {
		t.Fatalf("rate at start = %v, want 0", r)
	}
}

func TestFormatETA(t *testing.T) {
	cases := []struct {
		remaining int64
		rate      float64
		want      string
	}{
		{100, 0, "--"},
		{0, 100, "--"},
		{700, 100, "7s"},
		{125 * 100, 100, "2m05s"},
		{3600 * 100 * 2, 100, "2h00m"},
	}
	for _, c := range cases {
		if got := formatETA(c.remaining, c.rate); got != c.want {
			t.Errorf("formatETA(%d, %v) = %q, want %q", c.remaining, c.rate, got, c.want)
		}
	}
}
