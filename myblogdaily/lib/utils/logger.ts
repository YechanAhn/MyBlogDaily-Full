/**
 * 로깅 시스템
 *
 * 용도:
 * - 일관된 로그 형식
 * - 로그 레벨 제어
 * - 타임스탬프 및 컨텍스트 추가
 * - 개발/프로덕션 환경 구분
 */

/**
 * 로그 레벨
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4
}

/**
 * 로그 레벨 문자열 매핑
 */
const LOG_LEVEL_MAP: Record<string, LogLevel> = {
  debug: LogLevel.DEBUG,
  info: LogLevel.INFO,
  warn: LogLevel.WARN,
  error: LogLevel.ERROR,
  none: LogLevel.NONE
};

/**
 * ANSI 색상 코드 (터미널용)
 */
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

/**
 * 이모지
 */
const emoji = {
  debug: '🐛',
  info: 'ℹ️',
  warn: '⚠️',
  error: '❌',
  success: '✅',
  rocket: '🚀',
  clock: '⏰',
  fire: '🔥'
};

/**
 * 로거 클래스
 */
class Logger {
  private level: LogLevel;
  private context?: string;

  constructor(context?: string) {
    this.context = context;

    // 환경 변수에서 로그 레벨 읽기
    const envLevel = process.env.LOG_LEVEL?.toLowerCase() || 'info';
    this.level = LOG_LEVEL_MAP[envLevel] ?? LogLevel.INFO;
  }

  /**
   * 로그 레벨 설정
   */
  setLevel(level: LogLevel): void {
    this.level = level;
  }

  /**
   * 타임스탬프 생성
   */
  private getTimestamp(): string {
    return new Date().toISOString();
  }

  /**
   * 컨텍스트 문자열 생성
   */
  private getContextString(): string {
    return this.context ? `[${this.context}]` : '';
  }

  /**
   * 로그 메시지 포맷팅
   */
  private format(
    level: string,
    message: string,
    color: string,
    icon: string,
    data?: unknown
  ): void {
    const timestamp = this.getTimestamp();
    const context = this.getContextString();

    // 기본 메시지
    const formattedMessage = `${colors.gray}${timestamp}${colors.reset} ${color}${icon} [${level}]${colors.reset} ${context} ${message}`;

    console.log(formattedMessage);

    // 추가 데이터가 있으면 출력
    if (data !== undefined) {
      console.log(colors.gray + 'Data:' + colors.reset, data);
    }
  }

  /**
   * DEBUG 로그
   */
  debug(message: string, data?: unknown): void {
    if (this.level <= LogLevel.DEBUG) {
      this.format('DEBUG', message, colors.gray, emoji.debug, data);
    }
  }

  /**
   * INFO 로그
   */
  info(message: string, data?: unknown): void {
    if (this.level <= LogLevel.INFO) {
      this.format('INFO', message, colors.blue, emoji.info, data);
    }
  }

  /**
   * SUCCESS 로그 (INFO 레벨)
   */
  success(message: string, data?: unknown): void {
    if (this.level <= LogLevel.INFO) {
      this.format('SUCCESS', message, colors.green, emoji.success, data);
    }
  }

  /**
   * WARN 로그
   */
  warn(message: string, data?: unknown): void {
    if (this.level <= LogLevel.WARN) {
      this.format('WARN', message, colors.yellow, emoji.warn, data);
    }
  }

  /**
   * ERROR 로그
   */
  error(message: string, error?: unknown): void {
    if (this.level <= LogLevel.ERROR) {
      this.format('ERROR', message, colors.red, emoji.error);

      // Error 객체인 경우 스택 트레이스 출력
      if (error instanceof Error) {
        console.error(colors.red + error.stack + colors.reset);
      } else if (error !== undefined) {
        console.error(colors.red + 'Error data:' + colors.reset, error);
      }
    }
  }

  /**
   * 성능 측정 시작
   */
  time(label: string): void {
    if (this.level <= LogLevel.DEBUG) {
      console.time(`${emoji.clock} ${label}`);
    }
  }

  /**
   * 성능 측정 종료
   */
  timeEnd(label: string): void {
    if (this.level <= LogLevel.DEBUG) {
      console.timeEnd(`${emoji.clock} ${label}`);
    }
  }

  /**
   * 새 컨텍스트로 로거 생성
   */
  child(childContext: string): Logger {
    const newContext = this.context
      ? `${this.context}:${childContext}`
      : childContext;
    return new Logger(newContext);
  }
}

/**
 * 기본 로거 인스턴스
 */
export const logger = new Logger();

/**
 * 컨텍스트별 로거 생성
 */
export function createLogger(context: string): Logger {
  return new Logger(context);
}

/**
 * API 로거
 */
export const apiLogger = createLogger('API');

/**
 * 크롤러 로거
 */
export const crawlerLogger = createLogger('Crawler');

/**
 * AI 로거
 */
export const aiLogger = createLogger('AI');

/**
 * DB 로거
 */
export const dbLogger = createLogger('DB');

/**
 * 큐 로거
 */
export const queueLogger = createLogger('Queue');

/**
 * 개발 환경에서만 실행되는 로그
 */
export function devLog(message: string, data?: unknown): void {
  if (process.env.NODE_ENV === 'development') {
    logger.debug(message, data);
  }
}

/**
 * 프로덕션 환경에서만 실행되는 로그
 */
export function prodLog(message: string, data?: unknown): void {
  if (process.env.NODE_ENV === 'production') {
    logger.info(message, data);
  }
}

/**
 * 조건부 로그
 */
export function conditionalLog(
  condition: boolean,
  message: string,
  data?: unknown
): void {
  if (condition) {
    logger.info(message, data);
  }
}

export { LogLevel, Logger };
