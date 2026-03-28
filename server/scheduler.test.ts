import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock node-cron before importing scheduler
vi.mock("node-cron", () => {
  const mockTask = {
    stop: vi.fn(),
    start: vi.fn(),
    on: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    emit: vi.fn(),
  };
  return {
    schedule: vi.fn(() => mockTask),
    validate: vi.fn(() => true),
    __mockTask: mockTask,
  };
});

// Mock the GraphQL sync
vi.mock("./maxiprodGraphQL", () => ({
  runGraphQLSync: vi.fn(async () => ({
    success: true,
    counts: { stock: 92, openOrders: 147, purchaseOrders: 67, salesOrders: 1117 },
  })),
}));

import { startScheduler, stopScheduler, isSchedulerRunning } from "./scheduler";
import { schedule } from "node-cron";

describe("Scheduler Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset scheduler state by stopping it
    stopScheduler();
  });

  afterEach(() => {
    stopScheduler();
  });

  it("should start the scheduler with correct cron expression", () => {
    startScheduler();
    
    expect(schedule).toHaveBeenCalledWith(
      "*/5 7-17 * * 1-5",
      expect.any(Function),
      expect.objectContaining({
        timezone: "America/Sao_Paulo",
      })
    );
  });

  it("should report scheduler as running after start", () => {
    expect(isSchedulerRunning()).toBe(false);
    startScheduler();
    expect(isSchedulerRunning()).toBe(true);
  });

  it("should not start a second scheduler if already running", () => {
    startScheduler();
    startScheduler(); // Second call should be a no-op
    
    expect(schedule).toHaveBeenCalledTimes(1);
  });

  it("should stop the scheduler", () => {
    startScheduler();
    expect(isSchedulerRunning()).toBe(true);
    
    stopScheduler();
    expect(isSchedulerRunning()).toBe(false);
  });

  it("should be safe to stop when not running", () => {
    expect(() => stopScheduler()).not.toThrow();
    expect(isSchedulerRunning()).toBe(false);
  });
});
