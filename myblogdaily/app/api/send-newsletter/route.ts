/**
 * 뉴스레터 발송 API
 *
 * POST /api/send-newsletter
 *
 * 기능:
 * 1. 즉시 발송: 큐에 작업 추가하여 즉시 실행
 * 2. 스케줄 설정: 매일 반복 작업 설정
 * 3. 스케줄 해제: 매일 반복 작업 제거
 */

import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { newsletterQueue } from '@/lib/scheduler';
import { asyncHandler, Errors, ApiResponse } from '@/lib/utils';
import { apiLogger as logger } from '@/lib/utils/logger';

/**
 * 요청 바디
 */
interface SendNewsletterRequest {
  action: 'send-now' | 'schedule-daily' | 'unschedule';  // 액션
  cronTime?: string;  // Cron 표현식 (schedule-daily 시)
}

/**
 * 응답
 */
interface SendNewsletterResponse {
  success: true;
  action: string;
  jobId?: string;       // 작업 ID (send-now)
  message: string;
}

/**
 * POST /api/send-newsletter
 */
export const POST = asyncHandler(async (req: NextRequest) => {
  // 1. Supabase 클라이언트
  const supabase = createClient();

  // 2. 현재 로그인된 사용자 확인 (세션 검증)
  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

  if (authError || !authUser) {
    throw Errors.UNAUTHORIZED('인증되지 않은 사용자입니다.');
  }

  const userId = authUser.id;

  // 3. 요청 파싱
  const body: SendNewsletterRequest = await req.json();
  const { action, cronTime = '0 7 * * *' } = body;

  logger.info(`뉴스레터 API 호출: ${action} (userId: ${userId})`);

  // 4. 파라미터 검증
  if (!['send-now', 'schedule-daily', 'unschedule'].includes(action)) {
    throw Errors.BAD_REQUEST('action은 send-now, schedule-daily, unschedule 중 하나여야 합니다.');
  }

  // 4. 사용자 확인
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id, email, name')
    .eq('id', userId)
    .single();

  if (userError || !user) {
    logger.error(`사용자를 찾을 수 없음: ${userId}`, userError);
    throw Errors.NOT_FOUND('사용자');
  }

  // 5. writing_dna 확인 (필수)
  const { data: dnaRecord, error: dnaError } = await supabase
    .from('writing_dna')
    .select('id')
    .eq('user_id', userId)
    .single();

  if (dnaError || !dnaRecord) {
    throw Errors.NOT_FOUND('writing_dna (먼저 /api/analyze-dna로 문체 분석을 진행해주세요.)');
  }

  // 6. 액션 처리
  let response: SendNewsletterResponse;

  switch (action) {
    case 'send-now': {
      // 즉시 발송
      logger.info('즉시 발송 작업 추가 중...');

      const jobId = await newsletterQueue.addJob({
        userId,
        userEmail: user.email,
        userName: user.name || '사용자',
        scheduledAt: new Date().toISOString()
      });

      logger.success(`즉시 발송 작업 추가 완료: ${jobId}`);

      response = {
        success: true,
        action: 'send-now',
        jobId,
        message: '뉴스레터 발송 작업이 큐에 추가되었습니다. 곧 발송됩니다.'
      };
      break;
    }

    case 'schedule-daily': {
      // 매일 반복 작업 설정
      logger.info(`매일 반복 작업 설정 중... (Cron: ${cronTime})`);

      await newsletterQueue.addDailyJob(
        {
          userId,
          userEmail: user.email,
          userName: user.name || '사용자',
          scheduledAt: new Date().toISOString()
        },
        cronTime
      );

      logger.success('매일 반복 작업 설정 완료');

      response = {
        success: true,
        action: 'schedule-daily',
        message: `매일 반복 작업이 설정되었습니다. (Cron: ${cronTime})`
      };
      break;
    }

    case 'unschedule': {
      // 반복 작업 제거
      logger.info('반복 작업 제거 중...');

      await newsletterQueue.removeDailyJob(userId);

      logger.success('반복 작업 제거 완료');

      response = {
        success: true,
        action: 'unschedule',
        message: '매일 반복 작업이 해제되었습니다.'
      };
      break;
    }

    default: {
      throw Errors.BAD_REQUEST('알 수 없는 액션입니다.');
    }
  }

  // 7. 응답 반환
  return ApiResponse.ok(response);
});

/**
 * GET /api/send-newsletter (큐 통계 조회)
 */
export const GET = asyncHandler(async (req: NextRequest) => {
  logger.info('큐 통계 조회');

  // 큐 통계
  const stats = await newsletterQueue.getStats();

  // 반복 작업 목록
  const repeatableJobs = await newsletterQueue.getRepeatableJobs();

  logger.success('큐 통계 조회 완료');

  return ApiResponse.ok({
    success: true,
    stats,
    repeatableJobs: repeatableJobs.map(job => ({
      key: job.key,
      name: job.name,
      pattern: job.pattern,
      next: job.next
    }))
  });
});
