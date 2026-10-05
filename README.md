# SchoolDay

Timetables, checklists and activities for your school. SchoolDay (formerly Timetable maker) is a [Next.js](https://nextjs.org/) application backed by [AWS Amplify Gen 2](https://docs.amplify.aws/nextjs/):

- **Auth**: Amazon Cognito (username or email + password; email optional) with two roles, `ADMIN` and `TEACHER`. Self sign-up is disabled; admins create logins in the app.
- **User management**: a Lambda function ([amplify/functions/manage-users](amplify/functions/manage-users)) that admins call to list, create, update and delete Cognito users and to set temporary passwords.
- **Data**: AWS AppSync + Amazon DynamoDB, defined in [amplify/data/resource.ts](amplify/data/resource.ts).
- **Storage**: Amazon S3 for the school logo, defined in [amplify/storage/resource.ts](amplify/storage/resource.ts).
- **Hosting**: Amplify Hosting runs the Next.js app server-side (`.next/`), as configured in [amplify.yml](amplify.yml).

## Prerequisites

- Node.js 18.17 or later
- An AWS account with credentials configured locally (`aws configure sso` or `aws configure`)

## Local development

Install dependencies:

```bash
npm install
```

Start a personal cloud sandbox. This deploys the backend to your AWS account and writes `amplify_outputs.json`, which the frontend needs:

```bash
npx ampx sandbox
```

In a second terminal, run the development server:

```bash
npm run dev
```

Open http://localhost:3000/ and sign in.

### Creating the first admin

Logins are managed in the app, which only admins can do, so the first admin is created from the command line. Use the user pool id from `amplify_outputs.json` (`auth.user_pool_id`), and choose a username and a temporary password (at least 8 characters with upper case, lower case, a number and a symbol):

```bash
aws cognito-idp admin-create-user   --user-pool-id <user-pool-id>   --username <username>   --temporary-password '<temporary-password>'   --message-action SUPPRESS

aws cognito-idp admin-add-user-to-group   --user-pool-id <user-pool-id>   --username <username>   --group-name ADMIN
```

Sign in with that username and temporary password; you are asked to choose a new password. Group changes take effect the next time the user signs in.

## Roles and logins

| Role | Can do |
| --- | --- |
| `ADMIN` | Everything: the school setup, timetables, checklists and logins. |
| `TEACHER` | View the class, students and teachers timetables and the school calendar, fill in their checklists, and review the checklists of the teachers they coordinate. |

Users sign in with their **username**, or with their **email** if they have one. An email address is optional: if one is set, Cognito also emails the invitation and the user can reset their own password with "Forgot your password?". Each email can belong to only one login.

When an admin creates a login or resets a password, the app generates a **temporary password and shows it once**, with a copy button, for the admin to hand over. The user must choose a new password at their next sign-in. If the temporary password is lost, reset the password again.

- **Teachers page**: the main place to manage logins. Each teacher has a **Login** column: **Give login access** (username, optional email, role), or **Manage** to edit the login, reset the password, or remove access while keeping the teacher. Deleting a teacher also deletes their login. A teacher can have the `ADMIN` role, for example the principal, so they can manage the app and also be assigned checklists.
- **Users page**: an overview of every login, including accounts that are not teachers (for example office staff). Logins can also be created, edited, linked to a teacher, reset and deleted here.

Admins cannot delete, disable or demote their own account.

## Navigation

The menu is grouped by what people do; each user only sees the pages they can open:

- **Checklists**: My checklists, Reviews (admins and coordinators), and for admins Manage checklists and Progress.
- **Timetables**: the class, students and teachers timetables, and for admins Create timetable, Timetable entries and Teacher workload.
- **Calendar**: the school calendar.
- **Setup** (admins): School, Teachers, Subjects, Classes, Periods, Teaching assignments and Users.

The signed-in user's name (or username) is shown on the right; click it to see the role and sign out. After signing in, admins start at the class timetable and teachers at My checklists.

## Teacher workload

The **Teacher workload** page (Timetables menu, admins only) counts each teacher's lessons in the timetable, to help spread the load evenly. One lesson in the timetable is one period; breaks are not counted. Weekday periods are Monday to Friday and weekend periods Saturday and Sunday; hours come from each period's start and end times.

- **Load per teacher**: a bar per teacher, weekday and weekend stacked, with the school average marked. The average is taken over teachers with at least one period; a teacher more than 20% above it is **Over**, more than 20% below is **Under**, otherwise **Balanced**.
- **Teachers**: subjects, classes, weekday, weekend and total periods, hours, free periods (out of the week's lesson slots: days × lesson periods), load %, busiest day and load status, with totals. Expand a teacher for their periods by subject and class.
- **Periods per day**: a teacher × day grid that shows uneven weeks.
- **Assigned but not in the timetable**: teaching assignments with no lessons yet.

Filter by teacher, subject, class and load status. **Download Excel** saves the teachers shown as an Excel file with three sheets: Summary (one row per teacher, with the school average and capacity), Detail (teacher, subject, class, weekday, weekend, total and hours, with a total per teacher) and By day.

## Managing data

The first time someone signs in to a new deployment, the app creates the initial school record, the days (Monday to Saturday) and the periods: P1 (10:00–11:30), P2 (11:30–1:00), a Break (1:00–2:00), P3 (2:00–3:30) and P4 (3:30–5:00). Each table is only seeded while it is empty, so periods you later edit or delete are not recreated.

Teachers, subjects, classes and periods can be added, edited and deleted from their pages in the app. A record that is still in use (for example, a teacher in a teaching assignment, or a period in the timetable) cannot be deleted until those references are removed.

Each period is a **lesson** or a **break** with a start and end time. Periods cannot overlap. The timetables have one column per period, in time order: lessons show their name and time, and breaks span every day and show their name. Breaks cannot hold lessons, so they are left out of the Create timetable grid and the Timetable entries form, and a period already used in the timetable cannot be changed into a break.

Teaching assignments (which teacher teaches which subject to which class) and timetable entries can also be added, edited and deleted from their pages. Saving is refused if it would double-book a class or a teacher in the same day and period, and a class, subject and teacher can only be associated once.

Each teacher can have a **coordinator**, set on the Teachers page: another teacher with a login, who reviews their checklists. A teacher cannot coordinate themselves, and teachers without a coordinator have their checklists reviewed automatically. Deleting a coordinator leaves the teachers they coordinated without one.

On the **Manage checklists** page, admins create checklists: a title, a description, a frequency (daily, weekly or one-time), a start date (today by default; a weekly checklist is due from the week containing it), how far back teachers can fill it in, an ordered list of activities, and the teachers who must complete it. Deleting a teacher removes their checklist assignments.

How far back teachers can fill in checklists is set on the **School** page: a number of days, `0` for only today or this week, or empty for no limit. A checklist can use this school default, its own number of days, or no limit.

### Filling in checklists

Teachers fill in their checklists on the **My checklists** page (admins linked to a teacher can too). It lists the checklists due on the chosen day, today by default, from each checklist's start date: daily checklists on school days, weekly checklists (Monday to Sunday) in weeks with a school day, and one-time checklists always. For each one the teacher ticks the activities they completed and can add a comment to each; an activity that is not ticked needs a comment before the checklist can be submitted. Progress can be saved and finished later. Checklists to do come first; those that can no longer be filled in and have nothing saved are hidden behind a switch.

When a checklist is submitted, it waits for the teacher's coordinator to review it. A teacher without a coordinator (or whose coordinator has no login) is reviewed automatically. A checklist that is sent back can be changed and submitted again. Filling in a day or week after it ended is allowed within the configured limit and marks the submission **Late**. The **History** tab lists past submissions with their status, reviewer and timeline.

Submissions are only written by the `checklist-workflow` function ([amplify/functions/checklist-workflow](amplify/functions/checklist-workflow)), which checks the rules shared with the app ([src/shared/lib/checklist-rules.js](src/shared/lib/checklist-rules.js)). A submission can be read by admins, the teacher, and their coordinator. The checklist's activities, title and the teacher's name are copied into each submission, so it stays readable after the checklist changes. When deleting a teacher or a checklist that has submissions, admins choose whether to also delete them or keep them as history.

### Reviewing checklists

Coordinators review their teachers' checklists on the **Reviews** page, which appears in the Checklists menu for admins and for teachers who coordinate someone. **Waiting for review** lists submitted checklists, oldest first; **Reviewed and sent back** lists past decisions. Both can be filtered by teacher and checklist, and admins can switch between their own teachers and all teachers.

Opening a checklist shows the activities done and not done with the teacher's comments, and its history. The coordinator can **Mark reviewed**, with an optional comment, or **Send back** with a comment explaining what to change; the teacher sees the comment on My checklists. Only the teacher's coordinator or an admin can review a checklist.

When a teacher's coordinator changes, the checklists waiting for review move to the new coordinator. When the teacher is left without a coordinator with a login (the coordinator is removed, deleted or loses their login), the waiting checklists are reviewed automatically.

### Checklist progress

Admins follow completion on the **Progress** page (Checklists menu). Choose daily, weekly or one-time checklists and a day (a weekly checklist shows the week containing it); every assigned teacher of every checklist due then is listed with its status, filterable by teacher, checklist and status, with a count per status:

- **Not submitted**: the day or week has ended with nothing submitted.
- **Not started**, **In progress**, **Sent back**, **Waiting for review** and **Reviewed** (or Auto-reviewed), with **Late** marking checklists filled in after their day or week.

Admins can open any submission and review it. The **All submissions** tab lists every submission, including those kept as history after their teacher or checklist was deleted, marked "(deleted)".

### School calendar

The **Calendar** page defines the school days, which decide when daily checklists are due. Admins set:

- **Working days**: the days of the week the school normally works (Monday to Saturday by default).
- **Holidays**: a date or a range of dates when the school is closed.
- **Extra working days**: normally-off days when the school works, for example a compensatory Saturday.

A holiday wins where it overlaps an extra working day. Admins click a day in the month view to add or edit an entry; teachers can view the calendar. The calendar does not change the timetables.

## Deploying

1. Push this repository to GitHub (or another Git provider).
2. In the Amplify console, choose **Create new app** and connect the repository and branch.
3. Amplify picks up [amplify.yml](amplify.yml). Each push deploys the backend for that branch, then builds and hosts the frontend.

To remove a sandbox, run `npx ampx sandbox delete`.
