import { NextRequest, NextResponse } from 'next/server';
import { IDCardGenerator } from '@/lib/id-card-generator';

const generator = new IDCardGenerator(
  'public/ID_TEMPLATE.jpg',
  'public/font/BauerBodoniRegular.otf',
  undefined,
  { fontSize: 24 }
);

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const name = searchParams.get('name') || '';
    const age = searchParams.get('age') || '';
    const gender = searchParams.get('gender') || '';
    const status = searchParams.get('status') || '';
    const iconUrl = searchParams.get('icon') || undefined;

    const imageBuffer = await generator.generate({
      name,
      age,
      gender,
      status,
      iconUrl
    });

    return new NextResponse(new Uint8Array(imageBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': 'inline; filename="id-card.png"',
      },
    });
  } catch (error: any) {
      return NextResponse.json({ error: error.message }, { status: 500 });
  }
}