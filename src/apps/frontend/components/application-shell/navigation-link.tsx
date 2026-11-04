import { StyledNavLink, type SharedProps } from "baseui/side-navigation";
import type {
  FC,
  KeyboardEventHandler,
  MouseEventHandler,
  PropsWithChildren,
} from "react";
import { NavLink } from "react-router";

interface NavigationLinkProperties extends SharedProps, PropsWithChildren {
  $isFocusVisible: boolean;
  href: string;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
  onKeyDown?: KeyboardEventHandler<HTMLAnchorElement>;
  tabIndex?: number;
}

const NavigationLink: FC<NavigationLinkProperties> = ({
  href,
  ...properties
}) => (
  <StyledNavLink
    {...properties}
    $as={NavLink}
    to={href}
    end
    data-testid="navigation-link"
  />
);

export default NavigationLink;
