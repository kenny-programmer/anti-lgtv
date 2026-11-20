import { monoLabel } from "@/components/ui";

/**
 * The signature object: a die-cut kraft luggage tag with a punched hole and a
 * loop of baker's twine. The hole is masked out, so whatever is behind the tag
 * shows through it. Purely presentational.
 */
export function GiftTag({
  label = "To:",
  children,
  footer,
  stringLength = 56,
  className = "",
  bodyClassName = "",
}: {
  label?: string | null;
  children: React.ReactNode;
  footer?: React.ReactNode;
  stringLength?: number;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <div className={`gift-tag ${className}`} style={{ paddingTop: stringLength }}>
      <div className="relative">
        <div className={`gift-tag-body px-6 pb-6 pt-[4.25rem] ${bodyClassName}`}>
          <span aria-hidden="true" className="gift-tag-ring" />
          {label ? <p className={monoLabel}>{label}</p> : null}
          <div className={label ? "mt-2" : undefined}>{children}</div>
          {footer ? <div className="mt-5 border-t border-ink/40 pt-3">{footer}</div> : null}
        </div>
        {stringLength > 0 ? (
          <svg
            aria-hidden="true"
            className="gift-tag-string"
            height={stringLength + 30}
            viewBox={`0 0 18 ${stringLength + 30}`}
          >
            <path
              d={`M5 ${stringLength + 30} L9 0 L13 ${stringLength + 30}`}
              fill="none"
              stroke="var(--twine)"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <path
              d={`M5 ${stringLength + 30} L9 0 L13 ${stringLength + 30}`}
              fill="none"
              stroke="var(--ribbon)"
              strokeWidth="2"
              strokeDasharray="3 3"
              strokeLinejoin="round"
            />
          </svg>
        ) : null}
      </div>
    </div>
  );
}
