import { extractBuildingPdf, BuildingPdfFields } from './buildingPdf'
import { extractBuildingPdfWithOcr } from './buildingOcrFixed'

export type BuildingFloorRow={floor:string;structure:string;usage:string;area:string;areaPyeong?:string;note?:string}
export type BuildingViolationStatus = 'O'|'X'|''
const SQM_PER_PYEONG = 3.305785
function formatPyeong(value:string){
 const number=Number(value)
 if(!Number.isFinite(number)) return ''
 const truncated=Math.trunc((number/SQM_PER_PYEONG)*10)/10
 return Number.isInteger(truncated)?String(truncated):truncated.toFixed(1)
}
function cleanFloorUsage(value:string){
 let usage=value.replace(/\s+/g,' ').trim()
 if(/(?:^|\s)(?:구분|수량|용량|변동|인허가|사용승인|건축물|대지위치|도로명주소|경면적)(?:\s|$)/i.test(usage)) return ''
 const metadata=usage.search(/\s+(?:일반건축물대장|건물ID|고유번호|명칭|대지위치|도로명주소|주구조|주용도|층수|건축물\s*현황|※)/i)
 if(metadata>=0) usage=usage.slice(0,metadata).trim()
 const area=usage.search(/\s+\d[\d,.]*(?:\s|$)/)
 if(area>=0) usage=usage.slice(0,area).trim()
 return usage
}

// PDF.js의 텍스트 레이어는 페이지/열 순서를 섞어 반환할 수 있으므로,
// 건축물현황 표가 의도한 층 순서(지하 → 1층 → 2층 …)를 마지막에 복원한다.
// 같은 층의 여러 행은 입력 순서를 그대로 유지한다(ES2019 stable sort).
function floorOrder(value:string){
 const normalized=value.replace(/\s+/g,'')
 if(/지하층/i.test(normalized)) return -1
 const basement=normalized.match(/지하(-?\d+)층/i)
 if(basement) return Number(basement[1]) * -1
 const numeric=normalized.match(/(-?\d+)층/)
 return numeric ? Number(numeric[1]) : Number.MAX_SAFE_INTEGER
}

/**
 * 건축물대장 텍스트에서 위반건축물 상태를 판정한다.
 * PDF마다 단어 사이에 공백/줄바꿈이 들어갈 수 있어 먼저 정규화하고,
 * "위반건축물 해제/해당 없음"은 마지막 표기 기준으로 명시적으로 제외한다.
 */
export function detectViolationStatus(text:string):BuildingViolationStatus{
 const normalized=text
  .replace(/[\u200B-\u200D\uFEFF]/g,'')
  .replace(/위반\s*건축물/gi,'위반건축물')
  .replace(/\s+/g,' ')
  .trim()
 const matches=[...normalized.matchAll(/위반건축물/gi)]
 if(!matches.length) return ''
 let status:BuildingViolationStatus=''
 for(const match of matches){
  const index=match.index??0
  const context=normalized.slice(Math.max(0,index-48),Math.min(normalized.length,index+72))
  if(/위반건축물\s*(?:해제|없음|해당\s*없음|미해당)|(?:해제|없음|해당\s*없음|미해당)\s*위반건축물/i.test(context)) status='X'
  else status='O'
 }
 return status
}

