package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
)

type LogEvent struct {
	Timestamp  string `json:"timestamp"`
	Service    string `json:"service"`
	Level      string `json:"level"`
	Message    string `json:"message"`
	StackTrace string `json:"stack_trace,omitempty"`
}

var inMemoryBuffer []LogEvent

func handleIngest(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var event LogEvent
	if err := json.NewDecoder(r.Body).Decode(&event); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}
	inMemoryBuffer = append(inMemoryBuffer, event)
	w.WriteHeader(http.StatusAccepted)
	fmt.Fprintf(w, `{"status":"queued","count":%d}`, len(inMemoryBuffer))
}

func main() {
	port := os.Getenv("COLLECTOR_HTTP_PORT")
	if port == "" {
		port = "5141"
	}
	http.HandleFunc("/ingest", handleIngest)
	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"status":"healthy","service":"collector-daemon","queued":%d}`, len(inMemoryBuffer))
	})
	log.Printf("[collector-daemon] Listening on :%s (in-memory mode)", port)
	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatalf("Server error: %v", err)
	}
}
