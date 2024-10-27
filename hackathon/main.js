const OPENAI_API_KEY = '----';
const sttAPI_KEY = '----';

// DOM 요소
const recordButton = document.getElementById('recordButton');
const micIcon = document.getElementById('micIcon');

// 상태 관리
let audioContext = null;
let audioStream = null;
let isRecording = false;
let isProcessing = false;

// 주문 관리
const orderList = new Map();
const menuPrices = {
    '에스프레소': 3500,
    '아메리카노': 2500,
    '카페라떼': 3000,
    '카푸치노': 4000,
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

const playAudio = (filename) => {
    const audio = new Audio(`audio/${filename}.mp3`);
    audio.play().catch(error => {
        console.error('오디오 재생 실패:', error);
    });
};


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

// 유틸리티 함수
const createAudioContext = () => {
    return new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 16000
    });
};

const updateMicIcon = (recording) => {
    micIcon.innerHTML = recording ? `
        <line x1="1" y1="1" x2="23" y2="23"></line>
        <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path>
        <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"></path>
        <line x1="12" y1="19" x2="12" y2="23"></line>
        <line x1="8" y1="23" x2="16" y2="23"></line>
    ` : `
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
        <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
        <line x1="12" y1="19" x2="12" y2="23"></line>
        <line x1="8" y1="23" x2="16" y2="23"></line>
    `;
};

// 오디오 처리 함수
const convertFloat32ToInt16 = (float32Array) => {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
        const s = Math.max(-1, Math.min(1, float32Array[i]));
        int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return int16Array;
};

const createWAVFile = (samples, sampleRate) => {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);
    
    const writeString = (view, offset, string) => {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    };

    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(view, 36, 'data');
    view.setUint32(40, samples.length * 2, true);

    for (let i = 0; i < samples.length; i++) {
        view.setInt16(44 + i * 2, samples[i], true);
    }

    return buffer;
};

// 음성 녹음 관련 함수
const startRecording = async () => {
    try {
        if (isRecording) return;

        // 이전 스트림 정리
        if (audioStream) {
            audioStream.getTracks().forEach(track => track.stop());
        }

        audioStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                channelCount: 1,
                sampleRate: 16000,
                sampleSize: 16
            }
        });

        audioContext = createAudioContext();
        const source = audioContext.createMediaStreamSource(audioStream);
        const processor = audioContext.createScriptProcessor(1024, 1, 1);
        let audioChunks = []; // 배열 이름을 더 명확하게 변경

        processor.onaudioprocess = (e) => {
            const inputData = e.inputBuffer.getChannelData(0);
            const int16Data = convertFloat32ToInt16(inputData);
            // 데이터를 작은 청크로 나누어 저장
            audioChunks.push(...Array.from(int16Data));
        };

        source.connect(processor);
        processor.connect(audioContext.destination);

        isRecording = true;
        updateMicIcon(true);
        console.log('녹음 시작');

        return () => {
            isRecording = false;
            processor.disconnect();
            source.disconnect();
            audioStream.getTracks().forEach(track => track.stop());
            
            if (audioContext) {
                audioContext.close();
            }

            const wavBuffer = createWAVFile(new Int16Array(audioChunks), 16000);
            return wavBuffer;
        };
    } catch (error) {
        console.error('마이크 접근 오류:', error);
        alert('마이크 접근에 실패했습니다. 마이크 권한을 확인해주세요.');
        throw error;
    }
};

const updateMicButtonStyle = (recording) => {
    const button = document.getElementById('recordButton');
    if (recording) {
        button.classList.add('recording');
    } else {
        button.classList.remove('recording');
    }
};


