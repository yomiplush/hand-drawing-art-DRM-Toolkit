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
      className={`relative rounded-xl border border-dashed transition-colors p-6 text-center ${
        dragging
          ? 'border-sky-300/70 bg-sky-400/10'
          : 'border-white/[0.16] bg-[#030b18]/55 hover:border-white/[0.3] hover:bg-[#041122]/75'
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
        className="flex flex-col items-center justify-center gap-2 cursor-pointer min-h-[110px]"
      >
        <div className="rounded-lg bg-white/[0.06] p-2.5 border border-white/[0.1] text-sky-200">
          <UploadCloud className="h-5 w-5" aria-hidden="true" />
        </div>
        <span className="text-sm sm:text-base font-medium text-slate-100">{title}</span>
        {subtitle && <span className="text-xs text-slate-400 max-w-md">{subtitle}</span>}
      </label>
    </div>
  );
}
