import { Credit } from "@/components/Credit";

/** The slim footer under every signed-in page: a hairline and the creator credit. */
export function SiteFooter() {
  return (
    <footer className="border-t border-rule">
      <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6">
        <Credit />
      </div>
    </footer>
  );
}
