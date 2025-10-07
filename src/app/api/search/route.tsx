import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const keyword = searchParams.get('keyword');
  const limit = searchParams.get('limit') || '10';

  if (!keyword) {
    return NextResponse.json({ error: 'Missing keyword' }, { status: 400 });
  }

  try {
    const response = await fetch(`https://users.roblox.com/v1/users/search?keyword=${encodeURIComponent(keyword)}&limit=${limit}`);
    const data = await response.json();
    return NextResponse.json(data);
  } catch  {
    return NextResponse.json({ error: 'Failed to fetch from Roblox' }, { status: 500 });
  }
}