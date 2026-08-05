# Agentic-mesh Autonomous Test Run Report

**Date:** 2026-10-31T19:35:24.773Z
**Jira Ticket:** SQA-1 - User Authentication and Todo Management Flow

## Summary

| Total Tests | Passed | Self-Healed | Flaky | Failed | Duration |
| :---: | :---: | :---: | :---: | :---: | :---: |
| 4 | 0 | 0 | 0 | 4 | 0.63s |

## Self-Healing Repairs (0)

_No repairs required. All locators matched current page DOM._

## Test Cases

### ❌ TC-01: Valid login displays dashboard greeting (FAILED)
- **Criterion:** Given the user is on the login page, when they enter valid username 'admin' and password 'password123' and click Login, they should see the dashboard and greeting 'Welcome, admin!'
- **Duration:** 0.19s
- **Error:** `page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3000/
Call log:
[2m  - navigating to "http://localhost:3000/", waiting until "domcontentloaded"[22m
`

### ❌ TC-02: Invalid login shows error message (FAILED)
- **Criterion:** Given the user is on the login page, when they enter invalid credentials 'admin' and 'wrongpass' and click Login, they should see an error message 'Invalid username or password'
- **Duration:** 0.18s
- **Error:** `page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3000/
Call log:
[2m  - navigating to "http://localhost:3000/", waiting until "domcontentloaded"[22m
`

### ❌ TC-03: Add new task appears in todo list (FAILED)
- **Criterion:** Given the user is logged into the dashboard, when they type 'Deploy Agentic-mesh' into the task input and click Add Task, the new item should appear in the todo list
- **Duration:** 0.13s
- **Error:** `page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3000/
Call log:
[2m  - navigating to "http://localhost:3000/", waiting until "domcontentloaded"[22m
`

### ❌ TC-04: Logout redirects to login page (FAILED)
- **Criterion:** Given the user is on the dashboard, when they click Logout, they should be redirected back to the login screen
- **Duration:** 0.13s
- **Error:** `page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3000/
Call log:
[2m  - navigating to "http://localhost:3000/", waiting until "domcontentloaded"[22m
`

