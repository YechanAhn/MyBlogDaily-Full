/**
 * 이메일 모듈 통합 export
 */

// Resend 클라이언트
export {
  ResendClient,
  resendClient
} from './resend-client';

export type {
  EmailOptions,
  EmailResult
} from './resend-client';

// 뉴스레터 템플릿
export {
  generateNewsletterHTML,
  generateNewsletterText
} from './newsletter-template';

export type {
  NewsletterData
} from './newsletter-template';
