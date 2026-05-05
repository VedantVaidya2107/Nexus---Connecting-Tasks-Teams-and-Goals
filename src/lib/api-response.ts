import { NextResponse } from 'next/server';

export type ApiResponse<T = any> = {
  success: boolean;
  message: string;
  data?: T;
  errors?: any;
};

export const apiResponse = {
  success: <T>(data: T, message = 'Success', status = 200) => {
    return NextResponse.json({ success: true, message, data }, { status });
  },
  error: (message = 'Error', status = 400, errors?: any) => {
    return NextResponse.json({ success: false, message, errors }, { status });
  },
  unauthorized: (message = 'Unauthorized') => {
    return NextResponse.json({ success: false, message }, { status: 401 });
  },
  forbidden: (message = 'Forbidden') => {
    return NextResponse.json({ success: false, message }, { status: 403 });
  },
  internalError: (error?: any) => {
    console.error('API Error:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
};
