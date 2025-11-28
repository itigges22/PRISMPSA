/**
 * Centralized Debug Logging System
 * Provides structured logging with levels, timestamps, and contextual data
 * Automatically sanitizes sensitive data in production
 */

import { config } from './config';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LogContext {
  function?: string;
  component?: string;
  userId?: string;
  roleId?: string;
  departmentId?: string;
  action?: string;
  [key: string]: any;
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: LogContext;
  error?: Error;
}

class DebugLogger {
  private isDevelopment: boolean;
  private minLevel: LogLevel;
  private sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'api_key', 'authorization', 'cookie', 'sessionId', 'session_id'];

  constructor() {
    this.isDevelopment = config.isDevelopment;
    const logLevel = config.logging.level;
    this.minLevel = logLevel === 'debug' ? LogLevel.DEBUG :
                     logLevel === 'info' ? LogLevel.INFO :
                     logLevel === 'warn' ? LogLevel.WARN :
                     LogLevel.ERROR;
  }

  /**
   * Sanitize sensitive data in objects before logging
   * Only runs in production for performance
   */
  private sanitize(obj: any): any {
    if (!config.logging.sanitizeSensitiveData) {
      return obj;
    }

    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitize(item));
    }

    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const keyLower = key.toLowerCase();
      const isSensitive = this.sensitiveFields.some(field => keyLower.includes(field.toLowerCase()));

      if (isSensitive) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitize(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  private formatTimestamp(): string {
    return new Date().toISOString();
  }

  private getColor(level: LogLevel): string {
    const colors = {
      [LogLevel.DEBUG]: '\x1b[36m', // Cyan
      [LogLevel.INFO]: '\x1b[32m',  // Green
      [LogLevel.WARN]: '\x1b[33m',  // Yellow
      [LogLevel.ERROR]: '\x1b[31m', // Red
    };
    return colors[level] || '\x1b[0m';
  }

  private getLevelName(level: LogLevel): string {
    const names = {
      [LogLevel.DEBUG]: 'DEBUG',
      [LogLevel.INFO]: 'INFO',
      [LogLevel.WARN]: 'WARN',
      [LogLevel.ERROR]: 'ERROR',
    };
    return names[level] || 'UNKNOWN';
  }

  private formatContext(context?: LogContext): string {
    if (!context) return '';
    
    const parts: string[] = [];
    if (context.function) parts.push(`fn:${context.function}`);
    if (context.component) parts.push(`comp:${context.component}`);
    if (context.userId) parts.push(`user:${context.userId}`);
    if (context.roleId) parts.push(`role:${context.roleId}`);
    if (context.departmentId) parts.push(`dept:${context.departmentId}`);
    if (context.action) parts.push(`action:${context.action}`);
    
    return parts.length > 0 ? `[${parts.join(' ')}]` : '';
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.minLevel;
  }

  private log(level: LogLevel, message: string, context?: LogContext, error?: Error): void {
    if (!this.shouldLog(level)) return;

    const timestamp = this.formatTimestamp();
    const levelName = this.getLevelName(level);

    // Sanitize context in production
    const sanitizedContext = this.sanitize(context);
    const contextStr = this.formatContext(sanitizedContext);

    const color = this.getColor(level);
    const reset = '\x1b[0m';

    const logMessage = `${color}[${timestamp}] ${levelName}${reset} ${contextStr} ${message}`;

    if (error) {
      // In production, don't log full stack traces
      if (config.logging.includeStackTrace) {
        console.error(logMessage, error);
      } else {
        console.error(logMessage, error.message);
      }
    } else {
      console.log(logMessage);
    }

    // In development, also log to browser console if available
    if (this.isDevelopment && typeof window !== 'undefined') {
      const browserLog = {
        level: levelName,
        message,
        timestamp,
        context: sanitizedContext,
        error: config.logging.includeStackTrace ? error?.stack : error?.message,
      };

      switch (level) {
        case LogLevel.DEBUG:
          console.debug('🔍 [DEBUG]', browserLog);
          break;
        case LogLevel.INFO:
          console.info('ℹ️ [INFO]', browserLog);
          break;
        case LogLevel.WARN:
          console.warn('⚠️ [WARN]', browserLog);
          break;
        case LogLevel.ERROR:
          console.error('❌ [ERROR]', browserLog);
          break;
      }
    }
  }

  debug(message: string, context?: LogContext): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.log(LogLevel.WARN, message, context);
  }

  error(message: string, context?: LogContext, error?: Error): void {
    this.log(LogLevel.ERROR, message, context, error);
  }

  // Specialized logging methods for common scenarios
  apiCall(method: string, endpoint: string, context?: LogContext): void {
    this.info(`API ${method} ${endpoint}`, { ...context, action: 'api_call' });
  }

  apiResponse(method: string, endpoint: string, status: number, context?: LogContext): void {
    const level = status >= 400 ? LogLevel.ERROR : LogLevel.INFO;
    this.log(level, `API ${method} ${endpoint} -> ${status}`, { ...context, action: 'api_response' });
  }

  databaseQuery(operation: string, table: string, context?: LogContext): void {
    this.debug(`DB ${operation} ${table}`, { ...context, action: 'db_query' });
  }

  databaseError(operation: string, table: string, error: Error, context?: LogContext): void {
    this.error(`DB ${operation} ${table} failed`, { ...context, action: 'db_error' }, error);
  }

  userAction(action: string, userId: string, context?: LogContext): void {
    this.info(`User ${action}`, { ...context, userId, action: 'user_action' });
  }

  roleManagement(action: string, roleId?: string, userId?: string, context?: LogContext): void {
    this.info(`Role ${action}`, { ...context, roleId, userId, action: 'role_management' });
  }

  permissionCheck(permission: string, userId: string, granted: boolean, context?: LogContext): void {
    const level = granted ? LogLevel.DEBUG : LogLevel.WARN;
    this.log(level, `Permission ${permission}: ${granted ? 'GRANTED' : 'DENIED'}`, { 
      ...context, 
      userId, 
      action: 'permission_check' 
    });
  }

  componentRender(component: string, props?: any, context?: LogContext): void {
    this.debug(`Component ${component} rendered`, { ...context, component, action: 'component_render' });
  }

  componentError(component: string, error: Error, context?: LogContext): void {
    this.error(`Component ${component} error`, { ...context, component, action: 'component_error' }, error);
  }

  orgChartAction(action: string, nodeId?: string, context?: LogContext): void {
    this.debug(`OrgChart ${action}`, { ...context, nodeId, action: 'org_chart' });
  }

  // Performance logging
  performance(operation: string, duration: number, context?: LogContext): void {
    const level = duration > 1000 ? LogLevel.WARN : LogLevel.DEBUG;
    this.log(level, `${operation} took ${duration}ms`, { ...context, action: 'performance' });
  }

  // Batch operations
  batchStart(operation: string, count: number, context?: LogContext): void {
    this.info(`Starting batch ${operation} (${count} items)`, { ...context, action: 'batch_start' });
  }

  batchComplete(operation: string, count: number, duration: number, context?: LogContext): void {
    this.info(`Completed batch ${operation} (${count} items) in ${duration}ms`, { 
      ...context, 
      action: 'batch_complete' 
    });
  }

  batchError(operation: string, error: Error, context?: LogContext): void {
    this.error(`Batch ${operation} failed`, { ...context, action: 'batch_error' }, error);
  }
}

