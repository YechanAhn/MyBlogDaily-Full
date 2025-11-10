/**
 * 유틸리티 함수 통합 export
 */

// 환경 변수 검증
export {
  validateEnv,
  validateEnvOrThrow,
  hasEnv,
  getEnv,
  getEnvNumber,
  getEnvBoolean,
  isDevelopment,
  isProduction,
  isTest
} from './env-validator';

// 에러 핸들링
export {
  AppError,
  Errors,
  createErrorResponse,
  createSuccessResponse,
  asyncHandler,
  logError,
  handleSupabaseError,
  ApiResponse
} from './error-handler';

export type {
  ErrorResponse,
  SuccessResponse
} from './error-handler';

// 로깅
export {
  LogLevel,
  logger,
  createLogger,
  apiLogger,
  crawlerLogger,
  aiLogger,
  dbLogger,
  queueLogger,
  curationLogger,
  devLog,
  prodLog,
  conditionalLog
} from './logger';
