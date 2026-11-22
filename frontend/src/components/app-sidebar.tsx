import * as React from "react";
import {
  Receipt,
  Plug,
  Wallet,
} from "lucide-react";
import { useLocation } from "react-router-dom";

import { NavMain } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";

import { useAuth } from "@/contexts/AuthContext";
import { useGravatar } from "@/hooks/use-gravatar";

const navigationItems = [
  {
    label: "Workspace",
    items: [
      {
        title: "Receipts",
        url: "/",
        icon: Receipt,
      },
      {
        title: "Payments",
        url: "/payments",
        icon: Wallet,
      },
      {
        title: "Integrations",
        url: "/integrations",
        icon: Plug,
      },
    ],
  },
];

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user } = useAuth();
  const gravatarUrl = useGravatar(user?.email || "");
  const { pathname } = useLocation();

  const navigationData = navigationItems.map((group) => ({
    ...group,
    items: group.items.map((item) => ({
      ...item,
      isActive: item.url !== "#" && pathname === item.url,
    })),
  }));

  // Format the user object for the NavUser component
  const navUser = {
    name: user?.name || user?.email?.split("@")[0] || "User",
    email: user?.email || "",
    avatar: gravatarUrl,
  };

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <a href="/">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <Receipt className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">Splitta</span>
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain groups={navigationData} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={navUser} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
