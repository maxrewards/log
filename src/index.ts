import { createLogger, format, transports, Logger as WinstonLogger, LoggerOptions } from 'winston';
import { v4 } from 'uuid';

export default class Logger {
  applicationName: string;
  apiKey: string;
  logger: WinstonLogger;

  constructor(applicationName: string, apiKey: string, options?: LoggerOptions, overrideTransport?: boolean) {
    this.applicationName = applicationName;
    this.apiKey = apiKey;

    const httpTransport = new transports.Http({
      handleExceptions: true,
      handleRejections: true,
      host: 'http-intake.logs.datadoghq.com',
      path: `/v1/input/${apiKey}?ddsource=nodejs&service=${applicationName}`
    });

    const consoleTransport = new transports.Console({ format: format.simple() });

    const transport = (process.env.NODE_ENV === 'production')
      ? [httpTransport]
      : overrideTransport
        ? [httpTransport, consoleTransport]
        : [consoleTransport];

    this.logger = createLogger({
      level: 'info',
      exitOnError: false,
      format: format.json(),
      transports: transport,
      ...options
    });
  }

  public create = (userId?: string) => {
    const options: any = { reqId: v4() };
    if(userId) {
      options.userId = userId;
    }
    return this.logger.child(options);
  }
}