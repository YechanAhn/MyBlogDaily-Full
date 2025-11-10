/**
 * Resend API 클라이언트
 *
 * 용도:
 * - 이메일 발송
 * - 뉴스레터 전송
 * - HTML 템플릿 렌더링
 */

import { Resend } from 'resend';
import { getEnv } from '@/lib/utils/env-validator';
import { Errors } from '@/lib/utils/error-handler';
import { logger } from '@/lib/utils/logger';

/**
 * 이메일 옵션
 */
export interface EmailOptions {
  to: string | string[];           // 수신자 이메일
  subject: string;                  // 제목
  html: string;                     // HTML 본문
  from?: string;                    // 발신자 (기본: RESEND_FROM_EMAIL)
  replyTo?: string;                 // 답장 주소
  cc?: string | string[];           // 참조
  bcc?: string | string[];          // 숨은 참조
}

/**
 * 이메일 발송 결과
 */
export interface EmailResult {
  id: string;         // Resend에서 생성한 이메일 ID
  success: boolean;   // 발송 성공 여부
}

/**
 * Resend 클라이언트 클래스
 */
export class ResendClient {
  private client: Resend;
  private defaultFrom: string;

  constructor() {
    const apiKey = getEnv('RESEND_API_KEY');
    this.defaultFrom = getEnv('RESEND_FROM_EMAIL');
    this.client = new Resend(apiKey);
  }

  /**
   * 이메일 발송
   */
  async sendEmail(options: EmailOptions): Promise<EmailResult> {
    const { to, subject, html, from, replyTo, cc, bcc } = options;

    logger.info('이메일 발송 중', {
      to: Array.isArray(to) ? to.join(', ') : to,
      subject
    });

    try {
      const { data, error } = await this.client.emails.send({
        from: from || this.defaultFrom,
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
        reply_to: replyTo,
        cc: cc ? (Array.isArray(cc) ? cc : [cc]) : undefined,
        bcc: bcc ? (Array.isArray(bcc) ? bcc : [bcc]) : undefined
      });

      if (error) {
        logger.error('이메일 발송 실패', error);
        throw Errors.EXTERNAL_API_ERROR('Resend', error.message);
      }

      if (!data?.id) {
        throw Errors.EXTERNAL_API_ERROR('Resend', '이메일 ID를 받지 못했습니다.');
      }

      logger.success(`이메일 발송 완료: ${data.id}`);

      return {
        id: data.id,
        success: true
      };

    } catch (error) {
      if (error instanceof Error && error.message.includes('429')) {
        throw Errors.TOKEN_LIMIT_EXCEEDED('Resend API 요청 한도 초과');
      }
      throw error;
    }
  }

  /**
   * 여러 수신자에게 일괄 발송
   */
  async sendBulkEmails(
    recipients: string[],
    subject: string,
    html: string
  ): Promise<EmailResult[]> {
    logger.info(`일괄 이메일 발송: ${recipients.length}명`);

    const results = await Promise.allSettled(
      recipients.map(to =>
        this.sendEmail({ to, subject, html })
      )
    );

    const succeeded = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    logger.info(`일괄 발송 완료: 성공 ${succeeded}, 실패 ${failed}`);

    return results
      .filter((r): r is PromiseFulfilledResult<EmailResult> => r.status === 'fulfilled')
      .map(r => r.value);
  }
}

/**
 * 전역 Resend 클라이언트 인스턴스
 */
export const resendClient = new ResendClient();
