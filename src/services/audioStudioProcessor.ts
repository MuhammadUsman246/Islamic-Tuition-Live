/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Studio-Grade Vocal Audio Processor for Islamic Tuition Quran Classroom
 * 
 * Implements a Web Audio signal chain:
 * 1. High-Pass Filter (85 Hz) -> eliminates AC hum, mic handling rumble, and desk vibrations.
 * 2. Vocal Presence EQ (3.2 kHz peaking) -> enhances Tajweed articulation and Makharij clarity.
 * 3. Dynamics Compressor -> evens out vocal dynamics, preventing clipping and boosting whisper recitation.
 * 4. AnalyserNode -> drives live LED volume meter and active speaking detection.
 */

export interface StudioAudioPipeline {
  processedTrack: MediaStreamTrack;
  analyser: AnalyserNode;
  audioContext: AudioContext;
  cleanup: () => void;
}

export function createStudioVocalPipeline(rawTrack: MediaStreamTrack): StudioAudioPipeline {
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  const audioContext = new AudioCtx({ latencyHint: 'interactive', sampleRate: 48000 });

  // Source from user's physical microphone
  const mediaStream = new MediaStream([rawTrack]);
  const sourceNode = audioContext.createMediaStreamSource(mediaStream);

  // 1. High-Pass Filter (removes low-frequency static, desk rumble, and mic plosives)
  const highPassFilter = audioContext.createBiquadFilter();
  highPassFilter.type = 'highpass';
  highPassFilter.frequency.setValueAtTime(85, audioContext.currentTime);
  highPassFilter.Q.setValueAtTime(0.707, audioContext.currentTime);

  // 2. Vocal Presence Filter (enhances Quranic recitation and Tajweed diction)
  const vocalPresenceFilter = audioContext.createBiquadFilter();
  vocalPresenceFilter.type = 'peaking';
  vocalPresenceFilter.frequency.setValueAtTime(3200, audioContext.currentTime);
  vocalPresenceFilter.Q.setValueAtTime(1.0, audioContext.currentTime);
  vocalPresenceFilter.gain.setValueAtTime(2.0, audioContext.currentTime);

  // 3. Studio Dynamics Compressor (Apple / Zoom studio vocal leveling)
  const compressor = audioContext.createDynamicsCompressor();
  compressor.threshold.setValueAtTime(-24, audioContext.currentTime);
  compressor.knee.setValueAtTime(12, audioContext.currentTime);
  compressor.ratio.setValueAtTime(4.0, audioContext.currentTime);
  compressor.attack.setValueAtTime(0.003, audioContext.currentTime);
  compressor.release.setValueAtTime(0.25, audioContext.currentTime);

  // 4. Analyser Node for real-time speech detection and LED audio meter
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 256;
  analyser.smoothingTimeConstant = 0.4;

  // 5. Output Destination
  const destination = audioContext.createMediaStreamDestination();

  // Connect Audio Graph:
  // Source -> HighPass -> VocalPresence -> Compressor -> Destination & Analyser
  sourceNode.connect(highPassFilter);
  highPassFilter.connect(vocalPresenceFilter);
  vocalPresenceFilter.connect(compressor);
  compressor.connect(destination);
  compressor.connect(analyser);

  const processedTrack = destination.stream.getAudioTracks()[0];

  const cleanup = () => {
    try {
      sourceNode.disconnect();
      highPassFilter.disconnect();
      vocalPresenceFilter.disconnect();
      compressor.disconnect();
      destination.disconnect();
      analyser.disconnect();
      processedTrack.stop();
      if (audioContext.state !== 'closed') {
        audioContext.close().catch(() => {});
      }
    } catch (e) {
      console.warn('Audio pipeline cleanup notice:', e);
    }
  };

  return {
    processedTrack,
    analyser,
    audioContext,
    cleanup,
  };
}

/**
 * Records a 5-second audio sample from the microphone and returns the playback blob URL
 */
export async function recordVoiceSample(
  stream: MediaStream,
  durationMs = 5000,
  onProgress?: (secondsLeft: number) => void
): Promise<{ audioUrl: string; durationMs: number; cleanup: () => void }> {
  return new Promise((resolve, reject) => {
    try {
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : (MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : '')
      });

      const audioChunks: Blob[] = [];
      let intervalTimer: any = null;
      let remainingSeconds = Math.ceil(durationMs / 1000);

      if (onProgress) {
        onProgress(remainingSeconds);
        intervalTimer = setInterval(() => {
          remainingSeconds -= 1;
          if (remainingSeconds >= 0) {
            onProgress(remainingSeconds);
          }
        }, 1000);
      }

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        if (intervalTimer) clearInterval(intervalTimer);
        const mime = mediaRecorder.mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunks, { type: mime });
        const audioUrl = URL.createObjectURL(audioBlob);

        resolve({
          audioUrl,
          durationMs,
          cleanup: () => {
            URL.revokeObjectURL(audioUrl);
          }
        });
      };

      mediaRecorder.onerror = (err) => {
        if (intervalTimer) clearInterval(intervalTimer);
        reject(err);
      };

      mediaRecorder.start(200);

      setTimeout(() => {
        if (mediaRecorder.state === 'recording') {
          mediaRecorder.stop();
        }
      }, durationMs);

    } catch (err) {
      reject(err);
    }
  });
}
