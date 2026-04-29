import { AppError } from '@/lib/api-errors'
import {
  getServerSession,
  getUserWithOrg,
  type UserWithOrganization,
} from '@/lib/auth-server'

export async function requirePlatformAdmin(): Promise<UserWithOrganization> {
  const session = await getServerSession()

  if (!session?.email) {
    throw new AppError('Não autorizado', 401, 'AUTH_ERROR')
  }

  const user = await getUserWithOrg(session.email)

  if (!user || user.isPlatformAdmin !== true) {
    throw new AppError(
      'Acesso restrito ao painel da plataforma',
      403,
      'PLATFORM_ADMIN_REQUIRED'
    )
  }

  return user
}
