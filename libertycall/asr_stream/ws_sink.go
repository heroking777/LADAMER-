package main

import (
	"bufio"
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	speech "cloud.google.com/go/speech/apiv1"
	"cloud.google.com/go/speech/apiv1/speechpb"
	"github.com/gorilla/websocket"
	"google.golang.org/api/option"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

// ESLConnection - FreeSWITCH ESL接続
type ESLConnection struct {
	conn     net.Conn
	reader   *bufio.Reader
	mu       sync.Mutex
	host     string
	port     string
	password string
	authDone bool
}

func NewESLConnection(host, port, password string) *ESLConnection {
	return &ESLConnection{host: host, port: port, password: password}
}

func (e *ESLConnection) Connect() error {
	e.mu.Lock()
	defer e.mu.Unlock()

	conn, err := net.DialTimeout("tcp", e.host+":"+e.port, 5*time.Second)
	if err != nil {
		return fmt.Errorf("dial failed: %v", err)
	}
	e.conn = conn
	e.reader = bufio.NewReader(conn)

	// バナー読み飛ばし
	if _, err := e.reader.ReadString('\n'); err != nil {
		e.conn.Close()
		return fmt.Errorf("banner read failed: %v", err)
	}

	// 認証
	authCmd := fmt.Sprintf("auth %s\n\n", e.password)
	if _, err := e.conn.Write([]byte(authCmd)); err != nil {
		e.conn.Close()
		return fmt.Errorf("auth write failed: %v", err)
	}

	for {
		line, err := e.reader.ReadString('\n')
		if err != nil {
			e.conn.Close()
			return fmt.Errorf("auth response read failed: %v", err)
		}
		if strings.Contains(line, "+OK") {
			e.authDone = true
			log.Printf("[ESL] Connected and authenticated")
			return nil
		}
		if strings.Contains(line, "-ERR") {
			e.conn.Close()
			return fmt.Errorf("auth failed: %s", line)
		}
	}
}

func (e *ESLConnection) Execute(command string, args ...string) (string, error) {
	e.mu.Lock()
	defer e.mu.Unlock()

	if e.conn == nil || !e.authDone {
		return "", fmt.Errorf("ESL not connected or not authenticated")
	}

	cmd := fmt.Sprintf("%s %s\n\n", command, strings.Join(args, " "))
	if _, err := e.conn.Write([]byte(cmd)); err != nil {
		return "", fmt.Errorf("command write failed: %v", err)
	}

	var response strings.Builder
	for {
		line, err := e.reader.ReadString('\n')
		if err != nil {
			return "", fmt.Errorf("command read failed: %v", err)
		}
		response.WriteString(line)
		if strings.Contains(line, "+OK") || strings.Contains(line, "-ERR") {
			break
		}
	}
	return response.String(), nil
}

func (e *ESLConnection) Playback(uuid, audioFile string) error {
	// タイムアウトを無効化
	e.Execute("set", "media_timeout=0")
	e.Execute("set", "media_hold_timeout=0")

	// 音声再生
	result, err := e.Execute("api", "uuid_broadcast", uuid, audioFile, "both")
	if err != nil {
		return err
	}
	if strings.Contains(result, "-ERR") {
		return fmt.Errorf("playback failed: %s", result)
	}

	// 無音を流し続ける（RTP途切れ防止）
	e.Execute("api", "uuid_broadcast", uuid, "silence_stream://-1", "both")

	log.Printf("[PLAYBACK] Playing %s on %s", audioFile, uuid)
	return nil
}

func (e *ESLConnection) Close() {
	e.mu.Lock()
	defer e.mu.Unlock()
	if e.conn != nil {
		e.conn.Close()
		e.conn = nil
	}
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

type DialogueConfig struct {
	Patterns []struct {
		Keywords []string    `json:"keywords"`
		Response interface{} `json:"response"`
	} `json:"patterns"`
}

type ASRSession struct {
	callID   string
	conn     *websocket.Conn
	mu       sync.Mutex
	client   *speech.Client
	stream   speechpb.Speech_StreamingRecognizeClient
	ctx      context.Context
	cancel   context.CancelFunc
	started  bool
	esl      *ESLConnection
}

var sessions = struct {
	sync.RWMutex
	m map[string]*ASRSession
}{m: make(map[string]*ASRSession)}

var dialogueConfig DialogueConfig
var configLoaded bool

func loadDialogueConfig() error {
	configFile := "/opt/libertycall/clients/000/config/dialogue_config.json"
	data, err := os.ReadFile(configFile)
	if err != nil {
		return err
	}
	if err := json.Unmarshal(data, &dialogueConfig); err != nil {
		return err
	}
	configLoaded = true
	log.Printf("[CONFIG] Loaded dialogue_config.json with %d patterns", len(dialogueConfig.Patterns))
	return nil
}

func matchKeyword(text string) (string, bool) {
	if !configLoaded {
		return "", false
	}
	text = strings.TrimSpace(text)
	for _, pattern := range dialogueConfig.Patterns {
		for _, keyword := range pattern.Keywords {
			if strings.Contains(text, keyword) || strings.Contains(keyword, text) {
				switch v := pattern.Response.(type) {
				case string:
					return v, true
				case []interface{}:
					if len(v) > 0 {
						if s, ok := v[0].(string); ok {
							return s, true
						}
					}
				}
			}
		}
	}
	return "", false
}

func handleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("Upgrade error: %v", err)
		return
	}
	defer conn.Close()

	var session *ASRSession
	var esl *ESLConnection

	for {
		msgType, msg, err := conn.ReadMessage()
		if err != nil {
			log.Printf("Read error: %v", err)
			break
		}

		if msgType == websocket.BinaryMessage {
			if session == nil {
				callID := r.URL.Path[1:]
				if callID == "" {
					log.Printf("[BINARY] No callID in path")
					continue
				}
				ctx, cancel := context.WithCancel(context.Background())
				client, err := speech.NewClient(ctx, option.WithCredentialsFile("/opt/libertycall/key/google_tts.json"))
				if err != nil {
					log.Printf("[START] Failed to create speech client: %v", err)
					cancel()
					continue
				}
				stream, err := client.StreamingRecognize(ctx)
				if err != nil {
					log.Printf("[START] Failed to create stream: %v", err)
					client.Close()
					cancel()
					continue
				}
				config := &speechpb.StreamingRecognitionConfig{
					Config: &speechpb.RecognitionConfig{
						Encoding:        speechpb.RecognitionConfig_LINEAR16,
						SampleRateHertz: 8000,
						LanguageCode:    "ja-JP",
					},
					InterimResults: true,
				}
				if err := stream.Send(&speechpb.StreamingRecognizeRequest{
					StreamingRequest: &speechpb.StreamingRecognizeRequest_StreamingConfig{
						StreamingConfig: config,
					},
				}); err != nil {
					log.Printf("[START] Failed to send config: %v", err)
					stream.CloseSend()
					client.Close()
					cancel()
					continue
				}

				esl = NewESLConnection("127.0.0.1", "8021", "ClueCon")
				if err := esl.Connect(); err != nil {
					log.Printf("[ESL] Connection failed: %v", err)
				} else {
					log.Printf("[ESL] Connected for call %s", callID)
				}

				session = &ASRSession{
					callID:   callID,
					conn:     conn,
					client:   client,
					stream:   stream,
					ctx:      ctx,
					cancel:   cancel,
					started:  true,
					esl:      esl,
				}
				sessions.Lock()
				sessions.m[callID] = session
				sessions.Unlock()
				log.Printf("[START] call_id=%s (binary mode)", callID)

				if !configLoaded {
					loadDialogueConfig()
				}

				go func(s *ASRSession) {
					for {
						resp, err := s.stream.Recv()
						if err != nil {
							log.Printf("[ASR] Receive error: %v", err)
							return
						}
						for _, result := range resp.Results {
							if len(result.Alternatives) > 0 {
								text := result.Alternatives[0].Transcript
								transcript := Transcript{
									Type:       "transcript",
									Text:       text,
									Confidence: float64(result.Alternatives[0].Confidence),
									CallID:     s.callID,
									Final:      result.IsFinal,
								}
								s.conn.WriteJSON(transcript)
								log.Printf("[TRANSCRIPT] %s (final=%v)", text, result.IsFinal)

								if result.IsFinal && len(text) > 0 {
									if audioFile, ok := matchKeyword(text); ok {
										log.Printf("[ACTION] Matched keyword -> audio=%s", audioFile)
										if s.esl != nil {
											audioPath := fmt.Sprintf("/opt/libertycall/clients/000/audio/%s.wav", audioFile)
											if err := s.esl.Playback(s.callID, audioPath); err != nil {
												log.Printf("[PLAYBACK] Error: %v", err)
											}
										}
									}
								}
							}
						}
					}
				}(session)
			}

			if session != nil && session.stream != nil {
				session.mu.Lock()
				if err := session.stream.Send(&speechpb.StreamingRecognizeRequest{
					StreamingRequest: &speechpb.StreamingRecognizeRequest_AudioContent{
						AudioContent: msg,
					},
				}); err != nil {
					log.Printf("[AUDIO] Send error: %v", err)
				}
				session.mu.Unlock()
			}
			continue
		}

		var m Message
		if err := json.Unmarshal(msg, &m); err != nil {
			log.Printf("JSON error: %v", err)
			continue
		}

		switch m.Type {
		case "start":
			log.Printf("[START_JSON] call_id=%s", m.CallID)
		case "end":
			log.Printf("[END] call_id=%s", m.CallID)
			if session != nil {
				session.stream.CloseSend()
				session.client.Close()
				session.cancel()
				if session.esl != nil {
					session.esl.Close()
				}
				sessions.Lock()
				delete(sessions.m, session.callID)
				sessions.Unlock()
			}
			return
		default:
			log.Printf("[UNKNOWN] type=%s", m.Type)
		}
	}
}

func main() {
	flag.Parse()

	log.Printf("Starting WS Sink server on 0.0.0.0:9000")
	http.HandleFunc("/", handleWebSocket)
	if err := http.ListenAndServe(":9000", nil); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
