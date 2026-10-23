# Maple MVP

메이플스토리 MVP작의 캐시 아이템 판매와 메소마켓 메소 구매를 비교하는 한국어 정적 웹 계산기.

## 실행

Node.js 22 이상. 외부 npm 의존성 없이 동작합니다.

```sh
npm run dev
# http://127.0.0.1:4173/maple-mvp/
npm test
npm run build
```

배포 파일은 `dist/`에 생성됩니다. HTML 직접 열기 대신 로컬 서버를 사용하세요(ES modules).

## 기능과 계산 기준

- 캐시 아이템 추가·수정·삭제(최대 100개), 입력값 localStorage 저장.
- 경매장 수수료 3% 고정, 메소마켓 수수료 0% 고정(사용자 요구사항).
- 1만 캐시당 효율 순위, 예산 내 정수 구매 순위, 동률 처리.
- 아이템 개당 실수령, 메소마켓 대비 효율, 손익분기 경매장 판매가.
- 메포 지급 패키지 가격/지급량과 메소마켓 구매 단위 수정.
- 잔여 캐시와 메포를 실수령 메소에 합치지 않고 별도 표시.
- 모바일 대응, 키보드 조작, 오류·빈 목록·저장 불가 처리.

판매가 입력 단위는 **억 메소**, 메소마켓 시세는 **메포 / 1억 메소**입니다. 기본값은 실시간 시세가 아닌 예시입니다. 각 아이템을 예산 내에서 단독 구매하는 비교이며 혼합 최적화나 구매 한도 자동 적용은 하지 않습니다.

정규화 아이템 효율 = 판매가 × 0.97 / 아이템 캐시 × 10,000.
정규화 마켓 효율 = 패키지 메포 / 패키지 캐시 / 1억당 메포 × 100,000,000 × 10,000.
실제 구매량은 예산/가격을 내림합니다. 마켓은 패키지를 정수 구매한 뒤 지정한 메소 구매 단위로 다시 내림합니다. 수수료의 1메소 미만 처리는 근사이며 수량 한도·호가 변동·매물 체결 여부는 게임에서 확인해야 합니다.

예시: 2,200캐시 / 1.05억 판매 아이템은 수수료 차감 후 1.0185억. 1만 캐시당 약 4.6295억이며, 1:1 메포 전환 및 1억당 2,200메포인 마켓(약 4.5455억) 대비 1.85% 유리합니다.

## 조사 근거 (2026-10-24)

- [공식 MVP 시스템](https://maplestory.nexon.com/Guide/N23GameInformation/Articles/425): 사용 넥슨캐시 기준. 상품에 따라 인벤토리 이동 또는 구매 시 반영되며 일부 제외 상품이 존재합니다. 단순 충전은 실적으로 간주하지 않습니다.
- [공식 캐시샵](https://maplestory.nexon.com/guide/n23gameinformation/articles/424): 파워 엘릭서 패키지 보너스 등으로 메포 획득 가능. 메포로 구매한 상품은 교환 제한이 있으므로 이 계산기의 판매 경로는 넥슨캐시 구매를 전제로 합니다.
- [공식 메소마켓 검색 가이드](https://maplestory.nexon.com/Guide/N23GameInformation/Articles/Search?keyword=%EB%A9%94%EC%86%8C%EB%A7%88%EC%BC%93): 메포와 메소 교환 경로. 과거 가이드와 현재 가이드의 이용 조건이 달라 거래 횟수·레벨 제한은 코드에 고정하지 않았습니다.

MVP 등급/실적을 자동 판정하지 않습니다. 패키지의 MVP 인정 여부·상품별 사용 시점·거래 가능 여부는 게임 내 안내를 우선합니다. 할인 충전, 마일리지, MVP 보상과 크레딧 가치는 제외합니다. '수익'은 현금 환금 수익이 아니라 확보 메소 비교입니다.

## GitHub Pages 배포

저장소명: `maple-mvp`. 신규 저장소 기본 브랜치는 `main`으로 준비합니다.

1. GitHub에 `maple-mvp` 저장소를 생성하고 로컬 파일을 커밋·push합니다.
2. 저장소 **Settings → Pages → Build and deployment → Source: GitHub Actions**로 설정합니다.
3. `main` push 또는 Actions의 `Validate and deploy GitHub Pages`를 수동 실행합니다.
4. 테스트와 정적 파일 패키징이 통과하면 Pages로 배포됩니다.

예상 URL 형식: `https://<GitHub계정>.github.io/maple-mvp/` (실제 배포 주소는 Actions 결과에서 확인).

```sh
# GitHub CLI 로그인 및 저장소 생성은 소유 계정을 확인한 후 실행
gh auth login
git add .
git commit -m "Build Maple MVP comparison calculator"
gh repo create maple-mvp --public --source=. --remote=origin
git push -u origin main
# GitHub Pages Source를 GitHub Actions로 설정 후, 필요하면 수동 재실행
gh workflow run pages.yml
```

[GitHub 공식 배포 워크플로 문서](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)

## 구조

- `src/calculate.js`: 검증·계산·저장 데이터 복구(브라우저와 테스트에서 공유).
- `src/app.js`: UI와 안전한 텍스트 렌더링, 입력 저장.
- `src/styles.css`: 반응형 레이아웃. Google Fonts 실패 시 시스템 글꼴 사용.
- `test/calculate.test.js`: 수수료, 환율, 정수 수량, 잔액, 동률, 경계값 테스트.
- `.github/workflows/pages.yml`: PR 검증 및 main 배포. 외부 npm 패키지 설치 불필요.
