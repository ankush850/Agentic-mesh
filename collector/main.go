package main

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
)

// LogEvent represents an incoming normalized structured log
type LogEvent struct {
	Timestamp  string `json:"timestamp"`
	Service    string `json:"service"`
	Level      string `json:"level"`
	Message    string `json:"message"`
	StackTrace string `json:"stack_trace,omitempty"`
}

// CollectorConfig holds the daemon configuration
type CollectorConfig struct {
	RedisURL    string
	HTTPPort    string
	StreamName  string
	BufferCap   int64
	DedupWindow time.Duration
}

var (
	ctx        = context.Background()
	logChannel = make(chan LogEvent, 10000)
	rdb        *redis.Client
)

// ComputeLogFingerprint generates a SHA-256 fingerprint from service, level, and top stack traces
func ComputeLogFingerprint(event LogEvent) string {
	lines := strings.Split(event.StackTrace, "\n")
	top3 := ""
	for i := 0; i < len(lines) && i < 3; i++ {
		top3 += strings.TrimSpace(lines[i]) + "|"
	}
	raw := fmt.Sprintf("%s:%s:%s", event.Service, event.Level, top3)
	hash := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(hash[:])
}

// IsDuplicate checks whether the fingerprint has been seen in Redis within the dedup window
func IsDuplicate(fingerprint string, ttl time.Duration) bool {
	if rdb == nil {
		return false
	}
	key := fmt.Sprintf("dedup:log:%s", fingerprint)
	set, err := rdb.SetNX(ctx, key, 1, ttl).Result()
	if err != nil {
		return false
	}
	return !set // If SetNX returned false, the key already existed
}

// StreamPublisher continuously drains logChannel into Redis Streams
func StreamPublisher(streamName string, maxLen int64) {
	for event := range logChannel {
		// Log deduplication check
		if event.Level == "ERROR" || event.Level == "FATAL" {
			fp := ComputeLogFingerprint(event)
			if IsDuplicate(fp, 60*time.Second) {
				log.Printf("[Collector] Dropped duplicate error event (fingerprint: %s)", fp[:8])
				continue
			}
		}

		payload, err := json.Marshal(event)
		if err != nil {
			continue
		}

		if rdb != nil {
			err = rdb.XAdd(ctx, &redis.XAddArgs{
				Stream: streamName,
				MaxLen: maxLen,
				Approx: true,
				Values: map[string]interface{}{
					"service":   event.Service,
					"level":     event.Level,
					"payload":   string(payload),
					"timestamp": event.Timestamp,
				},
			}).Err()
			if err != nil {
				log.Printf("[Collector] Redis XAdd warning: %v", err)
			}
		} else {
			// Fallback local stdout log if Redis not connected
			log.Printf("[Collector Stream Buffer] %s [%s] %s", event.Service, event.Level, event.Message)
		}
	}
}

func handleHTTPLog(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Bad request", http.StatusBadRequest)
		return
	}

	var event LogEvent
	if err := json.Unmarshal(body, &event); err != nil {
		// Try parsing generic payload
		event = LogEvent{
			Timestamp: time.Now().UTC().Format(time.RFC3339),
			Service:   "unknown",
			Level:     "INFO",
			Message:   string(body),
		}
	}
	if event.Timestamp == "" {
		event.Timestamp = time.Now().UTC().Format(time.RFC3339)
	}

	select {
	case logChannel <- event:
		w.WriteHeader(http.StatusAccepted)
		w.Write([]byte(`{"status":"buffered"}`))
	default:
		http.Error(w, "Buffer overflow", http.StatusServiceUnavailable)
	}
}

func main() {
	redisURL := os.Getenv("REDIS_URL")
	if redisURL == "" {
		redisURL = "localhost:6379"
	}
	httpPort := os.Getenv("COLLECTOR_HTTP_PORT")
	if httpPort == "" {
		httpPort = "5141"
	}

	opt, err := redis.ParseURL(redisURL)
	if err != nil {
		// Fallback address format
		opt = &redis.Options{Addr: redisURL}
	}

	rdb = redis.NewClient(opt)
	if err := rdb.Ping(ctx).Err(); err != nil {
		log.Printf("[Collector] Notice: Redis not reachable (%v). Operating in local memory queue mode.", err)
		rdb = nil
	} else {
		log.Printf("[Collector] Connected to Redis Streams at %s", redisURL)
	}

	// Start stream publisher goroutine
	go StreamPublisher("telemetry:stream", 10000)

	http.HandleFunc("/ingest", handleHTTPLog)
	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(fmt.Sprintf(`{"status":"healthy","queue_len":%d}`, len(logChannel))))
	})

	log.Printf("[Collector] High-throughput Go log daemon listening on :%s", httpPort)
	if err := http.ListenAndServe(":"+httpPort, nil); err != nil {
		log.Fatalf("Collector server error: %v", err)
	}
}
