/**
 * 뉴스레터 HTML 템플릿
 *
 * 용도:
 * - 큐레이션 콘텐츠 + 초안을 이메일로 포맷팅
 * - 반응형 HTML 이메일 템플릿
 */

import type { CuratedItem } from '@/lib/curation';
import type { BlogDraft } from '@/lib/ai/draft-writer';

/**
 * 뉴스레터 데이터
 */
export interface NewsletterData {
  userName: string;              // 사용자 이름
  curatedItems: CuratedItem[];   // 큐레이션 아이템
  drafts: BlogDraft[];           // 블로그 초안
  date: string;                  // 발송 날짜 (ISO 8601)
}

/**
 * 뉴스레터 HTML 생성
 */
export function generateNewsletterHTML(data: NewsletterData): string {
  const { userName, curatedItems, drafts, date } = data;
  const formattedDate = new Date(date).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  });

  return `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MyBlogDaily - 오늘의 뉴스레터</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans KR', sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .container {
      background-color: #ffffff;
      border-radius: 8px;
      padding: 30px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .header {
      text-align: center;
      padding-bottom: 20px;
      border-bottom: 2px solid #4F46E5;
      margin-bottom: 30px;
    }
    .header h1 {
      color: #4F46E5;
      margin: 0 0 10px 0;
      font-size: 28px;
    }
    .header .date {
      color: #666;
      font-size: 14px;
    }
    .section {
      margin-bottom: 40px;
    }
    .section-title {
      color: #4F46E5;
      font-size: 20px;
      font-weight: bold;
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 1px solid #E5E7EB;
    }
    .curated-item {
      margin-bottom: 20px;
      padding: 15px;
      background-color: #F9FAFB;
      border-left: 3px solid #4F46E5;
      border-radius: 4px;
    }
    .curated-item h3 {
      margin: 0 0 8px 0;
      font-size: 16px;
      color: #1F2937;
    }
    .curated-item h3 a {
      color: #1F2937;
      text-decoration: none;
    }
    .curated-item h3 a:hover {
      color: #4F46E5;
    }
    .curated-item .meta {
      font-size: 12px;
      color: #6B7280;
      margin-bottom: 8px;
    }
    .curated-item .summary {
      font-size: 14px;
      color: #4B5563;
      line-height: 1.5;
    }
    .draft {
      margin-bottom: 30px;
      padding: 20px;
      background-color: #FFF7ED;
      border: 1px solid #FDBA74;
      border-radius: 4px;
    }
    .draft-number {
      display: inline-block;
      background-color: #F97316;
      color: white;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: bold;
      margin-bottom: 10px;
    }
    .draft h3 {
      margin: 0 0 10px 0;
      font-size: 18px;
      color: #1F2937;
    }
    .draft .summary {
      font-size: 14px;
      color: #6B7280;
      font-style: italic;
      margin-bottom: 15px;
    }
    .draft .content {
      font-size: 14px;
      color: #374151;
      line-height: 1.7;
      white-space: pre-wrap;
    }
    .draft .tags {
      margin-top: 15px;
      padding-top: 15px;
      border-top: 1px solid #FED7AA;
    }
    .tag {
      display: inline-block;
      background-color: #FFEDD5;
      color: #9A3412;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 12px;
      margin-right: 8px;
      margin-bottom: 5px;
    }
    .footer {
      text-align: center;
      padding-top: 30px;
      border-top: 1px solid #E5E7EB;
      margin-top: 40px;
      color: #6B7280;
      font-size: 12px;
    }
    .footer a {
      color: #4F46E5;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- 헤더 -->
    <div class="header">
      <h1>📰 MyBlogDaily</h1>
      <p class="date">${formattedDate}</p>
      <p>안녕하세요, ${userName}님! 오늘의 큐레이션과 블로그 초안을 전달드립니다.</p>
    </div>

    <!-- 큐레이션 섹션 -->
    <div class="section">
      <h2 class="section-title">🔍 오늘의 큐레이션 (${curatedItems.length}개)</h2>
      ${curatedItems.map((item, index) => `
        <div class="curated-item">
          <h3><a href="${item.url}" target="_blank">${index + 1}. ${item.title}</a></h3>
          <div class="meta">
            📌 ${item.source} | 🏷️ ${item.keyword} | ⭐ 점수: ${item.score}
          </div>
          <div class="summary">${item.summary}</div>
        </div>
      `).join('')}
    </div>

    <!-- 초안 섹션 -->
    <div class="section">
      <h2 class="section-title">✍️ 블로그 포스트 초안 (${drafts.length}개)</h2>
      <p style="color: #6B7280; font-size: 14px; margin-bottom: 20px;">
        당신의 문체를 반영한 ${drafts.length}가지 초안입니다. 마음에 드는 초안을 골라 수정해보세요!
      </p>
      ${drafts.map((draft, index) => `
        <div class="draft">
          <span class="draft-number">초안 ${index + 1}</span>
          <h3>${draft.title}</h3>
          <div class="summary">"${draft.summary}"</div>
          <div class="content">${draft.content.substring(0, 500)}${draft.content.length > 500 ? '...' : ''}</div>
          <div class="tags">
            ${draft.tags.map(tag => `<span class="tag">#${tag}</span>`).join('')}
            <span style="color: #9A3412; font-size: 12px; margin-left: 10px;">
              📖 읽기 시간: 약 ${draft.estimatedReadTime}분
            </span>
          </div>
        </div>
      `).join('')}
    </div>

    <!-- 푸터 -->
    <div class="footer">
      <p>
        이 뉴스레터는 MyBlogDaily에서 자동으로 발송되었습니다.<br>
        문의사항이 있으시면 <a href="mailto:support@myblogdaily.com">support@myblogdaily.com</a>으로 연락주세요.
      </p>
      <p style="margin-top: 10px;">
        © 2025 MyBlogDaily. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * 간단한 텍스트 버전 (HTML을 지원하지 않는 이메일 클라이언트용)
 */
export function generateNewsletterText(data: NewsletterData): string {
  const { userName, curatedItems, drafts, date } = data;
  const formattedDate = new Date(date).toLocaleDateString('ko-KR');

  let text = `MyBlogDaily - ${formattedDate}\n\n`;
  text += `안녕하세요, ${userName}님!\n\n`;

  text += `=== 오늘의 큐레이션 (${curatedItems.length}개) ===\n\n`;
  curatedItems.forEach((item, index) => {
    text += `${index + 1}. ${item.title}\n`;
    text += `   출처: ${item.source} | 키워드: ${item.keyword}\n`;
    text += `   ${item.summary}\n`;
    text += `   ${item.url}\n\n`;
  });

  text += `\n=== 블로그 포스트 초안 (${drafts.length}개) ===\n\n`;
  drafts.forEach((draft, index) => {
    text += `[초안 ${index + 1}]\n`;
    text += `제목: ${draft.title}\n`;
    text += `요약: ${draft.summary}\n`;
    text += `태그: ${draft.tags.join(', ')}\n`;
    text += `읽기 시간: 약 ${draft.estimatedReadTime}분\n`;
    text += `\n${draft.content.substring(0, 300)}...\n\n`;
  });

  text += `\n---\n`;
  text += `MyBlogDaily | support@myblogdaily.com\n`;

  return text;
}
