import { FeedbackRepository } from '@/repositories/feedbackRepository'
import crypto from 'node:crypto';

export class FeedbackService {
  /**
   * Generates a new feedback request for a contact.
   * If there's an active (PENDING) request in the last 24h, returns it.
   */
  static async requestFeedback(contactId: string, phone: string, conversationId?: string) {
    const last = await FeedbackRepository.findLastByContact(contactId);
    
    if (last) {
      const lastCreatedAt = new Date(last.createdAt).getTime();
      const now = new Date().getTime();
      const diffHours = (now - lastCreatedAt) / (1000 * 60 * 60);

      // If there's a PENDING feedback from the last 24h, reuse it
      if (diffHours < 24 && last.status === 'PENDING') {
         return last;
      }

      // If it's already SUBMITTED in the last 24h, block new submission
      if (diffHours < 24 && last.status === 'SUBMITTED') {
         throw new Error('RECENT_SUBMISSION');
      }
    }

    // Generate a secure public token
    const token = crypto.randomUUID().replace(/-/g, '');
    
    // Window of 24h for submission
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    return await FeedbackRepository.create({
      contactId,
      contactPhone: phone,
      conversationId,
      token,
      expiresAt,
      status: 'PENDING'
    });
  }

  /**
   * Retrieves a feedback request by its public token.
   */
  static async getByToken(token: string) {
    console.log(`[FEEDBACK_LOG] Fetching feedback by token: ${token}`);
    const feedback = await FeedbackRepository.findByToken(token);
    
    if (!feedback) {
      console.log(`[FEEDBACK_LOG] Token not found: ${token}`);
      return null;
    }

    console.log(`[FEEDBACK_LOG] Contact identified: ${feedback.contactId} (${feedback.contact?.name || 'Unknown'})`);

    // Check if link is expired
    const isExpired = new Date(feedback.expiresAt) < new Date();
    if (isExpired && feedback.status === 'PENDING') {
      console.log(`[FEEDBACK_LOG] Token expired: ${token}`);
      return { ...feedback, status: 'EXPIRED' };
    }

    // Check if this contact already submitted ANY feedback in the last 24h
    // This handles both the case where THIS token was already used or another token for same contact was used
    const recent = await FeedbackRepository.findLastSubmittedByContact(feedback.contactId, feedback.contactPhone);
    if (recent && feedback.status === 'PENDING') {
      console.log(`[FEEDBACK_LOG] 24h block active for contact ${feedback.contactId} / ${feedback.contactPhone}. Last submission: ${recent.submittedAt}`);
      return { ...feedback, status: 'RECENT_SUBMISSION' };
    }

    return feedback;
  }

  /**
   * Submits a feedback response.
   */
  static async submitFeedback(token: string, data: { score: number, comment?: string, categoryOptions?: string[] }) {
    console.log(`[FEEDBACK_LOG] Attempting submission for token: ${token}`);
    const feedback = await FeedbackRepository.findByToken(token);
    
    if (!feedback) {
       console.log(`[FEEDBACK_LOG] Submission failed: Token not found ${token}`);
       throw new Error('FEEDBACK_NOT_FOUND');
    }

    if (feedback.status === 'SUBMITTED') {
       console.log(`[FEEDBACK_LOG] Submission failed: Already submitted ${token}`);
       throw new Error('ALREADY_SUBMITTED');
    }
    
    // Check expiration window (24h)
    const isExpired = new Date(feedback.expiresAt) < new Date();
    if (isExpired) {
      console.log(`[FEEDBACK_LOG] Submission failed: Expired link ${token}`);
      throw new Error('FEEDBACK_EXPIRED');
    }

    // Double check 24h block during submission
    const recent = await FeedbackRepository.findLastSubmittedByContact(feedback.contactId, feedback.contactPhone);
    if (recent) {
      console.log(`[FEEDBACK_LOG] 24h block triggered during submission for contact ${feedback.contactId} / ${feedback.contactPhone}`);
      throw new Error('RECENT_SUBMISSION');
    }

    const updated = await FeedbackRepository.update(feedback.id, {
      score: data.score,
      comment: data.comment || '',
      categoryOptions: data.categoryOptions || [],
      status: 'SUBMITTED',
      submittedAt: new Date().toISOString()
    });

    console.log(`[FEEDBACK_LOG] Submission successful for contact ${feedback.contactId}. ID: ${updated.id}`);
    return updated;
  }

  /**
   * Admin: List all submitted feedbacks with optional filters.
   */
  static async listFeedbacks(filters: any) {
    return await FeedbackRepository.findAll(filters);
  }

  /**
   * Admin: Get summary statistics for feedbacks.
   */
  static async getFeedbackSummary(filters: any) {
    return await FeedbackRepository.getSummary(filters);
  }
}