// Export singleton instance
export const logger = new DebugLogger();

// Export convenience functions
export const debug = (message: string, context?: LogContext) => logger.debug(message, context);
export const info = (message: string, context?: LogContext) => logger.info(message, context);
export const warn = (message: string, context?: LogContext) => logger.warn(message, context);
export const error = (message: string, context?: LogContext, err?: Error) => logger.error(message, context, err);

// Export specialized functions
export const apiCall = (method: string, endpoint: string, context?: LogContext) => 
  logger.apiCall(method, endpoint, context);
export const apiResponse = (method: string, endpoint: string, status: number, context?: LogContext) => 
  logger.apiResponse(method, endpoint, status, context);
export const databaseQuery = (operation: string, table: string, context?: LogContext) => 
  logger.databaseQuery(operation, table, context);
export const databaseError = (operation: string, table: string, error: Error, context?: LogContext) => 
  logger.databaseError(operation, table, error, context);
export const userAction = (action: string, userId: string, context?: LogContext) => 
  logger.userAction(action, userId, context);
export const roleManagement = (action: string, roleId?: string, userId?: string, context?: LogContext) => 
  logger.roleManagement(action, roleId, userId, context);
export const permissionCheck = (permission: string, userId: string, granted: boolean, context?: LogContext) => 
  logger.permissionCheck(permission, userId, granted, context);
export const componentRender = (component: string, props?: any, context?: LogContext) => 
  logger.componentRender(component, props, context);
export const componentError = (component: string, error: Error, context?: LogContext) => 
  logger.componentError(component, error, context);
export const orgChartAction = (action: string, nodeId?: string, context?: LogContext) => 
  logger.orgChartAction(action, nodeId, context);
export const performance = (operation: string, duration: number, context?: LogContext) => 
  logger.performance(operation, duration, context);
export const batchStart = (operation: string, count: number, context?: LogContext) => 
  logger.batchStart(operation, count, context);
export const batchComplete = (operation: string, count: number, duration: number, context?: LogContext) => 
  logger.batchComplete(operation, count, duration, context);
export const batchError = (operation: string, error: Error, context?: LogContext) => 
  logger.batchError(operation, error, context);
