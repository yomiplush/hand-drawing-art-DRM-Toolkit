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
      className={`relative rounded-xl border-2 border-dashed transition-colors p-6 text-center ${
        dragging
          ? 'border-cyan-400 bg-cyan-500/10'
          : 'border-slate-700 bg-slate-900/50 hover:border-cyan-500/50 hover:bg-slate-900/80'
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
        <div className="rounded-full bg-cyan-500/10 p-3 border border-cyan-500/20 text-cyan-300">
          <UploadCloud className="h-6 w-6" aria-hidden="true" />
        </div>
        <span className="text-sm sm:text-base font-medium text-slate-100">{title}</span>
        {subtitle && <span className="text-xs text-slate-400 max-w-md">{subtitle}</span>}
      </label>
    </div>
  );
}
