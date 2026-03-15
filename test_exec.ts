import { createSubsystemLogger } from "./src/logging/subsystem.js";
import { runExec } from "./src/process/exec.ts";

const logger = createSubsystemLogger("test/exec");

async function testExec() {
  logger.info("Testing runExec utility directly...");
  try {
    const result = await runExec("ls", ["-la"]);
    logger.info("Exec tool output:", { stdout: result.stdout });
    console.log("--- EXEC SUCCESS ---");
    process.exit(0);
  } catch (error: any) {
    logger.error("Exec tool failed", { error: error.message });
    process.exit(1);
  }
}

testExec();
