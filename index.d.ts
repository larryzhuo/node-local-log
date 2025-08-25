import type { Express } from "express";
import type { Server as HttpServer } from "http";

/** 告警配置 */
export interface AlertConfig {
  alertEnabled: boolean;
  alertUrl: string;
  alertInterval: number;
  alertThreshold: number;
  alertCooldown: number;
}

/** 服务器完整配置（运行时生效值） */
export interface LogServerConfig extends AlertConfig {
  staticRoot: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  username: string;
  password: string;
  defaultPageSize: number;
  maxPageSize: number;
  port?: number;
}

/** 初始化可选配置（传入值，未提供的将使用默认值） */
export type LogServerOptions = Partial<LogServerConfig>;

/**
 * 命名空间：类型与类定义
 */
declare namespace NodeLocalLog {
  export type Alert = AlertConfig;
  export type Config = LogServerConfig;
  export type Options = LogServerOptions;

  /**
   * 日志本地查看服务器
   */
  export class LogServer {
    constructor(options?: Options);

    /** 内置 Express 实例 */
    readonly app: Express;

    /** 只读运行时配置（合并默认值后的最终配置） */
    readonly config: Config;

    /** 启动 HTTP 服务（未在 options.port 指定时，可在此传入） */
    start(port?: number): Promise<HttpServer>;

    /** 停止服务（若已启动） */
    stop(): Promise<void>;
  }
}

/**
 * 默认导出为一个对象，其中包含 LogServer 类
 */
declare const _default: {
  LogServer: typeof NodeLocalLog.LogServer;
};

export = _default;
