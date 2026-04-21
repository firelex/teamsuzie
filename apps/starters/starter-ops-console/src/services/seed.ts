import {
  Organization,
  OrganizationMember,
  User,
  UserService,
} from '@teamsuzie/shared-auth';
import { Contact } from '../models/contact.js';
import { config, sharedAuthConfig } from '../config.js';

interface SeedSummary {
  created: boolean;
  adminEmail: string;
  adminPassword: string;
  demoEmail: string;
  demoPassword: string;
  orgSlug: string;
  contactsCreated: number;
}

const adminEmail = process.env.SEED_EMAIL || 'admin@example.com';
const adminPassword = process.env.SEED_PASSWORD || 'admin12345';
const adminName = process.env.SEED_NAME || 'Ops Admin';

const demoEmail = config.demo.email;
const demoPassword = config.demo.password;
const demoName = config.demo.name;

const ORG_SLUG = 'ops-console-demo';
const ORG_NAME = 'Ops Console Demo';

/**
 * Idempotent — creates admin/demo users, a demo organization, and sample
 * contacts only if they don't already exist. Safe to call on every boot.
 * Returns `created: true` when anything new was inserted.
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

  const admin = await upsertUser(adminEmail, adminPassword, adminName, 'admin');
  const demo = await upsertUser(demoEmail, demoPassword, demoName, 'user');

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

  let contactsCreated = 0;
  const existingContacts = await Contact.count({ where: { organization_id: org.id } });
  if (existingContacts === 0) {
    const rows = await Contact.bulkCreate([
      {
        organization_id: org.id,
        name: 'Ada Lovelace',
        email: 'ada@analytical-engines.co',
        company: 'Analytical Engines',
        notes: 'First on the platform — VIP.',
        created_by: admin.id,
        updated_by: admin.id,
      },
      {
        organization_id: org.id,
        name: 'Grace Hopper',
        email: 'grace@navy.mil',
        company: 'US Navy',
        notes: 'Compiler enthusiast.',
        created_by: admin.id,
        updated_by: admin.id,
      },
      {
        organization_id: org.id,
        name: 'Alan Turing',
        email: 'alan@bletchley.uk',
        company: 'Bletchley Park',
        notes: null,
        created_by: admin.id,
        updated_by: admin.id,
      },
    ]);
    contactsCreated = rows.length;
    created = true;
  }

  return {
    created,
    adminEmail,
    adminPassword,
    demoEmail,
    demoPassword,
    orgSlug: ORG_SLUG,
    contactsCreated,
  };
}
