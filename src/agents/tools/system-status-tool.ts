import os from "node:os";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export type SystemStatus = {
  uptime: number;
  cpuLoad: number[];
  totalMemory: number;
  freeMemory: number;
  memoryUsagePercent: number;
  platform: string;
  arch: string;
  processCount?: number;
};

/**
 * AEON PROPHET: System Status Tool
 * Provides real-time observability into the host environment.
 */
export async function getSystemStatus(): Promise<SystemStatus> {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();

  let processCount: number | undefined;
  if (process.platform !== "win32") {
    try {
      const { stdout } = await execAsync("ps -ax | wc -l");
      processCount = parseInt(stdout.trim(), 10);
    } catch {
      // Ignore
    }
  }

  return {
    uptime: os.uptime(),
    cpuLoad: os.loadavg(),
    totalMemory: totalMem,
    freeMemory: freeMem,
    memoryUsagePercent: Math.round(((totalMem - freeMem) / totalMem) * 100),
    platform: os.platform(),
    arch: os.arch(),
    processCount,
  };
}
