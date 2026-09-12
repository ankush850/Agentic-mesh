package filter

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strings"
)

// DeduplicationFilter normalizes stack frames and creates consistent hashes
type DeduplicationFilter struct{}

// NewFilter returns a new DeduplicationFilter
func NewFilter() *DeduplicationFilter {
	return &DeduplicationFilter{}
}

// Fingerprint generates a normalized SHA-256 fingerprint for error log deduplication
func (f *DeduplicationFilter) Fingerprint(service string, errorType string, stackTrace string) string {
	var normalizedLines []string
	lines := strings.Split(stackTrace, "\n")
	count := 0
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" {
			continue
		}
		// Strip volatile memory addresses like 0x7fff...
		stripped := stripMemoryAddresses(trimmed)
		normalizedLines = append(normalizedLines, stripped)
		count++
		if count >= 3 {
			break
		}
	}

	joined := strings.Join(normalizedLines, " > ")
	raw := fmt.Sprintf("%s|%s|%s", strings.ToLower(service), strings.ToLower(errorType), joined)
	hash := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(hash[:])
}

func stripMemoryAddresses(s string) string {
	parts := strings.Fields(s)
	for i, p := range parts {
		if strings.HasPrefix(p, "0x") {
			parts[i] = "[ADDR]"
		}
	}
	return strings.Join(parts, " ")
}
