import { parseBuildingRegister } from "@/lib/buildingRegister";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.formData();
    const file = body.get("file");
    if (!(file instanceof File)) {
      return Response.json({ error: "PDF 파일이 없습니다." }, { status: 400 });
    }
    const parsed = await parseBuildingRegister(file);
    return Response.json(parsed);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "건축물대장 PDF 분석에 실패했습니다." },
      { status: 500 },
    );
  }
}
