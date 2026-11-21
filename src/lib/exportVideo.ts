import { paintFrame, type OverlayOptions } from '@/lib/overlay';
import { seekVideo } from '@/lib/video';
import type { ProjectData } from '@/types';

const FRAME_RATE = 30;
const VIDEO_BITS_PER_SECOND = 8_000_000;
const MIME_CANDIDATES = [
  'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
  'video/mp4',
  'video/webm;codecs=vp9,opus',
  'video/webm',
];

export type ExportResult = { blob: Blob; extension: 'mp4' | 'webm' };

function pickRecordingMime(): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  return MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type)) ?? null;
}

export function canRecordVideo(): boolean {
  return pickRecordingMime() !== null;
}

export async function exportAnnotatedVideo(
  video: HTMLVideoElement,
  data: ProjectData,
  captions: boolean,
  onProgress: (fraction: number) => void,
): Promise<ExportResult> {
  const mimeType = pickRecordingMime();
  if (!mimeType) throw new Error('This browser cannot record video.');

  const width = video.videoWidth;
  const height = video.videoHeight;
  const duration = video.duration;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not prepare the video frame.');

  video.pause();
  await seekVideo(video, 0);

  const stream = canvas.captureStream(FRAME_RATE);
  const videoWithCapture = video as HTMLVideoElement & { captureStream?: () => MediaStream };
  videoWithCapture.captureStream?.().getAudioTracks().forEach((track) => stream.addTrack(track));

  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: VIDEO_BITS_PER_SECOND });
  const chunks: Blob[] = [];
  const options: OverlayOptions = { draft: null, captions };

  return new Promise<ExportResult>((resolve, reject) => {
    let frameId = 0;

    const finish = () => {
      cancelAnimationFrame(frameId);
      video.pause();
      if (recorder.state !== 'inactive') recorder.stop();
    };

    const drawFrame = () => {
      paintFrame(ctx, video, width, height, data, options);
      onProgress(Math.min(video.currentTime / duration, 1));
      if (video.ended || video.currentTime >= duration - 0.05) {
        finish();
        return;
      }
      frameId = requestAnimationFrame(drawFrame);
    };

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    recorder.onerror = () => {
      cancelAnimationFrame(frameId);
      reject(new Error('Recording stopped unexpectedly.'));
    };
    recorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      resolve({
        blob: new Blob(chunks, { type: mimeType }),
        extension: mimeType.includes('mp4') ? 'mp4' : 'webm',
      });
    };

    recorder.start(1000);
    video.play().then(() => drawFrame()).catch((error: unknown) => {
      finish();
      reject(error instanceof Error ? error : new Error('Playback could not start for export.'));
    });
  });
}
