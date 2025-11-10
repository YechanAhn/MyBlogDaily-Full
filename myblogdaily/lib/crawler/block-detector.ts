/**
 * 차단 감지 시스템
 *
 * 용도:
 * - 네이버 블로그 크롤링 시 차단 감지
 * - 차단 시 자동 백오프 및 재시도 로직
 * - 차단 신호 패턴 분석
 */

import type { Response } from 'playwright';
import { logger } from '@/lib/utils/logger';

/**
 * 차단 감지 결과
 */
export interface BlockDetection {
  isBlocked: boolean;
  reason?: string;
  retryAfter?: number;  // 밀리초
}

/**
 * 차단 감지 설정
 */
export interface BlockDetectorConfig {
  maxConsecutiveFailures: number;  // 연속 실패 허용 횟수
  baseDelayMs: number;             // 기본 대기 시간
  maxDelayMs: number;              // 최대 대기 시간
  longWaitMs: number;              // 장기 대기 시간 (연속 실패 시)
}

/**
 * 기본 설정
 */
const DEFAULT_CONFIG: BlockDetectorConfig = {
  maxConsecutiveFailures: 3,
  baseDelayMs: 2000,
  maxDelayMs: 16000,
  longWaitMs: 30 * 60 * 1000  // 30분
};

/**
 * 차단 감지 클래스
 */
export class BlockDetector {
  private consecutiveFailures: number = 0;
  private totalBlocks: number = 0;
  private lastBlockTime: number | null = null;
  private config: BlockDetectorConfig;

  constructor(config: Partial<BlockDetectorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * HTTP 응답 분석하여 차단 감지
   */
  async detectBlock(response: Response): Promise<boolean> {
    const url = response.url();
    const status = response.status();

    // 1. HTTP 상태 코드 확인
    if (status === 403 || status === 429) {
      logger.warn(`차단 감지 (HTTP ${status}): ${url}`);
      this.recordBlock('HTTP_STATUS');
      return true;
    }

    // 2. 리다이렉션 확인 (네이버 차단 시 특정 페이지로 리다이렉션)
    if (status === 302 || status === 301) {
      const location = response.headers()['location'];
      if (location && this.isBlockRedirect(location)) {
        logger.warn(`차단 감지 (리다이렉션): ${location}`);
        this.recordBlock('REDIRECT');
        return true;
      }
    }

    // 3. 응답 본문 확인 (CAPTCHA, 차단 메시지)
    try {
      const contentType = response.headers()['content-type'];

      // HTML 응답인 경우만 본문 검사
      if (contentType && contentType.includes('text/html')) {
        const body = await response.text();

        // CAPTCHA 페이지 감지
        if (this.containsCaptcha(body)) {
          logger.warn(`차단 감지 (CAPTCHA): ${url}`);
          this.recordBlock('CAPTCHA');
          return true;
        }

        // 차단 메시지 감지
        if (this.containsBlockMessage(body)) {
          logger.warn(`차단 감지 (차단 메시지): ${url}`);
          this.recordBlock('BLOCK_MESSAGE');
          return true;
        }
      }
    } catch (error) {
      // 본문 읽기 실패는 무시 (이미 소비된 응답일 수 있음)
    }

    return false;
  }

  /**
   * 차단 리다이렉션인지 확인
   */
  private isBlockRedirect(location: string): boolean {
    const blockPatterns = [
      '/error',
      '/block',
      '/captcha',
      '/verify'
    ];

    return blockPatterns.some(pattern => location.includes(pattern));
  }

  /**
   * CAPTCHA 포함 여부 확인
   */
  private containsCaptcha(html: string): boolean {
    const captchaPatterns = [
      'captcha',
      'recaptcha',
      'g-recaptcha',
      '자동입력 방지',
      '로봇이 아닙니다'
    ];

    const lowerHtml = html.toLowerCase();
    return captchaPatterns.some(pattern => lowerHtml.includes(pattern.toLowerCase()));
  }

  /**
   * 차단 메시지 포함 여부 확인
   */
  private containsBlockMessage(html: string): boolean {
    const blockMessages = [
      '접근이 차단',
      '일시적으로 차단',
      '비정상적인 접근',
      '잠시 후 다시',
      'access denied',
      'temporarily blocked'
    ];

    const lowerHtml = html.toLowerCase();
    return blockMessages.some(msg => lowerHtml.includes(msg.toLowerCase()));
  }

  /**
   * 차단 기록
   */
  private recordBlock(reason: string): void {
    this.consecutiveFailures++;
    this.totalBlocks++;
    this.lastBlockTime = Date.now();

    logger.warn(
      `차단 기록: ${reason} (연속 ${this.consecutiveFailures}회, 총 ${this.totalBlocks}회)`
    );
  }

  /**
   * 차단 처리 (백오프 대기)
   */
  async handleBlock(): Promise<void> {
    const delay = this.calculateDelay();

    logger.warn(
      `차단 처리: ${delay}ms 대기 (연속 실패 ${this.consecutiveFailures}회)`
    );

    // 장기 대기가 필요한 경우
    if (this.consecutiveFailures >= this.config.maxConsecutiveFailures) {
      const longDelay = this.config.longWaitMs;
      logger.error(
        `⚠️  연속 ${this.consecutiveFailures}회 차단! ${longDelay / 1000 / 60}분 대기합니다.`
      );

      await this.sleep(longDelay);
      this.consecutiveFailures = 0;  // 리셋
      return;
    }

    // 일반 백오프 대기
    await this.sleep(delay);
  }

  /**
   * 지수 백오프 지연 시간 계산
   */
  private calculateDelay(): number {
    // 2^n * baseDelay (최대 maxDelay)
    const exponentialDelay = Math.pow(2, this.consecutiveFailures - 1) * this.config.baseDelayMs;
    return Math.min(exponentialDelay, this.config.maxDelayMs);
  }

  /**
   * 대기 (sleep)
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 성공 시 리셋
   */
  reset(): void {
    if (this.consecutiveFailures > 0) {
      logger.info(`차단 상태 리셋 (이전 연속 실패: ${this.consecutiveFailures}회)`);
    }
    this.consecutiveFailures = 0;
  }

  /**
   * 통계 조회
   */
  getStats() {
    return {
      consecutiveFailures: this.consecutiveFailures,
      totalBlocks: this.totalBlocks,
      lastBlockTime: this.lastBlockTime,
      isCurrentlyBlocked: this.consecutiveFailures > 0
    };
  }

  /**
   * Rate Limiting: 랜덤 대기
   * 매 요청마다 호출하여 자연스러운 간격 유지
   */
  async randomDelay(minMs: number = 2000, maxMs: number = 5000): Promise<void> {
    const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
    logger.debug(`Rate Limiting: ${delay}ms 대기`);
    await this.sleep(delay);
  }

  /**
   * 상태 메시지
   */
  getStatusMessage(): string {
    if (this.consecutiveFailures === 0) {
      return '✅ 정상';
    }

    if (this.consecutiveFailures >= this.config.maxConsecutiveFailures) {
      return `🔴 장기 대기 중 (${this.consecutiveFailures}회 연속 차단)`;
    }

    return `🟡 주의 (${this.consecutiveFailures}회 연속 차단)`;
  }
}

/**
 * 전역 BlockDetector 인스턴스
 */
export const globalBlockDetector = new BlockDetector();
