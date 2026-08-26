import React, { useState, useEffect, useRef } from "react";
import Inko from "inko/index.js";

const inko = new Inko();

// Global pub/sub for typing language mode synchronization
const getTypingMode = (): "ko" | "en" => {
  return (localStorage.getItem("typing_language_mode") as "ko" | "en") || "ko";
};

const dispatchTypingMode = (mode: "ko" | "en") => {
  localStorage.setItem("typing_language_mode", mode);
  window.dispatchEvent(new CustomEvent("typingModeChanged", { detail: mode }));
};

export interface HangulInputProps {
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onValueChange?: (value: string) => void;
  className?: string;
  placeholder?: string;
  type?: string;
  lang?: string;
  autoCapitalize?: string;
  autoCorrect?: string;
  spellCheck?: boolean;
  [key: string]: any;
}

export function HangulInput({
  value,
  onChange,
  onKeyDown,
  onValueChange,
  className = "",
  ...props
}: HangulInputProps) {
  const [mode, setMode] = useState<"ko" | "en">(getTypingMode);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleSync = (e: Event) => {
      const customEvent = e as CustomEvent<"ko" | "en">;
      setMode(customEvent.detail);
    };
    window.addEventListener("typingModeChanged", handleSync);
    return () => window.removeEventListener("typingModeChanged", handleSync);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Detect Hangul mode toggling key
    if (e.key === "HangulMode" || e.keyCode === 21 || e.code === "Lang1") {
      const nextMode = mode === "ko" ? "en" : "ko";
      dispatchTypingMode(nextMode);
    }
    onKeyDown?.(e);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const target = e.target;
    const originalValue = target.value;
    const nativeEvent = e.nativeEvent as any;
    const inputType = nativeEvent?.inputType || "";

    // Convert only if mode matches Korean and we are inserting text manually
    const isInserting = !inputType || (inputType.startsWith("insert") && inputType !== "insertFromPaste");

    if (mode === "ko" && isInserting) {
      const convertedValue = inko.en2ko(originalValue);
      
      if (convertedValue !== originalValue) {
        const selectionStart = target.selectionStart;
        const selectionEnd = target.selectionEnd;

        // Custom propagation
        if (onValueChange) {
          onValueChange(convertedValue);
        } else if (onChange) {
          // Clone event to avoid synthetic event recycling issues
          const customEvent = Object.create(e);
          Object.defineProperty(customEvent, "target", {
            value: { ...target, value: convertedValue },
            writable: true,
          });
          onChange(customEvent);
        }

        // Restore cursor position
        requestAnimationFrame(() => {
          try {
            const diff = convertedValue.length - originalValue.length;
            const newStart = selectionStart !== null ? selectionStart + diff : convertedValue.length;
            const newEnd = selectionEnd !== null ? selectionEnd + diff : convertedValue.length;
            target.setSelectionRange(newStart, newEnd);
          } catch (err) {}
        });
        return;
      }
    }

    if (onValueChange) {
      onValueChange(originalValue);
    } else {
      onChange?.(e);
    }
  };

  return (
    <input
      ref={inputRef}
      value={value}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      className={className}
      {...props}
    />
  );
}

export interface HangulTextareaProps {
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onValueChange?: (value: string) => void;
  className?: string;
  placeholder?: string;
  rows?: number;
  lang?: string;
  autoCapitalize?: string;
  autoCorrect?: string;
  spellCheck?: boolean;
  [key: string]: any;
}

export function HangulTextarea({
  value,
  onChange,
  onKeyDown,
  onValueChange,
  className = "",
  ...props
}: HangulTextareaProps) {
  const [mode, setMode] = useState<"ko" | "en">(getTypingMode);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const handleSync = (e: Event) => {
      const customEvent = e as CustomEvent<"ko" | "en">;
      setMode(customEvent.detail);
    };
    window.addEventListener("typingModeChanged", handleSync);
    return () => window.removeEventListener("typingModeChanged", handleSync);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "HangulMode" || e.keyCode === 21 || e.code === "Lang1") {
      const nextMode = mode === "ko" ? "en" : "ko";
      dispatchTypingMode(nextMode);
    }
    onKeyDown?.(e);
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const target = e.target;
    const originalValue = target.value;
    const nativeEvent = e.nativeEvent as any;
    const inputType = nativeEvent?.inputType || "";

    const isInserting = !inputType || (inputType.startsWith("insert") && inputType !== "insertFromPaste");

    if (mode === "ko" && isInserting) {
      const convertedValue = inko.en2ko(originalValue);
      
      if (convertedValue !== originalValue) {
        const selectionStart = target.selectionStart;
        const selectionEnd = target.selectionEnd;

        if (onValueChange) {
          onValueChange(convertedValue);
        } else if (onChange) {
          const customEvent = Object.create(e);
          Object.defineProperty(customEvent, "target", {
            value: { ...target, value: convertedValue },
            writable: true,
          });
          onChange(customEvent);
        }

        requestAnimationFrame(() => {
          try {
            const diff = convertedValue.length - originalValue.length;
            const newStart = selectionStart !== null ? selectionStart + diff : convertedValue.length;
            const newEnd = selectionEnd !== null ? selectionEnd + diff : convertedValue.length;
            target.setSelectionRange(newStart, newEnd);
          } catch (err) {}
        });
        return;
      }
    }

    if (onValueChange) {
      onValueChange(originalValue);
    } else {
      onChange?.(e);
    }
  };

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      className={className}
      {...props}
    />
  );
}
