import { NextResponse } from 'next/server';
import { DirectorService } from '@/features/director/director.service';

export async function GET() {
  try {
    const data = await DirectorService.getLearningSubjectGroups();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Lookup learning-subject-groups error:', error);
    return NextResponse.json({ error: 'Failed to fetch learning subject groups' }, { status: 500 });
  }
}
