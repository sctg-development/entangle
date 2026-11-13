package wordlist

import (
	"os"
	"os/exec"
	"runtime"
	"strings"
)

var aliases = map[string]string{
	"eff": "en", "english": "en", "en": "en",
	"fr": "fr", "french": "fr", "francais": "fr", "français": "fr",
	"de": "de", "german": "de", "deutsch": "de",
	"es": "es", "spanish": "es", "espanol": "es", "español": "es",
	"it": "it", "italian": "it", "italiano": "it",
	"pt": "pt", "portuguese": "pt", "portugues": "pt", "português": "pt", "pt-br": "pt",
}

// ForName resolves a wordlist name or language ("eff", "fr", "german", "es"...)
// to an embedded list. ok is false for any other name (e.g. a file path).
func ForName(name string) (wl *Wordlist, ok bool) {
	lang, ok := aliases[strings.ToLower(strings.TrimSpace(name))]
	if !ok {
		return nil, false
	}
	return Embedded(lang)
}

// Auto picks an embedded wordlist from the user's locale (fr, de, es, it, pt),
// falling back to the English EFF list. No files are needed.
func Auto() *Wordlist {
	if wl, ok := Embedded(DetectLanguage()); ok {
		return wl
	}
	return EmbeddedEFF()
}

// DetectLanguage returns a lowercase language code such as "fr" or "en"
// ("" when unknown), from POSIX locale variables, then the OS settings.
func DetectLanguage() string {
	for _, k := range []string{"LC_ALL", "LC_MESSAGES", "LANGUAGE", "LANG"} {
		if lang := parseLocale(os.Getenv(k)); lang != "" {
			return lang
		}
	}
	switch runtime.GOOS {
	case "darwin":
		out, err := exec.Command("defaults", "read", "-g", "AppleLanguages").Output()
		if err == nil {
			for _, f := range strings.FieldsFunc(string(out), func(r rune) bool {
				return r == '(' || r == ')' || r == ',' || r == '"' || r == '\n' || r == ' '
			}) {
				if lang := parseLocale(f); lang != "" {
					return lang
				}
			}
		}
	case "windows":
		return windowsLanguage()
	}
	return ""
}

// parseLocale extracts the language from values like "fr_FR.UTF-8", "fr-CA",
// "fr:en". "C" and "POSIX" mean no preference.
func parseLocale(v string) string {
	v = strings.ToLower(strings.TrimSpace(v))
	if v == "" || v == "c" || v == "posix" {
		return ""
	}
	if i := strings.IndexAny(v, ":._-@"); i >= 0 {
		v = v[:i]
	}
	if len(v) < 2 || len(v) > 3 {
		return ""
	}
	return v
}
