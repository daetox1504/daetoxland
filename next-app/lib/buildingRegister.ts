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
 const pattern=/(?:주\d+\s+)?((?:지하|지상)?\s*-?\d+\s*층)\s+([^\s]+조)\s+(.+?)\s+([\d,.]+)\s*(?:㎡|m2|m²)/i
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
 return {
  ...base,
  approvalDate:base.approvalDate||pick([/(?:사용승인일|사용승인|준공일)[^0-9]*(\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2})/]),
  buildingBasement:base.buildingBasement||pick([/(?:지하총층수|지하층수|지하층|지하)[^0-9-]*(-?\d+)\s*층?/]),
  buildingGround:base.buildingGround||pick([/(?:지상총층수|지상층수|지상층|지상)[^0-9]*(\d+)\s*층?/]),
  buildingUse:base.buildingUse||pick([/주용도\s*[:：]?\s*(.+?)(?=주구조|구조|대지면적|연면적|건축면적|$)/]),
  buildingStructure:base.buildingStructure||pick([/주구조\s*[:：]?\s*(.+?)(?=주용도|대지면적|연면적|건축면적|$)/]),
  landArea:base.landArea||pick([/대지면적\s*[:：]?\s*([\d,.]+)/]),
  totalArea:base.totalArea||pick([/연면적\s*[:：]?\s*([\d,.]+)/]),
  buildingArea:base.buildingArea||pick([/건축면적\s*[:：]?\s*([\d,.]+)/]),
  buildingElevator:base.buildingElevator||pick([/(?:승강기|엘리베이터)\s*[:：]?\s*([^\s]+)/]),
  parking:base.parking||pick([/(?:주차대수|주차장|주차)\s*[:：]?\s*([^\s]+)/]),
 }
}

export async function parseBuildingRegister(file:File):Promise<{fields:BuildingPdfFields;floors:BuildingFloorRow[];text:string}>{
 let base=await extractBuildingPdf(file)
 if(base.text.replace(/\s/g,'').length<40) base=await extractBuildingPdfWithOcr(file)
 return {fields:mergeFields(base.fields,base.text),floors:parseFloorRows(base.text),text:base.text}
}
