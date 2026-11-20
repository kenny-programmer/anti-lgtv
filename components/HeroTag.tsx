import { GiftTag } from "@/components/GiftTag";
import { Twine } from "@/components/Twine";
import { monoLabel } from "@/components/ui";

/**
 * The hero assembly: the vertical ribbon, the twine knot and the hanging tag
 * are all children of ONE centered box, each centered in it the same way
 * (`inset-x-0 mx-auto`), so the ribbon's centerline, the knot, the twine, the
 * hole and the tag's center share one x at every width. The tag hangs straight
 * (0deg) at rest.
 */
export function HeroTag() {
  return (
    <div className="relative mx-auto w-[17.5rem] sm:w-[19rem] lg:mt-6 lg:w-[20rem]">
      <div
        aria-hidden="true"
        className="ribbon-band inset-x-0 top-0 -bottom-[40rem] mx-auto w-12 lg:-top-[40rem] lg:w-16"
        data-axis="y"
      />
      <Twine className="absolute inset-x-0 top-[-0.4rem] z-10 mx-auto hidden w-[5.5rem] lg:block" />
      <GiftTag
        stringLength={110}
        className="[--tag-tilt:0deg]"
        bodyClassName="lg:pb-8 lg:pt-[5.5rem]"
        footer={
          <div className="flex items-baseline justify-between gap-3">
            <span className={monoLabel}>From:</span>
            <span className="font-serif text-2xl italic">Secret Santa</span>
          </div>
        }
      >
        <div className="mt-3 flex h-16 items-end bg-ink px-3 pb-2.5">
          <span className={`${monoLabel} text-paper`}>Hidden until the draw</span>
        </div>
        <p className="mt-6 max-w-[16rem] text-sm leading-snug lg:mb-10">
          One name per tag. You only ever open your own.
        </p>
      </GiftTag>
    </div>
  );
}
