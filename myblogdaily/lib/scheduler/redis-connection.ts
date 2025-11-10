/**
 * Upstash Redis 연결 설정
 *
 * 용도:
 * - BullMQ용 Redis 연결
 * - Upstash Redis (서버리스) 사용
 */

import { getEnv } from '@/lib/utils/env-validator';
import { queueLogger as logger } from '@/lib/utils/logger';
import type { ConnectionOptions } from 'bullmq';

/**
 * Redis 연결 옵션 생성
 */
export function getRedisConnection(): ConnectionOptions {
  const url = getEnv('UPSTASH_REDIS_REST_URL');
  const token = getEnv('UPSTASH_REDIS_REST_TOKEN');

  logger.info('Redis 연결 설정 중...');

  // Upstash Redis REST URL에서 호스트와 포트 추출
  const urlObj = new URL(url);

  return {
    host: urlObj.hostname,
    port: parseInt(urlObj.port) || 6379,
    password: token,
    tls: {
      // Upstash는 TLS 필수
      rejectUnauthorized: true
    },
    maxRetriesPerRequest: 3,
    enableReadyCheck: false,
    enableOfflineQueue: true
  };
}

/**
 * Redis 연결 테스트
 */
export async function testRedisConnection(): Promise<boolean> {
  const IORedis = (await import('ioredis')).default;
  const connection = getRedisConnection();

  try {
    const client = new IORedis(connection);
    await client.ping();
    await client.quit();

    logger.success('Redis 연결 성공');
    return true;
  } catch (error) {
    logger.error('Redis 연결 실패', error);
    return false;
  }
}
