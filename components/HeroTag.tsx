import { HangingTag } from "@/components/HangingTag";
import { TagDemo } from "@/components/TagDemo";
import { Twine } from "@/components/Twine";

/**
 * The hero assembly: the vertical ribbon, the twine knot and the hanging tag
 * are all children of ONE centered box, each centered in it the same way
 * (`inset-x-0 mx-auto`), so the ribbon's centerline, the knot, the top of the
 * twine, the hole and the tag's center share one x at rest, at every width.
 * The twine is a simulated string pinned to the knot (see HangingTag).
 */
export function HeroTag() {
  return (
    <div className="relative mx-auto w-[17.5rem] sm:w-[19rem] lg:mt-6 lg:w-[20rem]">
      <div
        aria-hidden="true"
        className="ribbon-band unroll-y inset-x-0 top-0 -bottom-[40rem] mx-auto w-12 lg:-top-[40rem] lg:w-16"
        data-axis="y"
      />
      <div className="hero-drift tag-appear relative">
        <HangingTag stringLength={110} tagDrop={150} entrance>
          <TagDemo />
        </HangingTag>
        <Twine className="absolute inset-x-0 top-[-0.4rem] z-10 mx-auto hidden w-[5.5rem] lg:block" />
      </div>
    </div>
  );
}
