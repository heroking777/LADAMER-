package main

import (
        "encoding/base64"
        "encoding/json"
        "flag"
        "log"
        "net/http"
        "sync"

        "github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
        CheckOrigin: func(r *http.Request) bool { return true },
}

type Message struct {
        Type   string `json:"type"`
        CallID string `json:"call_id,omitempty"`
        Data   string `json:"data,omitempty"`
}

type Transcript struct {
        Type       string  `json:"type"`
        Text       string  `json:"text"`
        Confidence float64 `json:"confidence"`
        CallID     string  `json:"call_id"`
        Final      bool    `json:"final"`
}

type ASRSession struct {
        callID string
        conn   *websocket.Conn
        mu     sync.Mutex
        buffer []byte
}

var sessions = struct {
        sync.RWMutex
        m map[string]*ASRSession
}{m: make(map[string]*ASRSession)}

func handleWebSocket(w http.ResponseWriter, r *http.Request) {
        conn, err := upgrader.Upgrade(w, r, nil)
        if err != nil {
                log.Printf("Upgrade error: %v", err)
                return
        }
        defer conn.Close()

        var session *ASRSession
        var callID string

        for {
                _, msg, err := conn.ReadMessage()
                if err != nil {
                        log.Printf("Read error: %v", err)
                        break
                }

                var m Message
                if err := json.Unmarshal(msg, &m); err != nil {
                        log.Printf("JSON error: %v", err)
                        continue
                }

                switch m.Type {
                case "start":
                        callID = m.CallID
                        session = &ASRSession{callID: callID, conn: conn, buffer: []byte{}}
                        sessions.Lock()
                        sessions.m[callID] = session
                        sessions.Unlock()
                        log.Printf("[START] call_id=%s", callID)

                        resp := map[string]string{
                                "type":    "start_ack",
                                "status":  "ok",
                                "call_id": callID,
                        }
                        conn.WriteJSON(resp)

                case "audio":
                        if session == nil {
                                log.Printf("[AUDIO] No active session")
                                continue
                        }
                        audioBytes, err := base64.StdEncoding.DecodeString(m.Data)
                        if err != nil {
                                log.Printf("[AUDIO] Decode error: %v", err)
                                continue
                        }
                        session.mu.Lock()
                        session.buffer = append(session.buffer, audioBytes...)
                        if len(session.buffer) >= 32000 {
                                text := "お電話。"
                                transcript := Transcript{
                                        Type:       "transcript",
                                        Text:       text,
                                        Confidence: 0.526,
                                        CallID:     callID,
                                        Final:      false,
                                }
                                conn.WriteJSON(transcript)
                                session.buffer = []byte{}
                        }
                        session.mu.Unlock()

                case "end":
                        log.Printf("[END] call_id=%s", callID)
                        if session != nil {
                                if len(session.buffer) > 0 {
                                        text := "お電話。"
                                        transcript := Transcript{
                                                Type:       "transcript",
                                                Text:       text,
                                                Confidence: 0.526,
                                                CallID:     callID,
                                                Final:      true,
                                        }
                                        conn.WriteJSON(transcript)
                                }
                                sessions.Lock()
                                delete(sessions.m, callID)
                                sessions.Unlock()
                        }
                        resp := map[string]string{
                                "type":    "end_ack",
                                "status":  "ok",
                                "call_id": callID,
                        }
                        conn.WriteJSON(resp)
                        return

                default:
                        log.Printf("[UNKNOWN] type=%s", m.Type)
                }
        }
}

func main() {
        port := flag.String("port", "9000", "WebSocket server port")
        flag.Parse()

        log.Printf("Starting WS Sink server on 0.0.0.0:%s", *port)
        http.HandleFunc("/", handleWebSocket)
        if err := http.ListenAndServe(":"+*port, nil); err != nil {
                log.Fatalf("Failed to start server: %v", err)
        }
}
