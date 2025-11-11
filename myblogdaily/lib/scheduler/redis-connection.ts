/**
 * Upstash Redis 연결 설정
 *
 * 용도:
 * - BullMQ용 Redis 연결
 * - Upstash Redis (서버리스) 사용
 */

import { queueLogger as logger } from '@/lib/utils/logger';
import type { ConnectionOptions } from 'bullmq';

/**
 * Redis 연결 옵션 생성
 *
 * Upstash Redis는 RESP 프로토콜 사용 (REST가 아님)
 * 연결 URL: rediss://default:<password>@<host>:<port>
 */
export function getRedisConnection(): ConnectionOptions {
  // RESP 프로토콜용 UPSTASH_REDIS_URL 사용
  // 형식: rediss://default:password@host:port
  const redisUrl = process.env.UPSTASH_REDIS_URL;

  if (!redisUrl) {
    // 폴백: 별도의 환경 변수 사용
    const host = process.env.UPSTASH_REDIS_HOST || 'localhost';
    const port = parseInt(process.env.UPSTASH_REDIS_PORT || '6379');
    const password = process.env.UPSTASH_REDIS_PASSWORD;

    logger.info('Redis 연결 설정 중... (HOST/PORT/PASSWORD 방식)');

    return {
      host,
      port,
      password,
      tls: password ? {
        rejectUnauthorized: true
      } : undefined,
      maxRetriesPerRequest: 3,
      enableReadyCheck: false,
      enableOfflineQueue: true
    };
  }

  logger.info('Redis 연결 설정 중... (UPSTASH_REDIS_URL)');

  // rediss://default:password@host:port 형식 파싱
  const urlObj = new URL(redisUrl);

  return {
    host: urlObj.hostname,
    port: parseInt(urlObj.port) || 6379,
    password: urlObj.password || '',
    username: urlObj.username || 'default',
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
    // ConnectionOptions를 IORedis.RedisOptions로 변환
    const client = new IORedis(connection as any);
    await client.ping();
    await client.quit();

    logger.success('Redis 연결 성공');
    return true;
  } catch (error) {
    logger.error('Redis 연결 실패', error);
    return false;
  }
}
