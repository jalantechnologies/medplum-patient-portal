import { forwardRef, type AnchorHTMLAttributes } from "react";
import { Link } from "react-router";

interface RouterLinkProperties extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
}

const RouterLink = forwardRef<HTMLAnchorElement, RouterLinkProperties>(
  ({ href, ...properties }, reference) => (
    <Link {...properties} ref={reference} to={href} />
  ),
);

RouterLink.displayName = "RouterLink";

export default RouterLink;
