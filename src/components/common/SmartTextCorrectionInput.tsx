import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Check, X, ArrowRight, CheckCircle2, ShieldCheck, HelpCircle } from 'lucide-react';
import { evaluateTextCorrection, CorrectionSuggestion } from '../../utils/textCorrectionEngine';

export interface SmartTextCorrectionInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: 'text' | 'textarea';
  className?: string;
  rows?: number;
  id?: string;
  name?: string;
  disabled?: boolean;
  debounceMs?: number;
  fieldLabel?: string;
}

export const SmartTextCorrectionInput: React.FC<SmartTextCorrectionInputProps> = ({
  value,
  onChange,
  placeholder,
  required = false,
  type = 'text',
  className = '',
  rows = 3,
  id,
  name,
  disabled = false,
  debounceMs = 350,
  fieldLabel
}) => {
  const [suggestion, setSuggestion] = useState<CorrectionSuggestion | null>(null);
  const [ignoredText, setIgnoredText] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState<boolean>(false);
  const debounceTimerRef = useRef<any>(null);

  // Evaluate text correction locally whenever value changes
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (!value || !value.trim()) {
      setSuggestion(null);
      return;
    }

    // If tutor already explicitly ignored this exact text, do not nag them
    if (ignoredText === value.trim()) {
      return;
    }

    debounceTimerRef.current = setTimeout(() => {
      const res = evaluateTextCorrection(value);
      if (res.hasChanges && res.suggestedText.trim() !== value.trim()) {
        setSuggestion(res);
      } else {
        setSuggestion(null);
      }
    }, debounceMs);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [value, ignoredText, debounceMs]);

  const handleAccept = () => {
    if (suggestion) {
      onChange(suggestion.suggestedText);
      setSuggestion(null);
    }
  };

  const handleIgnore = () => {
    if (value) {
      setIgnoredText(value.trim());
    }
    setSuggestion(null);
  };

  return (
    <div className="w-full space-y-1 relative">
      {type === 'textarea' ? (
        <textarea
          id={id}
          name={name}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            // Reset ignored state if tutor types something new
            if (ignoredText && ignoredText !== e.target.value.trim()) {
              setIgnoredText(null);
            }
          }}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          rows={rows}
          className={`w-full rounded-lg border px-3 py-2 text-xs focus:ring-1 focus:ring-[#2D8B5C] focus:outline-none bg-white font-medium transition-all ${
            suggestion
              ? 'border-amber-400/90 ring-1 ring-amber-300/40'
              : 'border-[#D5D0C6] focus:border-[#2D8B5C]'
          } ${className}`}
        />
      ) : (
        <input
          type="text"
          id={id}
          name={name}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            if (ignoredText && ignoredText !== e.target.value.trim()) {
              setIgnoredText(null);
            }
          }}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          className={`w-full rounded-lg border px-3 py-2 text-xs focus:ring-1 focus:ring-[#2D8B5C] focus:outline-none bg-white font-medium transition-all ${
            suggestion
              ? 'border-amber-400/90 ring-1 ring-amber-300/40'
              : 'border-[#D5D0C6] focus:border-[#2D8B5C]'
          } ${className}`}
        />
      )}

      {/* COMPACT SMART CORRECTION SUGGESTION PILL / BANNER */}
      {suggestion && (
        <div
          className="p-2 sm:p-2.5 rounded-xl bg-amber-50/95 border border-amber-300/80 text-amber-950 flex flex-wrap items-center justify-between gap-2 shadow-xs animate-in fade-in slide-in-from-top-1 duration-150 text-xs"
          role="region"
          aria-label="Grammar and spelling suggestion"
        >
          <div className="flex items-start sm:items-center space-x-2 min-w-0 flex-1">
            <div className="p-1 rounded-md bg-amber-200/80 text-amber-800 shrink-0 mt-0.5 sm:mt-0">
              <Sparkles className="w-3.5 h-3.5 text-amber-700" />
            </div>
            <div className="min-w-0 flex-1 leading-snug">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 block sm:inline mr-1.5">
                Suggested Cleanup:
              </span>
              <span className="font-semibold text-[#161F1A] break-words bg-white/70 px-1.5 py-0.5 rounded border border-amber-200 font-mono text-[11px]">
                {suggestion.suggestedText}
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-1.5 shrink-0 self-end sm:self-center ml-auto">
            <button
              type="button"
              onClick={handleIgnore}
              className="px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900 hover:bg-amber-200/50 rounded-lg transition-colors cursor-pointer flex items-center space-x-1"
              title="Keep your original text"
            >
              <X className="w-3 h-3 text-slate-500" />
              <span>Ignore</span>
            </button>

            <button
              type="button"
              onClick={handleAccept}
              className="px-3 py-1 text-[11px] font-bold text-white bg-[#2D8B5C] hover:bg-[#1E5C3D] rounded-lg transition-all shadow-2xs cursor-pointer flex items-center space-x-1 active:scale-95"
              title="Replace with suggested correction"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Accept</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
