import { Organization, OrganizationMember, User, UserService } from '@teamsuzie/shared-auth';
import { config, sharedAuthConfig } from '../config.js';

interface SeedSummary {
  created: boolean;
  adminEmail: string;
  adminPassword: string;
  demoEmail: string;
  demoPassword: string;
  orgSlug: string;
}

const ORG_SLUG = 'admin-demo';
const ORG_NAME = 'Admin Demo';

/**
 * Idempotent — creates admin/demo users and a demo organization only if
 * they don't already exist. Safe to call on every boot.
 */
export async function ensureSeed(): Promise<SeedSummary> {
  const userService = new UserService(sharedAuthConfig);
  let created = false;

  async function upsertUser(
    email: string,
    password: string,
    name: string,
    role: 'admin' | 'user',
  ) {
    const existing = await User.findOne({ where: { email } });
    if (existing) return existing;
    created = true;
    return userService.create(email, password, name, role);
  }

  const admin = await upsertUser(config.seed.email, config.seed.password, config.seed.name, 'admin');
  const demo = await upsertUser(config.demo.email, config.demo.password, config.demo.name, 'user');

  let org = await Organization.findOne({ where: { slug: ORG_SLUG } });
  if (!org) {
    created = true;
    org = await Organization.create({
      name: ORG_NAME,
      slug: ORG_SLUG,
      type: 'human',
      owner_id: admin.id,
      settings: {},
      created_by: admin.id,
      updated_by: admin.id,
    });
  }

  const [, adminMemberCreated] = await OrganizationMember.findOrCreate({
    where: { organization_id: org.id, user_id: admin.id },
    defaults: {
      role: 'owner',
      created_by: admin.id,
      updated_by: admin.id,
    },
  });
  const [, demoMemberCreated] = await OrganizationMember.findOrCreate({
    where: { organization_id: org.id, user_id: demo.id },
    defaults: {
      role: 'member',
      created_by: admin.id,
      updated_by: admin.id,
    },
  });
  created = created || adminMemberCreated || demoMemberCreated;

  for (const u of [admin, demo]) {
    if (u.default_organization_id !== org.id) {
      u.default_organization_id = org.id;
      await u.save();
      created = true;
    }
  }

  return {
    created,
    adminEmail: config.seed.email,
    adminPassword: config.seed.password,
    demoEmail: config.demo.email,
    demoPassword: config.demo.password,
    orgSlug: ORG_SLUG,
  };
}
