"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranscribe } from "@/hooks/use-mylist";
import { useI18n } from "@/lib/i18n";
import type { TranslationKey } from "@/lib/i18n/en";

const MAX_AUDIO_MS = 10 * 60 * 1000;

type Phase = "idle" | "requesting" | "recording" | "transcribing";

/** Voice → raw transcript via MediaRecorder + /api/ai/transcribe.
 *  The audio blob stays in memory only — never uploaded for storage. */
export function BriefRecorder({
  onTranscript,
  disabled,
}: {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  const transcribe = useTranscribe();
  const [phase, setPhase] = useState<Phase>("idle");
  const [seconds, setSeconds] = useState(0);
  const [errorKey, setErrorKey] = useState<TranslationKey | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      // Unmount mid-recording → release everything.
      if (timerRef.current) clearInterval(timerRef.current);
      if (maxTimerRef.current) clearTimeout(maxTimerRef.current);
      if (recorderRef.current?.state === "recording") {
        recorderRef.current.stop();
        recorderRef.current.stream.getTracks().forEach((tr) => tr.stop());
      }
    };
  }, []);

  function stopTimers() {
    if (timerRef.current) clearInterval(timerRef.current);
    if (maxTimerRef.current) clearTimeout(maxTimerRef.current);
    timerRef.current = null;
    maxTimerRef.current = null;
  }

  async function finishRecording() {
    const recorder = recorderRef.current;
    if (!recorder) return;
    stopTimers();
    recorder.stop();
    recorder.stream.getTracks().forEach((tr) => tr.stop());

    const blob = new Blob(chunksRef.current, {
      type: recorder.mimeType || "audio/webm",
    });
    chunksRef.current = [];
    recorderRef.current = null;

    if (blob.size === 0) {
      setPhase("idle");
      return;
    }
    setPhase("transcribing");
    try {
      const { transcript } = await transcribe.mutateAsync({
        file: blob,
        filename: "brief-recording.webm",
      });
      if (transcript.trim()) onTranscript(transcript.trim());
      setPhase("idle");
    } catch {
      setPhase("idle");
    }
  }

  async function start() {
    setErrorKey(null);
    setSeconds(0);
    setPhase("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        // Handled in finishRecording — kept for the hard cap path.
      };
      recorderRef.current = recorder;
      recorder.start();

      timerRef.current = setInterval(
        () => setSeconds((s) => s + 1),
        1000,
      );
      maxTimerRef.current = setTimeout(() => void finishRecording(), MAX_AUDIO_MS);
      setPhase("recording");
    } catch {
      setErrorKey("brief.voiceUnavailable");
      setPhase("idle");
    }
  }

  const busy = phase === "requesting" || phase === "transcribing";
  const label =
    phase === "requesting"
      ? t("brief.requestingMic")
      : phase === "recording"
        ? t("brief.recording", { s: seconds })
        : phase === "transcribing"
          ? t("brief.transcribing")
          : t("brief.record");

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        {phase === "recording" ? (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => void finishRecording()}
          >
            <Square className="size-4" />
            {t("brief.stopRecording")}
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void start()}
            disabled={disabled || busy}
          >
            {phase === "transcribing" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Mic className="size-4" />
            )}
            {label}
          </Button>
        )}
        {phase === "recording" && (
          <span className="flex items-center gap-1.5 text-sm text-red-600">
            <span className="size-2 animate-pulse rounded-full bg-red-500" />
            {t("brief.recording", { s: seconds })}
          </span>
        )}
      </div>
      {(phase === "idle" || phase === "transcribing") && (
        <p className="text-xs text-slate-400">{t("brief.voicePrivacy")}</p>
      )}
      {errorKey && <p className="text-xs text-red-600">{t(errorKey)}</p>}
    </div>
  );
}