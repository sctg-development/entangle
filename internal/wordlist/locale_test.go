package wordlist

import "testing"

func TestParseLocale(t *testing.T) {
	for in, want := range map[string]string{"fr_FR.UTF-8": "fr", "fr-CA": "fr", "fr:en": "fr", "en_US": "en", "C": "", "POSIX": "", "": ""} {
		if got := parseLocale(in); got != want {
			t.Errorf("parseLocale(%q)=%q want %q", in, got, want)
		}
	}
}

func TestAutoFrench(t *testing.T) {
	t.Setenv("LC_ALL", "fr_FR.UTF-8")
	if len(Auto().Words) != len(EmbeddedFrench().Words) {
		t.Fatal("expected French list")
	}
	t.Setenv("LC_ALL", "en_GB.UTF-8")
	if len(Auto().Words) != 7776 {
		t.Fatal("expected EFF list")
	}
}

func TestAutoOtherLanguages(t *testing.T) {
	for lang, loc := range map[string]string{"de": "de_DE.UTF-8", "es": "es_ES", "it": "it_IT", "pt": "pt_BR.UTF-8"} {
		t.Setenv("LC_ALL", loc)
		want, _ := Embedded(lang)
		if got := Auto(); got.Words[0] != want.Words[0] || len(got.Words) != len(want.Words) {
			t.Errorf("%s: wrong list for %s", lang, loc)
		}
	}
}
