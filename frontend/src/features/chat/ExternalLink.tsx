import type { AnchorHTMLAttributes } from "react";
import { openExternal } from "@/store/actions";

// Streamdown passes the mdast node along with the anchor attributes; it is not
// a DOM attribute, so it is taken apart instead of being spread on the element.
export type ExternalLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & { node?: unknown };

/**
 * ExternalLink opens a link in the browser. Nothing ever navigates inside the
 * webview: the app is the only thing that lives there.
 */
export function ExternalLink({ node: _node, href, children, ...props }: ExternalLinkProps) {
  return (
    <a
      {...props}
      href={href ?? "#"}
      onClick={(event) => {
        event.preventDefault();
        if (href !== undefined && href !== "") {
          void openExternal(href);
        }
      }}
    >
      {children}
    </a>
  );
}
