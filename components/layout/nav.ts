import {
  LayoutDashboard,
  Users,
  GraduationCap,
  BookOpen,
  Library,
  Calendar,
  ScanFace,
  MapPin,
  FileBarChart,
  Settings,
  Activity,
  AlertTriangle,
  Lightbulb,
  Bell,
  User,
  Radio,
  ClipboardCheck,
  LineChart,
} from "lucide-react";

export type UserRole = "ADMIN" | "TEACHER" | "STUDENT";

export interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
}
export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const PORTAL_NAME: Record<UserRole, string> = {
  ADMIN: "Administration",
  TEACHER: "Faculty Portal",
  STUDENT: "Student Portal",
};

/** Sidebar navigation per role. Routes are unchanged; only the grouping is presentational. */
export const NAV: Record<UserRole, NavGroup[]> = {
  ADMIN: [
    { label: "Overview", items: [{ name: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard }] },
    {
      label: "Academic",
      items: [
        { name: "Students", href: "/admin/students", icon: Users },
        { name: "Teachers", href: "/admin/teachers", icon: GraduationCap },
        { name: "Classes / Divisions", href: "/admin/classes", icon: Library },
        { name: "Subjects", href: "/admin/subjects", icon: BookOpen },
        { name: "Academic Years", href: "/admin/academic-years", icon: Calendar },
      ],
    },
    {
      label: "Attendance",
      items: [
        { name: "Face Enrollment", href: "/admin/face-enrollment", icon: ScanFace },
        { name: "Campus Settings", href: "/admin/campus-settings", icon: MapPin },
      ],
    },
    { label: "Reports", items: [{ name: "Reports & Analytics", href: "/admin/reports", icon: FileBarChart }] },
    {
      label: "System",
      items: [
        { name: "Notifications", href: "/admin/notifications", icon: Bell },
        { name: "Settings", href: "/admin/settings", icon: Settings },
      ],
    },
  ],
  TEACHER: [
    { label: "Overview", items: [{ name: "Dashboard", href: "/teacher/dashboard", icon: LayoutDashboard }] },
    {
      label: "Attendance",
      items: [
        { name: "Live Attendance", href: "/teacher/live-attendance", icon: Radio },
        { name: "Attendance", href: "/teacher/attendance", icon: ClipboardCheck },
      ],
    },
    {
      label: "Academic",
      items: [
        { name: "Classes", href: "/teacher/classes", icon: Library },
        { name: "Students", href: "/teacher/students", icon: Users },
      ],
    },
    {
      label: "Academic Intelligence",
      items: [
        { name: "Engagement", href: "/teacher/engagement", icon: Activity },
        { name: "Risk Analysis", href: "/teacher/risk-analysis", icon: AlertTriangle },
        { name: "Recommendations", href: "/teacher/recommendations", icon: Lightbulb },
      ],
    },
    { label: "Reports", items: [{ name: "Reports", href: "/teacher/reports", icon: FileBarChart }] },
    {
      label: "Account",
      items: [
        { name: "Notifications", href: "/teacher/notifications", icon: Bell },
        { name: "Profile", href: "/teacher/profile", icon: User },
      ],
    },
  ],
  STUDENT: [
    { label: "Overview", items: [{ name: "Dashboard", href: "/student/dashboard", icon: LayoutDashboard }] },
    {
      label: "Attendance",
      items: [
        { name: "Live Attendance", href: "/student/live-attendance", icon: Radio },
        { name: "My Attendance", href: "/student/attendance", icon: ClipboardCheck },
        { name: "Face Enrollment", href: "/student/face-enrollment", icon: ScanFace },
      ],
    },
    {
      label: "Academic",
      items: [
        { name: "Engagement", href: "/student/engagement", icon: Activity },
        { name: "Performance", href: "/student/performance", icon: LineChart },
        { name: "Recommendations", href: "/student/recommendations", icon: Lightbulb },
      ],
    },
    {
      label: "Account",
      items: [
        { name: "Notifications", href: "/student/notifications", icon: Bell },
        { name: "Profile", href: "/student/profile", icon: User },
      ],
    },
  ],
};

export const isActivePath = (pathname: string, href: string) => pathname === href || pathname.startsWith(href + "/");

export const findNavItem = (role: UserRole | null | undefined, pathname: string) =>
  role ? NAV[role].flatMap((g) => g.items).find((i) => isActivePath(pathname, i.href)) : undefined;
