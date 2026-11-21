// tiny stroke icons. decorative: always pair with an aria-label on the button.

const paths = {
  close: "M6 6l12 12M18 6L6 18",
  back: "M15 5l-7 7 7 7",
  forward: "M9 5l7 7-7 7",
  flip: "M20 11a8 8 0 0 0-14.9-3M4 13a8 8 0 0 0 14.9 3M5 4v4h4M19 20v-4h-4",
  download: "M12 4v11M7 10l5 5 5-5M5 20h14",
  settings: "M4 7h10M18 7h2M4 17h2M10 17h10M14 5v4M8 15v4",
  image: "M4 5h16v14H4zM4 15l5-5 4 4 3-3 4 4",
};

export type IconName = keyof typeof paths;

export function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
