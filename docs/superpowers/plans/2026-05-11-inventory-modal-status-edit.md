# Inventory Modal Status Edit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an admin-editable device status select with an explicit save action inside the Inventory device detail popup.

**Architecture:** Move the inventory device list from static `MOCK_DEVICES` reads into local component state in `app/views/Inventory.tsx`, then pass a status-save callback into the detail modal. Add a small exported helper for immutable status updates and a modal export so tests can cover the save UI and options without introducing a browser-only harness.

**Tech Stack:** Next.js client component, React 19 state, node:test with tsx, existing mock data-driven inventory screen.

---

### Task 1: Add failing tests for modal status editing

**Files:**
- Create: `app/views/Inventory.test.ts`
- Modify: `app/views/Inventory.tsx`

- [ ] **Step 1: Write a failing test that renders the modal with status options and save button**
- [ ] **Step 2: Write a failing test for the immutable device status update helper**
- [ ] **Step 3: Run `npm.cmd test -- app/views/Inventory.test.ts` and confirm failure**

### Task 2: Implement the modal-only status edit flow

**Files:**
- Modify: `app/views/Inventory.tsx`

- [ ] **Step 1: Add local `devices` state in `Inventory` seeded from `MOCK_DEVICES`**
- [ ] **Step 2: Add exported `DEVICE_STATUS_OPTIONS` and `updateDeviceStatus` helper**
- [ ] **Step 3: Pass an `onSaveStatus` callback into `DeviceDetailModal`**
- [ ] **Step 4: Add the status select and `Save Status` button inside the popup while keeping the table read-only**

### Task 3: Verify green state

**Files:**
- Test: `app/views/Inventory.test.ts`

- [ ] **Step 1: Run `npm.cmd test -- app/views/Inventory.test.ts`**
- [ ] **Step 2: Run `npm.cmd test`**