function parseFloorRows(text:string):BuildingFloorRow[] {
 const rows:BuildingFloorRow[]=[]
 const seen=new Map<string,number>()
 const add=(match:RegExpMatchArray)=>{
  const area=match[4].replace(/,/g,'')
  const floor=match[1].replace(/\s+/g,'')
  const structure=match[2].trim()
  const usage=cleanFloorUsage(match[3])
  if(!usage||usage.length>120) return
  const key=`${floor}|${structure}|${usage}`
  const existing=seen.get(key)
  if(existing!==undefined){
   if(Number(rows[existing].area)>=Number(area)) return
   rows[existing]={floor,structure,usage,area,areaPyeong:formatPyeong(area),note:''}
   return
  }
  seen.set(key,rows.length)
  rows.push({floor,structure,usage,area,areaPyeong:formatPyeong(area),note:''})
 }
 // PDF.js는 표의 셀 사이 공백을 제거하거나 다음 행의 "주1"을 바로 붙이는
 // 경우가 있으므로, 행 번호(주1) 또는 이하여백을 행의 경계로 사용한다.
 const pattern=/(?:주\d+\s*)?((?:(?:지하|지상)\s*층|(?:지하|지상)?\s*-?\d+\s*층))\s+([^\s]+(?:조|구조))\s+(.+?)\s+([\d,.]+)\s*(?:㎡|m2|m²)?(?=\s*(?:주\d+\s+|\-\s*이하여백|$))/i
 const loosePattern=/(?:주\d+\s*)?((?:(?:지하|지상)\s*층|(?:지하|지상)?\s*-?\d+\s*층))\s*([^\s]+(?:조|구조))\s*(.+?)\s*([\d,.]+)\s*(?:㎡|m2|m²)?(?=\s*(?:주\d+\s*)?(?:(?:지하|지상)\s*층|(?:지상|지하)?\s*-?\d+\s*층)|\s*-\s*이하여백|$)/i
 for(const rawLine of text.split(/\r?\n+/)){
  const line=rawLine.replace(/\u00a0/g,' ').replace(/[ \t]+/g,' ').trim()
  if(!line) continue
  const match=line.match(pattern)
  if(!match) continue
  add(match)
 }
 // PDF.js가 같은 표를 한 줄로 합쳐 반환하는 경우가 있어
 // 줄 단위 추출 결과가 있더라도 압축 텍스트를 한 번 더 훑어 누락된 층을 보완한다.
 const compact=text.replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim()
 for(const match of compact.matchAll(new RegExp(pattern.source,'gi'))) add(match)
 for(const match of compact.matchAll(new RegExp(loosePattern.source,'gi'))) add(match)
 // 마지막 보완 단계: PDF.js가 행 번호/공백을 모두 제거한 경우에도
 // 층 라벨 단위로 구간을 나눠 구조·용도·면적을 복원한다.
 const floorToken=/(?:(?:지하|지상)\s*층|(?:지하|지상)?\s*-?\d+\s*층)/gi
 const tokens=[...compact.matchAll(floorToken)]
 tokens.forEach((token,index)=>{
  const floor=token[0].replace(/\s+/g,'')
  const start=(token.index??0)+token[0].length
  const end=index+1<tokens.length?(tokens[index+1].index??compact.length):compact.length
  const segment=compact.slice(start,end)
  const structureMatch=segment.match(/([^\s]+(?:조|구조))/i)
  if(!structureMatch||structureMatch.index===undefined) return
  const afterStructure=segment.slice(structureMatch.index+structureMatch[0].length)
  const areaMatch=afterStructure.match(/([\d,.]+)\s*(?:㎡|m2|m²)?/i)
  if(!areaMatch) return
  const usage=cleanFloorUsage(afterStructure.slice(0,areaMatch.index??0))
  const area=areaMatch[1].replace(/,/g,'')
  if(!usage||usage.length>120) return
  const structure=structureMatch[1].trim()
  const key=`${floor}|${structure}|${usage}`
  const existing=seen.get(key)
  if(existing!==undefined){
   if(Number(rows[existing].area)>=Number(area)) return
   rows[existing]={floor,structure,usage,area,areaPyeong:formatPyeong(area),note:''}
   return
  }
  seen.set(key,rows.length)
  rows.push({floor,structure,usage,area,areaPyeong:formatPyeong(area),note:''})
 })
 rows.sort((a,b)=>floorOrder(a.floor)-floorOrder(b.floor))
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

export async function parseBuildingRegister(file:File):Promise<{fields:BuildingPdfFields;floors:BuildingFloorRow[];text:string;violation:BuildingViolationStatus}>{
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
 return {fields,floors,text:base.text,violation:detectViolationStatus(base.text)}
}
