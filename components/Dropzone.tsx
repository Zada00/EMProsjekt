"use client";

import { useRef, useState } from "react";

/**
 * Dra-og-slipp for én ELLER FLERE PDF-er (tilstandsrapport og/eller salgsoppgave
 * for samme bolig). Viser valgte filer med mulighet for å fjerne enkeltvis.
 */
export function Dropzone({
    files,
    onChange,
    disabled,
}: {
    files: File[];
    onChange: (files: File[]) => void;
    disabled?: boolean;
}) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [drag, setDrag] = useState(false);

    function leggTil(liste: FileList | null) {
        if (!liste) return;
        const pdfer = Array.from(liste).filter((f) => f.type === "application/pdf");
        if (pdfer.length) onChange([...files, ...pdfer]);
    }
    function fjern(i: number) {
        onChange(files.filter((_, idx) => idx !== i));
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
                    if (!disabled) leggTil(e.dataTransfer.files);
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
                <div className="big">
                    {files.length === 0 ? "Slipp PDF-er her" : "Slipp flere PDF-er her"}
                </div>
                <div className="sub">
                    tilstandsrapport og/eller salgsoppgave — eller klikk for å velge
                </div>
                <input
                    ref={inputRef}
                    type="file"
                    accept="application/pdf"
                    multiple
                    onChange={(e) => {
                        leggTil(e.target.files);
                        e.target.value = ""; // så samme fil kan velges igjen etter fjerning
                    }}
                />
            </div>

            {files.map((f, i) => (
                <div className="filerow" key={i}>
                    <code>{f.name}</code> ({Math.round(f.size / 1024)} kB)
                    <button className="lenkeknapp" onClick={() => fjern(i)} disabled={disabled}>
                        fjern
                    </button>
                </div>
            ))}
        </div>
    );
}
