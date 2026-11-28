import { useId, useRef, useState } from 'react';
import { UploadCloud } from 'lucide-react';
import { useAppPreferences } from './useAppPreferences';

interface ImageDropzoneProps {
  onFileSelected: (file: File) => void;
  title: string;
  subtitle?: string;
  accept?: string;
  testId?: string;
  disabled?: boolean;
}

export function ImageDropzone({
  onFileSelected,
  title,
  subtitle,
  accept = 'image/png,image/jpeg,image/webp,image/*',
  testId,
  disabled = false,
}: ImageDropzoneProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const { reducedMotion } = useAppPreferences();

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0 || disabled) return;
    onFileSelected(files[0]);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        handleFiles(e.dataTransfer.files);
      }}
      className={`relative rounded-2xl border-2 border-dashed p-6 sm:p-8 text-center transition-all duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
        dragging
          ? `border-[var(--ga-accent)] bg-[var(--ga-accent-soft)] ${
              reducedMotion ? '' : 'scale-[1.02] chm-magnet-active'
            }`
          : 'ga-border-strong ga-surface-subtle hover:border-[var(--ga-accent)]'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <input
        id={inputId}
        ref={inputRef}
        type="file"
        accept={accept}
        disabled={disabled}
        data-testid={testId}
        onClick={(e) => {
          // Reset prior to picking so re-selecting the same image works cleanly without
          // clearing File references immediately after onChange in iOS/iPadOS Safari.
          e.currentTarget.value = '';
        }}
        onChange={(e) => {
          const inputEl = e.currentTarget;
          handleFiles(inputEl.files);
          window.setTimeout(() => {
            if (inputEl && document.contains(inputEl)) {
              inputEl.value = '';
            }
          }, 250);
        }}
        className="sr-only"
      />
      <label
        htmlFor={inputId}
        className="flex flex-col items-center justify-center gap-2.5 cursor-pointer min-h-[124px]"
      >
        <div
          className={`rounded-xl ga-card-solid p-3 text-[var(--ga-accent)] transition-transform duration-200 ${
            dragging && !reducedMotion ? 'scale-110' : ''
          }`}
        >
          <UploadCloud className="h-6 w-6" aria-hidden="true" />
        </div>
        <span className="text-sm sm:text-base font-semibold ga-text">{title}</span>
        {subtitle && <span className="text-xs sm:text-sm ga-text-muted max-w-md">{subtitle}</span>}
      </label>
    </div>
  );
}
