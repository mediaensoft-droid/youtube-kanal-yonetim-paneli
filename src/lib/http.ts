import "server-only";
import { NextResponse } from "next/server";

export function okResponse<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function errorResponse(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}
