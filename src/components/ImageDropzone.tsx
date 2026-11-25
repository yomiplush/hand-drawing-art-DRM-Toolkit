import { useId, useRef, useState } from 'react';
import { UploadCloud } from 'lucide-react';

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
      className={`relative rounded-2xl border-2 border-dashed transition-all p-6 sm:p-8 text-center ${
        dragging
          ? 'border-[var(--ga-accent)] bg-[var(--ga-accent-soft)] scale-[1.01]'
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
        onChange={(e) => {
          handleFiles(e.target.files);
          // Reset input so re-selecting the same file works cleanly
          e.target.value = '';
        }}
        className="sr-only"
      />
      <label
        htmlFor={inputId}
        className="flex flex-col items-center justify-center gap-2.5 cursor-pointer min-h-[124px]"
      >
        <div className="rounded-xl ga-card-solid p-3 text-[var(--ga-accent)]">
          <UploadCloud className="h-6 w-6" aria-hidden="true" />
        </div>
        <span className="text-sm sm:text-base font-semibold ga-text">{title}</span>
        {subtitle && <span className="text-xs sm:text-sm ga-text-muted max-w-md">{subtitle}</span>}
      </label>
    </div>
  );
}
