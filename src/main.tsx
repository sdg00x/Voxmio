import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Camera,
  Mic,
  Play,
  Square,
  Sparkles,
  Hand,
  Download,
  Volume2,
  Trash2,
  Share2,
  Music2,
} from "lucide-react";
import { StudioAudio } from "./lib/audio";
import { CHORDS, duration, extension } from "./lib/music";
import { listTakes, saveTake, deleteTake, type Take } from "./lib/takes";
import "./styles.css";

function TakeCard({
  take,
  onDelete,
  onError,
}: {
  take: Take;
  onDelete: (id: string) => void;
  onError: (s: string) => void;
}) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const u = URL.createObjectURL(take.blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [take.blob]);
  const filename = `voxmio-${take.id}.${extension(take.blob.type)}`;
  async function share() {
    try {
      const file = new File([take.blob], filename, { type: take.blob.type });
      if (navigator.canShare?.({ files: [file] }))
        await navigator.share({ title: take.name, files: [file] });
      else
        onError(
          "Sharing is unavailable in this browser. Download your take and send the file.",
        );
    } catch (e) {
      if ((e as Error).name !== "AbortError")
        onError("Could not share this take. Download it instead.");
    }
  }
  return (
    <article className="takeCard">
      <div className="takeTitle">
        <Music2 size={18} />
        <div>
          <h3>{take.name}</h3>
          <small>
            {new Date(take.created).toLocaleString()} · {duration(take.seconds)}
            {take.harmony ? " · Harmony" : ""}
          </small>
        </div>
      </div>
      <video src={url || undefined} controls preload="metadata" playsInline />
      <div className="takeActions">
        <a href={url} download={filename}>
          <Download size={15} /> Download
        </a>
        <button onClick={share} aria-label={`Share ${take.name}`}>
          <Share2 size={15} />
        </button>
        <button
          onClick={() => onDelete(take.id)}
          aria-label={`Delete ${take.name}`}
        >
          <Trash2 size={15} />
        </button>
      </div>
    </article>
  );
}
function App() {
  const video = useRef<HTMLVideoElement>(null),
    canvas = useRef<HTMLCanvasElement>(null);
  const audio = useRef(new StudioAudio()),
    media = useRef<MediaStream | null>(null),
    cameraStream = useRef<MediaStream | null>(null);
  const stopTracking = useRef<(() => void) | null>(null),
    generation = useRef(0),
    recorder = useRef<MediaRecorder | null>(null),
    recordStart = useRef(0),
    recordTimer = useRef<ReturnType<typeof setTimeout> | null>(null),
    busyRef = useRef(false);
  const [cam, setCam] = useState(false),
    [mic, setMic] = useState(false),
    [busy, setBusy] = useState(false),
    [recording, setRecording] = useState(false),
    [finishing, setFinishing] = useState(false);
  const [status, setStatus] = useState("Ready when you are. Try a chord pad."),
    [current, setCurrent] = useState(-1),
    [takes, setTakes] = useState<Take[]>([]),
    [seconds, setSeconds] = useState(0),
    [level, setLevel] = useState(0);
  const [harmony, setHarmony] = useState(false),
    [sound, setSound] = useState<OscillatorType>("triangle"),
    [bpm, setBpm] = useState(90),
    [volume, setVolume] = useState(65);
  const settings = useRef({ sound, bpm, volume, harmony });
  settings.current = { sound, bpm, volume, harmony };
  const playRef = useRef<(i: number) => void>(() => {});
  async function playChord(i: number) {
    try {
      await audio.current.start();
      audio.current.setVolume(settings.current.volume / 100);
      audio.current.play(i, settings.current.sound, settings.current.bpm);
      setCurrent(i);
    } catch {
      setStatus(
        "Audio could not start. Try again in a browser that supports Web Audio.",
      );
    }
  }
  playRef.current = playChord;
  useEffect(() => {
    listTakes()
      .then((t) => setTakes(t.sort((a, b) => b.created - a.created)))
      .catch(() =>
        setStatus(
          "Browser storage unavailable. Download takes before leaving.",
        ),
      );
    const keys = (e: KeyboardEvent) => {
      if (
        e.repeat ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey ||
        /INPUT|SELECT|TEXTAREA|BUTTON/.test((e.target as HTMLElement).tagName)
      )
        return;
      const i = Number(e.key) - 1;
      if (i >= 0 && i < 4) playRef.current(i);
      if (e.code === "Space") {
        e.preventDefault();
        audio.current.silence();
        setCurrent(-1);
      }
    };
    window.addEventListener("keydown", keys);
    return () => {
      window.removeEventListener("keydown", keys);
      generation.current++;
      stopTracking.current?.();
      if (recordTimer.current) clearTimeout(recordTimer.current);
      if (recorder.current?.state === "recording") recorder.current.stop();
      media.current?.getTracks().forEach((t) => t.stop());
      cameraStream.current?.getTracks().forEach((t) => t.stop());
      audio.current.dispose();
    };
  }, []);
  useEffect(() => {
    if (!recording) return;
    const id = setInterval(
      () => setSeconds((Date.now() - recordStart.current) / 1000),
      250,
    );
    return () => clearInterval(id);
  }, [recording]);
  useEffect(() => {
    if (!mic) return;
    const data = new Float32Array(256);
    const id = setInterval(() => {
      audio.current.analyser.getFloatTimeDomainData(data);
      setLevel(
        Math.min(
          100,
          Math.sqrt(data.reduce((a, v) => a + v * v, 0) / data.length) * 400,
        ),
      );
    }, 100);
    return () => clearInterval(id);
  }, [mic]);
  function stopDevices() {
    generation.current++;
    stopTracking.current?.();
    stopTracking.current = null;
    media.current?.getTracks().forEach((t) => t.stop());
    cameraStream.current?.getTracks().forEach((t) => t.stop());
    media.current = cameraStream.current = null;
    audio.current.detachMicrophone();
    audio.current.silence();
    if (video.current) video.current.srcObject = null;
    setCam(false);
    setMic(false);
    setLevel(0);
    setCurrent(-1);
    setStatus("Camera and microphone are off. Chord pads still work.");
  }
  async function enableDevices(withCamera: boolean) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    const token = ++generation.current;
    try {
      await audio.current.start();
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("unsupported");
      if (!media.current) {
        const s = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
          video: false,
        });
        if (token !== generation.current) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        media.current = s;
        audio.current.attachMicrophone(s);
        audio.current.setHarmony(settings.current.harmony);
        setMic(true);
        s.getAudioTracks()[0].onended = () => {
          if (recorder.current?.state === "recording") stopRecording();
          stopDevices();
        };
      }
      setStatus(
        "Microphone ready. Use headphones, then record your voice and chords.",
      );
      if (withCamera && !cameraStream.current) {
        const s = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
          audio: false,
        });
        if (token !== generation.current) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        cameraStream.current = s;
        if (video.current) {
          video.current.srcObject = s;
          await video.current.play();
        }
        setCam(true);
        setStatus("Camera ready — loading hand tracking…");
        try {
          const { trackHands } = await import("./lib/tracking");
          if (token !== generation.current) return;
          const stop = await trackHands(
            video.current!,
            canvas.current!,
            (i) => playRef.current(i),
            (s) => {
              if (token === generation.current) setStatus(s);
            },
          );
          if (token !== generation.current) stop();
          else stopTracking.current = stop;
        } catch {
          if (token === generation.current)
            setStatus(
              "Camera ready. Hand tracking could not load; use the chord pads or keys 1–4.",
            );
        }
      }
    } catch (e) {
      const name = (e as Error).name;
      setStatus(
        name === "NotAllowedError"
          ? "Permission denied. Allow access in browser settings, or play the chord pads."
          : name === "NotFoundError"
            ? "No camera or microphone found. Chord pads still work."
            : "Could not open this device. Use HTTPS or localhost and check device access.",
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  function stopRecording() {
    if (recordTimer.current) {
      clearTimeout(recordTimer.current);
      recordTimer.current = null;
    }
    if (recorder.current?.state === "recording") {
      setFinishing(true);
      recorder.current.stop();
      setRecording(false);
    }
  }
  async function startRecording() {
    if (busyRef.current || recorder.current?.state === "recording" || finishing)
      return;
    busyRef.current = true;
    setBusy(true);
    try {
      await audio.current.start();
      if (typeof MediaRecorder === "undefined")
        throw new Error(
          "Recording is unsupported in this browser. Try Chrome, Edge or Safari.",
        );
      const tracks = [
        ...audio.current.output.stream.getAudioTracks(),
        ...(cameraStream.current?.getVideoTracks() || []),
      ];
      const hasVideo = tracks.some((t) => t.kind === "video");
      const options = hasVideo
        ? ["video/webm;codecs=vp8,opus", "video/webm", "video/mp4"]
        : ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
      const mime = options.find((m) => MediaRecorder.isTypeSupported(m));
      const r = new MediaRecorder(
        new MediaStream(tracks),
        mime ? { mimeType: mime } : undefined,
      );
      recorder.current = r;
      const chunks: Blob[] = [];
      const recordedHarmony = harmony;
      const started = Date.now();
      r.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      r.onerror = () => {
        setStatus("Recording failed. Try a shorter take or another browser.");
        stopRecording();
      };
      r.onstop = async () => {
        if (recordTimer.current) clearTimeout(recordTimer.current);
        recordTimer.current = null;
        setRecording(false);
        const blob = new Blob(chunks, { type: r.mimeType || chunks[0]?.type });
        if (blob.size) {
          const take: Take = {
            id: crypto.randomUUID(),
            name: `Take ${new Date(started).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
            created: started,
            seconds: (Date.now() - started) / 1000,
            blob,
            harmony: recordedHarmony,
          };
          setTakes((prev) => [take, ...prev]);
          try {
            await saveTake(take);
            setStatus(
              "Take saved on this device. Replay, download or share below.",
            );
          } catch {
            setStatus(
              "Take ready, but storage is full or unavailable. Download it before leaving.",
            );
          }
        } else setStatus("No audio was captured. Please try again.");
        setFinishing(false);
      };
      recordStart.current = started;
      setSeconds(0);
      r.start(1000);
      setRecording(true);
      setStatus(
        "Recording your mix. Takes stop automatically after 3 minutes.",
      );
      recordTimer.current = setTimeout(stopRecording, 180000);
    } catch (e) {
      setStatus((e as Error).message || "Recording could not start.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  async function removeTake(id: string) {
    try {
      await deleteTake(id);
      setTakes((prev) => prev.filter((t) => t.id !== id));
    } catch {
      setStatus("Could not delete the saved take. Please try again.");
    }
  }
  const jump = () =>
    document.getElementById("studio")?.scrollIntoView({ behavior: "smooth" });
  return (
    <>
      <nav>
        <a className="brand" href="#">
          <span>V</span>VOXMIO
        </a>
        <div className="navlinks">
          <a href="#studio">Studio</a>
          <a href="#takes">My takes</a>
          <a href="#how">How it works</a>
        </div>
        <button onClick={jump}>Start creating</button>
      </nav>
      <header>
        <div className="eyebrow">
          <Sparkles size={14} /> YOUR INSTINCT. YOUR INSTRUMENT.
        </div>
        <h1>
          The music in your head
          <br />
          <em>shouldn't stay there.</em>
        </h1>
        <p>
          Play with your hands. Sing what you feel. Turn a little idea into a
          performance worth keeping.
        </p>
        <div className="actions">
          <button className="primary" onClick={jump}>
            <Play size={17} /> Try the studio
          </button>
          <span>Free to explore. No account needed.</span>
        </div>
      </header>
      <main>
        <section id="studio" className="studio">
          <div className="studioHead">
            <div>
              <small>LIVE PLAYGROUND</small>
              <h2>Make something now.</h2>
            </div>
            <span className="sessionBadge">
              {recording ? "● RECORDING" : "BROWSER STUDIO · BETA"}
            </span>
          </div>
          <p className="status" role="status" aria-live="polite">
            {status}
          </p>
          <div className="workspace">
            <div className="camera">
              <video ref={video} muted playsInline />
              <canvas ref={canvas} />
              {!cam && (
                <div className="cameraEmpty">
                  <Hand />
                  <b>Your hands become the instrument.</b>
                  <p>
                    Move an open hand across four chord zones. Or start with the
                    pads — no camera needed.
                  </p>
                  <button
                    disabled={busy || recording || finishing}
                    onClick={() => enableDevices(true)}
                  >
                    <Camera size={17} />{" "}
                    {busy ? "Connecting…" : "Enable camera + mic"}
                  </button>
                  <button
                    className="secondary"
                    disabled={busy || mic || recording || finishing}
                    onClick={() => enableDevices(false)}
                  >
                    <Mic size={17} />{" "}
                    {mic ? "Microphone connected" : "Use microphone only"}
                  </button>
                </div>
              )}
              {cam && (
                <>
                  <div className="zones">
                    {CHORDS.map((c, i) => (
                      <span
                        key={c.name}
                        className={current === i ? "active" : ""}
                      >
                        {c.name}
                      </span>
                    ))}
                  </div>
                  <div className="hud">
                    <span>HAND SPACE</span>
                    <strong>
                      {current < 0
                        ? "Move an open hand between zones"
                        : `${CHORDS[current].name} · playing`}
                    </strong>
                  </div>
                </>
              )}
            </div>
            <aside>
              <div className="controlTitle">
                <h3>Your instrument</h3>
                <button
                  className="quiet"
                  onClick={() => {
                    audio.current.silence();
                    setCurrent(-1);
                  }}
                >
                  Silence
                </button>
              </div>
              <p>
                Tap a chord, press 1–4, or move your hand. Space silences the
                instrument.
              </p>
              <div className="chords">
                {CHORDS.map((c, i) => (
                  <button
                    key={c.name}
                    aria-label={`Play ${c.name} chord`}
                    aria-pressed={current === i}
                    onClick={() => playChord(i)}
                  >
                    <span>{c.name}</span>
                    <small>
                      <Volume2 size={11} /> KEY {c.key}
                    </small>
                  </button>
                ))}
              </div>
              <div className="settings">
                <label>
                  Sound
                  <select
                    value={sound}
                    onChange={(e) => setSound(e.target.value as OscillatorType)}
                  >
                    <option value="triangle">Warm keys</option>
                    <option value="sine">Soft glow</option>
                    <option value="sawtooth">Bright synth</option>
                  </select>
                </label>
                <label>
                  Tempo <span>{bpm} BPM</span>
                  <input
                    aria-label="Tempo"
                    type="range"
                    min="60"
                    max="150"
                    value={bpm}
                    onChange={(e) => setBpm(Number(e.target.value))}
                  />
                </label>
                <label>
                  Instrument volume <span>{volume}%</span>
                  <input
                    aria-label="Instrument volume"
                    type="range"
                    min="0"
                    max="100"
                    value={volume}
                    onChange={(e) => {
                      setVolume(Number(e.target.value));
                      audio.current.setVolume(Number(e.target.value) / 100);
                    }}
                  />
                </label>
              </div>
              <label className="harmony">
                <input
                  type="checkbox"
                  checked={harmony}
                  disabled={recording || finishing}
                  onChange={(e) => {
                    setHarmony(e.target.checked);
                    audio.current.setHarmony(e.target.checked);
                  }}
                />
                <span>
                  <b>Vocal harmony</b>
                  <small>
                    Adds a pitch-shifted fifth to your recorded voice. Hear it
                    on replay.
                  </small>
                </span>
                <Sparkles size={18} />
              </label>
              <div className="micLevel">
                <Mic size={13} />
                <meter
                  min="0"
                  max="100"
                  value={level}
                  aria-label="Microphone level"
                />
                <small>{mic ? "Mic connected" : "Instrument-only mode"}</small>
              </div>
              <div className="rec">
                <button
                  disabled={busy || finishing}
                  className={recording ? "stop" : ""}
                  onClick={recording ? stopRecording : startRecording}
                >
                  {recording ? (
                    <>
                      <Square size={16} /> Stop · {duration(seconds)}
                    </>
                  ) : finishing ? (
                    "Saving take…"
                  ) : (
                    <>
                      <Mic size={16} /> Record{" "}
                      {mic ? "performance" : "instruments"}
                    </>
                  )}
                </button>
              </div>
              <p className="privacy">
                Use headphones for a clean recording. Camera and audio stay on
                your device.
              </p>
              {(cam || mic) && (
                <button
                  className="quiet"
                  disabled={recording || finishing || busy}
                  onClick={stopDevices}
                >
                  Turn camera & mic off
                </button>
              )}
            </aside>
          </div>
        </section>
        <section id="takes" className="saved">
          <div className="studioHead">
            <div>
              <small>YOUR LITTLE BIG IDEAS</small>
              <h2>
                My takes <span>{takes.length.toString().padStart(2, "0")}</span>
              </h2>
            </div>
            <p>Saved in this browser. Download to keep a backup.</p>
          </div>
          {takes.length ? (
            <div className="takeGrid">
              {takes.map((t) => (
                <TakeCard
                  key={t.id}
                  take={t}
                  onDelete={removeTake}
                  onError={setStatus}
                />
              ))}
            </div>
          ) : (
            <div className="emptyTakes">
              <Music2 />
              <div>
                <h3>Your first idea belongs here.</h3>
                <p>Play a chord, hit record, and see where it goes.</p>
              </div>
              <button onClick={jump}>Make your first take →</button>
            </div>
          )}
        </section>
        <section id="how" className="features">
          <article>
            <Hand />
            <small>01</small>
            <h3>Move into music</h3>
            <p>
              Let the camera follow your hand across C, Am, F and G. Keyboard
              and touch controls are always there.
            </p>
          </article>
          <article>
            <Mic />
            <small>02</small>
            <h3>Give it your voice</h3>
            <p>
              Sing over the chords. Add a vocal harmony effect and record the
              whole mix together.
            </p>
          </article>
          <article>
            <Download />
            <small>03</small>
            <h3>Keep the feeling</h3>
            <p>
              Replay your takes, download a performance, or share the file with
              someone who should hear it.
            </p>
          </article>
        </section>
        <section className="pricing">
          <small>ROOM TO GROW</small>
          <h2>
            Free to explore.
            <br />
            <em>Made for your next idea.</em>
          </h2>
          <div>
            <p>
              The beta includes recording and exports. AI-generated vocal
              arrangements and cloud projects are planned for Creator. No paid
              plan is available yet.
            </p>
            <span className="sessionBadge">CREATOR · COMING LATER</span>
          </div>
        </section>
      </main>
      <footer>
        <a className="brand" href="#">
          <span>V</span>VOXMIO
        </a>
        <p>More people creating a more musical world.</p>
        <small>© 2026 Voxmio</small>
      </footer>
    </>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
