import { extractBuildingPdf, BuildingPdfFields } from './buildingPdf'
import { extractBuildingPdfWithOcr } from './buildingOcrFixed'

export type BuildingFloorRow={floor:string;structure:string;usage:string;area:string;areaPyeong?:string;note?:string}
const SQM_PER_PYEONG = 3.305785
function formatPyeong(value:string){
 const number=Number(value)
 if(!Number.isFinite(number)) return ''
 const truncated=Math.trunc((number/SQM_PER_PYEONG)*10)/10
 return Number.isInteger(truncated)?String(truncated):truncated.toFixed(1)
}
function cleanFloorUsage(value:string){
 let usage=value.replace(/\s+/g,' ').trim()
 const metadata=usage.search(/\s+(?:일반건축물대장|건물ID|고유번호|명칭|대지위치|도로명주소|주구조|주용도|층수|건축물\s*현황|※)/i)
 if(metadata>=0) usage=usage.slice(0,metadata).trim()
 const area=usage.search(/\s+\d[\d,.]*(?:\s|$)/)
 if(area>=0) usage=usage.slice(0,area).trim()
 return usage
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
  const key=`${floor}|${structure}|${area}`
  const existing=seen.get(key)
  if(existing!==undefined){
   if(rows[existing].usage.length<=usage.length) return
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
  const key=`${floor}|${structure}|${area}`
  const existing=seen.get(key)
  if(existing!==undefined){
   if(rows[existing].usage.length<=usage.length) return
   rows[existing]={floor,structure,usage,area,areaPyeong:formatPyeong(area),note:''}
   return
  }
  seen.set(key,rows.length)
  rows.push({floor,structure,usage,area,areaPyeong:formatPyeong(area),note:''})
 })
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
