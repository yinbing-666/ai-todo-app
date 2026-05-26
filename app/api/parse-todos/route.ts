import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import OpenAI from 'openai';

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
});

// Initialize Supabase with the service role key for admin access
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  // Step 1: Parse request body
  let text: string, userId: string, imageUrl: string | null;
  try {
    const body = await request.json();
    text = body.text || '';
    userId = body.userId || '';
    imageUrl = body.imageUrl || null;
  } catch (parseError) {
    return NextResponse.json(
      { error: '请求格式错误', step: 'parse-body' },
      { status: 400 }
    );
  }

  // Step 2: Validate inputs
  if ((!text || text.trim() === '') && !imageUrl) {
    return NextResponse.json(
      { error: '请提供文本内容或图片' },
      { status: 400 }
    );
  }

  if (!userId) {
    return NextResponse.json(
      { error: '缺少用户ID' },
      { status: 400 }
    );
  }

  let todoItems: string[] = [];

  // Step 3: AI processing
  try {
    if (imageUrl) {
      // Vision model for image + text
      const content: any[] = [];
      if (text && text.trim() !== '') {
        content.push({ type: 'text', text: text });
      }
      content.push({ type: 'image_url', image_url: { url: imageUrl } });

      const completion = await openai.chat.completions.create({
        model: 'Qwen/Qwen2.5-VL-72B-Instruct',
        messages: [
          {
            role: 'system',
            content: `你是一个专门提取待办事项的助手。请分析用户的图片和文本，识别其中所有的待办事项。如果是图片，请识别图片中的文字内容并提取待办事项。仅提取文字中存在的待办事项，不要添加任何额外内容。提取的内容以原文原语言展示，不要翻译。返回JSON格式：{"tasks": ["待办1", "待办2"]}。只输出JSON，不要其他内容。`
          },
          { role: 'user', content: content }
        ],
        response_format: { type: 'json_object' },
      });

      const responseContent = completion.choices[0]?.message?.content;
      if (responseContent) {
        try {
          const parsed = JSON.parse(responseContent);
          todoItems = Array.isArray(parsed.tasks) ? parsed.tasks : [responseContent];
        } catch {
          todoItems = [responseContent];
        }
      }
    } else if (text) {
      // Text-only model
      const completion = await openai.chat.completions.create({
        model: 'Qwen/Qwen2.5-7B-Instruct',
        messages: [
          {
            role: 'system',
            content: `你是一个专门提取待办事项的助手。请分析用户的文本，识别其中所有的待办事项。仅提取文字中存在的待办事项，不要添加任何额外内容。提取的内容以原文原语言展示，不要翻译。返回JSON格式：{"tasks": ["待办1", "待办2"]}。只输出JSON，不要其他内容。`
          },
          { role: 'user', content: text }
        ],
        response_format: { type: 'json_object' },
      });

      const responseContent = completion.choices[0]?.message?.content;
      if (responseContent) {
        try {
          const parsed = JSON.parse(responseContent);
          todoItems = Array.isArray(parsed.tasks) ? parsed.tasks : [responseContent];
        } catch {
          todoItems = [responseContent];
        }
      }
    }
  } catch (aiError: any) {
    // AI parsing failed — fall back to using raw text as a single todo
    console.error('AI parsing error:', aiError?.message || aiError);
    if (text && text.trim()) {
      todoItems = [text.trim()];
    }
  }

  // Step 4: Filter empty items
  todoItems = todoItems.filter(item => item && item.trim().length > 0);

  if (todoItems.length === 0) {
    return NextResponse.json(
      { error: '在提供的内容中未找到有效的待办事项' },
      { status: 400 }
    );
  }

  // Step 5: Insert into Supabase
  try {
    const todoPromises = todoItems.map((todoText, index) => {
      return supabaseAdmin
        .from('todos')
        .insert([{
          text: todoText.trim(),
          completed: false,
          user_id: userId,
          image_url: (index === 0 && imageUrl) ? imageUrl : null,
        }]);
    });

    const results = await Promise.all(todoPromises);
    const errors = results.filter(r => r.error);

    if (errors.length > 0) {
      console.error('Supabase insert errors:', errors);
      return NextResponse.json(
        { error: '插入待办事项失败', step: 'supabase-insert', details: errors.map(e => e.error) },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      count: todoItems.length,
      message: `已创建 ${todoItems.length} 个待办事项`,
    });
  } catch (dbError: any) {
    console.error('Database error:', dbError?.message || dbError);
    return NextResponse.json(
      { error: '数据库操作失败', step: 'supabase', details: dbError?.message || String(dbError) },
      { status: 500 }
    );
  }
}
