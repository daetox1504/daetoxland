import { extractBuildingPdf, BuildingPdfFields } from './buildingPdf'

export type BuildingFloorRow={floor:string;structure:string;usage:string;area:string}
export async function parseBuildingRegister(file:File):Promise<{fields:BuildingPdfFields;floors:BuildingFloorRow[];text:string}>{
 const base=await extractBuildingPdf(file); const text=base.text.replace(/\s+/g,' ').trim(); const fields={...base.fields}
 const structureUse=text.match(/주구조\s+주용도\s+층수\s+([^ ]+)\s+([^ ]+)\s+(?:지하\s*:\s*)?\d+층[, ]*지상\s*:\s*\d+층/)
 if(structureUse){fields.buildingStructure=structureUse[1];fields.buildingUse=structureUse[2]}
 const floorMatches=[...text.matchAll(/(지하층|\d+층)\s+([^ ]+)\s+([^ ]+)\s+([\d,.]+)/g)]
 const floors=floorMatches.map(match=>({floor:match[1],structure:match[2],usage:match[3],area:match[4]})).filter(row=>row.usage.includes('근린')||row.usage.includes('주차')||row.structure.includes('철근'))
 return {fields,floors,text}
}
