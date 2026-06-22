import { NextResponse } from "next/server";
import prisma from "@/lib/database/prisma";
import { MCPServerType } from "@/types/mcp";
import { UpdateMCPServerBody } from "./schema";

export async function GET() {
  try {
    const servers = await prisma.mCPServer.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(servers);
  } catch (error) {
    console.error("Error fetching MCP servers:", error);
    return NextResponse.json({ error: "Failed to fetch MCP servers" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, type, command, args, env, url, headers } = body;

    if (!name || !type) {
      return NextResponse.json({ error: "Name and type are required" }, { status: 400 });
    }

    if (type === "stdio" && !command) {
      return NextResponse.json({ error: "Command is required for stdio servers" }, { status: 400 });
    }

    if (type === "http" && !url) {
      return NextResponse.json({ error: "URL is required for http servers" }, { status: 400 });
    }

    const server = await prisma.mCPServer.create({
      data: {
        name,
        type: type as MCPServerType,
        command: type === "stdio" ? command : null,
        args: type === "stdio" ? args : null,
        env: type === "stdio" ? env : null,
        url: type === "http" ? url : null,
        headers: type === "http" ? headers : null,
      },
    });

    return NextResponse.json(server, { status: 201 });
  } catch (error) {
    console.error("Error creating MCP server:", error);
    if ((error as { code?: string })?.code === "P2002") {
      return NextResponse.json({ error: "Server name already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to create MCP server" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const parsed = UpdateMCPServerBody.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }
    const { id, name, type, command, args, env, url, headers, enabled } = parsed.data;

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (type !== undefined) updateData.type = type;
    if (enabled !== undefined) updateData.enabled = enabled;

    if (type === "stdio") {
      if (command !== undefined) updateData.command = command;
      if (args !== undefined) updateData.args = args;
      if (env !== undefined) updateData.env = env;
      updateData.url = null;
      updateData.headers = null;
    } else if (type === "http") {
      if (url !== undefined) updateData.url = url;
      if (headers !== undefined) updateData.headers = headers;
      updateData.command = null;
      updateData.args = null;
      updateData.env = null;
    }

    const server = await prisma.mCPServer.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(server);
  } catch (error) {
    console.error("Error updating MCP server:", error);
    if ((error as { code?: string })?.code === "P2025") {
      return NextResponse.json({ error: "Server not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to update MCP server" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    await prisma.mCPServer.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting MCP server:", error);
    if ((error as { code?: string })?.code === "P2025") {
      return NextResponse.json({ error: "Server not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to delete MCP server" }, { status: 500 });
  }
}
