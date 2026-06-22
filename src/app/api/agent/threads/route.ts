import { NextRequest, NextResponse } from "next/server";
import type { Thread } from "@/types/message";
import prisma from "@/lib/database/prisma";
import { UpdateThreadBody, DeleteThreadBody } from "./schema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ThreadEntity = {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
};
export async function GET() {
  const dbThreads = await prisma.thread.findMany({ orderBy: { updatedAt: "desc" }, take: 50 });
  const threads: Thread[] = dbThreads.map((t: ThreadEntity) => ({
    id: t.id,
    title: t.title,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  }));
  return NextResponse.json(threads, { status: 200 });
}

export async function POST() {
  const created = await prisma.thread.create({ data: { title: "New thread" } });
  const thread: Thread = {
    id: created.id,
    title: created.title,
    createdAt: created.createdAt.toISOString(),
    updatedAt: created.updatedAt.toISOString(),
  };
  return NextResponse.json(thread, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  try {
    const parsed = UpdateThreadBody.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "id and title required" }, { status: 400 });
    }
    const { id, title } = parsed.data;
    const updated = await prisma.thread.update({ where: { id }, data: { title } });
    return NextResponse.json(
      {
        id: updated.id,
        title: updated.title,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      },
      { status: 200 },
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Update failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const parsed = DeleteThreadBody.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Thread id required" }, { status: 400 });
    }
    const { id } = parsed.data;

    // First check if thread exists
    const thread = await prisma.thread.findUnique({ where: { id } });
    if (!thread) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    // Delete the thread from Prisma (metadata)
    await prisma.thread.delete({ where: { id } });

    // Note: LangGraph checkpoint data will become orphaned but won't affect functionality
    // The checkpointer will simply not find any thread metadata for this thread_id
    // Future versions could implement direct checkpoint deletion via SQL if needed

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Delete failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
