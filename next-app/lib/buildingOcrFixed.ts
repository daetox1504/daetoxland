import { extractBuildingPdf, BuildingPdfFields } from './buildingPdf'

function parseFields(text:string):BuildingPdfFields {
  const pick=(re:RegExp)=>text.match(re)?.[1]?.trim()||''
  return { approvalDate:pick(/(?:사용승인일|사용승인|준공일)[^0-9]*(\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2})/), buildingBasement:pick(/(?:지하총층수|지하층|지하)[^0-9-]*(-?\d+)\s*층?/), buildingGround:pick(/(?:지상총층수|지상층|지상)[^0-9]*(\d+)\s*층?/), buildingUse:pick(/(?:주용도|용도)\s*[:：]?\s*([^\n]{2,30})/), buildingStructure:pick(/(?:주구조|구조)\s*[:：]?\s*([^\n]{2,30})/), landArea:pick(/(?:대지면적)\s*[:：]?\s*([\d,.]+)/), totalArea:pick(/(?:연면적)\s*[:：]?\s*([\d,.]+)/), buildingArea:pick(/(?:건축면적)\s*[:：]?\s*([\d,.]+)/), buildingElevator:pick(/(?:승강기|엘리베이터)\s*[:：]?\s*([^\n]{1,20})/), parking:pick(/(?:주차대수|주차)\s*[:：]?\s*([^\n]{1,20})/) }
}

export async function extractBuildingPdfWithOcr(file:File,onProgress?:(value:number)=>void){
  const base=await extractBuildingPdf(file); if(base.text.replace(/\s/g,'').length>=40)return base
  const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs'); const {createWorker}=await import('tesseract.js')
  const pdfDocument=await pdfjs.getDocument({data:await file.arrayBuffer(),disableWorker:true} as any).promise; const worker=await createWorker('kor+eng',1,{logger:(message)=>{if(message.status==='recognizing text')onProgress?.(message.progress)}}); const pages:string[]=[]
  for(let pageNumber=1;pageNumber<=pdfDocument.numPages;pageNumber++){const page=await pdfDocument.getPage(pageNumber);const viewport=page.getViewport({scale:2});const canvas=globalThis.document.createElement('canvas');canvas.width=viewport.width;canvas.height=viewport.height;const context=canvas.getContext('2d');if(!context)continue;await page.render({canvas,canvasContext:context,viewport}).promise;const result=await worker.recognize(canvas);pages.push(result.data.text)}
  await worker.terminate(); const text=pages.join('\n'); return {text,fields:parseFields(text)}
}
