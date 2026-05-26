import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    ok: true,
    route: '/api/test',
    env: {
      hasOpenAIKey: !!process.env.OPENAI_API_KEY,
      openAIKeyPrefix: process.env.OPENAI_API_KEY?.substring(0, 10) || 'none',
      hasSupabaseKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      supabaseKeyPrefix: process.env.SUPABASE_SERVICE_ROLE_KEY?.substring(0, 10) || 'none',
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      baseURL: process.env.OPENAI_BASE_URL || 'none',
    }
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  return NextResponse.json({
    ok: true,
    received: body,
  });
}
