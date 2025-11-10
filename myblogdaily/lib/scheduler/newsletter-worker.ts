/**
 * 뉴스레터 Worker
 *
 * 용도:
 * - 큐에서 작업을 가져와 실제 뉴스레터 발송
 * - 큐레이션 → 초안 작성 → 이메일 발송
 */

import { Worker, Job } from 'bullmq';
import { getRedisConnection } from './redis-connection';
import { NEWSLETTER_QUEUE_NAME, type NewsletterJobData } from './newsletter-queue';
import { queueLogger as logger } from '@/lib/utils/logger';
import { createClient } from '@/lib/supabase/server';
import { curator } from '@/lib/curation';
import { draftWriter } from '@/lib/ai';
import { resendClient, generateNewsletterHTML } from '@/lib/email';
import type { CreativeDNA } from '@/lib/ai/types';

/**
 * 뉴스레터 발송 처리
 */
async function processNewsletterJob(job: Job<NewsletterJobData>): Promise<void> {
  const { userId, userEmail, userName, scheduledAt } = job.data;

  logger.info(`뉴스레터 작업 시작: ${userId} (${userEmail})`);

  // 진행률 업데이트
  await job.updateProgress(10);

  try {
    // 1. Supabase 클라이언트
    const supabase = createClient();

    // 2. writing_dna 조회
    logger.info('writing_dna 조회 중...');

    const { data: dnaRecord, error: dnaError } = await supabase
      .from('writing_dna')
      .select('creative_dna')
      .eq('user_id', userId)
      .single();

    if (dnaError || !dnaRecord) {
      throw new Error('writing_dna를 찾을 수 없습니다.');
    }

    const creativeDNA = dnaRecord.creative_dna as CreativeDNA;

    await job.updateProgress(20);

    // 3. 큐레이션 실행
    logger.info('콘텐츠 큐레이션 중...');

    const curationResult = await curator.curateContent(creativeDNA, {
      maxItems: 10,
      itemsPerKeyword: 5,
      useNews: true,
      useBlog: true
    });

    logger.success(`큐레이션 완료: ${curationResult.items.length}개 아이템`);

    await job.updateProgress(50);

    // 4. 초안 작성
    logger.info('블로그 초안 작성 중...');

    const draftResult = await draftWriter.generateDrafts(
      creativeDNA,
      curationResult.items,
      {
        numDrafts: 3,
        minLength: 500,
        maxLength: 2000
      }
    );

    logger.success(`초안 작성 완료: ${draftResult.drafts.length}개 초안`);

    await job.updateProgress(70);

    // 5. 이메일 HTML 생성
    logger.info('이메일 템플릿 생성 중...');

    const emailHTML = generateNewsletterHTML({
      userName,
      curatedItems: curationResult.items,
      drafts: draftResult.drafts,
      date: scheduledAt || new Date().toISOString()
    });

    await job.updateProgress(80);

    // 6. 이메일 발송
    logger.info('이메일 발송 중...');

    const emailResult = await resendClient.sendEmail({
      to: userEmail,
      subject: `📰 MyBlogDaily - ${new Date().toLocaleDateString('ko-KR')} 뉴스레터`,
      html: emailHTML
    });

    logger.success(`이메일 발송 완료: ${emailResult.id}`);

    await job.updateProgress(90);

    // 7. DB에 저장 (newsletters 테이블)
    logger.info('DB에 저장 중...');

    const { error: newsletterError } = await supabase
      .from('newsletters')
      .insert({
        user_id: userId,
        curated_item_ids: curationResult.items.map((_, i) => `item-${i}`),  // 실제로는 curated_items의 ID
        draft_content: draftResult.drafts[0].content,  // 첫 번째 초안 저장
        sent_at: new Date().toISOString(),
        email_id: emailResult.id,
        status: 'sent'
      });

    if (newsletterError) {
      logger.error('newsletters 저장 실패', newsletterError);
      // 에러가 나도 이메일은 발송되었으므로 작업은 성공으로 처리
    } else {
      logger.success('DB 저장 완료');
    }

    await job.updateProgress(100);

    logger.success(`뉴스레터 작업 완료: ${userId}`);

  } catch (error) {
    logger.error('뉴스레터 작업 실패', error);
    throw error;  // Worker가 재시도하도록 에러 throw
  }
}

/**
 * Worker 시작
 */
export function startNewsletterWorker(): Worker<NewsletterJobData> {
  const connection = getRedisConnection();

  const worker = new Worker<NewsletterJobData>(
    NEWSLETTER_QUEUE_NAME,
    processNewsletterJob,
    {
      connection,
      concurrency: 5,  // 동시에 5개 작업 처리
      limiter: {
        max: 10,       // 1분당 최대 10개 작업
        duration: 60000
      }
    }
  );

  worker.on('completed', (job) => {
    logger.success(`Worker 작업 완료: ${job.id}`);
  });

  worker.on('failed', (job, error) => {
    logger.error(`Worker 작업 실패: ${job?.id}`, error);
  });

  logger.success('뉴스레터 Worker 시작됨 (동시성: 5)');

  return worker;
}
