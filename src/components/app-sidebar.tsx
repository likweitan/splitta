import * as React from "react";
import {
  Clock,
  Download,
  LayoutDashboard,
  PieChart,
  Receipt,
  Settings,
  Wallet,
  Webhook,
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

// Defined Sections:
// Section 1: The Core (Activity)
// Section 2: Personalization (The "Wallet")
// Section 3: Analytics & Tools
const navigationItems = [
  {
    label: "The Core",
    items: [
      {
        title: "Overview",
        url: "/dashboard",
        icon: LayoutDashboard,
      },
      {
        title: "Pending Payments",
        url: "#",
        icon: Clock,
      },
    ],
  },
  {
    label: "Personalization",
    items: [
      {
        title: "Bank Details",
        url: "/payment-details",
        icon: Wallet,
      },
      {
        title: "Webhooks",
        url: "/webhooks",
        icon: Webhook,
      },
    ],
  },
  {
    label: "Analytics & Tools",
    items: [
      {
        title: "Spending Insights",
        url: "#",
        icon: PieChart,
      },
      {
        title: "Export Data",
        url: "#",
        icon: Download,
      },
      {
        title: "Settings",
        url: "#",
        icon: Settings,
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
    name:
      user?.user_metadata?.full_name || user?.email?.split("@")[0] || "User",
    email: user?.email || "",
    avatar: gravatarUrl,
  };

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <a href="/dashboard">
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
