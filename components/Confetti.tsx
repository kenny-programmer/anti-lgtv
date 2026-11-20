import type { CSSProperties } from "react";

const COLORS = ["var(--ribbon)", "var(--leaf)", "var(--kraft)", "var(--cream)"];
const PIECES = 24;

/**
 * A one-shot burst of paper confetti, CSS only. Every offset comes from index
 * arithmetic (no randomness), so server and client render the same markup.
 * Decorative: hidden from assistive tech and from the pointer; each piece ends
 * at opacity 0 and stays there.
 */
export function Confetti() {
  return (
    <div aria-hidden="true" className="confetti">
      {Array.from({ length: PIECES }, (_, i) => {
        const style = {
          "--x": `${(((i * 47) % 23) - 11) * 14}px`,
          "--up": `${-(60 + ((i * 29) % 70))}px`,
          "--fall": `${150 + ((i * 31) % 120)}px`,
          "--r": `${((i * 67) % 360) - 180 + (i % 2 ? 360 : -360)}deg`,
          "--delay": `${(i % 5) * 25}ms`,
          background: COLORS[i % COLORS.length],
          outline: i % 4 === 3 ? "1px solid rgb(15 35 27 / 0.25)" : undefined,
        } as CSSProperties;
        return <span key={i} className="confetti-piece" style={style} />;
      })}
    </div>
  );
}
