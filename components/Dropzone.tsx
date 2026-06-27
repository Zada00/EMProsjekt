"use client";

import { useRef, useState } from "react";

/**
 * Dra-og-slipp eller klikk for å velge én PDF.
 * Frontend (Utvikler 2) eier denne. Holder seg bevisst enkel.
 */
export function Dropzone({
  file,
  onPick,
  disabled,
}: {
  file: File | null;
  onPick: (file: File | null) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  function handleFiles(files: FileList | null) {
    const f = files?.[0] ?? null;
    if (f && f.type !== "application/pdf") {
      onPick(null);
      return;
    }
    onPick(f);
  }

  return (
    <div>
      <div
        className={`dropzone${drag ? " drag" : ""}`}
        onClick={() => !disabled && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          if (!disabled) handleFiles(e.dataTransfer.files);
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !disabled) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
      >
        <div className="big">Slipp en tilstandsrapport her</div>
        <div className="sub">eller klikk for å velge en PDF</div>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {file && (
        <div className="filerow">
          Valgt: <code>{file.name}</code> ({Math.round(file.size / 1024)} kB)
        </div>
      )}
    </div>
  );
}
