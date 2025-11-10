/**
 * 콘텐츠 큐레이션 + 초안 작성 API
 *
 * POST /api/curate
 *
 * 기능:
 * 1. 사용자의 creativeDNA 조회
 * 2. 큐레이션 실행 (Naver Search API)
 * 3. Claude로 블로그 초안 작성
 * 4. Supabase curated_items 테이블에 저장
 */

import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { curator, type CurationOptions } from '@/lib/curation';
import { draftWriter, type DraftOptions } from '@/lib/ai';
import { asyncHandler, Errors, ApiResponse, handleSupabaseError } from '@/lib/utils';
import { apiLogger as logger } from '@/lib/utils/logger';
import type { CreativeDNA } from '@/lib/ai/types';
import type { BlogDraft } from '@/lib/ai/draft-writer';

/**
 * 요청 바디
 */
interface CurateRequest {
  userId: string;
  curationOptions?: CurationOptions;  // 큐레이션 옵션
  draftOptions?: DraftOptions;        // 초안 옵션
  saveToDatabase?: boolean;           // DB 저장 여부 (기본: true)
}

/**
 * 응답
 */
interface CurateResponse {
  success: true;
  curated: {
    items: any[];
    count: number;
    keywords: string[];
  };
  drafts: BlogDraft[];
  savedIds?: string[];  // 저장된 curated_items의 ID들
}

/**
 * POST /api/curate
 */
export const POST = asyncHandler(async (req: NextRequest) => {
  const startTime = Date.now();

  // 1. 요청 파싱
  const body: CurateRequest = await req.json();
  const {
    userId,
    curationOptions = {},
    draftOptions = {},
    saveToDatabase = true
  } = body;

  logger.info(`큐레이션 시작: ${userId}`);

  // 2. 파라미터 검증
  if (!userId) {
    throw Errors.BAD_REQUEST('userId가 필요합니다.');
  }

  // 3. Supabase 클라이언트
  const supabase = createClient();

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

  // 5. writing_dna 조회
  logger.info('writing_dna 조회 중...');

  const { data: dnaRecord, error: dnaError } = await supabase
    .from('writing_dna')
    .select('creative_dna')
    .eq('user_id', userId)
    .single();

  if (dnaError || !dnaRecord) {
    logger.error('writing_dna를 찾을 수 없음', dnaError);
    throw Errors.NOT_FOUND('writing_dna (먼저 /api/analyze-dna로 문체 분석을 진행해주세요.)');
  }

  const creativeDNA = dnaRecord.creative_dna as CreativeDNA;

  logger.success('creativeDNA 조회 완료', {
    archetype: creativeDNA.persona_profile.archetype,
    contentType: creativeDNA.content_needs.type
  });

  // 6. 큐레이션 실행
  logger.info('콘텐츠 큐레이션 중...');

  const curationResult = await curator.curateContent(creativeDNA, {
    maxItems: 10,
    itemsPerKeyword: 5,
    useNews: true,
    useBlog: true,
    ...curationOptions
  });

  logger.success(
    `큐레이션 완료: ${curationResult.items.length}개 아이템 선택 (검색: ${curationResult.totalSearched}개)`,
    {
      keywords: curationResult.keywords.slice(0, 3).join(', ')
    }
  );

  // 7. 초안 작성
  logger.info('블로그 초안 작성 중...');

  const draftResult = await draftWriter.generateDrafts(
    creativeDNA,
    curationResult.items,
    {
      numDrafts: 3,
      minLength: 500,
      maxLength: 2000,
      ...draftOptions
    }
  );

  logger.success(`초안 작성 완료: ${draftResult.drafts.length}개 초안`);

  // 8. DB에 저장 (선택)
  let savedIds: string[] | undefined;

  if (saveToDatabase) {
    logger.info('Supabase에 저장 중...');

    // curated_items 테이블에 저장
    const itemsToInsert = curationResult.items.map(item => ({
      user_id: userId,
      title: item.title,
      url: item.url,
      summary: item.summary,
      source: item.source,
      published_at: item.publishedAt,
      keyword: item.keyword,
      score: item.score,
      type: item.type,
      is_used: false  // 아직 사용되지 않음
    }));

    const { data: insertedItems, error: insertError } = await supabase
      .from('curated_items')
      .insert(itemsToInsert)
      .select('id');

    if (insertError) {
      logger.error('curated_items 저장 실패', insertError);
      handleSupabaseError(insertError);
    }

    savedIds = insertedItems?.map(item => item.id) || [];

    logger.success(`${savedIds.length}개 아이템 저장 완료`);
  }

  const duration = Date.now() - startTime;

  logger.success(
    `큐레이션 + 초안 작성 완료 (${duration}ms)`,
    {
      curatedCount: curationResult.items.length,
      draftsCount: draftResult.drafts.length
    }
  );

  // 9. 응답 반환
  return ApiResponse.ok({
    success: true,
    curated: {
      items: curationResult.items,
      count: curationResult.items.length,
      keywords: curationResult.keywords
    },
    drafts: draftResult.drafts,
    savedIds
  } as CurateResponse);
});
