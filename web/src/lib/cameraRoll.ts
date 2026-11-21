// "save to camera roll". browsers can't write to the photo library directly,
// so we open the share sheet (which has "save image" on iphone and android)
// and fall back to a normal download on desktop.
//
// call this straight from a tap handler, before any `await`, or ios will
// refuse to open the share sheet.

export function saveToCameraRoll(files: File[]): Promise<void> {
  if (files.length === 0) return Promise.resolve();
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files })) {
    return nav.share({ files }).catch((err: Error) => {
      if (err.name !== "AbortError") download(files);
    });
  }
  download(files);
  return Promise.resolve();
}

export function download(files: File[]) {
  for (const file of files) {
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
}
