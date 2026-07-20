package main

import (
        "encoding/json"
        "flag"
        "log"
        "net/http"
        "sync"
        "time"
)

type Gateway struct {
        mu      sync.RWMutex
        calls   map[string]*Call
        running bool
}

type Call struct {
        ID        string    `json:"id"`
        Status    string    `json:"status"`
        StartedAt time.Time `json:"started_at"`
        ClientID  string    `json:"client_id"`
}

var gateway = &Gateway{
        calls:   make(map[string]*Call),
        running: true,
}

func (g *Gateway) handleStart(w http.ResponseWriter, r *http.Request) {
        var req struct {
                CallID   string `json:"call_id"`
                ClientID string `json:"client_id"`
        }
        if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
                http.Error(w, "Invalid request", 400)
                return
        }
        g.mu.Lock()
        g.calls[req.CallID] = &Call{
                ID:        req.CallID,
                Status:    "active",
                StartedAt: time.Now(),
                ClientID:  req.ClientID,
        }
        g.mu.Unlock()
        w.Header().Set("Content-Type", "application/json")
        json.NewEncoder(w).Encode(map[string]string{"status": "started", "call_id": req.CallID})
}

func (g *Gateway) handleStatus(w http.ResponseWriter, r *http.Request) {
        g.mu.RLock()
        defer g.mu.RUnlock()
        w.Header().Set("Content-Type", "application/json")
        json.NewEncoder(w).Encode(g.calls)
}

func (g *Gateway) handleEnd(w http.ResponseWriter, r *http.Request) {
        var req struct{ CallID string `json:"call_id"` }
        if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
                http.Error(w, "Invalid request", 400)
                return
        }
        g.mu.Lock()
        if call, ok := g.calls[req.CallID]; ok {
                call.Status = "ended"
        }
        g.mu.Unlock()
        w.Header().Set("Content-Type", "application/json")
        json.NewEncoder(w).Encode(map[string]string{"status": "ended", "call_id": req.CallID})
}

func (g *Gateway) healthHandler(w http.ResponseWriter, r *http.Request) {
        w.Header().Set("Content-Type", "application/json")
        json.NewEncoder(w).Encode(map[string]interface{}{
                "status": "ok",
                "calls":  len(g.calls),
                "time":   time.Now().Unix(),
        })
}

func main() {
        port := flag.String("port", "8080", "Gateway API port")
        flag.Parse()

        http.HandleFunc("/api/gateway/start", gateway.handleStart)
        http.HandleFunc("/api/gateway/status", gateway.handleStatus)
        http.HandleFunc("/api/gateway/end", gateway.handleEnd)
        http.HandleFunc("/health", gateway.healthHandler)

        log.Printf("[GATEWAY] Starting on port %s", *port)
        if err := http.ListenAndServe(":"+*port, nil); err != nil {
                log.Fatalf("Failed to start: %v", err)
        }
}
