import { NextResponse } from "next/server";
import { trafficLogs } from "../../../lib/traffic";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(trafficLogs);
}
