import styled from "@emotion/styled";
import { Button, Dropdown, Layout, Menu, Typography } from "antd";
import { DownOutlined, LogoutOutlined, UserOutlined } from "@ant-design/icons";
import Link from "next/link";
import { useRouter } from "next/router";

import { canAccess } from "@/shared/lib/access";

const { Header, Content, Footer } = Layout;

const link = (key, href, label) => ({
  key,
  href,
  label: <Link href={href}>{label}</Link>,
});

// Grouped by what people do. Pages a user cannot open are left out, so
// teachers see Checklists, Timetables and Calendar, and Reviews only when
// they coordinate other teachers.
const items = [
  {
    key: "checklists-menu",
    label: "Checklists",
    children: [
      link("my-checklists", "/my-checklists", "My checklists"),
      {
        ...link("reviews", "/reviews", "Reviews"),
        // Only coordinators have teachers' checklists to review.
        visibleWhen: (user) => user.isAdmin || user.isCoordinator,
      },
      link("checklists", "/checklists", "Manage checklists"),
      link("checklist-progress", "/checklist-progress", "Progress"),
    ],
  },
  {
    key: "timetables",
    label: "Timetables",
    children: [
      link("class-timetable", "/class-timetable", "Class timetable"),
      link("students-timetable", "/students-timetable", "Students timetable"),
      link("teachers-timetable", "/teachers-timetable", "Teachers timetable"),
      { type: "divider", adminOnly: true },
      link("create-timetable", "/create-timetable", "Create timetable"),
      link("cta", "/cta", "Timetable entries"),
    ],
  },
  link("calendar", "/calendar", "Calendar"),
  {
    key: "setup",
    label: "Setup",
    children: [
      link("school", "/school", "School"),
      link("teachers", "/teachers", "Teachers"),
      link("subjects", "/subjects", "Subjects"),
      link("classes", "/classes", "Classes"),
      link("periods", "/periods", "Periods"),
      link("csta", "/csta", "Teaching assignments"),
      link("users", "/users", "Users"),
    ],
  },
];

// Keeps only the pages the user can open, dropping groups left empty.
const filterItems = (menuItems, currentUser) =>
  menuItems
    .map(({ href, children, adminOnly, visibleWhen, ...item }) => {
      if (item.type === "divider") {
        return !adminOnly || currentUser.isAdmin ? item : null;
      }
      if (children) {
        const visible = filterItems(children, currentUser);
        return visible.length > 0 ? { ...item, children: visible } : null;
      }
      const isVisible = !visibleWhen || visibleWhen(currentUser);
      return isVisible && canAccess(href, currentUser) ? item : null;
    })
    .filter(Boolean);

function UserMenu({ currentUser, onSignOut }) {
  const displayName = currentUser.displayName || "Account";
  const role = currentUser.isAdmin ? "Admin" : "Teacher";
  const details = [currentUser.username, currentUser.email]
    .filter((value) => value && value !== displayName)
    .join(" · ");

  return (
    <Dropdown
      trigger={["click"]}
      menu={{
        items: [
          {
            key: "user",
            disabled: true,
            label: (
              <>
                <Typography.Text strong>{displayName}</Typography.Text>
                <br />
                <Typography.Text type="secondary">
                  {details ? `${role} · ${details}` : role}
                </Typography.Text>
              </>
            ),
          },
          { type: "divider" },
          {
            key: "sign-out",
            icon: <LogoutOutlined />,
            label: "Sign out",
            onClick: onSignOut,
          },
        ],
      }}
    >
      <Button type="text" style={{ color: "white" }}>
        <UserOutlined />
        {displayName}
        <DownOutlined />
      </Button>
    </Dropdown>
  );
}

const AppLayout = ({ children, onSignOut, currentUser = {} }) => {
  const router = useRouter();
  return (
    <Layout className="" style={{ minHeight: "100vh" }}>
      <Header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "2rem",
          padding: "2rem",
        }}
      >
        <Title level={4} style={{ margin: 0 }}>
          SchoolDay
        </Title>
        <Menu
          theme="dark"
          mode="horizontal"
          selectedKeys={[router?.pathname?.split("/")[1]]}
          items={filterItems(items, currentUser)}
          style={{
            flex: 1,
            minWidth: 0,
          }}
        />
        {onSignOut && (
          <UserMenu currentUser={currentUser} onSignOut={onSignOut} />
        )}
      </Header>
      <Content>{children}</Content>
      <Footer
        style={{
          textAlign: "center",
        }}
      >
        SchoolDay ©{new Date().getFullYear()} Created by Fiftytwodays
      </Footer>
    </Layout>
  );
};

export default AppLayout;

const Title = styled.span`
  color: white;
  font-weight: 600;
  font-size: 18px;
  display: inline-block;
  border-radius: 0.4rem;
  margin-right: 1rem;
`;
