#!/usr/bin/env python3
import asyncio
import json
import logging
import base64
import sys
import threading
import time
from pathlib import Path

sys.path.insert(0, '/opt/libertycall')

import websockets
from gateway.asr.google_asr import GoogleASR

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/tmp/ws_sink_debug.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger('ws_sink')

class ASRSession:
    def __init__(self, call_id: str, websocket):
        self.call_id = call_id
        self.websocket = websocket
        self.loop = asyncio.get_running_loop()
        self.asr = GoogleASR(
            credentials_path='/opt/libertycall/key/google_tts.json',
            language_code='ja-JP',
            sample_rate=16000,
            ai_core=self,
            error_callback=None
        )
        self.is_active = True
        self._buffer = bytearray()
        self._started = False
        self._pending_results = []

    def on_transcript(self, transcript: str, is_final: bool = False, confidence: float = 0.0, call_id: str = None, **kwargs):
        self._pending_results.append((transcript, confidence, is_final))
        self.loop.call_soon_threadsafe(
            asyncio.create_task,
            self._send_result(transcript, confidence, is_final)
        )

    async def _send_result(self, text: str, confidence: float, final: bool):
        try:
            if self.websocket.open:
                await self.websocket.send(json.dumps({
                    'type': 'transcript',
                    'text': text,
                    'confidence': confidence,
                    'call_id': self.call_id,
                    'final': final
                }))
                logger.info(f'[TRANSCRIPT] {text} (final={final})')
        except Exception as e:
            logger.error(f'[SEND] Error: {e}')

    def start(self):
        if not self._started:
            self.asr._start_stream_worker(self.call_id)
            self._started = True
            logger.info(f'[ASR] Stream started for {self.call_id}')

    def feed(self, audio_bytes: bytes):
        self._buffer.extend(audio_bytes)
        if len(self._buffer) >= 16000 * 2:
            self.asr.feed_audio(self.call_id, bytes(self._buffer))
            self._buffer = bytearray()

    def end(self):
        if self._started:
            if len(self._buffer) > 0:
                self.asr.feed_audio(self.call_id, bytes(self._buffer))
            self.asr.end_stream(self.call_id)
            self._started = False
            logger.info(f'[ASR] Stream ended for {self.call_id}')

    def flush_pending(self):
        for text, conf, final in self._pending_results:
            asyncio.create_task(self._send_result(text, conf, final))
        self._pending_results = []

sessions = {}

async def handle_websocket(websocket, path):
    call_id = None
    session = None

    try:
        async for message in websocket:
            try:
                data = json.loads(message)
                msg_type = data.get('type')

                if msg_type == 'start':
                    call_id = data.get('call_id')
                    logger.info(f'[START] call_id={call_id}')
                    session = ASRSession(call_id, websocket)
                    sessions[call_id] = session
                    session.start()
                    await websocket.send(json.dumps({
                        'type': 'start_ack',
                        'status': 'ok',
                        'call_id': call_id
                    }))

                elif msg_type == 'audio':
                    if not session:
                        logger.warning('[AUDIO] No active session')
                        continue
                    audio_b64 = data.get('data', '')
                    audio_bytes = base64.b64decode(audio_b64)
                    session.feed(audio_bytes)

                elif msg_type == 'end':
                    logger.info(f'[END] call_id={call_id}')
                    if session:
                        session.end()
                        # 保留中の結果を先に送信
                        await asyncio.sleep(0.5)
                        session.flush_pending()
                        if call_id in sessions:
                            del sessions[call_id]
                    # end_ackは最後に送信
                    await websocket.send(json.dumps({
                        'type': 'end_ack',
                        'status': 'ok',
                        'call_id': call_id
                    }))
                    break

                else:
                    logger.warning(f'[UNKNOWN] type={msg_type}')

            except json.JSONDecodeError as e:
                logger.error(f'[JSON] Invalid JSON: {e}')
            except Exception as e:
                logger.error(f'[MSG] Error: {e}', exc_info=True)

    except websockets.exceptions.ConnectionClosed:
        logger.info(f'[CLOSED] call_id={call_id}')
    except Exception as e:
        logger.error(f'[ERROR] {e}', exc_info=True)
    finally:
        if session:
            session.end()
            if call_id in sessions:
                del sessions[call_id]
        logger.info(f'[CLEANUP] call_id={call_id}')

async def main():
    logger.info('Starting WS Sink server on 0.0.0.0:9000')
    try:
        async with websockets.serve(handle_websocket, '0.0.0.0', 9000):
            logger.info('WS Sink started successfully on port 9000')
            await asyncio.Future()
    except Exception as e:
        logger.error(f'Failed to start server: {e}')
        sys.exit(1)

if __name__ == '__main__':
    asyncio.run(main())
