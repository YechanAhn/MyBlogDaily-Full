import { Redis } from '@upstash/redis';

// Upstash Redis 클라이언트 (환경변수 없으면 null)
let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  try {
    redis = new Redis({ url, token });
    return redis;
  } catch (err) {
    console.error('Redis 연결 실패:', err);
    return null;
  }
}

/**
 * 캐시 조회 - 실패 시 null 반환 (graceful fallback)
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const client = getRedis();
    if (!client) return null;
    const data = await client.get<T>(key);
    return data ?? null;
  } catch (err) {
    console.error('Redis GET 실패:', err);
    return null;
  }
}

/**
 * 캐시 저장 - TTL은 초 단위, 실패해도 무시
 */
export async function cacheSet<T>(key: string, data: T, ttlSeconds: number): Promise<void> {
  try {
    const client = getRedis();
    if (!client) return;
    await client.set(key, data, { ex: ttlSeconds });
  } catch (err) {
    console.error('Redis SET 실패:', err);
  }
}

/**
 * 여러 키 일괄 조회 - mget (Upstash pipeline 사용)
 */
export async function cacheMGet<T>(keys: string[]): Promise<(T | null)[]> {
  try {
    const client = getRedis();
    if (!client || keys.length === 0) return keys.map(() => null);
    const results = await client.mget<(T | null)[]>(...keys);
    return results.map(r => r ?? null);
  } catch (err) {
    console.error('Redis MGET 실패:', err);
    return keys.map(() => null);
  }
}

/**
 * 대량 키-값 파이프라인 저장 (Upstash pipeline 사용)
 * - 개별 SET 대신 파이프라인으로 묶어서 호출 (API 요청 수 절약)
 * - 200개씩 배치 처리 (Upstash body size 제한 대응)
 */
export async function cachePipelineSet<T>(
  entries: { key: string; value: T; ttl: number }[]
): Promise<number> {
  try {
    const client = getRedis();
    if (!client || entries.length === 0) return 0;

    let saved = 0;
    const BATCH_SIZE = 200;

    for (let i = 0; i < entries.length; i += BATCH_SIZE) {
      const batch = entries.slice(i, i + BATCH_SIZE);
      const pipeline = client.pipeline();
      for (const { key, value, ttl } of batch) {
        pipeline.set(key, value, { ex: ttl });
      }
      await pipeline.exec();
      saved += batch.length;
    }

    return saved;
  } catch (err) {
    console.error('Redis Pipeline SET 실패:', err);
    return 0;
  }
}

/**
 * 에러 카운터 증가 (health monitoring 용)
 */
export async function incrementErrorCount(apiName: string): Promise<void> {
  try {
    const client = getRedis();
    if (!client) return;
    const key = `errors:${apiName}:${new Date().toISOString().slice(0, 13)}`;
    await client.incr(key);
    await client.expire(key, 86400);
  } catch {
    // 에러 추적 실패는 무시
  }
}

/**
 * 에러 카운터 조회
 */
export async function getErrorCount(apiName: string): Promise<number> {
  try {
    const client = getRedis();
    if (!client) return 0;
    const key = `errors:${apiName}:${new Date().toISOString().slice(0, 13)}`;
    const count = await client.get<number>(key);
    return count ?? 0;
  } catch {
    return 0;
  }
}
