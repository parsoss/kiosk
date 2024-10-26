const OPENAI_API_KEY = 'api-key';
 
// 전역 변수로 주문 목록과 가격 정보를 관리
let orderList = new Map(); // Map을 사용하여 메뉴별 수량 관리
const menuPrices = {
    '에스프레소': 3500,
    '아메리카노': 2500,
    '카페라떼': 4000,
    '카푸치노': 3000,
    '레몬에이드': 4000,
    '청포도에이드': 4000,
    '자몽에이드': 4000,
    '아이스티': 3500,
    '블랙티': 4500,
    '캐모마일': 5000,
    '치즈도넛': 3000,
    '롤케이크': 4000,
    '크루아상': 3000
};

// 활성 버튼 설정 및 메뉴 필터링
function setActiveButton(button) {
    const buttons = document.querySelectorAll('.category-button');
    buttons.forEach(btn => btn.classList.remove('active'));
    button.classList.add('active');
}

function filterMenu(category) {
    const items = document.querySelectorAll('.menu-item');
    items.forEach(item => {
        if (category === 'all' || item.classList.contains(category)) {
            item.style.display = 'block';
        } else {
            item.style.display = 'none';
        }
    });
}

// HTML에서 사용자 입력 요소 참조
var userInput = document.getElementById('orderInput');

// GPT 응답을 저장할 변수 선언
let gptResponseText = "";
let isProcessing = false; // API 호출 중복 방지를 위한 플래그

// 사용자 입력을 GPT-3로 전송하고 응답을 받아오는 함수
async function fetchGPTResponse() {
    if (isProcessing) return; // 이미 처리 중이면 return
    
    // 사용자 입력값을 읽어와서 공백 제거
    const message = userInput.value.trim();
    if (message === '') {
        console.warn('입력이 비어 있습니다.');
        return;
    }

    isProcessing = true;

    try {
        // GPT-3 API 호출
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
                model: 'gpt-3.5-turbo',
                messages: [
                    {
                        role: 'system',
                        content: `당신은 주문 처리 시스템입니다. 사용자가 입력한 문장에서 메뉴 이름과 수량을 정확히 추출하여 다음과 같은 형식으로 출력해야 합니다:

출력 형식:
[메뉴1 이름] [수량]개, [메뉴2 이름] [수량]개, ...

주의 사항:
- "메뉴:"나 "수량:"과 같은 라벨을 포함하지 마세요.
- 수량은 정수로 표시해야 합니다.
- 응답은 반드시 "[메뉴1 이름] [수량]개, [메뉴2 이름] [수량]개, ..." 형식으로만 작성해야 하며, 다른 형식이나 추가적인 텍스트는 포함하지 마세요.
- 응답의 끝은 반드시 "개"로 끝나야 합니다.
- 응답의 끝에 ","를 포함하지 마세요.
- 주문 가능한 메뉴는 다음과 같습니다: 에스프레소, 아메리카노, 카페라떼, 카푸치노, 레몬에이드, 청포도에이드, 자몽에이드, 아이스티, 블랙티, 캐모마일, 치즈도넛, 롤케이크, 크루아상.
- 주문하려는 메뉴가 리스트에 없는 경우, "오류: [메뉴 이름]은(는) 주문 가능한 메뉴가 아닙니다." 형식으로 오류 메시지를 출력하세요.`
                    },
                    {
                        role: 'user',
                        content: message
                    }
                ],
            }),
        });

        // API 응답이 실패하면 오류 처리
        if (!response.ok) {
            const errorData = await response.json();
            const errorMessage = errorData.error ? errorData.error.message : '알 수 없는 오류가 발생했습니다.';
            console.error(`HTTP ${response.status}: ${errorMessage}`);
            return;
        }

        // 응답 데이터를 JSON 형식으로 파싱
        const data = await response.json();

        // GPT-3의 응답에서 텍스트 추출 후 변수에 저장
        if (data.choices && data.choices.length > 0) {
            gptResponseText = data.choices[0].message.content.trim();
            console.log('GPT 응답:', gptResponseText);

            // GPT 응답을 받은 후 주문 목록 업데이트 실행
            processOrder();
            // 입력창 초기화
            userInput.value = '';
        } else {
            console.warn('GPT 응답이 비어 있습니다.');
        }

    } catch (error) {
        // 네트워크 오류 또는 기타 예외 처리
        console.error('네트워크 오류:', error.message);
        alert('주문 처리 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
        isProcessing = false;
    }
}