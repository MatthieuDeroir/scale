export { prisma } from './db';
export { logActivity, activityRetentionDays } from './activity-log';
export { hujsonToJson } from './hujson';
export {
  mapNode,
  describeNode,
  listNodes,
  getNode,
  renameNode,
  setNodeTags,
  deleteNode,
  mapPreAuthKey,
  mapNewPreAuthKey,
  createPreAuthKey,
  listPreAuthKeys,
  expirePreAuthKey,
  getPolicy,
  setPolicy,
  checkPolicy,
  type RawHeadscaleNode,
  type RawHeadscalePreAuthKey,
} from './headscale';
export {
  parsePolicyFleets,
  fleetTagFromName,
  addFleetToPolicy,
  removeFleetFromPolicy,
  ensureSystemTags,
  SYSTEM_TAGS,
  SERVER_TAG,
  parsePolicyRules,
  addAccessRule,
  removeAccessRule,
  normalizePorts,
  type FleetPolicy,
  type PolicyRule,
  type PolicyWarning,
  type RuleKind,
} from './acl-policy';
export { ensureSystemTagsInPolicy } from './system-tags';
export { updatePolicy } from './policy-update';
export {
  generateAgentToken,
  hashAgentToken,
  authenticateAgent,
  inventorySchema,
  PACKAGE_NAME,
  JOB_KINDS,
  MAX_JOB_OUTPUT,
  type Inventory,
  type JobKind,
} from './agent';
export { agentScript, installerScript, publicStramscaleUrl } from './agent-install';
export {
  scanDevice,
  ecosystemFor,
  groupBySource,
  sourceVersionOf,
  summarize,
  severityOf,
  isAdvisory,
  SEVERITY_RANK,
  type Severity,
  type ScanSummary,
  type PackageVulns,
  type SourcePackage,
} from './vulns';
export { cvss3BaseScore } from './cvss';
export { toHostname, slotHostname } from './hostname';
export { issueMachineKey, KeyIssueError } from './machine-key';
export {
  ensureDefaultProducts,
  tagsFor,
  numberedLabels,
  setMachineProduct,
  resolveSlots,
  assignNodeToSlot,
  planToTemplateItems,
  createSlots,
  addSlaves,
  isServerSlot,
  MAX_SLOTS,
  type NewSlots,
  type TemplateItem,
} from './plan';
export {
  parkVulns,
  summarizePark,
  vulnKeyOf,
  assessmentFor,
  stateOf,
  VEX_STATUSES,
  VEX_JUSTIFICATIONS,
  type ParkVuln,
  type Occurrence,
  type Assessment,
  type SecuritySummary,
  type VexStatus,
  type VexJustification,
  type VulnState,
} from './security';
