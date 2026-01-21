import { NextResponse } from "next/server";
import { getAppInfo } from "@/lib/app-info";

export async function GET() {
  return NextResponse.json(getAppInfo());
}

