"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { formatClock, formatTc } from "@/lib/time";
import Watermark from "./Watermark";

export type PlayerHandle = {
  seek: (t: number) => void;
  pause: () => void;
};

export type Marker = { id: string; time: number; timeEnd: number | null; resolved: boolean };

type Props = {
  src: string;
  fps: number;
  /** When set, the viewer-specific watermark is shown (and enforced). */
  watermarkName: string | null;
  markers: Marker[];
  /** A range being composed in the comment box. */
  rangePreview: { start: number; end: number | null } | null;
  onTime: (t: number) => void;
};

const RATES = [0.5, 1, 1.25, 1.5, 2];

const VideoPlayer = forwardRef<PlayerHandle, Props>(function VideoPlayer(
  { src, fps, watermarkName, markers, rangePreview, onTime },
  ref,
) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const scrubbing = useRef(false);

  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const [blocked, setBlocked] = useState(false);

  const seek = useCallback(
    (t: number) => {
      const v = videoRef.current;
      if (!v) return;
      const d = Number.isFinite(v.duration) ? v.duration : t;
      v.currentTime = Math.min(Math.max(0, t), d);
      setTime(v.currentTime);
      onTime(v.currentTime);
    },
    [onTime],
  );

  useImperativeHandle(ref, () => ({ seek, pause: () => videoRef.current?.pause() }), [seek]);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v || blocked) return;
    if (v.paused) void v.play();
    else v.pause();
  }, [blocked]);

  const stepFrames = useCallback(
    (n: number) => {
      const v = videoRef.current;
      if (!v) return;
      v.pause();
      seek(Math.round(v.currentTime * fps) / fps + n / fps);
    },
    [fps, seek],
  );

  /* While playing, follow the clock every frame so the timecode is smooth. */
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = () => {
      const v = videoRef.current;
      if (v && !scrubbing.current) {
        setTime(v.currentTime);
        onTime(v.currentTime);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, onTime]);

  /* Keyboard shortcuts (ignored while typing in a field). */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)) return;
      if (e.key === " " || e.key === "k") {
        e.preventDefault();
        togglePlay();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (e.shiftKey) seek((videoRef.current?.currentTime ?? 0) - 5);
        else stepFrames(-1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        if (e.shiftKey) seek((videoRef.current?.currentTime ?? 0) + 5);
        else stepFrames(1);
      } else if (e.key === "f") {
        void toggleFullscreen();
      } else if (e.key === "m") {
        setMuted((m) => !m);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlay, stepFrames, seek]);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === wrapRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  async function toggleFullscreen() {
    // Fullscreen the wrapper (not the <video>) so the watermark stays on top.
    if (document.fullscreenElement) await document.exitFullscreen();
    else await wrapRef.current?.requestFullscreen();
  }

  /* Watermark enforcement: if it is removed or hidden, stop the video. A deterrent, not DRM. */
  useEffect(() => {
    if (!watermarkName) return;
    const wrap = wrapRef.current;
    if (!wrap) return;
    let strikes = 0;
    let recheck = 0;
    const intact = () => {
      const el = wrap.querySelector<HTMLElement>("[data-wm]");
      if (!el) return false;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      const w = wrap.getBoundingClientRect();
      const badge = el.querySelector<HTMLElement>(".wm-badge");
      const bs = badge ? getComputedStyle(badge) : null;
      return (
        cs.display !== "none" &&
        cs.visibility === "visible" &&
        parseFloat(cs.opacity) > 0.5 &&
        r.width >= w.width * 0.5 &&
        r.height >= w.height * 0.5 &&
        !!bs &&
        bs.display !== "none" &&
        bs.visibility === "visible" &&
        parseFloat(bs.opacity) > 0.3
      );
    };
    const check = () => {
      // Nothing to judge while the page is hidden or not laid out yet.
      if (document.hidden || wrap.getBoundingClientRect().width === 0) return;
      if (intact()) {
        strikes = 0;
        return;
      }
      // Require two failures in a row so a transient layout state can't trip it.
      if (++strikes < 2) {
        window.clearTimeout(recheck);
        recheck = window.setTimeout(check, 300);
        return;
      }
      const v = videoRef.current;
      if (v) {
        v.pause();
        v.removeAttribute("src");
        v.load();
      }
      setBlocked(true);
    };
    const observer = new MutationObserver(check);
    observer.observe(wrap, { childList: true, subtree: true, attributes: true });
    const interval = window.setInterval(check, 1500);
    return () => {
      observer.disconnect();
      window.clearInterval(interval);
      window.clearTimeout(recheck);
    };
  }, [watermarkName]);

  /* Scrubbing on the seek bar. */
  const seekFromPointer = (e: ReactPointerEvent) => {
    const bar = barRef.current;
    if (!bar || !duration) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    seek(ratio * duration);
  };

  const pct = (t: number) => (duration ? `${Math.min(100, (t / duration) * 100)}%` : "0%");

  return (
    <div
      ref={wrapRef}
      className="relative aspect-video w-full overflow-hidden rounded-xl bg-black select-none"
      style={{ containerType: "inline-size" }}
    >
      <video
        ref={videoRef}
        src={src}
        className="absolute inset-0 h-full w-full bg-black object-contain"
        playsInline
        preload="metadata"
        controlsList="nodownload noremoteplayback"
        disablePictureInPicture
        disableRemotePlayback
        onContextMenu={(e) => e.preventDefault()}
        onClick={togglePlay}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onDurationChange={(e) => setDuration(e.currentTarget.duration)}
        onTimeUpdate={(e) => {
          if (!scrubbing.current) setTime(e.currentTarget.currentTime);
        }}
        onProgress={(e) => {
          const v = e.currentTarget;
          if (v.buffered.length) setBuffered(v.buffered.end(v.buffered.length - 1));
        }}
        onVolumeChange={(e) => {
          setVolume(e.currentTarget.volume);
        }}
      />

      {watermarkName && <Watermark name={watermarkName} />}

      {blocked && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-black p-6 text-center">
          <p className="text-lg font-semibold text-sun">Playback stopped</p>
          <p className="max-w-sm text-sm text-cream/70">
            The watermark was removed or hidden. Reload the page to keep watching.
          </p>
        </div>
      )}

      {/* big play button when paused */}
      {!playing && !blocked && (
        <button
          type="button"
          onClick={togglePlay}
          aria-label="Play"
          className="absolute left-1/2 top-1/2 z-10 grid h-16 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-brand text-ink shadow-xl"
        >
          <svg viewBox="0 0 24 24" className="ml-1 h-7 w-7 fill-current"><path d="M8 5v14l11-7z" /></svg>
        </button>
      )}

      {/* controls */}
      <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/85 to-transparent px-3 pb-2 pt-8">
        <div
          ref={barRef}
          className="group relative h-5 cursor-pointer touch-none"
          onPointerDown={(e) => {
            scrubbing.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            seekFromPointer(e);
          }}
          onPointerMove={(e) => scrubbing.current && seekFromPointer(e)}
          onPointerUp={() => (scrubbing.current = false)}
        >
          <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-white/20 group-hover:h-2">
            <div className="absolute inset-y-0 left-0 rounded-full bg-white/25" style={{ width: pct(buffered) }} />
            <div className="absolute inset-y-0 left-0 rounded-full bg-brand" style={{ width: pct(time) }} />
            {/* range being composed */}
            {rangePreview && (
              <div
                className="absolute inset-y-0 rounded-full bg-sun/70"
                style={{
                  left: pct(rangePreview.start),
                  width: pct(Math.max(0, (rangePreview.end ?? time) - rangePreview.start)),
                }}
              />
            )}
          </div>
          {markers.map((m) => (
            <div key={m.id}>
              {m.timeEnd != null && (
                <div
                  className={`absolute top-1/2 h-1 -translate-y-1/2 rounded-full ${m.resolved ? "bg-stone/60" : "bg-magenta/80"}`}
                  style={{ left: pct(m.time), width: pct(m.timeEnd - m.time) }}
                />
              )}
              <div
                className={`absolute top-1/2 h-3 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-sm ${m.resolved ? "bg-stone" : "bg-sun"}`}
                style={{ left: pct(m.time) }}
              />
            </div>
          ))}
          <div
            className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cream shadow"
            style={{ left: pct(time) }}
          />
        </div>

        <div className="mt-1 flex items-center gap-2 text-cream">
          <button type="button" onClick={togglePlay} aria-label={playing ? "Pause" : "Play"} className="grid h-8 w-8 place-items-center rounded hover:bg-white/10">
            {playing ? (
              <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current"><path d="M6 5h4v14H6zm8 0h4v14h-4z" /></svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current"><path d="M8 5v14l11-7z" /></svg>
            )}
          </button>
          <button type="button" onClick={() => stepFrames(-1)} title="Back one frame (←)" className="grid h-8 w-8 place-items-center rounded text-xs font-bold hover:bg-white/10">‹|</button>
          <button type="button" onClick={() => stepFrames(1)} title="Forward one frame (→)" className="grid h-8 w-8 place-items-center rounded text-xs font-bold hover:bg-white/10">|›</button>

          <span className="font-mono text-xs tabular-nums sm:text-sm">
            {formatTc(time, fps)}
            <span className="hidden text-cream/50 sm:inline"> / {formatClock(duration)}</span>
          </span>

          <div className="ml-auto flex items-center gap-1">
            <select
              value={rate}
              onChange={(e) => {
                const r = Number(e.target.value);
                setRate(r);
                if (videoRef.current) videoRef.current.playbackRate = r;
              }}
              aria-label="Playback speed"
              className="rounded bg-transparent px-1 py-1 text-xs hover:bg-white/10"
            >
              {RATES.map((r) => (
                <option key={r} value={r} className="bg-panel">{r}x</option>
              ))}
            </select>
            <button
              type="button"
              aria-label={muted ? "Unmute" : "Mute"}
              onClick={() => {
                const next = !muted;
                setMuted(next);
                if (videoRef.current) videoRef.current.muted = next;
              }}
              className="grid h-8 w-8 place-items-center rounded hover:bg-white/10"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
                {muted || volume === 0 ? (
                  <path d="M16.5 12A4.5 4.5 0 0014 7.97v2.21l2.45 2.45c.03-.2.05-.41.05-.63zM19 12c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.8 8.8 0 0021 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 003.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                ) : (
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0014 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
                )}
              </svg>
            </button>
            <button type="button" onClick={() => void toggleFullscreen()} aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"} className="grid h-8 w-8 place-items-center rounded hover:bg-white/10">
              <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
                {fullscreen ? (
                  <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" />
                ) : (
                  <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

export default VideoPlayer;
