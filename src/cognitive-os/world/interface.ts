import type { WorldCapability } from "../contracts/types.js";
import { defaultWorldCapabilities } from "./capabilities.js";

export class WorldInterface {
  private readonly capabilities: WorldCapability[];

  constructor(capabilities: WorldCapability[] = defaultWorldCapabilities()) {
    this.capabilities = capabilities;
  }

  listCapabilities(): WorldCapability[] {
    return [...this.capabilities];
  }

  isCapabilityEnabled(id: string): boolean {
    return this.capabilities.some((item) => item.id === id && item.enabled);
  }
}
