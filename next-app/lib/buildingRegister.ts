import { extractBuildingPdf, BuildingPdfFields } from './buildingPdf'
import { extractBuildingPdfWithOcr } from './buildingOcrFixed'

export type BuildingFloorRow={floor:string;structure:string;usage:string;area:string;areaPyeong?:string;note?:string}
const SQM_PER_PYEONG = 3.305785

function parseFloorRows(text:string):BuildingFloorRow[] {
 const rows:BuildingFloorRow[]=[]
 const seen=new Set<string>()
 const add=(match:RegExpMatchArray)=>{
  const area=match[4].replace(/,/g,'')
  const floor=match[1].replace(/\s+/g,'')
  const key=`${floor}|${match[2]}|${match[3]}|${area}`
  if(seen.has(key)) return
  seen.add(key)
  rows.push({floor,structure:match[2].trim(),usage:match[3].trim(),area,areaPyeong:(Number(area)/SQM_PER_PYEONG).toFixed(2),note:''})
 }
 const pattern=/(?:주\d+\s+)?((?:(?:지하|지상)\s*층|(?:지하|지상)?\s*-?\d+\s*층))\s+([^\s]+(?:조|구조))\s+(.+?)\s+([\d,.]+)\s*(?:㎡|m2|m²)?(?=\s|$)/i
 for(const rawLine of text.split(/\r?\n+/)){
  const line=rawLine.replace(/\u00a0/g,' ').replace(/[ \t]+/g,' ').trim()
  if(!line) continue
  const match=line.match(pattern)
  if(!match) continue
  add(match)
 }
 if(!rows.length){
  const compact=text.replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim()
  for(const match of compact.matchAll(new RegExp(pattern.source,'gi'))) add(match)
 }
 return rows
}

function mergeFields(base:BuildingPdfFields,text:string):BuildingPdfFields {
 const compact=text.replace(/\s+/g,' ')
 const pick=(patterns:RegExp[])=>{for(const pattern of patterns){const match=compact.match(pattern);if(match?.[1])return match[1].trim()}return ''}
 const use=pick([/주\s*구조\s+주\s*용도\s+층수\s+[^\s]+(?:조|구조)\s+(.+?)\s+지하\s*[:：]/,/주\s*용도\s*[:：]?\s*(.+?)(?=주\s*구조|구조|대지\s*면적|연\s*면적|건축\s*면적|$)/])
 const structure=pick([/주\s*구조\s+주\s*용도\s+층수\s+([^\s]+(?:조|구조))\s+/,/주\s*구조\s*[:：]?\s*(.+?)(?=주\s*용도|대지\s*면적|연\s*면적|건축\s*면적|$)/])
 const basement=pick([/지하\s*(?:총\s*)?층\s*수?\s*[:：]?\s*(-?\d+)\s*층?/,/지하\s*[:：]\s*(-?\d+)\s*층?/])
 const ground=pick([/지상\s*(?:총\s*)?층\s*수?\s*[:：]?\s*([0-9]+)\s*층?/,/지상\s*[:：]\s*([0-9]+)\s*층?/])
 const land=pick([/대지\s*면적\s*[:：]?\s*([\d,.]+)/])
 const total=pick([/연\s*면적\s*[:：]?\s*([\d,.]+)/])
 const building=pick([/건축\s*면적\s*[:：]?\s*([\d,.]+)/])
 const elevator=pick([/(?:승강기|엘리베이터)\s*[:：]?\s*([^\s]+)/])
 const parking=pick([/주차\s*(?:대수|장)?\s*[:：]?\s*([^\s]+)/])
 // 건축물대장 텍스트 추출은 인허가 표의 날짜가 라벨보다 앞에 배치될 수 있다.
 // 이 PDF에서는 1985.4.25.가 사용승인일이고, 뒤의 2002.3.2.는 변경 이력 날짜다.
 const permitApproval=compact.match(/((?:19|20)\d{2}[.\-/]\d{1,2}[.\-/]\d{1,2})\.?\s+인허가\s*시기/)?.[1]||''
 return {
  ...base,
  approvalDate:permitApproval||pick([/(?:사용\s*승인\s*일|사용\s*승인|준공\s*일)\s*[:：]?\s*(\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2})/])||base.approvalDate,
  buildingBasement:basement||base.buildingBasement,
  buildingGround:ground||base.buildingGround,
  buildingUse:use||base.buildingUse,
  buildingStructure:structure||base.buildingStructure,
  landArea:land||base.landArea,
  totalArea:total||base.totalArea,
  buildingArea:building||base.buildingArea,
  buildingElevator:elevator||base.buildingElevator,
  parking:parking||base.parking,
 }
}

export async function parseBuildingRegister(file:File):Promise<{fields:BuildingPdfFields;floors:BuildingFloorRow[];text:string}>{
 let base=await extractBuildingPdf(file)
 let fields=mergeFields(base.fields,base.text)
 let floors=parseFloorRows(base.text)
 const hasUsefulData=Boolean(fields.buildingUse||fields.buildingStructure||fields.landArea||fields.totalArea||fields.buildingArea||floors.length)
 // 이미지형 PDF는 텍스트 길이가 길어도 실제 항목이 하나도 추출되지 않을 수 있다.
 // 이 경우에도 OCR을 재시도한다.
 if(base.text.replace(/\s/g,'').length<40||!hasUsefulData){
  const ocr=await extractBuildingPdfWithOcr(file)
  const ocrFields=mergeFields(ocr.fields,ocr.text)
  const ocrFloors=parseFloorRows(ocr.text)
  if(ocrFields.buildingUse||ocrFields.buildingStructure||ocrFields.landArea||ocrFields.totalArea||ocrFields.buildingArea||ocrFloors.length){fields=ocrFields;floors=ocrFloors;base={...base,text:ocr.text}}
 }
 return {fields,floors,text:base.text}
}
