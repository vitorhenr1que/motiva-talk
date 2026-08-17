import { AppError } from '@/lib/api-errors';
import { organizationRepository } from '@/repositories/organizationRepository';

export class LimitsService {
  /** Garante apenas que o ambiente interno existe; a edição standalone não possui cotas. */
  static async assertOrganizationActive(organizationId: string): Promise<void> {
    const org = await organizationRepository.findById(organizationId);

    if (!org) {
      throw new AppError('Organização não encontrada', 404, 'NOT_FOUND');
    }

  }

  static async checkCanCreateChannel(organizationId: string): Promise<void> {
    await this.assertOrganizationActive(organizationId);
  }

  static async checkCanInviteUser(organizationId: string): Promise<void> {
    await this.assertOrganizationActive(organizationId);
  }

  static async checkCanSendMessage(organizationId: string): Promise<void> {
    await this.assertOrganizationActive(organizationId);
  }
}
