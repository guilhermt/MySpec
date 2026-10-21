import { Children, type ReactNode } from "react";

export interface ImageStripProps {
  children: ReactNode;
  /** label names the list of images. */
  label: string;
}

/** ImageStrip lays thumbnails out in a wrapping row, one list item each. */
export function ImageStrip({ children, label }: ImageStripProps) {
  return (
    <ul aria-label={label} className="flex flex-wrap gap-(--space-2)">
      {Children.map(children, (child) => (
        <li>{child}</li>
      ))}
    </ul>
  );
}
