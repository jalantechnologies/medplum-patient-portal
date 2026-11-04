import { Block } from "baseui/block";
import { StyledDivider } from "baseui/divider";
import { ANCHOR, Drawer, SIZE } from "baseui/drawer";
import { Navigation, type Item } from "baseui/side-navigation";
import type { FC, PropsWithChildren } from "react";
import { useLocation } from "react-router";

import AccountSummary from "./account-summary";
import useNavigationDrawer from "./navigation-drawer.hook";
import NavigationLink from "./navigation-link";
import TopBar from "./top-bar";

interface ApplicationShellProperties {
  brand: string;
  navigationItems: Item[];
  patientName: string;
  isSignOutLoading: boolean;
  onSignOut: () => void;
}

const ApplicationShell: FC<PropsWithChildren<ApplicationShellProperties>> = ({
  brand,
  children,
  isSignOutLoading,
  navigationItems,
  onSignOut,
  patientName,
}) => {
  const location = useLocation();
  const { closeNavigation, isNavigationOpen, openNavigation } =
    useNavigationDrawer();

  const sidebarContent = (
    <>
      <Navigation
        items={navigationItems}
        activeItemId={location.pathname}
        overrides={{
          NavLink: NavigationLink,
          Root: { props: { "data-testid": "sidebar-navigation" } },
        }}
      />
      <AccountSummary
        patientName={patientName}
        isSignOutLoading={isSignOutLoading}
        onSignOut={onSignOut}
      />
    </>
  );

  return (
    <Block display="flex" flexDirection="column" minHeight="100vh">
      <TopBar
        brand={brand}
        isNavigationOpen={isNavigationOpen}
        onOpenNavigation={openNavigation}
      />
      <Block as={StyledDivider} margin="0" />
      <Block display="flex" flex="1">
        <Block
          as="aside"
          display={["none", "none", "none", "flex"]}
          flexDirection="column"
          width="15rem"
          paddingTop="scale800"
          paddingBottom="scale800"
          data-testid="sidebar"
        >
          {sidebarContent}
        </Block>
        <Block
          as="main"
          flex="1"
          minWidth="0"
          maxWidth="90rem"
          paddingTop="scale800"
          paddingBottom="scale800"
          paddingLeft={["scale600", "scale600", "scale900"]}
          paddingRight={["scale600", "scale600", "scale900"]}
        >
          {children}
        </Block>
      </Block>
      <Drawer
        isOpen={isNavigationOpen}
        onClose={closeNavigation}
        anchor={ANCHOR.left}
        size={SIZE.auto}
        overrides={{
          DrawerContainer: {
            props: {
              role: "dialog",
              "aria-modal": true,
              "aria-label": "Navigation",
              "data-testid": "navigation-drawer",
            },
          },
        }}
      >
        {sidebarContent}
      </Drawer>
    </Block>
  );
};

export default ApplicationShell;
