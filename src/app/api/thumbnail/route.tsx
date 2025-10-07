import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
  }

  const apiUrl = `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=48x48&format=Png`;

  try {
    const apiResponse = await fetch(apiUrl);
    if (!apiResponse.ok) {
      return NextResponse.json({ error: 'Failed to fetch thumbnail API' }, { status: apiResponse.status });
    }

    const jsonData = await apiResponse.json();
    const imageUrl = jsonData.data?.[0]?.imageUrl;

    if (!imageUrl) {
      return NextResponse.json({ error: 'No image URL found' }, { status: 404 });
    }

    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      return NextResponse.json({ error: 'Failed to fetch image' }, { status: imageResponse.status });
    }

    const buffer = await imageResponse.arrayBuffer();
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });
  } catch  {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}