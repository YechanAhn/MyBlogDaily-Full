/**
 * 문체 DNA 분석 API
 *
 * POST /api/analyze-dna
 *
 * 기능:
 * 1. 사용자의 수집된 블로그 포스트 조회
 * 2. 텍스트 통계 분석 (형태소 분석 대신)
 * 3. Claude API로 창작 DNA 추출
 * 4. Supabase writing_dna 테이블에 저장
 */

import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { textAnalyzer } from '@/lib/ai/text-analyzer';
import { claudeAnalyzer } from '@/lib/ai/claude-analyzer';
import { asyncHandler, Errors, ApiResponse, handleSupabaseError } from '@/lib/utils';
import { apiLogger as logger } from '@/lib/utils/logger';
import type { CreativeDNA } from '@/lib/ai/types';

/**
 * 요청 바디
 */
interface AnalyzeDNARequest {
  forceReanalyze?: boolean;  // 기존 분석 무시하고 재분석
}

/**
 * 응답
 */
interface AnalyzeDNAResponse {
  success: true;
  creativeDNA: CreativeDNA;
  isNew: boolean;  // 새로 분석했는지, 기존 것인지
}

/**
 * POST /api/analyze-dna
 */
export const POST = asyncHandler(async (req: NextRequest) => {
  const startTime = Date.now();

  // 1. Supabase 클라이언트
  const supabase = createClient();

  // 2. 현재 로그인된 사용자 확인 (세션 검증)
  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

  if (authError || !authUser) {
    throw Errors.UNAUTHORIZED('인증되지 않은 사용자입니다.');
  }

  const userId = authUser.id;

  // 3. 요청 파싱
  const body: AnalyzeDNARequest = await req.json();
  const { forceReanalyze = false } = body;

  logger.info(`문체 DNA 분석 시작: ${userId} (강제 재분석: ${forceReanalyze})`);

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

  // 5. 기존 분석 확인 (강제 재분석이 아닌 경우)
  if (!forceReanalyze) {
    const { data: existingDNA, error: dnaError } = await supabase
      .from('writing_dna')
      .select('creative_dna, analyzed_post_count, updated_at')
      .eq('user_id', userId)
      .single();

    if (!dnaError && existingDNA) {
      logger.info(`기존 분석 발견: ${existingDNA.analyzed_post_count}개 포스트 (${existingDNA.updated_at})`);

      return ApiResponse.ok({
        success: true,
        creativeDNA: existingDNA.creative_dna as CreativeDNA,
        isNew: false
      } as AnalyzeDNAResponse);
    }
  }

  // 6. 블로그 포스트 조회
  logger.info('블로그 포스트 조회 중...');

  const { data: posts, error: postsError } = await supabase
    .from('blog_posts')
    .select('title, content, published_at')
    .eq('user_id', userId)
    .order('published_at', { ascending: false })
    .limit(50);

  if (postsError) {
    logger.error('포스트 조회 실패', postsError);
    handleSupabaseError(postsError);
  }

  if (!posts || posts.length < 10) {
    throw Errors.VALIDATION_ERROR(
      `최소 10개 이상의 포스트가 필요합니다. (현재: ${posts?.length || 0}개)`,
      { count: posts?.length || 0 }
    );
  }

  logger.success(`${posts.length}개 포스트 조회 완료`);

  // 7. 텍스트 통계 분석
  logger.info('텍스트 통계 분석 중...');

  const postTexts = posts.map(p => `${p.title}\n\n${p.content}`);
  const styleMetrics = textAnalyzer.analyzeStyle(postTexts);

  logger.success('텍스트 통계 분석 완료', {
    avgSentenceLength: styleMetrics.avgSentenceLength,
    lexicalDensity: styleMetrics.lexicalDensity
  });

  // 8. Claude API로 창작 DNA 분석
  logger.info('Claude API로 창작 DNA 분석 중...');

  const creativeDNA = await claudeAnalyzer.analyzeCreativeDNA(postTexts, styleMetrics);

  logger.success('창작 DNA 분석 완료', {
    archetype: creativeDNA.persona_profile.archetype,
    mainTopics: creativeDNA.topic_profile.main_topics.map(t => t.topic_name).join(', '),
    contentType: creativeDNA.content_needs.type
  });

  // 9. Supabase에 저장 (upsert)
  logger.info('Supabase에 저장 중...');

  const { error: upsertError } = await supabase
    .from('writing_dna')
    .upsert({
      user_id: userId,
      creative_dna: creativeDNA as any,  // JSONB 타입
      analyzed_post_count: posts.length,
      version: 1
    }, {
      onConflict: 'user_id'
    });

  if (upsertError) {
    logger.error('저장 실패', upsertError);
    handleSupabaseError(upsertError);
  }

  // 10. blog_posts의 is_analyzed 플래그 업데이트
  await supabase
    .from('blog_posts')
    .update({ is_analyzed: true })
    .eq('user_id', userId);

  const duration = Date.now() - startTime;

  logger.success(
    `문체 DNA 분석 완료: ${posts.length}개 포스트 분석 (${duration}ms)`
  );

  // 11. 응답 반환
  return ApiResponse.ok({
    success: true,
    creativeDNA,
    isNew: true
  } as AnalyzeDNAResponse);
});
