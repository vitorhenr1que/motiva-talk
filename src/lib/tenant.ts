import type { User } from '@supabase/supabase-js'

import { AppError, ORGANIZATION_NOT_FOUND_MESSAGE } from '@/lib/api-errors'
import {
  getServerSession,
  getUserWithOrg,
  type UserWithOrganization,
} from '@/lib/auth-server'

export function organizationNotFoundError() {
  return new AppError(ORGANIZATION_NOT_FOUND_MESSAGE, 403, 'FORBIDDEN')
}

export async function getCurrentUser(): Promise<User | null> {
  return getServerSession()
}

export async function getCurrentUserWithOrganization(): Promise<UserWithOrganization | null> {
  const user = await getCurrentUser()

  if (!user?.email) return null

  return getUserWithOrg(user.email)
}

export async function getCurrentOrganizationId(): Promise<string | null> {
  const user = await getCurrentUserWithOrganization()

  if (!user?.organizationId || !user.organization) return null

  return user.organizationId
}

export async function requireOrganization(): Promise<string> {
  const user = await getCurrentUserWithOrganization()

  if (!user?.organizationId || !user.organization) {
    throw organizationNotFoundError()
  }

  return user.organizationId
}

export async function requireAdminOrOwner(): Promise<UserWithOrganization & { organizationId: string }> {
  const user = await getCurrentUserWithOrganization()

  if (!user?.organizationId || !user.organization) {
    throw organizationNotFoundError()
  }

  if (user.role !== 'ADMIN' && user.organization.ownerId !== user.id) {
    throw new AppError('Acesso negado', 403, 'FORBIDDEN')
  }

  return { ...user, organizationId: user.organizationId }
}
