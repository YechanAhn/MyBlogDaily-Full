/**
 * 뉴스레터 발송 큐
 *
 * 용도:
 * - 뉴스레터 발송 작업 스케줄링
 * - Cron 작업 (매일 아침 7시)
 * - 재시도 로직
 */

import { Queue, QueueEvents } from 'bullmq';
import { getRedisConnection } from './redis-connection';
import { queueLogger as logger } from '@/lib/utils/logger';

/**
 * 뉴스레터 작업 데이터
 */
export interface NewsletterJobData {
  userId: string;           // 사용자 ID
  userEmail: string;        // 사용자 이메일
  userName: string;         // 사용자 이름
  scheduledAt: string;      // 예약 시간 (ISO 8601)
}

/**
 * 큐 이름
 */
export const NEWSLETTER_QUEUE_NAME = 'newsletter';

/**
 * 뉴스레터 큐 클래스
 */
class NewsletterQueue {
  private queue: Queue<NewsletterJobData>;
  private events: QueueEvents;

  constructor() {
    const connection = getRedisConnection();

    this.queue = new Queue<NewsletterJobData>(NEWSLETTER_QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts: 3,                    // 최대 3번 재시도
        backoff: {
          type: 'exponential',          // 지수 백오프 (2초, 4초, 8초)
          delay: 2000
        },
        removeOnComplete: {
          age: 7 * 24 * 60 * 60,        // 7일 후 완료된 작업 삭제
          count: 1000                   // 최대 1000개 보관
        },
        removeOnFail: {
          age: 30 * 24 * 60 * 60        // 30일 후 실패한 작업 삭제
        }
      }
    });

    this.events = new QueueEvents(NEWSLETTER_QUEUE_NAME, { connection });

    this.setupEventListeners();

    logger.success('뉴스레터 큐 초기화 완료');
  }

  /**
   * 이벤트 리스너 설정
   */
  private setupEventListeners(): void {
    this.events.on('completed', ({ jobId }) => {
      logger.success(`작업 완료: ${jobId}`);
    });

    this.events.on('failed', ({ jobId, failedReason }) => {
      logger.error(`작업 실패: ${jobId}`, { reason: failedReason });
    });

    this.events.on('progress', ({ jobId, data }) => {
      logger.info(`작업 진행 중: ${jobId}`, data);
    });
  }

  /**
   * 즉시 작업 추가 (테스트용)
   */
  async addJob(data: NewsletterJobData): Promise<string> {
    logger.info('뉴스레터 작업 추가', {
      userId: data.userId,
      email: data.userEmail
    });

    const job = await this.queue.add('send-newsletter', data);

    logger.success(`작업 추가 완료: ${job.id}`);

    return job.id || 'unknown';
  }

  /**
   * 매일 반복 작업 추가 (Cron)
   */
  async addDailyJob(data: NewsletterJobData, cronTime: string = '0 7 * * *'): Promise<void> {
    logger.info('매일 반복 작업 추가', {
      userId: data.userId,
      cronTime
    });

    await this.queue.add('send-newsletter-daily', data, {
      repeat: {
        pattern: cronTime  // 매일 아침 7시 (한국 시간 기준: 0 22 * * * UTC)
      },
      jobId: `daily-${data.userId}`  // 사용자별 고유 ID
    });

    logger.success('매일 반복 작업 설정 완료');
  }

  /**
   * 특정 사용자의 반복 작업 제거
   */
  async removeDailyJob(userId: string): Promise<void> {
    const jobId = `daily-${userId}`;

    logger.info(`반복 작업 제거: ${jobId}`);

    await this.queue.removeRepeatableByKey(jobId);

    logger.success('반복 작업 제거 완료');
  }

  /**
   * 모든 반복 작업 조회
   */
  async getRepeatableJobs() {
    const jobs = await this.queue.getRepeatableJobs();

    logger.info(`반복 작업 개수: ${jobs.length}`);

    return jobs;
  }

  /**
   * 큐 통계
   */
  async getStats() {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
      this.queue.getDelayedCount()
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed
    };
  }

  /**
   * 큐 정리 (완료/실패 작업 삭제)
   */
  async cleanup(): Promise<void> {
    logger.info('큐 정리 중...');

    await this.queue.clean(7 * 24 * 60 * 60 * 1000, 1000, 'completed');  // 7일 이상된 완료 작업
    await this.queue.clean(30 * 24 * 60 * 60 * 1000, 1000, 'failed');    // 30일 이상된 실패 작업

    logger.success('큐 정리 완료');
  }

  /**
   * 큐 종료
   */
  async close(): Promise<void> {
    await this.queue.close();
    await this.events.close();

    logger.info('뉴스레터 큐 종료');
  }
}

/**
 * 전역 뉴스레터 큐 인스턴스
 */
export const newsletterQueue = new NewsletterQueue();
