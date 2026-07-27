import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/db";
import { trafficLogs } from "../../../lib/traffic";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.max(1, parseInt(searchParams.get("limit") || "20", 10));
    const startDateStr = searchParams.get("startDate");
    const endDateStr = searchParams.get("endDate");
    const action = searchParams.get("action");
    const direction = searchParams.get("direction");
    const convoIdStr = searchParams.get("conversationId");
    const search = searchParams.get("search");

    let startDate: Date | undefined;
    let endDate: Date | undefined;

    if (startDateStr) {
      const d = new Date(startDateStr);
      if (!isNaN(d.getTime())) {
        d.setHours(0, 0, 0, 0);
        startDate = d;
      }
    }

    if (endDateStr) {
      const d = new Date(endDateStr);
      if (!isNaN(d.getTime())) {
        d.setHours(23, 59, 59, 999);
        endDate = d;
      }
    }

    if (prisma) {
      try {
        const where: Record<string, unknown> = {};

        if (startDate || endDate) {
          where.timestamp = {
            ...(startDate ? { gte: startDate } : {}),
            ...(endDate ? { lte: endDate } : {}),
          };
        }

        if (action && action !== "all") {
          where.action = action;
        }

        if (direction && direction !== "all") {
          where.direction = direction;
        }

        if (convoIdStr && convoIdStr !== "all") {
          const convoId = parseInt(convoIdStr, 10);
          if (!isNaN(convoId)) {
            where.conversationId = convoId;
          }
        }

        if (search && search.trim() !== "") {
          const term = search.trim();
          where.OR = [
            { content: { contains: term, mode: "insensitive" } },
            { details: { contains: term, mode: "insensitive" } },
          ];
        }

        const total = await prisma.trafficLog.count({ where });
        const dbLogs = await prisma.trafficLog.findMany({
          where,
          orderBy: { timestamp: "desc" },
          skip: (page - 1) * limit,
          take: limit,
        });

        const formattedLogs = (dbLogs || []).map((log) => ({
          ...log,
          timestamp: log.timestamp ? log.timestamp.toISOString() : new Date().toISOString(),
        }));

        const repliesCount = await prisma.trafficLog.count({ where: { ...where, action: "dify_reply" } });
        const handoffsCount = await prisma.trafficLog.count({ where: { ...where, action: "handoff" } });
        const ignoredCount = await prisma.trafficLog.count({ where: { ...where, action: "ignored" } });
        const errorsCount = await prisma.trafficLog.count({ where: { ...where, action: "error" } });

        const totalPages = Math.ceil(total / limit) || 1;

        return NextResponse.json({
          logs: formattedLogs,
          pagination: {
            total,
            page,
            limit,
            totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
          },
          stats: {
            total,
            replies: repliesCount,
            handoffs: handoffsCount,
            ignored: ignoredCount,
            errors: errorsCount,
          },
        });
      } catch (dbErr) {
        console.error("Database query failed, falling back to in-memory traffic logs:", dbErr);
      }
    }

    // Fallback to in-memory logs
    let filtered = Array.isArray(trafficLogs) ? [...trafficLogs] : [];

    if (startDate) {
      filtered = filtered.filter((l) => new Date(l.timestamp) >= startDate!);
    }

    if (endDate) {
      filtered = filtered.filter((l) => new Date(l.timestamp) <= endDate!);
    }

    if (action && action !== "all") {
      filtered = filtered.filter((l) => l.action === action);
    }

    if (direction && direction !== "all") {
      filtered = filtered.filter((l) => l.direction === direction);
    }

    if (convoIdStr && convoIdStr !== "all") {
      const convoId = parseInt(convoIdStr, 10);
      if (!isNaN(convoId)) {
        filtered = filtered.filter((l) => l.conversationId === convoId);
      }
    }

    if (search && search.trim() !== "") {
      const term = search.trim().toLowerCase();
      filtered = filtered.filter(
        (l) =>
          (l.content && l.content.toLowerCase().includes(term)) ||
          (l.details && l.details.toLowerCase().includes(term))
      );
    }

    const total = filtered.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const paginatedLogs = filtered.slice((page - 1) * limit, page * limit);

    const stats = filtered.reduce(
      (acc, log) => {
        acc.total++;
        if (log.action === "dify_reply") acc.replies++;
        if (log.action === "handoff") acc.handoffs++;
        if (log.action === "ignored") acc.ignored++;
        if (log.action === "error") acc.errors++;
        return acc;
      },
      { total: 0, replies: 0, handoffs: 0, ignored: 0, errors: 0 }
    );

    return NextResponse.json({
      logs: paginatedLogs,
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
      stats,
    });
  } catch (globalErr) {
    console.error("Critical error in /api/traffic handler:", globalErr);
    return NextResponse.json({
      logs: [],
      pagination: {
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
      },
      stats: {
        total: 0,
        replies: 0,
        handoffs: 0,
        ignored: 0,
        errors: 0,
      },
    });
  }
}
