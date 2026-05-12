# Device Type Contract Update Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Change the Add Device save contract to accept only `Laptop`, `PC`, and `Server`.

**Architecture:** Update the shared create-device contract in `app/views/AddDeviceForm.tsx` and `app/lib/devices/deviceService.ts` so the UI options and server validation agree on the same three values. Keep the rest of the app untouched for now, including older mock/reporting uses of `Workstation` and `Mobile`.

**Tech Stack:** Next.js App Router client component, React 19 form state, node:test with tsx, existing device API/service layer.

---

### Task 1: Add failing tests for the new device type contract

**Files:**
- Modify: `app/views/AddDeviceForm.test.ts`
- Modify: `app/lib/devices/deviceService.test.ts`

- [ ] **Step 1: Change the form test to expect `Laptop`, `PC`, and `Server` only**
- [ ] **Step 2: Run `npm.cmd test -- app/views/AddDeviceForm.test.ts` and confirm failure**
- [ ] **Step 3: Add a device service test proving `PC` is accepted**
- [ ] **Step 4: Run `npm.cmd test -- app/lib/devices/deviceService.test.ts` and confirm failure**

### Task 2: Implement the minimal contract update

**Files:**
- Modify: `app/views/AddDeviceForm.tsx`
- Modify: `app/lib/devices/deviceService.ts`
- Modify: `docs/device-database.md`

- [ ] **Step 1: Update the `DeviceType` union in the form and service to `Laptop | PC | Server`**
- [ ] **Step 2: Update the Add Device dropdown to render only those three options**
- [ ] **Step 3: Update the documented schema enum to the same three values**

### Task 3: Verify the change stays green

**Files:**
- Test: `app/views/AddDeviceForm.test.ts`
- Test: `app/lib/devices/deviceService.test.ts`

- [ ] **Step 1: Run `npm.cmd test -- app/views/AddDeviceForm.test.ts`**
- [ ] **Step 2: Run `npm.cmd test -- app/lib/devices/deviceService.test.ts`**
- [ ] **Step 3: Run `npm.cmd test`**
