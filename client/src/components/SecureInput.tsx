import { useRef, useEffect, useCallback } from "react";

/**
 * SecureInput - A password-like input that Chrome's password manager CANNOT detect.
 * Uses a contenteditable div instead of <input>, so Chrome never triggers
 * its "password found in data breach" popup.
 * 
 * The text is displayed as dots (●) visually but the actual value is tracked in state.
 */
interface SecureInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  onKeyDown?: (e: React.KeyboardEvent) => void;
}

export default function SecureInput({ value, onChange, placeholder, className, autoFocus, onKeyDown }: SecureInputProps) {
  const divRef = useRef<HTMLDivElement>(null);
  const valueRef = useRef(value);
  const composingRef = useRef(false);

  // Keep ref in sync
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  // Auto focus
  useEffect(() => {
    if (autoFocus && divRef.current) {
      setTimeout(() => divRef.current?.focus(), 50);
    }
  }, [autoFocus]);

  // Update display dots
  useEffect(() => {
    if (divRef.current && document.activeElement !== divRef.current) {
      divRef.current.textContent = "●".repeat(value.length);
    }
  }, [value]);

  const handleInput = useCallback((e: React.FormEvent<HTMLDivElement>) => {
    if (composingRef.current) return;
    
    const el = e.currentTarget;
    const displayedText = el.textContent || "";
    
    // Count how many dots vs new characters
    const dots = (displayedText.match(/●/g) || []).length;
    const newChars = displayedText.replace(/●/g, "");
    
    // Figure out what the new value should be
    // If dots < current value length, some chars were deleted
    const currentVal = valueRef.current;
    
    if (displayedText === "") {
      // All cleared
      onChange("");
      return;
    }
    
    if (newChars.length > 0) {
      // Characters were added - figure out where
      // Simple approach: keep the dots portion of old value + append new chars
      const keptLength = dots;
      const newValue = currentVal.substring(0, keptLength) + newChars;
      onChange(newValue);
      // Update display to all dots
      setTimeout(() => {
        if (el) {
          el.textContent = "●".repeat(newValue.length);
          // Move cursor to end
          const range = document.createRange();
          const sel = window.getSelection();
          if (el.childNodes.length > 0) {
            range.setStartAfter(el.childNodes[el.childNodes.length - 1]);
          } else {
            range.setStart(el, 0);
          }
          range.collapse(true);
          sel?.removeAllRanges();
          sel?.addRange(range);
        }
      }, 0);
    } else {
      // Only dots remain - some were deleted
      const newValue = currentVal.substring(0, dots);
      onChange(newValue);
    }
  }, [onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    // Handle backspace when there's content
    if (e.key === "Backspace") {
      e.preventDefault();
      const currentVal = valueRef.current;
      if (currentVal.length > 0) {
        const newVal = currentVal.slice(0, -1);
        onChange(newVal);
        if (divRef.current) {
          divRef.current.textContent = "●".repeat(newVal.length);
          // Move cursor to end
          const range = document.createRange();
          const sel = window.getSelection();
          if (divRef.current.childNodes.length > 0) {
            range.setStartAfter(divRef.current.childNodes[divRef.current.childNodes.length - 1]);
          } else {
            range.setStart(divRef.current, 0);
          }
          range.collapse(true);
          sel?.removeAllRanges();
          sel?.addRange(range);
        }
      }
      return;
    }
    
    // Handle regular character input
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      const newVal = valueRef.current + e.key;
      onChange(newVal);
      if (divRef.current) {
        divRef.current.textContent = "●".repeat(newVal.length);
        // Move cursor to end
        const range = document.createRange();
        const sel = window.getSelection();
        if (divRef.current.childNodes.length > 0) {
          range.setStartAfter(divRef.current.childNodes[divRef.current.childNodes.length - 1]);
        } else {
          range.setStart(divRef.current, 0);
        }
        range.collapse(true);
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
      return;
    }

    // Pass through other keys (Enter, etc)
    if (onKeyDown) {
      onKeyDown(e);
    }
  }, [onChange, onKeyDown]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData("text");
    if (pastedText) {
      const newVal = valueRef.current + pastedText;
      onChange(newVal);
      if (divRef.current) {
        divRef.current.textContent = "●".repeat(newVal.length);
      }
    }
  }, [onChange]);

  return (
    <div className="relative">
      <div
        ref={divRef}
        contentEditable
        suppressContentEditableWarning
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onCompositionStart={() => { composingRef.current = true; }}
        onCompositionEnd={(e) => {
          composingRef.current = false;
          handleInput(e as any);
        }}
        data-placeholder={placeholder}
        className={`${className || ""} secure-input-field`}
        style={{ minHeight: "1.5em", outline: "none", cursor: "text" }}
      />
      {value.length === 0 && (
        <div className="absolute inset-0 flex items-center pointer-events-none px-4 text-slate-400 text-sm">
          {placeholder}
        </div>
      )}
    </div>
  );
}
