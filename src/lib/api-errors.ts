import { NextResponse } from 'next/server';

export interface ApiErrorResponse {
  success: false;
  message: string;
  error?: string;
  details?: any;
  route: string;
  method: string;
  timestamp: string;
  stack?: string;
}

export type AppErrorType = 
  | 'VALIDATION_ERROR'
  | 'AUTH_ERROR'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'DATABASE_ERROR'
  | 'INTERNAL_ERROR'
  | 'BAD_REQUEST';

export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public type: AppErrorType = 'INTERNAL_ERROR',
    public details?: any
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function handleApiError(
  error: any,
  req: Request,
  options: { route: string }
) {
  const method = req.method;
  const url = new URL(req.url);
  const route = options.route || url.pathname;
  const isDev = process.env.NODE_ENV === 'development';

  let statusCode = 500;
  let message = 'Ocorreu um erro interno inesperado';
  
  // Extract technical description
  let errorDescription = '';
  if (error instanceof Error) {
    errorDescription = error.message;
  } else if (typeof error === 'object' && error !== null) {
    errorDescription = error.message || error.details || JSON.stringify(error);
  } else {
    errorDescription = String(error);
  }

  let details = error instanceof AppError ? error.details : (error.details || error.hint || undefined);

  if (error instanceof AppError) {
    statusCode = error.statusCode;
    message = error.message;
  } else if (error.code === 'P2002' || error.code === '23505') { 
    // Prisma or Postgres Unique Violation
    statusCode = 409;
    message = 'Já existe um registro com estes dados';
  } else if (error.code === 'single-row' || error.message?.includes('0 rows')) {
    statusCode = 404;
    message = 'Recurso não encontrado';
  } else if (error.code === '42P01') {
    // Table not found - common after database migrations or removals
    message = 'Erro de banco de dados: Tabela não encontrada';
  }

  // Enhanced logging for developers
  console.error(`[API ERROR] ${method} ${route}:`, {
    message: errorDescription,
    code: error.code,
    details,
    fullError: isDev ? error : '[Redacted]',
    timestamp: new Date().toISOString()
  });

  const response: ApiErrorResponse = {
    success: false,
    message,
    error: isDev ? errorDescription : undefined,
    details: isDev ? details : undefined,
    route,
    method,
    timestamp: new Date().toISOString(),
    stack: isDev && error instanceof Error ? error.stack : undefined,
  };

  return NextResponse.json(response, { status: statusCode });
}

export function validateBody<T>(body: any, requiredFields: (keyof T)[]): T {
  const missing = requiredFields.filter(f => !body[f]);
  if (missing.length > 0) {
    throw new AppError(
      `Os seguintes campos são obrigatórios: ${missing.join(', ')}`,
      400,
      'VALIDATION_ERROR'
    );
  }
  return body as T;
}
