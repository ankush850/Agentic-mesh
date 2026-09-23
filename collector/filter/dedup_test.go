package filter

import (
	"testing"
)

func TestDedupFilterHashing(t *testing.T) {
	stackA := "PoolExhaustionError: ConnectionTimeout at Pool.connect (/app/services/payment/db.ts:42:15)\n    at acquire (/app/services/payment/pool.ts:88:21)"
	stackB := "PoolExhaustionError: ConnectionTimeout at Pool.connect (/app/services/payment/db.ts:42:15)\n    at acquire (/app/services/payment/pool.ts:88:21)"

	hA := ComputeHash("payment", "ERROR", stackA)
	hB := ComputeHash("payment", "ERROR", stackB)

	if hA == "" || hB == "" {
		t.Fatalf("Expected non-empty hash")
	}
	if hA != hB {
		t.Fatalf("Expected deterministic hashes, got %s != %s", hA, hB)
	}
}
