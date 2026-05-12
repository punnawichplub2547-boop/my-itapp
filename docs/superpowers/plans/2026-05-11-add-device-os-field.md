# Add Device OS Field Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a required `OS` text input to the Add New Device form and persist it with the saved device data.

**Architecture:** Extend the existing form value helpers in `app/views/AddDeviceForm.tsx` so client-side validation and request payload generation include `os`. Mirror that rule in `app/lib/devices/deviceService.ts` so the API enforces the same required field before persisting to either demo-file or MySQL storage.

**Tech Stack:** Next.js App Router client component, React 19 state management, node:test with tsx, existing device API/service layer.

---

### Task 1: Add failing tests for required OS behavior

**Files:**
- Modify: `app/views/AddDeviceForm.test.ts`
- Modify: `app/lib/devices/deviceService.test.ts`

- [ ] **Step 1: Write failing form tests**
- [ ] **Step 2: Run `npm.cmd test -- app/views/AddDeviceForm.test.ts` and confirm failure**
- [ ] **Step 3: Write failing device service tests**
- [ ] **Step 4: Run `npm.cmd test -- app/lib/devices/deviceService.test.ts` and confirm failure**

### Task 2: Implement minimal form and service support

**Files:**
- Modify: `app/views/AddDeviceForm.tsx`
- Modify: `app/lib/devices/deviceService.ts`
- Modify: `docs/device-database.md`

- [ ] **Step 1: Add `os` to form state, validation helper, and payload helper**
- [ ] **Step 2: Render the new `OS` input in Hardware Configuration**
- [ ] **Step 3: Add `os` to the server-side create-device contract and persistence**
- [ ] **Step 4: Document the new `os` column in the schema doc**

### Task 3: Verify green state

**Files:**
- Test: `app/views/AddDeviceForm.test.ts`
- Test: `app/lib/devices/deviceService.test.ts`

- [ ] **Step 1: Run `npm.cmd test -- app/views/AddDeviceForm.test.ts`**
- [ ] **Step 2: Run `npm.cmd test -- app/lib/devices/deviceService.test.ts`**
- [ ] **Step 3: Run `npm.cmd test`**
