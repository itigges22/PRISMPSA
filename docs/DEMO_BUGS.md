Here are the issues/ bugs in the demo that need to be fixed. I have gone through every role and found every error I could possibly find. Before you begin, please double check the Seed Data to understand what roles have what permissions to avoid a mishap in determining whether there is a bug or a designed permission block. Also- keep in mind that some of these issues about seeing no data means that we need to add more data & expand the seed data to ensure the platform is demo ready.
ALEX THE EXECUTIVE ROLE TESTING:
1. When I first login on the demo, the nav bar takes over 1000ms to load. It should be immediate or under 100ms
2. It shows ZERO project updates on the Welcome page for the Alex Executive User
3. The Alex Executive User can see all of the projects under the "my projects" section, but none of the workflows attached to those projects are showing up/ it says "no workflow" for all of the projects
4. I am not sure if Alex is on any projects, but his capacity trend chart is showing nothing, and it needs to show utilization, actual, allocated, and available hours to show a populated chart
5. Absolutely none of the widgets on the Dashboard page are populated for Alex the executive, Nothing in "my time this week", nothing in "my tasks", nothing in "my workflows", nothing in "my accounts", nothing in "my collaborators", nothing in "time by project", nothing in "task completion trend", nothing in Recent activity, and nothing in "upcoming deadlines"
6. Alex the Executive on the dashboard page under My Projects and the "in the pipeline", "Pending Approval" and "Completed" tab, see nothing at all, these should also be populated.
7. Alex the Executive can go to the "admin dashboard" page, or the "/admin" page, but alex can still see components to pages that he does not have access too, such as the "superadmin setup" component/ section.
8. Alex the Executive also has access to the Database Management page and RBAC Diagnostics page, but there are no permissions to allow or disallow viewing these pages. I want to make these pages bespoke for ONLY superadmins/ ONLY superadmins can view this component/ these pages.
9. If Alex the Exective tries to visit a page that he does not have access too, it will either send him back to the welcome page, or it will show a "permission denied screen". I JUST want it to show a permission denied screen, and then he can click on the back to home button or whatever.
10. The Acme Corp Account page for Alex the Executive is showing essentially no capacity data, no active issues and roadblocks, and no urgent items.
11. The Fashion Forward account page for Alex is showing essentially no capacity data, no active issues and roadblocks, and no urgent items. It does show one completed project though. This account does have projects active. 
12. Alex has the "edit account" button, but when he tries to edit the accounts name, it comes back with a "Failed to edit account" error.This account does have projects active. 
13. The Green Energy Co account page for Alex is showing essentially no capacity data, no active issues and roadblocks, and no urgent items. This account does have projects active. 
14. The The Local Bistro account page for Alex is showing essentially no capacity data, no active issues and roadblocks, and no urgent items. This account does have projects active. 
15. The TechStart Inc account page for Alex is showing essentially no capacity data, no active issues and roadblocks, and no urgent items. This account does have projects active.
16. No workflows are attached to ANY projects across all accounts, which is concerning. Not sure if it just was not setup in the demo seed data or not.
17. Alex the Executive gets access denied to these pages: Role Management, Superadmin Setup, Time-Tracking Admin, Workflow Management (can view the page, but it says that theres insufficient permissions to view the workflows, and then also no workflows actually appear), can view the client portal page but gets "failed to load invitations", and "failed to load feedback", can view Database Status pages, and RBAC Diagnostic pages
18. Not sure of the validity in the Database Management and RBAC diagnostic pages... I think they have a lot of mock data.
19. Alex the Executive can view the Analytics page, but on the Overview tab the utilization is showing 0% utilization across all periods, Under Project Analytics the "by account" tab shows "no account data available", shows zero top performers in the team performance section (the chart is empty), Activity by Day of Week is showing nothing (empty chart)
20. Alex the executive can view the analytics page, but on the projects tab under Project Analytics the Estimate Accuracy is at 0% (not sure if this is an error/ bug or not), the "by account" tab shows "no account data available".
21. Alex the executive can view the Analytics page, but on the accounts tab the Hours by Account chart or "top accounts by Hours invested" chart is showing no data.
21. Alex the executive can view the Analytics page, but on the Time tab the Daily Trend chart is showing no data, the by project is showing no hours by project data, and no Project Distribution data. the By Day or "Activiy by Day of week" is showing no data or an empty chart, and top Users is showing zero data or "No contributor data"
22. Alex the executive can view the Analytics page, but on the workflow tab the Workflow Analytics is showing no data under the status tab, the templates tab, and the bottle neck tab. Also all of the data like "active workflows", "completed", "Avg Days", and "completion rate" all show zero.
23. Alex the executive can view the Analytics page, but on the Network tab- Alex can see all of the projects and the accounts tied to those projects, but there are no users in the network graph, and there are no departments tied to projects/ users in that graph either.
24. Alex tried to clock in, but he got "insufficient permissions to clock in" (not sure if he has that permission or not). For some more context alex can view the "/time-entries" page.
25. Alex tried to set his availability, but gets "You do not have permission to edit your availability. Contact your administrator"... For some more context alex can view the "/time-entries" page.
26. The time-entries page for Alex shows no data whatsoever (everything is at zero, empty charts, or N/A)
27. Alex is unable to view or edit newsletters (not sure if this is in the permissions/ seed or not, but he should be able too)
28. Customizing the Dashboard does not work / shows no widgets to reorganize.
29. Cannot view Department pages (their roles should be attached to a department??)
MORGAN THE MANAGER: 
1. When morgan first logs in, the nav bar takes over 1000ms to load, it shows the "welcome" link, but takes over 1000ms to load the rest of the nav bar. It should take less than 100ms.
2. Morgan the manager apparently has no projects, nothing in the pipeline, no pending approvals, and nothing completed. (on the dashboard page)
3. Morgan the manager does not have any data for her Capacity Trend chart on the dashboard (no available, allocated, actual, or utilization)
4. Morgan the manager sees empty widgts on the dashboard. here are the widgets with zero or n/a data... "My time this week", "my tasks", "my workflows", "my accounts" DOES SEE THREE ACCOUNTS, "my collaborators", "time by project", "task complettion trend", "upcoming deadlines", and "recent activity"
5. Morgan the Manager sees three accounts in the "my accounts" widget, but then when visiting the "/accounts" page, sees Zero accounts for 5-10seconds, and then the three accounts shes assigned too appears. 100% a bug.
6. Morgan the Manager sees zero data in any components other than the active projects on the account page "Acme Corporation"
7. Morgan the Manager sees zero data in any components other than the active projects on the account page "Fashion Forward"
8. Morgan the Manager sees zero data in any components other than the active projects on the account page "TechStart Inc"
9. Morgan the Manager seems to have access to "create an account", but when trying to create an account for one gets the error: "Account Manager ID: Invalid UUID format", but also probably should not have access to create accounts? Check seed to see if this is a bug.
10. Morgan the Manager can see the "Admin" dropdown in the nav bar, but I am unsure that she is supposed to have access to this. Although she can view the client portal, but gets the errors "failed to load invitations", and "failed to load feedback".
11. Morgan the manager can view the "RBAC DIAGNOSTICS" page for some reason, but I do not think she has access to this, or is supposed to have access. and gets this error when trying to run the RBAC diag: Uncaught TypeError: Cannot read properties of undefined (reading 'length')
   at y (page-b4a2c572f9f1e681.js:1:5963)
 at l9 (4bd1b696-100b9d70ed4e49c1.js:1:51130)
    at o_ (4bd1b696-100b9d70ed4e49c1.js:1:70990)
    at oq (4bd1b696-100b9d70ed4e49c1.js:1:82020)
    at ik (4bd1b696-100b9d70ed4e49c1.js:1:114682)
    at 4bd1b696-100b9d70ed4e49c1.js:1:114527
    at ib (4bd1b696-100b9d70ed4e49c1.js:1:114535)
    at iu (4bd1b696-100b9d70ed4e49c1.js:1:111618)
    at iX (4bd1b696-100b9d70ed4e49c1.js:1:132934)
    at MessagePort.w (1255-37fdc005f9321e44.js:1:64139)Understand this error
