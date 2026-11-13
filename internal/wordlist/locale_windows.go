//go:build windows

package wordlist

import (
	"syscall"
	"unsafe"
)

func windowsLanguage() string {
	proc := syscall.NewLazyDLL("kernel32.dll").NewProc("GetUserDefaultLocaleName")
	buf := make([]uint16, 85)
	n, _, _ := proc.Call(uintptr(unsafe.Pointer(&buf[0])), uintptr(len(buf)))
	if n == 0 {
		return ""
	}
	return parseLocale(syscall.UTF16ToString(buf[:n]))
}
