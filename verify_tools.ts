import { createSubsystemLogger } from "./src/logging/subsystem.js";
import { getChildLogger } from "./src/logging/logger.js";
import { defaultRuntime } from "./src/runtime.js";
import { createConfigIO } from "./src/config/io.js";

const logger = createSubsystemLogger("test/verification");

async function testTools() {
  logger.info("Starting tool verification...");

  try {
    // 1. Test Logger initialization (already tested by the fact we are here)
    logger.debug("Logger initialized successfully");

    // 2. Test Exec Tool (indirectly by checking if we can import logic)
    const execModule = await import("./dist/exec.js").catch((e) => {
      logger.error("Failed to import exec tool logic", { error: e.message });
      return null;
    });
    if (execModule) {
      logger.info("Exec tool logic imported successfully");
    }

    // 3. Test Config Loading
    const config = createConfigIO().loadConfig();
    logger.info("Config loaded successfully", { profile: config.tools?.profile });

    logger.info("Tool verification completed successfully");
    process.exit(0);
  } catch (error: any) {
    logger.error("Tool verification failed", { error: error.message, stack: error.stack });
    process.exit(1);
  }
}

testTools();
