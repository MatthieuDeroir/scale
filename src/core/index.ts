export { prisma } from './db';
export {
  mapNode,
  listNodes,
  getNode,
  renameNode,
  setNodeTags,
  expireNode,
  deleteNode,
  mapPreAuthKey,
  mapNewPreAuthKey,
  createPreAuthKey,
  listPreAuthKeys,
  expirePreAuthKey,
  type RawHeadscaleNode,
  type RawHeadscalePreAuthKey,
} from './headscale';
