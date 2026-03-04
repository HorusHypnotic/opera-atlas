import {
  LayoutDashboard, Users, Package, Wrench, ShieldAlert, TrendingUp, ShieldCheck,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, useSidebar,
} from "@/components/ui/sidebar";

const sections = [
  { title: "Visão Geral", url: "/", icon: LayoutDashboard },
  { title: "Organização", url: "/organizacao", icon: Users, letter: "O" },
  { title: "Padronização", url: "/padronizacao", icon: Package, letter: "P" },
  { title: "Eficiência", url: "/eficiencia", icon: Wrench, letter: "E" },
  { title: "Redução de Perdas", url: "/reducao-perdas", icon: ShieldAlert, letter: "R" },
  { title: "Análise Contínua", url: "/analise-continua", icon: TrendingUp, letter: "A" },
  { title: "Segurança & Qualidade", url: "/seguranca-qualidade", icon: ShieldCheck },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4 border-b border-border">
        {!collapsed ? (
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center font-bold text-primary-foreground text-sm">
              OP
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight">Método O.P.E.R.A.</h1>
              <p className="text-[10px] text-muted-foreground">Gestão Inteligente de Obras</p>
            </div>
          </div>
        ) : (
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center font-bold text-primary-foreground text-sm mx-auto">
            OP
          </div>
        )}
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navegação</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {sections.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="hover:bg-sidebar-accent/50"
                      activeClassName="bg-sidebar-accent text-primary font-medium"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && (
                        <span className="flex items-center gap-2">
                          {item.letter && (
                            <span className="w-5 h-5 rounded bg-primary/20 text-primary text-[10px] font-bold flex items-center justify-center">
                              {item.letter}
                            </span>
                          )}
                          {item.title}
                        </span>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
