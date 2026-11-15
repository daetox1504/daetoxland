export type MarketType = 'rent' | 'sale'
export type Area = { sqm: number; pyeong: number }
export type BaseProperty = { id:string; name:string; category:string; address:string; floor:string; exclusiveArea:Area; status:'준비'|'진행'|'상황'|'보류'|'거래완료'; favorite:boolean; manager:string; photos:string[]; updatedAt:string }
export type RentalProperty = BaseProperty & { marketType:'rent'; deposit:string; monthlyRent:string; maintenance:string; premium:string; leaseArea:Area }
export type SaleProperty = BaseProperty & { marketType:'sale'; salePrice:string; entryPrice:string; unitPrice:string; contractArea:Area; leaseNote:string }
export type Property = RentalProperty | SaleProperty
export type Customer = { id:string; name:string; marketType:MarketType; category:string; phone:string; budget:string; status:'상담중'|'매물안내'|'종료'; memo:string; updatedAt:string }
