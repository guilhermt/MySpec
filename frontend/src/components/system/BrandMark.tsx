import art from "@/assets/brand-art.png";
import robot from "@/assets/brand-robot.png";
import { cn } from "@/lib/utils";

export interface BrandMarkProps {
  size: "sm" | "lg";
}

const MARKS = {
  sm: { src: robot, className: "size-(--size-mark) rounded-sm" },
  lg: { src: art, className: "size-(--size-mark-lg) rounded-xl" },
} as const;

/** BrandMark is the product's mark: the small robot of the sidebar and the whole art of the first screens. */
export function BrandMark({ size }: BrandMarkProps) {
  const { src, className } = MARKS[size];
  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      draggable={false}
      data-size={size}
      className={cn("block shrink-0", className)}
    />
  );
}