12. Morgan the Manager can view three accounts, but the accounts have zero team members. Not sure if she is the account manager for these three accounts, but it does not mention it anywhere in the UI if she is. Not to mention the projects under these accounts also have zero team members, in which she should at least be a team member on if she is the account manager of those accounts.
13. Zero data is shown on the /time-entries page
14. Morgan is not allowed to edit her availability, as she gets the error: You do not have permission to edit your availability. Contact your administrator.
15. Morgan cannot view newsletters (I am not sure if she has access too/ if she is allowed too, but she should be able too)
16. Morgan is unable to clock in and is getting permission blocked.
17. Customizing the Dashboard does not work/ shows no widgets to reorganize.
18. Cannot view Department pages (their roles should be attached to a department??)
PAT PROJECT MANAGER:
1. Nav bar is taking forever to load like previously mentioned!
2. Project updates show nothing, and pat is unable to view newsletters.
3. Pat Cannot clock in, his /time-entries page shows no data, and he is getting permission blocked to adjust availability.
4. Pats dashboard shows no projects, nothing in the pipeline, no pending approvals, and nothing completed.
5. Pats dashboard shows the capacity chart showing available hours, but since he does not have access to availability, that makes no sense. (He should have access to availability though). there should also be Actual, Allocated, and Utilization on the capacity chart (like actual data)
6. All of the dashboard widgets except for "My accounts" does not show data for pat/ they are all empty except for "my accounts"
7. Customizing the dashboard does not work at all/ shows no widgets to reorganize.
8. Pat has no account access for 10 seconds, and then it shows the two accounts that he is on. 100% a timing bug.
9. All accounts that he is on has zero data shown except for the projects tied to the accounts. (Green Energy Co, Local Bistro)
10. Pat cannot view the admin nav bar link (good unless he has permissions to any of the pages in /admin)
11. Projects show zero team members, and accounts show zero team members. Not sure how Pat has access then to the project pages, and or to the accounts. Unless there is a bug! Pat can edit the project though on some of these and add tasks but he cannot add issues and roadblocks and or add updates. I am not sure if that was the intended design. Double check this.
12. Cannot view Department pages (their roles should be attached to a department??)
DANA DESIGNER:
1. Similar issues to Pat & Morganz
2. Cannot view Department pages (their roles should be attached to a department??)
DEV DEVELOPER:
1. Similar issues to Pat & Morgan & Dana 
2. Cannot view Department pages (their roles should be attached to a department??)
CHRIS CLIENT:
1. The client view should only be ONE page, and it should show analytics. So instead of clients being taken to a welcome page, it should quite litterally JUST show them analytics on the account that they are attached too. (things that are valuable to the client). There should also be a way for them to provide feedback that ties into the project & account pages, and a way for them to approve things if a workflow calls for their approval.
2. Currently the client JUST sees the welcome page.
ANDY ADMIN:
1. Failed to clock in
2. Failed to load project updates
3. No widgets have any data on dashboard
4. Customize Dashboard button is broken
5. Nav Bar actually loads normally/ fast.
6. Can actually view deparment pages.
7. Auto Assign Tasks feature in the Department Settings 100% does not work.
8. Cannot create department (gets a failed to create department error)
9. Cannot create accounts either: account_manager_id: Invalid UUID format
10. Failed to update an account when attempted
11. failed to update project when attempted: Failed to update project: Cannot coerce the result to a single JSON object
12. When attempting to create a task, the assign to dropdown shows no other users.
13. Cannot add notes to projects/ gets an error
14. Failed to update role. Please try again
15. All levels in the role hiearchy are all set to level 0.
16. Internal Server Error when trying to create a workflow.