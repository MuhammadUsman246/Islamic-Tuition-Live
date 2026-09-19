import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, Mic } from 'lucide-react';

interface AudioPlayerProps {
  src: string;
  duration?: number;
  fileName?: string;
  isMe?: boolean;
  onListen?: () => void;
  listened?: boolean;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  src,
  duration: initialDuration,
  fileName = 'Voice Note',
  isMe = false,
  onListen,
  listened = false
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(initialDuration || 0);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const hasListenedReported = useRef(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setDuration(Math.round(audio.duration));
      }
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [src]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().then(() => {
        setIsPlaying(true);
        if (!hasListenedReported.current && onListen) {
          hasListenedReported.current = true;
          onListen();
        }
      }).catch(err => {
        console.warn('Audio playback notice:', err);
      });
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const newTime = parseFloat(e.target.value);
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const togglePlaybackRate = () => {
    const audio = audioRef.current;
    if (!audio) return;
    const nextRate = playbackRate === 1 ? 1.5 : playbackRate === 1.5 ? 2 : 1;
    audio.playbackRate = nextRate;
    setPlaybackRate(nextRate);
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Generate dynamic pseudo-waveform bars
  const totalBars = 24;
  const progressRatio = duration > 0 ? currentTime / duration : 0;
  const activeBarIndex = Math.floor(progressRatio * totalBars);

  return (
    <div
      className={`p-2.5 rounded-xl flex items-center space-x-3 w-full max-w-xs transition-colors ${
        isMe
          ? 'bg-emerald-800/15 border border-emerald-700/20 text-[#161F1A]'
          : 'bg-[#F0F2F5] text-[#111B21] border border-[#E9EDEF]'
      }`}
    >
      <audio ref={audioRef} src={src} preload="metadata" />

      {/* Play/Pause Button */}
      <button
        type="button"
        onClick={togglePlay}
        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-transform active:scale-95 shadow-xs cursor-pointer ${
          isMe
            ? 'bg-[#1E5C3D] text-white hover:bg-[#16472F]'
            : 'bg-[#2D8B5C] text-white hover:bg-[#1E5C3D]'
        }`}
        title={isPlaying ? 'Pause voice note' : 'Play voice note'}
      >
        {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
      </button>

      {/* Waveform track & details */}
      <div className="flex-1 min-w-0 space-y-1.5">
        {/* Waveform graphic scrubber */}
        <div className="relative flex items-center h-5 gap-0.5">
          {Array.from({ length: totalBars }).map((_, idx) => {
            // Simulated heights for audio waveform
            const heightMultiplier = Math.sin((idx / totalBars) * Math.PI * 3.5) * 0.45 + 0.55;
            const barHeight = Math.max(4, Math.round(heightMultiplier * 18));
            const isPlayed = idx <= activeBarIndex;
            const isPlayedBlue = listened || (isMe && activeBarIndex > 0);

            return (
              <div
                key={idx}
                className="flex-1 rounded-full transition-colors duration-100"
                style={{
                  height: `${barHeight}px`,
                  backgroundColor: isPlayed
                    ? isPlayedBlue
                      ? '#34B7F1'
                      : '#2D8B5C'
                    : '#C1C7CD'
                }}
              />
            );
          })}

          <input
            type="range"
            min={0}
            max={duration || 1}
            step={0.05}
            value={currentTime}
            onChange={handleSeek}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            title="Seek position"
          />
        </div>

        {/* Time & speed controls */}
        <div className="flex items-center justify-between text-[10px] font-medium text-[#54656F]">
          <div className="flex items-center gap-1.5 font-mono tabular-nums">
            <Mic className={`w-3 h-3 ${listened ? 'text-[#34B7F1]' : 'text-[#8696A0]'}`} />
            <span>{formatSeconds(isPlaying ? currentTime : duration || 0)}</span>
          </div>

          <button
            type="button"
            onClick={togglePlaybackRate}
            className="px-1.5 py-0.5 rounded bg-black/5 hover:bg-black/10 text-[9px] font-mono font-bold text-[#111B21] transition-colors cursor-pointer"
            title="Change playback speed"
          >
            {playbackRate}x
          </button>
        </div>
      </div>
    </div>
  );
};

