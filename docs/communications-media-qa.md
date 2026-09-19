# Communications media implementation and QA

## Modules

- `artifacts/jak-sanggar/src/components/communications/VoiceRecorder.tsx`: records supported audio, caps at 120 seconds / 8 MiB, previews, discards, and calls the parent authenticated upload/send handler.
- `CallProvider.tsx`: authenticated global incoming calls, reusable identity-scoped `CallSessionProvider`, `useCalls`, and `CallButtons`. Actual `RTCPeerConnection.connectionState` controls the connected label.
- `call-api.ts`: the `/api/communications` REST signaling contract through the existing cookie/per-tab-session API helper, with request deadlines.
- `media-utils.ts`: media capability checks, browser permission errors, supported MIME selection, and track cleanup.

Calls poll sequentially, queue ICE until the remote description exists, and close streams/peer connections on rejection, end, failure, timeout, navigation, session change, and unmount. Pending `getUserMedia` results are discarded and stopped after cancellation. Camera/microphone are requested only from the outgoing action or incoming acceptance.

## Local harness

The Vite-only `artifacts/jak-sanggar/communications-qa.html` entry loads `qa/communications.tsx`. It is not part of the standard production `index.html` build input, and runs only when `import.meta.env.DEV` and the hostname is localhost/127.0.0.1/::1.

- `/communications-qa.html?role=a` and `?role=b`: actual production components with synthetic oscillator/canvas media and deterministic localStorage signaling. Real WebRTC transports connect the two tabs. Physical camera and microphone access has no fallback path.
- `/communications-qa.html?transport=api`: same synthetic media with real authenticated local API upload/message and the production `MessageAudio` receiver player. Requires separately provisioned isolated QA accounts. The UI accepts the credentials; no passwords are embedded in the harness.

The harness reports live tracks, pending permission responses, simulated signaling state, and a visible playing/recording state. It supports denial, an 8-second delayed permission response, send failure, signaling outage, and recorder unmount.

## Browser validation on 2026-09-15

Chrome CUA, two separately created QA tabs, synthetic media only:

| Scenario | Observed result |
| --- | --- |
| Record → stop → preview playback | Valid `audio/webm;codecs=opus` recording; live tracks return to zero |
| Failed send → retry | Preview remains available; retry produces one synthetic sent recording |
| Discard preview | Returns to idle; zero live tracks |
| Denied recording permission | Actionable permission error; zero tracks |
| Recorder unmount during recording | Track stops; zero tracks |
| Cancel delayed recording permission | Late media response immediately stopped; zero tracks |
| Recorder unmount while permission pending | Late media response immediately stopped; zero tracks |
| Automatic 120-second stop | Preview displays `2:00`; zero live tracks without pressing Stop |
| Video caller → incoming receiver | Receiver has zero tracks before acceptance |
| Two-way video acceptance | Both display `Terhubung`; remote canvas camera visible; actual SDP/ICE exchange |
| Mute and camera off/on | Controls toggle their accessible pressed states; stream remains under user control |
| Caller ends video | Both dialogs show ended; both return to zero live tracks |
| Two-way voice acceptance | Both display connected with exactly one local audio track |
| Receiver ends voice | Both return to zero live tracks |
| Receiver declines | Rejected state propagates; receiver never opens media; caller track stops |
| Cancel delayed outgoing video permission | Late audio/video tracks are immediately stopped |
| Denied outgoing call permission | Actionable error; no media tracks |
| Initial signaling outage | Error displayed; acquired media released |
| Unanswered call expires after 60 seconds | Both dialogs show `Panggilan tidak dijawab`; caller and receiver have zero live tracks |

Real isolated API validation at localhost:5187 (proxy to API port 3018):

- Sender `qa.sanggar` recorded a synthetic voice note and used the actual attachment and message endpoints.
- Stored payload: 51,025 bytes, declared duration 6,314 ms; persisted message `message-82de7d8c91de43cbfe38199f2a7cf3af9fe0afe1`.
- Receiver `qa.seniman` loaded the same message and private audio through the production `MessageAudio` component.
- Read-only DOM inspection after playback: `ended: true`, `currentTime: 6.18`, `duration: 6.18`, `readyState: 4`, `mediaError: null`. No physical capture devices were opened.

Frontend `pnpm --filter @workspace/jak-sanggar run typecheck` passed after the media implementation.

Screenshot evidence: `docs/communications-media-evidence/received-audio-local-api.png` and `docs/communications-media-evidence/unanswered-call-cleanup.png`. Connected video and the two-minute recording were also visually inspected in CUA during the run. The final pagehide cleanup marks a cached page's call ended so browser Back cannot restore a stale connected label after its devices have been released.

## Production relay verification

The final backend also supports TURN REST credentials from COMMUNICATIONS_TURN_URLS and COMMUNICATIONS_TURN_SECRET. A coturn relay has been deployed and the production API receives its configuration. A separate authenticated test from the local computer through the public relay received all 10 of 10 synthetic packets over both UDP and TCP. Evidence is saved in the task directory as jaksanggar-template-20260915/turn-relay-results.json.

The browser media tests above use host candidates. They establish browser behavior separately from the public relay packet test; no real production user was called.

## Local test limits

The backend returns ICE servers from `COMMUNICATIONS_ICE_SERVERS_JSON`. The local synthetic tests use host candidates. Deployment behind different NAT/firewall networks needs an appropriately configured TURN service; no cross-network TURN claim is made from these local tests. Mobile Safari and Firefox device-specific capture behavior have not been browser-tested in this pass.

Authoritative API references consulted: [MediaRecorder](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder), [MediaRecorder stop event](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/stop_event), [RTCPeerConnection connectionState](https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/connectionState), [addIceCandidate](https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/addIceCandidate), [signalingState](https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/signalingState).
