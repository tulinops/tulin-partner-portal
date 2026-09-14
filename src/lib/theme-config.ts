// Layout/theme configuration for the admin dashboard shell. Only
// `layout.sideNavCollapse` and `controlSize` currently have a runtime
// consumer (SidebarProvider's default state, and the shell components'
// own Button/icon sizing) — `mode`, `direction`, `panelExpand`, and
// `themeSchema` are real fields with no wiring yet (no dark-mode toggle,
// no RTL support, no panel-expand control exist in this pass), kept here
// so the shape doesn't need to change when those are built.
export type ThemeConfig = {
  themeSchema: string;
  direction: "ltr" | "rtl";
  mode: "light" | "dark";
  panelExpand: boolean;
  controlSize: "sm" | "md" | "lg";
  layout: {
    type: "insetShell";
    sideNavCollapse: boolean;
  };
};

export const themeConfig: ThemeConfig = {
  themeSchema: "",
  direction: "ltr",
  mode: "light",
  panelExpand: false,
  controlSize: "md",
  layout: {
    type: "insetShell",
    sideNavCollapse: false,
  },
};

export const controlSizeToButtonSize: Record<ThemeConfig["controlSize"], "sm" | "default" | "lg"> = {
  sm: "sm",
  md: "default",
  lg: "lg",
};
