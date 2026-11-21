import type { ReactNode } from "react";

/** one photo area inside a print. shows an image, or whatever children you pass. */
export function PrintPhoto({ src, label, children }: { src?: string; label?: string; children?: ReactNode }) {
  return (
    <div className="print__photo">
      {src ? <img src={src} alt="" /> : <div className="grain" />}
      {children}
      {label && <span className="print__label">{label}</span>}
    </div>
  );
}

/** paper border around one or more photos, with the date in the bottom margin */
export function Print({
  date,
  className = "",
  children,
}: {
  date?: string | null;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`print ${className}`}>
      {children}
      <p className="print__date">{date ?? ""}</p>
    </div>
  );
}

/** an already-printed image (border + date baked in by film.ts) */
export function PrintImage({ src, alt, className = "" }: { src: string; alt: string; className?: string }) {
  return <img className={className} src={src} alt={alt} style={{ display: "block", width: "100%", boxShadow: "var(--shadow-print)" }} />;
}
