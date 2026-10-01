import type { ReactNode } from "react";
import { Link } from "@/components/system/Link";
import { openExternal } from "@/store/actions";

export interface ExternalLinkProps {
  url: string;
  children: ReactNode;
}

/** ExternalLink is a link that opens in the browser, since nothing navigates inside the webview. */
export function ExternalLink({ url, children }: ExternalLinkProps) {
  return (
    <Link
      href={url}
      external
      onClick={(event) => {
        event.preventDefault();
        void openExternal(url);
      }}
    >
      {children}
    </Link>
  );
}
