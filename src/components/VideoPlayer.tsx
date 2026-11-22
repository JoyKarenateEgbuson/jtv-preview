"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
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
  /** Show "Download still" (only for people who are allowed to download). */
  canSaveStill: boolean;
  stillName: string;
  /** Start playing as soon as the video is ready (used when arriving from "up next"). */
  autoPlay?: boolean;
  /** The next video in the folder, if any. When this one ends, it can play automatically. */
  next?: { title: string; go: () => void } | null;
};

type Zoom = "fit" | "fill" | "native";
type Guides = "off" | "safe" | "thirds" | "center";
type Menu = "speed" | "settings" | null;

const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
const ZOOMS: { id: Zoom; label: string }[] = [
  { id: "fit", label: "Fit" },
  { id: "fill", label: "Fill" },
  { id: "native", label: "100%" },
];
const GUIDES: { id: Guides; label: string }[] = [
  { id: "off", label: "Off" },
  { id: "safe", label: "Safe areas" },
  { id: "thirds", label: "Thirds" },
  { id: "center", label: "Center" },
];

const Icon = ({ children, className = "h-5 w-5" }: { children: ReactNode; className?: string }) => (
  <svg viewBox="0 0 24 24" className={`${className} fill-current`}>{children}</svg>
);

const VideoPlayer = forwardRef<PlayerHandle, Props>(function VideoPlayer(
  { src, fps, watermarkName, markers, rangePreview, onTime, canSaveStill, stillName, autoPlay, next },
  ref,
) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const menusRef = useRef<HTMLDivElement>(null);
  const scrubbing = useRef(false);
  const retries = useRef(0);

  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(1);
  const [loop, setLoop] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [failed, setFailed] = useState(false);
  const [menu, setMenu] = useState<Menu>(null);
  const [zoom, setZoom] = useState<Zoom>("fit");
  const [guides, setGuides] = useState<Guides>("off");
  const [area, setArea] = useState({ w: 0, h: 0 });
  const [vsize, setVsize] = useState({ w: 0, h: 0 });
  // "Autoplay next video": on by default, remembered on this device.
  const [autoNext, setAutoNext] = useState(() => {
    try {
      return localStorage.getItem("jtv-autonext") !== "off";
    } catch {
      return true;
    }
  });
  const [upNext, setUpNext] = useState<number | null>(null); // seconds left before the next video starts
  const nextRef = useRef(next);
  const autoPlayed = useRef(false);

  useEffect(() => {
    nextRef.current = next;
  }, [next]);

  /* Count down, then move to the next video. */
  useEffect(() => {
    if (upNext === null) return;
    if (upNext <= 0) {
      nextRef.current?.go();
      return;
    }
    const t = window.setTimeout(() => setUpNext((n) => (n === null ? null : n - 1)), 1000);
    return () => window.clearTimeout(t);
  }, [upNext]);

  /* The browser can finish loading the video's metadata before React attaches the
     event handlers below (fast connections, cached video), so we'd never hear about
     it. Read the current state once on startup to catch up. */
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.readyState >= 1 && Number.isFinite(v.duration)) {
      setDuration(v.duration);
      setVsize({ w: v.videoWidth, h: v.videoHeight });
    }
    if (v.buffered.length) setBuffered(v.buffered.end(v.buffered.length - 1));
    setVolume(v.volume);
    setPlaying(!v.paused);
  }, []);

  /* Track the size of the picture area (for the guides). */
  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) =>
      setArea({ w: entry.contentRect.width, h: entry.contentRect.height }),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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
    if (v.paused) void v.play().catch(() => undefined);
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

  function applyRate(r: number) {
    setRate(r);
    const v = videoRef.current;
    if (v) {
      v.defaultPlaybackRate = r; // survives a reload after a network hiccup
      v.playbackRate = r;
    }
  }

  function applyLoop(next: boolean) {
    setLoop(next);
    if (videoRef.current) videoRef.current.loop = next;
  }

  /* If a chunk fails to load (a network hiccup), quietly reload and carry on from the same spot. */
  function onVideoError() {
    const v = videoRef.current;
    if (!v || blocked) return;
    if (retries.current >= 3) {
      setFailed(true);
      return;
    }
    retries.current += 1;
    const resumeAt = v.currentTime;
    const wasPlaying = !v.paused;
    const resume = () => {
      v.removeEventListener("loadedmetadata", resume);
      v.currentTime = resumeAt;
      if (wasPlaying) void v.play().catch(() => undefined);
    };
    v.addEventListener("loadedmetadata", resume);
    window.setTimeout(() => v.load(), 500 * retries.current);
  }

  function retryNow() {
    retries.current = 0;
    setFailed(false);
    const v = videoRef.current;
    if (!v) return;
    const at = v.currentTime;
    const onMeta = () => {
      v.removeEventListener("loadedmetadata", onMeta);
      v.currentTime = at;
    };
    v.addEventListener("loadedmetadata", onMeta);
    v.load();
  }

  function saveStill() {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext("2d")?.drawImage(v, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${stillName} ${formatTc(v.currentTime, fps).replace(/:/g, "-")}.png`;
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }, "image/png");
    setMenu(null);
  }

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
        const v = videoRef.current;
        if (v) v.muted = !v.muted;
      } else if (e.key === "Escape") {
        setMenu(null);
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

  /* Close the speed / settings popovers when clicking elsewhere. */
  useEffect(() => {
    if (!menu) return;
    const onDown = (e: PointerEvent) => {
      if (!menusRef.current?.contains(e.target as Node)) setMenu(null);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [menu]);

  async function toggleFullscreen() {
    // Fullscreen the wrapper (not the <video>) so the watermark stays on top.
    if (document.fullscreenElement) await document.exitFullscreen();
    else await wrapRef.current?.requestFullscreen();
  }

  /* Watermark enforcement: if it is removed or hidden, stop the video. A deterrent, not DRM. */
  useEffect(() => {
    if (!watermarkName) return;
    const areaEl = areaRef.current;
    if (!areaEl) return;
    let strikes = 0;
    let recheck = 0;
    const intact = () => {
      const el = areaEl.querySelector<HTMLElement>("[data-wm]");
      if (!el) return false;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      const a = areaEl.getBoundingClientRect();
      return (
        cs.display !== "none" &&
        cs.visibility === "visible" &&
        parseFloat(cs.opacity) > 0.5 &&
        cs.backgroundImage !== "none" &&
        r.width >= a.width * 0.9 &&
        r.height >= a.height * 0.9
      );
    };
    const check = () => {
      // Nothing to judge while the page is hidden or not laid out yet.
      if (document.hidden || areaEl.getBoundingClientRect().width === 0) return;
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
    observer.observe(areaEl, { childList: true, subtree: true, attributes: true });
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

  /* Where the picture actually sits inside the area, so guides line up with it. */
  const box = useMemo(() => {
    if (!area.w || !area.h || !vsize.w || !vsize.h) return null;
    const scale =
      zoom === "fit"
        ? Math.min(area.w / vsize.w, area.h / vsize.h)
        : zoom === "fill"
          ? Math.max(area.w / vsize.w, area.h / vsize.h)
          : 1;
    const width = vsize.w * scale;
    const height = vsize.h * scale;
    return { left: (area.w - width) / 2, top: (area.h - height) / 2, width, height };
  }, [area, vsize, zoom]);

  const zoomClass = zoom === "fit" ? "object-contain" : zoom === "fill" ? "object-cover" : "object-none";
  const line = "absolute bg-white/60";

  const seg = (active: boolean) =>
    `rounded-md px-2.5 py-1 text-xs font-semibold transition ${active ? "bg-brand text-ink" : "bg-line text-cream/80 hover:bg-white/10"}`;

  return (
    <div
      ref={wrapRef}
      className="flex h-[calc(56.25vw+5.5rem)] w-full flex-col overflow-hidden rounded-xl bg-black select-none lg:h-[calc(100dvh-10rem)] lg:min-h-[340px] [&:fullscreen]:h-full [&:fullscreen]:rounded-none"
      style={{ containerType: "inline-size" }}
    >
      {/* picture */}
      <div ref={areaRef} className="relative min-h-0 flex-1 overflow-hidden bg-black">
        <video
          ref={videoRef}
          src={src}
          className={`absolute inset-0 h-full w-full bg-black ${zoomClass}`}
          playsInline
          preload="metadata"
          controlsList="nodownload noremoteplayback"
          disablePictureInPicture
          disableRemotePlayback
          onContextMenu={(e) => e.preventDefault()}
          onClick={togglePlay}
          onPlay={() => {
            setPlaying(true);
            setUpNext(null);
          }}
          onPause={() => setPlaying(false)}
          onEnded={() => {
            if (nextRef.current && autoNext) setUpNext(4);
          }}
          onCanPlay={() => {
            const v = videoRef.current;
            if (autoPlay && v && !autoPlayed.current) {
              autoPlayed.current = true;
              void v.play().catch(() => undefined); // if the browser refuses, the play button is still there
            }
          }}
          onPlaying={() => (retries.current = 0)}
          onError={onVideoError}
          onLoadedMetadata={(e) => {
            setDuration(e.currentTarget.duration);
            setVsize({ w: e.currentTarget.videoWidth, h: e.currentTarget.videoHeight });
          }}
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
            setMuted(e.currentTarget.muted);
          }}
        />

        {watermarkName && <Watermark name={watermarkName} />}

        {/* composition guides, aligned to the picture */}
        {guides !== "off" && box && (
          <div className="pointer-events-none absolute z-[5]" style={box}>
            {guides === "safe" && (
              <>
                <div className="absolute border border-white/60" style={{ inset: "5%" }} />
                <div className="absolute border border-white/40" style={{ inset: "10%" }} />
              </>
            )}
            {guides === "thirds" && (
              <>
                <div className={`${line} inset-y-0 w-px`} style={{ left: "33.333%" }} />
                <div className={`${line} inset-y-0 w-px`} style={{ left: "66.666%" }} />
                <div className={`${line} inset-x-0 h-px`} style={{ top: "33.333%" }} />
                <div className={`${line} inset-x-0 h-px`} style={{ top: "66.666%" }} />
              </>
            )}
            {guides === "center" && (
              <>
                <div className={`${line} inset-y-0 w-px`} style={{ left: "50%" }} />
                <div className={`${line} inset-x-0 h-px`} style={{ top: "50%" }} />
              </>
            )}
          </div>
        )}

        {blocked && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-black p-6 text-center">
            <p className="text-lg font-semibold text-sun">Playback stopped</p>
            <p className="max-w-sm text-sm text-cream/70">
              The watermark was removed or hidden. Reload the page to keep watching.
            </p>
          </div>
        )}

        {upNext !== null && next && !blocked && (
          <div className="absolute inset-0 z-20 grid place-items-center bg-black/80 p-6 text-center">
            <div>
              <p className="text-sm text-cream/70">Up next</p>
              <p className="mt-1 text-xl font-bold">{next.title}</p>
              <p className="mt-2 text-sm text-cream/70">Playing in {Math.max(upNext, 0)}…</p>
              <div className="mt-4 flex justify-center gap-2">
                <button type="button" className="btn" onClick={() => next.go()}>Play now</button>
                <button type="button" className="btn btn-ghost" onClick={() => setUpNext(null)}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {failed && !blocked && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/85 p-6 text-center">
            <p className="text-lg font-semibold text-sun">The video stopped loading</p>
            <p className="max-w-sm text-sm text-cream/70">This is usually a brief connection problem.</p>
            <button type="button" className="btn" onClick={retryNow}>Try again</button>
          </div>
        )}

        {/* big play button when paused */}
        {!playing && !blocked && !failed && (
          <button
            type="button"
            onClick={togglePlay}
            aria-label="Play"
            className="absolute left-1/2 top-1/2 z-10 grid h-16 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-brand text-ink shadow-xl"
          >
            <Icon className="ml-1 h-7 w-7"><path d="M8 5v14l11-7z" /></Icon>
          </button>
        )}
      </div>

      {/* controls, below the picture */}
      <div className="shrink-0 px-3 pb-2 pt-1">
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
          onPointerCancel={() => (scrubbing.current = false)}
          onLostPointerCapture={() => (scrubbing.current = false)}
        >
          <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-white/20 group-hover:h-2">
            <div className="absolute inset-y-0 left-0 rounded-full bg-white/25" style={{ width: pct(buffered) }} />
            <div className="absolute inset-y-0 left-0 rounded-full bg-brand" style={{ width: pct(time) }} />
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

        <div className="mt-1 flex items-center gap-1 text-cream sm:gap-2">
          <button type="button" onClick={togglePlay} aria-label={playing ? "Pause" : "Play"} className="grid h-8 w-8 place-items-center rounded hover:bg-white/10">
            {playing ? <Icon><path d="M6 5h4v14H6zm8 0h4v14h-4z" /></Icon> : <Icon><path d="M8 5v14l11-7z" /></Icon>}
          </button>
          <button type="button" onClick={() => stepFrames(-1)} title="Back one frame (←)" className="grid h-8 w-8 place-items-center rounded text-xs font-bold hover:bg-white/10">‹|</button>
          <button type="button" onClick={() => stepFrames(1)} title="Forward one frame (→)" className="grid h-8 w-8 place-items-center rounded text-xs font-bold hover:bg-white/10">|›</button>

          <span className="font-mono text-xs tabular-nums sm:text-sm">
            {formatTc(time, fps)}
            <span className="hidden text-cream/50 sm:inline"> / {formatClock(duration)}</span>
          </span>

          <div ref={menusRef} className="relative ml-auto flex items-center gap-0.5 sm:gap-1">
            <button
              type="button"
              onClick={() => applyLoop(!loop)}
              aria-label="Loop"
              aria-pressed={loop}
              title="Loop"
              className={`grid h-8 w-8 place-items-center rounded hover:bg-white/10 ${loop ? "text-brand" : ""}`}
            >
              <Icon><path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z" /></Icon>
            </button>

            <button
              type="button"
              onClick={() => setMenu(menu === "speed" ? null : "speed")}
              aria-label="Playback speed"
              className={`h-8 rounded px-2 text-xs font-semibold hover:bg-white/10 ${rate !== 1 ? "text-brand" : ""}`}
            >
              {Number.isInteger(rate) ? rate.toFixed(1) : String(rate)}x
            </button>

            <button
              type="button"
              aria-label={muted ? "Unmute" : "Mute"}
              onClick={() => {
                if (videoRef.current) videoRef.current.muted = !videoRef.current.muted;
              }}
              className="grid h-8 w-8 place-items-center rounded hover:bg-white/10"
            >
              <Icon>
                {muted || volume === 0 ? (
                  <path d="M16.5 12A4.5 4.5 0 0014 7.97v2.21l2.45 2.45c.03-.2.05-.41.05-.63zM19 12c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.8 8.8 0 0021 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 003.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                ) : (
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0014 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
                )}
              </Icon>
            </button>

            <button
              type="button"
              onClick={() => setMenu(menu === "settings" ? null : "settings")}
              aria-label="Player settings"
              className={`grid h-8 w-8 place-items-center rounded hover:bg-white/10 ${zoom !== "fit" || guides !== "off" ? "text-brand" : ""}`}
            >
              <Icon><path d="M19.14 12.94c.04-.3.06-.61.06-.94s-.02-.64-.07-.94l2.03-1.58a.5.5 0 00.12-.64l-1.92-3.32a.5.5 0 00-.6-.22l-2.39.96a7 7 0 00-1.62-.94l-.36-2.54a.5.5 0 00-.5-.42h-3.84a.5.5 0 00-.5.42l-.36 2.54c-.59.24-1.13.56-1.62.94l-2.39-.96a.5.5 0 00-.6.22L2.74 8.84a.5.5 0 00.12.64l2.03 1.58c-.05.3-.07.63-.07.94s.02.64.07.94l-2.03 1.58a.5.5 0 00-.12.64l1.92 3.32c.12.22.37.29.6.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.26.42.5.42h3.84c.24 0 .45-.18.5-.42l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .6-.22l1.92-3.32a.5.5 0 00-.12-.64l-2.01-1.58zM12 15.6A3.6 3.6 0 1112 8.4a3.6 3.6 0 010 7.2z" /></Icon>
            </button>

            <button type="button" onClick={() => void toggleFullscreen()} aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"} className="grid h-8 w-8 place-items-center rounded hover:bg-white/10">
              <Icon>
                {fullscreen ? (
                  <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" />
                ) : (
                  <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
                )}
              </Icon>
            </button>

            {menu === "speed" && (
              <div className="absolute bottom-full right-0 z-30 mb-2 w-72 max-w-[85vw] rounded-xl border border-line bg-panel p-4 shadow-2xl">
                <p className="mb-3 text-sm text-cream/70">Playback speed</p>
                <input
                  type="range"
                  className="speed"
                  min={0.25}
                  max={2}
                  step={0.25}
                  value={rate}
                  aria-label="Playback speed"
                  onChange={(e) => applyRate(Number(e.target.value))}
                />
                <div className="mt-2 flex justify-between text-[11px] text-cream/60">
                  {SPEEDS.map((s) => (
                    <button key={s} type="button" onClick={() => applyRate(s)} className={`px-0.5 hover:text-cream ${s === rate ? "font-bold text-brand" : ""}`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {menu === "settings" && (
              <div className="absolute bottom-full right-0 z-30 mb-2 w-72 max-w-[85vw] space-y-4 rounded-xl border border-line bg-panel p-4 shadow-2xl">
                <div>
                  <p className="mb-2 text-sm text-cream/70">Zoom</p>
                  <div className="flex gap-1.5">
                    {ZOOMS.map((z) => (
                      <button key={z.id} type="button" className={seg(zoom === z.id)} onClick={() => setZoom(z.id)}>{z.label}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-sm text-cream/70">Guides</p>
                  <div className="flex flex-wrap gap-1.5">
                    {GUIDES.map((g) => (
                      <button key={g.id} type="button" className={seg(guides === g.id)} onClick={() => setGuides(g.id)}>{g.label}</button>
                    ))}
                  </div>
                </div>
                {next && (
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={autoNext}
                      onChange={(e) => {
                        setAutoNext(e.target.checked);
                        try {
                          localStorage.setItem("jtv-autonext", e.target.checked ? "on" : "off");
                        } catch {
                          /* private mode: the choice just isn't remembered */
                        }
                      }}
                    />
                    Autoplay the next video
                  </label>
                )}
                {canSaveStill && (
                  <button type="button" className="btn btn-ghost w-full" onClick={saveStill}>
                    Download still of this frame
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

export default VideoPlayer;
