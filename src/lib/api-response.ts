import { NextResponse } from 'next/server';

export function successResponse(data: any, message: string = 'Success', status: number = 200) {
    return NextResponse.json(
        {
            success: true,
            message,
            data,
        },
        { status }
    );
}

export function errorResponse(message: string = 'An error occurred', status: number = 500, errors: any = null) {
    return NextResponse.json(
        {
            success: false,
            message,
            errors,
        },
        { status }
    );
}
