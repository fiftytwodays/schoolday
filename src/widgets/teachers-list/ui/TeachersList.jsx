import { useState } from "react";
import { Alert, Button, Dropdown, Modal, Space, Spin, Tag, message } from "antd";
import { DownOutlined, UserAddOutlined } from "@ant-design/icons";
import useSWR, { mutate } from "swr";

import {
  DeleteDescription,
  useDeleteHistoryChoice,
} from "@/entities/checklist-submission";
import { getAllSubmissions } from "@/entities/checklist-submission/api/get-submissions";
import { TeachersList as _TeachersList } from "@/entities/teacher";
import { getAllTeachers } from "@/entities/teacher/api/get-teachers";
import {
  createTeacher,
  updateTeacher,
  deleteTeacher,
} from "@/entities/teacher/api/mutate-teacher";
import { getFormFields } from "@/entities/teacher/config/form-fields";
import { getAllUsers } from "@/entities/user/api/get-users";
import {
  createUser,
  updateUser,
  deleteUser,
} from "@/entities/user/api/mutate-user";
import { RoleTag, StatusTag } from "@/entities/user/config/columns";
import { teacherLoginFormFields } from "@/entities/user/config/form-fields";
import { useManageEntity } from "@/features/manage-entity";
import {
  confirmResetPassword,
  showTemporaryPassword,
} from "@/features/manage-login";
import useCurrentUser from "@/shared/lib/use-current-user";

const confirmRemoveAccess = (user, teacher) =>
  Modal.confirm({
    title: `Remove login access for ${teacher.name}?`,
    content: `The login "${user.username}" is deleted. The teacher, their timetable and checklists are kept.`,
    okText: "Remove access",
    okButtonProps: { danger: true },
    onOk: async () => {
      try {
        await deleteUser(user.id, user);
        message.success("Login access removed!");
        mutate(() => true);
      } catch (error) {
        message.error(error.message);
      }
    },
  });

function TeachersList() {
  const [pageNo, setPageNo] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const currentUser = useCurrentUser();
  const { data: users, error: usersError } = useSWR(
    ["/api/users"],
    getAllUsers
  );

  const { data: allTeachers } = useSWR(["/api/teachers"], getAllTeachers);
  const { data: submissions } = useSWR(
    ["/api/checklist-submissions"],
    getAllSubmissions
  );
  const deleteHistory = useDeleteHistoryChoice();

  const loginFor = (teacher) =>
    teacher.userId ? users?.find((user) => user.sub === teacher.userId) : null;
  const hasLogin = (teacher) => Boolean(loginFor(teacher));
  const coordinatedBy = (teacher) =>
    (allTeachers || []).filter(
      (candidate) => candidate.coordinatorId === teacher.id
    );

  const teachers = useManageEntity({
    entityName: "Teacher",
    fields: getFormFields({ teachers: allTeachers, hasLogin }),
    getRecords: getAllTeachers,
    createRecord: createTeacher,
    updateRecord: async (id, values, teacher) => {
      await updateTeacher(id, values, teacher);
      // A linked login uses the teacher's name, so rename it too.
      const login = loginFor(teacher);
      if (login && values.name !== teacher.name) {
        await updateUser(login.id, {}, login);
      }
    },
    deleteRecord: async (id, teacher) => {
      if (teacher.userId && !users) {
        throw new Error("Logins could not be loaded. Try again.");
      }
      const login = loginFor(teacher);
      if (login && login.sub === currentUser.userId) {
        throw new Error("This is your own login. Ask another admin to do it.");
      }
      await deleteTeacher(id, {
        deleteSubmissions: deleteHistory.shouldDelete(id),
      });
      if (login) {
        await deleteUser(login.id);
      }
    },
    getDeleteDescription: (teacher) => {
      const question = teacher.username
        ? `Delete "${teacher.name}" and their login "${teacher.username}"?`
        : `Delete "${teacher.name}"?`;
      const coordinated = coordinatedBy(teacher).length;
      return (
        <DeleteDescription
          question={
            coordinated > 0
              ? `${question} ${coordinated} teacher(s) they coordinate will have no coordinator.`
              : question
          }
          count={
            submissions?.filter(
              (submission) => submission.teacherId === teacher.id
            ).length
          }
          checked={deleteHistory.shouldDelete(teacher.id)}
          onChange={(value) => deleteHistory.setShouldDelete(teacher.id, value)}
        />
      );
    },
  });

  const logins = useManageEntity({
    entityName: "Login",
    fields: teacherLoginFormFields,
    createRecord: async (values, { teacherId, name, hasStaleLink }) => {
      // The linked login was deleted elsewhere (e.g. the Cognito console).
      if (hasStaleLink) {
        await updateTeacher(teacherId, { userId: null, username: null });
      }
      const user = await createUser({ ...values, name, teacherId });
      showTemporaryPassword({ ...user, username: user.id });
    },
    updateRecord: updateUser,
    deleteRecord: deleteUser,
    getRecordLabel: (user) => user.username,
  });

  const coordinatorColumn = {
    title: "Coordinator",
    key: "coordinator",
    width: 220,
    render: (_, teacher) => {
      if (!teacher.coordinatorId) {
        return "---";
      }
      const coordinator = allTeachers?.find(
        (candidate) => candidate.id === teacher.coordinatorId
      );
      if (!coordinator) {
        return "---";
      }
      // Checked once logins load: without one, reviews are automatic.
      return (
        <Space size="small">
          <span>{coordinator.name}</span>
          {users && !hasLogin(coordinator) && <Tag color="warning">No login</Tag>}
        </Space>
      );
    },
  };

  const loginColumn = {
    title: "Login",
    key: "login",
    width: 340,
    render: (_, teacher) => {
      if (!users && !usersError) {
        return <Spin size="small" />;
      }
      const user = loginFor(teacher);
      if (!user) {
        return (
          <Button
            size="small"
            icon={<UserAddOutlined />}
            disabled={Boolean(usersError)}
            onClick={() =>
              logins.openCreate({
                teacherId: teacher.id,
                name: teacher.name,
                hasStaleLink: Boolean(teacher.userId),
              })
            }
          >
            Give login access
          </Button>
        );
      }

      const onMenuClick = ({ key }) => {
        if (key === "edit") {
          logins.openEdit(user);
        } else if (key === "reset") {
          confirmResetPassword(user);
        } else if (key === "remove") {
          confirmRemoveAccess(user, teacher);
        }
      };

      return (
        <Space size="small" wrap>
          <span>{user.username}</span>
          <RoleTag role={user.role} />
          <StatusTag user={user} />
          <Dropdown
            menu={{
              onClick: onMenuClick,
              items: [
                { key: "edit", label: "Edit login" },
                { key: "reset", label: "Reset password" },
                { type: "divider" },
                { key: "remove", label: "Remove access", danger: true },
              ],
            }}
          >
            <Button size="small">
              Manage <DownOutlined />
            </Button>
          </Dropdown>
        </Space>
      );
    },
  };

  return (
    <>
      {usersError && (
        <Alert
          type="error"
          showIcon
          message="Could not load logins"
          description={usersError.message}
        />
      )}
      <_TeachersList
        pageNo={pageNo}
        setPageNo={setPageNo}
        pageSize={pageSize}
        setPageSize={setPageSize}
        isLoading={false}
        extraColumns={[coordinatorColumn, loginColumn, teachers.actionsColumn]}
        toolbarExtensions={[teachers.addButton]}
      />
      {teachers.formModal}
      {logins.formModal}
    </>
  );
}

export default TeachersList;
