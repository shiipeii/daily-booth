export type Tab = "today" | "album";

export function Tabs({ current, onChange }: { current: Tab; onChange: (tab: Tab) => void }) {
  return (
    <nav className="tabs" aria-label="main">
      {(["today", "album"] as const).map((tab) => (
        <button
          key={tab}
          type="button"
          className="tabs__tab"
          aria-current={current === tab ? "page" : undefined}
          onClick={() => onChange(tab)}
        >
          {tab}
        </button>
      ))}
    </nav>
  );
}
