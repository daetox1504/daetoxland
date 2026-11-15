import { Workspace } from '../page'
export default function CustomersPage(){return <Workspace title="고객장부" description="고객 정보와 상담일지 히스토리를 관리합니다." sections={[["고객 목록","임대·매매 구분과 상태별로 고객을 관리합니다.","/customers"],["상담일지","최신 상담 기록과 작성 시각을 보관합니다.","/customers"],["고객 메모","고객별 메모와 예산 정보를 관리합니다.","/customers"]]}/>}
