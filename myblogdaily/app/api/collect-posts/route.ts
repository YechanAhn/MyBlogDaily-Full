/**
 * 블로그 포스트 수집 API
 *
 * POST /api/collect-posts
 *
 * 기능:
 * 1. RSS로 포스트 링크 목록 확보
 * 2. Playwright로 각 포스트 본문 크롤링
 * 3. Supabase에 저장
 */

import { NextRequest } from 'next/server';
import { fetchNaverBlogPosts } from '@/lib/crawler/rss-parser';
import { crawler } from '@/lib/crawler/playwright-crawler';
import { createClient } from '@/lib/supabase/server';
import { asyncHandler, Errors, ApiResponse, handleSupabaseError } from '@/lib/utils';
import { apiLogger as logger } from '@/lib/utils/logger';

/**
 * 요청 바디 타입
 */
interface CollectPostsRequest {
  userId: string;
  blogId: string;
  limit?: number;  // 수집할 포스트 수 (기본: 50)
}

/**
 * 응답 타입
 */
interface CollectPostsResponse {
  success: true;
  collected: number;
  failed: number;
  skipped: number;  // 이미 존재하는 포스트
  duration: number;
  posts: Array<{
    title: string;
    url: string;
    status: 'success' | 'failed' | 'skipped';
    error?: string;
  }>;
}

/**
 * POST /api/collect-posts
 */
export const POST = asyncHandler(async (req: NextRequest) => {
  const startTime = Date.now();

  // 1. 현재 로그인된 사용자 확인
  const supabase = await createClient();
  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

  if (authError || !authUser) {
    throw Errors.UNAUTHORIZED('인증되지 않은 사용자입니다.');
  }

  // 2. 사용자 정보 조회 (blogId 가져오기)
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('naver_blog_id, naver_blog_url')
    .eq('id', authUser.id)
    .single();

  if (userError || !userData || !userData.naver_blog_id) {
    throw Errors.BAD_REQUEST('블로그 정보가 설정되지 않았습니다. 먼저 설정 페이지에서 블로그 URL을 저장해주세요.');
  }

  const userId = authUser.id;
  const blogId = userData.naver_blog_id;
  const limit = 50; // 기본값

  logger.info(`블로그 포스트 수집 시작: ${blogId} (사용자: ${userId}, 최대: ${limit}개)`);

  // 3. RSS로 포스트 링크 목록 확보
  logger.info(`📡 RSS 피드 파싱: ${blogId}`);
  const rssResult = await fetchNaverBlogPosts(blogId, limit);

  if (!rssResult.success) {
    logger.error(`RSS 파싱 실패: ${blogId}`, { error: rssResult.error });
    throw Errors.EXTERNAL_API_ERROR('네이버 RSS', rssResult.error);
  }

  if (rssResult.posts.length === 0) {
    logger.warn(`블로그 ${blogId}에 공개된 포스트가 없습니다.`);
    throw Errors.BAD_REQUEST('블로그에 공개된 포스트가 없습니다. 포스트를 작성한 후 다시 시도해주세요.');
  }

  logger.success(`✅ RSS 파싱 완료: ${rssResult.posts.length}개 포스트`);

  // 6. 기존 포스트 URL 확인 (중복 제거)
  const postUrls = rssResult.posts.map(p => p.link);

  const { data: existingPosts } = await supabase
    .from('blog_posts')
    .select('post_url')
    .eq('user_id', userId)
    .in('post_url', postUrls);

  const existingUrls = new Set(existingPosts?.map(p => p.post_url) || []);

  logger.info(`📋 기존 포스트: ${existingUrls.size}개`);

  // 7. 크롤링할 포스트 필터링
  const postsToCrawl = rssResult.posts.filter(p => !existingUrls.has(p.link));

  if (postsToCrawl.length === 0) {
    logger.warn('⚠️  모든 포스트가 이미 수집됨');

    return ApiResponse.ok<CollectPostsResponse>({
      success: true,
      collected: 0,
      failed: 0,
      skipped: existingUrls.size,
      duration: Date.now() - startTime,
      posts: []
    });
  }

  logger.info(`🚀 크롤링 시작: ${postsToCrawl.length}개 포스트`);

  // 8. 각 포스트 크롤링 및 저장
  const results: CollectPostsResponse['posts'] = [];
  let collected = 0;
  let failed = 0;

  for (const [index, rssPost] of postsToCrawl.entries()) {
    logger.info(`[${index + 1}/${postsToCrawl.length}] 크롤링 중: ${rssPost.title}`);

    try {
      // 크롤링
      const crawlResult = await crawler.crawlWithRetry(rssPost.link);

      if (crawlResult.success && crawlResult.content) {
        // DB 저장
        const { error: insertError } = await supabase
          .from('blog_posts')
          .insert({
            user_id: userId,
            title: crawlResult.title || rssPost.title,
            content: crawlResult.content,
            post_url: rssPost.link,
            published_at: rssPost.pubDate,
            word_count: crawlResult.content.length,
            view_count: crawlResult.viewCount || 0,
            like_count: crawlResult.likeCount || 0,
            comment_count: crawlResult.commentCount || 0,
            is_analyzed: false
          });

        if (insertError) {
          logger.error(`DB 저장 실패: ${rssPost.link}`, insertError);
          failed++;
          results.push({
            title: rssPost.title,
            url: rssPost.link,
            status: 'failed',
            error: 'DB 저장 실패'
          });
        } else {
          collected++;
          results.push({
            title: crawlResult.title || rssPost.title,
            url: rssPost.link,
            status: 'success'
          });
          logger.success(`✅ 저장 완료: ${crawlResult.title}`);
        }

      } else {
        failed++;
        results.push({
          title: rssPost.title,
          url: rssPost.link,
          status: 'failed',
          error: crawlResult.error
        });
        logger.error(`❌ 크롤링 실패: ${rssPost.title}`, { error: crawlResult.error });
      }

    } catch (error) {
      failed++;
      results.push({
        title: rssPost.title,
        url: rssPost.link,
        status: 'failed',
        error: error instanceof Error ? error.message : '알 수 없는 오류'
      });
      logger.error(`❌ 예외 발생: ${rssPost.title}`, error);
    }
  }

  // 9. 크롤러 종료
  await crawler.closeBrowser();

  const duration = Date.now() - startTime;
  const successRate = ((collected / postsToCrawl.length) * 100).toFixed(1);

  logger.success(
    `🎉 수집 완료: ${collected}개 성공, ${failed}개 실패, ${existingUrls.size}개 스킵 (${duration}ms, 성공률: ${successRate}%)`
  );

  // 10. 응답 반환
  return ApiResponse.ok({
    success: true,
    collected,
    failed,
    skipped: existingUrls.size,
    duration,
    posts: results
  } as CollectPostsResponse);
});
