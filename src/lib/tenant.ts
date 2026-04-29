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

  // Permitir acesso se for admin da plataforma ou se a organização estiver ativa
  if (user.isPlatformAdmin || user.organization.status === 'ACTIVE') {
    return user.organizationId
  }

  return null
}

export async function requireOrganization(): Promise<string> {
  const user = await getCurrentUserWithOrganization()

  if (!user?.organizationId || !user.organization) {
    throw organizationNotFoundError()
  }

  if (!user.isPlatformAdmin && user.organization.status !== 'ACTIVE') {
    throw new AppError('Organização bloqueada. Entre em contato com o suporte.', 403, 'ORGANIZATION_BLOCKED')
  }

  return user.organizationId
}

export async function requireAdminOrOwner(): Promise<UserWithOrganization> {
  const user = await getCurrentUserWithOrganization()

  if (!user?.organizationId || !user.organization) {
    throw organizationNotFoundError()
  }

  if (user.role !== 'ADMIN' && user.organization.ownerId !== user.id) {
    throw new AppError('Acesso negado', 403, 'FORBIDDEN')
  }

  return user
}
