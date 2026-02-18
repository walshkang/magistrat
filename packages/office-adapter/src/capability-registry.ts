import type {
  AdapterCapability,
  AdapterCapabilityRegistry,
  HostCapabilities
} from "./adapter-types.js";

interface OfficeRequirementsLike {
  isSetSupported?: (name: string, minVersion?: string) => boolean;
}

interface OfficeContextLike {
  requirements?: OfficeRequirementsLike;
}

interface OfficeGlobalLike {
  context?: OfficeContextLike;
}

export function buildCapabilityRegistry(hostCapabilities: HostCapabilities): AdapterCapabilityRegistry {
  return {
    requirementSets: {
      powerPointApi_1_4: resolveRequirementSet(hostCapabilities, "1.4"),
      powerPointApi_1_6: resolveRequirementSet(hostCapabilities, "1.6")
    },
    policies: {
      livePatchApply: {
        supported: false,
        reasonCode: "POLICY_DISABLED",
        reason: "Live patch apply is disabled in this bootstrap slice."
      },
      bulletMetrics: {
        supported: false,
        reasonCode: "API_LIMITATION",
        reason: "Office.js does not expose stable bullet indent/hanging metrics in this slice."
      }
    }
  };
}

function resolveRequirementSet(hostCapabilities: HostCapabilities, minVersion: string): AdapterCapability {
  if (!hostCapabilities.officeAvailable) {
    return {
      supported: false,
      reasonCode: "OFFICE_UNAVAILABLE",
      reason: "Office runtime is unavailable."
    };
  }

  if (hostCapabilities.host !== "powerpoint") {
    return {
      supported: false,
      reasonCode: "HOST_UNSUPPORTED",
      reason: "Only PowerPoint host is supported."
    };
  }

  if (hostCapabilities.platform === "web") {
    return {
      supported: false,
      reasonCode: "PLATFORM_UNSUPPORTED",
      reason: "PowerPoint on the web is not enabled for this bootstrap slice."
    };
  }

  if (!hostCapabilities.desktopSupported) {
    return {
      supported: false,
      reasonCode: "PLATFORM_UNSUPPORTED",
      reason: "Only PowerPoint desktop on Windows or Mac is supported."
    };
  }

  const checker = getRequirementSetChecker();
  if (!checker) {
    return {
      supported: false,
      reasonCode: "API_LIMITATION",
      reason: "Office requirements API was unavailable."
    };
  }

  const supported = checker("PowerPointApi", minVersion);
  if (!supported) {
    return {
      supported: false,
      reasonCode: "REQUIREMENT_SET_UNSUPPORTED",
      reason: `PowerPointApi ${minVersion}+ is required.`
    };
  }

  return { supported: true };
}

function getRequirementSetChecker():
  | ((setName: string, minVersion?: string) => boolean)
  | undefined {
  const officeGlobal = (globalThis as { Office?: OfficeGlobalLike }).Office;
  const requirements = officeGlobal?.context?.requirements;
  if (!requirements || typeof requirements.isSetSupported !== "function") {
    return undefined;
  }
  return requirements.isSetSupported.bind(requirements);
}