// 음성 인식 함수
const transcribeSpeech = async (wavBuffer) => {
    try {
        // ArrayBuffer를 Base64로 변환
        const base64Audio = await arrayBufferToBase64(wavBuffer);
        console.log('Google Speech-to-Text API 요청 전송 중...');
        
        const response = await fetch(
            `https://speech.googleapis.com/v1/speech:recognize?key=${sttAPI_KEY}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    config: {
                        encoding: 'LINEAR16',
                        sampleRateHertz: 16000,
                        languageCode: 'ko-KR',
                        model: 'default',
                        enableAutomaticPunctuation: true,
                    },
                    audio: {
                        content: base64Audio
                    }
                })
            }
        );

        if (!response.ok) {
            const errorData = await response.json();
            console.error('API 오류:', errorData);
            throw new Error(`API 오류: ${errorData.error?.message || '알 수 없는 오류'}`);
        }

        const data = await response.json();
        console.log('API 응답:', data);

        if (data.results?.[0]?.alternatives?.[0]?.transcript) {
            const recognizedText = data.results[0].alternatives[0].transcript;
            console.log('인식된 텍스트:', recognizedText);
            return recognizedText;
        }
        
        throw new Error('음성을 인식하지 못했습니다.');
    } catch (error) {
        console.error('음성 인식 오류:', error);
        alert(error.message || '음성 인식 중 오류가 발생했습니다.');
        return null;
    }
};

const arrayBufferToBase64 = (buffer) => {
    return new Promise((resolve, reject) => {
        const blob = new Blob([buffer], { type: 'application/octet-stream' });
        const reader = new FileReader();
        reader.onloadend = () => {
            const dataUrl = reader.result;
            const base64 = dataUrl.split(',')[1];
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

// GPT 처리 함수
const processWithGPT = async (message) => {
    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'system',
                        content: `당신은 주문 처리 시스템입니다. 사용자가 입력한 문장에서 메뉴 이름과 수량을 정확히 추출하여 다음과 같은 형식으로 출력해야 합니다:
    
출력 형식:
[메뉴1 이름] [수량]개, [메뉴2 이름] [수량]개, ...
    
주의 사항:
1. "메뉴:"나 "수량:"과 같은 라벨을 포함하지 마세요.
2. 수량은 정수로 표시해야 합니다.
3. "개"는 항상 수량 뒤에 위치해야 합니다.
4. 응답은 반드시 "[메뉴1 이름] [수량]개, [메뉴2 이름] [수량]개, ..." 형식으로만 작성해야 하며, 다른 형식이나 추가적인 텍스트는 포함하지 마세요.
5. 응답의 끝은 반드시 "개"로 끝나야 합니다.
6. 응답의 끝에 구두점을 포함하지 마세요.
7. 주문 가능한 메뉴는 다음과 같습니다: 에스프레소, 아메리카노, 카페라떼, 카푸치노, 레몬에이드, 청포도에이드, 자몽에이드, 아이스티, 블랙티, 캐모마일, 치즈도넛, 롤케이크, 크루아상.
8. 사용자가 메뉴 이름의 줄임말이나 철자가 약간 다른 경우, 올바른 메뉴 이름으로 변환하여 출력하세요. 예를 들어, "롤케잌"은 "롤케이크", "레모네이드"는 "레몬에이드"로 인식합니다.
9. 주문하려는 메뉴가 리스트에 없는 경우, "오류: [메뉴 이름]은(는) 주문 가능한 메뉴가 아닙니다." 형식으로 오류 메시지를 출력하세요.
10. 사용자가 오늘 먹기 좋은 메뉴를 추천해달라고 요청하는 경우, 대중적인 메뉴 중 하나를 임의로 선택하여 "[메뉴 이름] 1개" 형식으로 출력하세요.
11. 사용자가 메뉴 주문 시 포함하는 온도를 의미하는 단어(예: "따뜻한", "차가운", "아이스", "핫")는 무시하고 처리하세요.
    
12. 예시:
    
입력: 에스프레소 2개, 크루아상 1개 주문할게요.
출력: 에스프레소 2개, 크루아상 1개

입력: 아메리카노 1개와 레몬에이드 2개 주세요.
출력: 아메리카노 1개, 레몬에이드 2개

입력: 블루베리 스무디 1개 주세요.
출력: 오류: 블루베리 스무디은(는) 주문 가능한 메뉴가 아닙니다.

입력: 오늘 먹기 좋은 메뉴 추천해줘.
출력: 카페라떼 1개

입력: 롤케잌 2개 주세요.
출력: 롤케이크 2개

입력: 치즈도넛 3개와 아이스티 2개 주문합니다.
출력: 치즈도넛 3개, 아이스티 2개    

입력: 레모네이드 한 잔 부탁해요.
출력: 레몬에이드 1개

입력: 청포도에이드 2개, 자몽에이드 1개 주세요.
출력: 청포도에이드 2개, 자몽에이드 1개

입력: 크루아상 2개와 롤케잌 1개 주문할게.
출력: 크루아상 2개, 롤케이크 1개

입력: 아이스티 1개, 카페라떼 2개, 블랙티 1개 주세요.
출력: 아이스티 1개, 카페라떼 2개, 블랙티 1개

입력: 따뜻한 아메리카노 하나 주세요.
출력: 아메리카노 1개

입력: 차가운 아이스티 2개 주문해줘.
출력: 아이스티 2개

입력: 핫 카페라떼 1개와 차가운 레몬에이드 1개 주세요.
출력: 카페라떼 1개, 레몬에이드 1개

입력: 아이스 아메리카노 하나 주세요.
출력: 아메리카노 1개

입력: 카푸치노 한 잔 부탁해요.
출력: 카푸치노 1개
                        `
                    },
                    { role: 'user', content: message }
                ],
            }),
        });

        if (!response.ok) throw new Error('GPT API 오류');
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content?.trim() || '';
        
        // GPT 응답을 콘솔에 출력
        console.log('GPT 응답:', content);

        return content;
    } catch (error) {
        console.error('GPT 처리 오류:', error);
        alert('주문 처리 중 오류가 발생했습니다.');
        return '';
    }
};

// 주문 처리 함수
const processOrder = (orderText) => {
    if (!orderText) return;
    if (orderText.startsWith('오류:')) {
        alert(orderText);
        return;
    }

    const orderItems = orderText.split(', ').map(item => {
        const match = item.match(/(.+?)\s+(\d+)개/);
        return match ? { menu: match[1], quantity: parseInt(match[2]) } : null;
    }).filter(Boolean);

    orderItems.forEach(({menu, quantity}) => {
        if (menuPrices[menu]) {
            orderList.set(menu, (orderList.get(menu) || 0) + quantity);
        }
    });

    updateOrderListUI();
};

// UI 업데이트 함수
const updateOrderListUI = () => {
    const orderListElement = document.querySelector('.order-list');
    
    // 기존 총 가격 요소 제거
    const existingTotalPrice = orderListElement.querySelector('.total-price');
    if (existingTotalPrice) {
        existingTotalPrice.remove();
    }

    // 총 가격 계산
    let totalPrice = 0;
    orderList.forEach((quantity, menu) => {
        totalPrice += menuPrices[menu] * quantity;
    });

    // 새로운 총 가격 요소 생성 및 최상단 삽입
    const totalPriceElement = document.createElement('p');
    totalPriceElement.className = 'total-price';
    totalPriceElement.textContent = `총 가격: ${totalPrice.toLocaleString()}원`;
    orderListElement.insertBefore(totalPriceElement, orderListElement.querySelector('h3').nextSibling);

    // 주문 목록 (ul) 관리
    let orderListContainer = orderListElement.querySelector('ul') || 
                            document.createElement('ul');
    if (!orderListElement.contains(orderListContainer)) {
        orderListElement.insertBefore(orderListContainer, totalPriceElement.nextSibling);
    }

    // 주문 목록 내용 업데이트
    orderListContainer.innerHTML = '';
    orderList.forEach((quantity, menu) => {
        const itemTotal = menuPrices[menu] * quantity;
        const li = document.createElement('li');
        li.innerHTML = `
            <div class="order-item">
                <span class="menu-name">${menu}</span>
                <span class="quantity">${quantity}개</span>
                <span class="price">${itemTotal.toLocaleString()}원</span>
                <button class="cancel-button" onclick="removeMenuItem('${menu}')">×</button>
            </div>
        `;
        orderListContainer.appendChild(li);
    });
};

// 이벤트 핸들러
let stopRecordingCallback = null;

const handleStartRecording = async () => {
    try {
        stopRecordingCallback = await startRecording();
        updateMicButtonStyle(true);
    } catch (error) {
        console.error('녹음 시작 실패:', error);
    }
};

const handleStopRecording = async () => {
    if (!stopRecordingCallback) return;

    try {
        const wavBuffer = stopRecordingCallback();
        updateMicButtonStyle(false);
        updateMicIcon(false);
        
        const recognizedText = await transcribeSpeech(wavBuffer);
        if (recognizedText) {
            const gptResponse = await processWithGPT(recognizedText);
            processOrder(gptResponse);
            // 주문 처리 후 주문 목록 읽기
            await readOrderList();
        }
    } catch (error) {
        console.error('녹음 중지 실패:', error);
        alert('녹음 처리 중 오류가 발생했습니다.');
    } finally {
        isRecording = false;
    }
};

const readOrderList = async () => {
    const audioFiles = [];
    
    orderList.forEach((quantity, menu) => {
        // 메뉴 이름 오디오 파일 매핑
        const menuAudioMapping = {
            '에스프레소': '에스',
            '아메리카노': '아메',
            '카페라떼': '카페',
            '카푸치노': '카푸',
            '레몬에이드': '레몬',
            '청포도에이드': '청포',
            '자몽에이드': '자몽',
            '아이스티': '아이스',
            '블랙티': '블랙',
            '캐모마일': '캐모',
            '치즈도넛': '치즈',
            '롤케이크': '롤케',
            '크루아상': '크루'
        };

        // 메뉴 이름 오디오 추가
        const menuAudio = menuAudioMapping[menu];
        if (menuAudio) {
            audioFiles.push(menuAudio);  // 메뉴 이름
            audioFiles.push(quantity.toString());  // 수량
        }
    });

    // 순차적으로 오디오 재생
    if (audioFiles.length > 0) {
        await playAudioSequence(audioFiles);
    }
};

const playAudioSequence = async (audioFiles) => {
    for (const file of audioFiles) {
        await new Promise((resolve) => {
            const audio = new Audio(`audio/${file}.mp3`);
            audio.onended = resolve;  // 오디오 재생이 끝나면 다음으로 진행
            audio.play().catch(error => {
                console.error('오디오 재생 실패:', error);
                resolve();  // 에러가 나도 다음 진행
            });
        });
    }
};


// 메뉴 제거 함수
const removeMenuItem = (menu) => {
    orderList.delete(menu);
    updateOrderListUI();
};

const handleMenuClick = (menuName) => {
    // 메뉴별 오디오 파일명 매핑
    const audioMapping = {
        '에스프레소': '에스',
        '아메리카노': '아메',
        '카페라떼': '카페',
        '카푸치노': '카푸',
        '레몬에이드': '레몬',
        '청포도에이드': '청포',
        '자몽에이드': '자몽',
        '아이스티': '아이',
        '블랙티': '블랙',
        '캐모마일': '캐모',
        '치즈도넛': '치즈',
        '롤케이크': '롤케',
        '크루아상': '크루'
    };

    // 해당 메뉴의 음성 파일 재생
    const audioFile = audioMapping[menuName];
    if (audioFile) {
        playAudio(audioFile);
    }

    // 기존의 주문 처리
    orderList.set(menuName, (orderList.get(menuName) || 0) + 1);
    updateOrderListUI();
};

// 초기화 및 이벤트 리스너
const initialize = () => {
    // 시작 음성 재생
    playAudio('시작');
 
    // 모든 메뉴 아이템에 클릭 이벤트 추가
    const menuItems = document.querySelectorAll('.menu-item');
    menuItems.forEach(item => {
        // 첫 번째 p 태그에서 메뉴 이름을 가져옴 (가격이 아닌 메뉴 이름)
        const paragraphs = item.getElementsByTagName('p');
        if (paragraphs.length >= 1) {
            const menuName = paragraphs[0].textContent.trim();
            item.style.cursor = 'pointer';
            
            // 메뉴 아이템 전체 영역 클릭 이벤트
            item.addEventListener('click', () => handleMenuClick(menuName));
            // 드래그 방지
            item.addEventListener('mousedown', (e) => e.preventDefault());
        }
    });
 
    // 마이크 버튼 요소 생성 및 설정
    const voiceContainer = document.querySelector('.voice-container');
    const recordButton = document.createElement('button');
    recordButton.id = 'recordButton';
    recordButton.appendChild(document.getElementById('micIcon'));
    voiceContainer.innerHTML = '';
    voiceContainer.appendChild(recordButton);
 
    // 주문하기 버튼 생성
    const orderButton = document.createElement('button');
    orderButton.className = 'order-button';
    orderButton.textContent = '주문하기';
    document.body.appendChild(orderButton);
 
    // 주문하기 버튼 이벤트 리스너
    orderButton.addEventListener('click', () => {
        if (orderList.size === 0) {
            alert('주문 목록이 비어있습니다.');
            return;
        }
 
        const totalPrice = Array.from(orderList.entries())
            .reduce((total, [menu, quantity]) => 
                total + (menuPrices[menu] * quantity), 0);
 
        alert(`총 ${totalPrice.toLocaleString()}원이 결제됩니다.`);
        window.location.href = 'jumun.html';
    });
 
    // 음성 인식 버튼 이벤트
    recordButton.addEventListener('click', () => {
        if (isRecording) {
            handleStopRecording();
        } else {
            handleStartRecording();
        }
    });
 };

// 초기화 실행
document.addEventListener('DOMContentLoaded', initialize);