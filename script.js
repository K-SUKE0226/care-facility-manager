// 施設データを保存する配列（ブラウザのローカルストレージに保存）
let facilities = [];

// リアルタイム情報のキャッシュ（メモリ内保存）
let realtimeCache = {};

// 患者プロファイルデータ
let patientProfile = {};

// 自動更新のタイマーID
let autoUpdateTimer = null;

// ページ読み込み時に実行される関数
document.addEventListener('DOMContentLoaded', function() {
    loadFacilities();
    loadPatientProfile();
    setupAutoUpdate();
    setupEventListeners();
    
    // 初期値設定
    document.getElementById('lastConfirmed').value = new Date().toISOString().split('T')[0];
    
    // 初期表示（おすすめ順）
    const facilitiesWithScores = calculateRecommendationScores([...facilities]);
    const sortedFacilities = sortFacilities(facilitiesWithScores, 'recommended');
    displayFacilities(sortedFacilities);
});

// イベントリスナーを設定する関数
function setupEventListeners() {
    // フォーム送信時の処理
    document.getElementById('facilityForm').addEventListener('submit', function(e) {
        e.preventDefault(); // ページのリロードを防ぐ
        addFacility();
    });
    
    // 検索フィルターが変更されたときの処理
    document.getElementById('searchArea').addEventListener('change', searchFacilities);
    document.getElementById('searchCareLevel').addEventListener('change', searchFacilities);
    document.getElementById('searchAvailability').addEventListener('change', searchFacilities);
    document.getElementById('searchRating').addEventListener('change', searchFacilities);
    document.getElementById('sortOrder').addEventListener('change', searchFacilities);
}

// 新しい施設を追加する関数
function addFacility() {
    // フォームから値を取得
    const name = document.getElementById('facilityName').value.trim();
    const address = document.getElementById('address').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const websiteUrl = document.getElementById('websiteUrl').value.trim();
    const careLevel = Array.from(document.getElementById('careLevel').selectedOptions).map(option => option.value);
    const monthlyFee = document.getElementById('monthlyFee').value.trim();
    const medicalCare = document.getElementById('medicalCare').value.trim();
    const features = document.getElementById('features').value.trim();
    const availability = document.getElementById('availability').value;
    const notes = document.getElementById('notes').value.trim();
    const reviews = document.getElementById('reviews').value.trim();
    const area = document.getElementById('area').value;
    const detailAddress = document.getElementById('detailAddress').value.trim();
    const reliabilityLevel = document.getElementById('reliabilityLevel').value;
    const lastConfirmed = document.getElementById('lastConfirmed').value;
    const confirmationMethod = document.getElementById('confirmationMethod').value;
    
    // 必須項目のチェック
    if (!name || !address) {
        showMessage('施設名と住所は必須項目です。', 'error');
        return;
    }
    
    // 新しい施設オブジェクトを作成
    const newFacility = {
        id: Date.now(), // 簡易的なID生成（現在時刻を使用）
        name: name,
        address: address,
        phone: phone,
        websiteUrl: websiteUrl,
        careLevel: careLevel,
        monthlyFee: monthlyFee,
        medicalCare: medicalCare,
        features: features,
        availability: availability,
        notes: notes,
        reviews: reviews,
        area: area,
        detailAddress: detailAddress,
        reliabilityLevel: reliabilityLevel,
        lastConfirmed: lastConfirmed,
        confirmationMethod: confirmationMethod,
        createdAt: new Date().toISOString(), // 作成日時を記録
        realtimeInfo: null, // リアルタイム情報
        lastUpdated: null   // 最終更新時刻
    };
    
    // 施設リストに追加
    facilities.push(newFacility);
    
    // ローカルストレージに保存
    saveFacilities();
    
    // 画面を更新
    displayFacilities();
    
    // フォームをクリア
    document.getElementById('facilityForm').reset();
    
    // 成功メッセージを表示
    showMessage('施設が正常に追加されました。', 'success');
}

// 施設一覧を画面に表示する関数
function displayFacilities(filteredFacilities = null) {
    const container = document.getElementById('facilitiesTable');
    const facilitiesToShow = filteredFacilities || facilities;
    
    if (facilitiesToShow.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #666; padding: 40px;">登録された施設はありません。</p>';
        return;
    }
    
    let html = '';
    
    facilitiesToShow.forEach(facility => {
        html += `
            <div class="facility-card">
                <div class="facility-header">
                    <div>
                        <div class="facility-name">${escapeHtml(facility.name)}
                            ${facility.recommendationScore ? `<span class="recommended-badge">🎆 おすすめ</span><span class="match-score">マッチ度: ${Math.round(facility.recommendationScore)}%</span>` : ''}
                        </div>
                        ${facility.realtimeInfo && facility.realtimeInfo.averageRating ? `<span class="rating-display">★${facility.realtimeInfo.averageRating}/5.0 (${facility.realtimeInfo.reviewCount}件)</span>` : '<span class="no-rating">評価未取得</span>'}
                    </div>
                    <div>
                        <div class="facility-availability availability-${facility.availability}">${facility.availability}</div>
                        ${generateReliabilityBadge(facility)}
                        ${generateConfirmationInfo(facility)}
                    </div>
                </div>
                
                <div class="facility-info">
                    <div class="info-group">
                        <div class="info-label">住所</div>
                        <div class="info-value">${escapeHtml(facility.address)}</div>
                    </div>
                    
                    <div class="info-group">
                        <div class="info-label">エリア</div>
                        <div class="info-value">${escapeHtml(facility.area || '未設定')}</div>
                    </div>
                    
                    <div class="info-group">
                        <div class="info-label">電話番号</div>
                        <div class="info-value">${escapeHtml(facility.phone) || '未設定'}</div>
                    </div>
                    
                    <div class="info-group">
                        <div class="info-label">ホームページ</div>
                        <div class="info-value">
                            ${facility.websiteUrl ? 
                                `<a href="${escapeHtml(facility.websiteUrl)}" target="_blank" class="website-link">サイトを開く</a>` : 
                                '未設定'
                            }
                        </div>
                    </div>
                    
                    <div class="info-group">
                        <div class="info-label">受け入れ可能な要介護度</div>
                        <div class="info-value">${facility.careLevel.length > 0 ? facility.careLevel.join(', ') : '未設定'}</div>
                    </div>
                    
                    <div class="info-group">
                        <div class="info-label">月額利用料</div>
                        <div class="info-value">${escapeHtml(facility.monthlyFee) || '未設定'}</div>
                    </div>
                    
                    <div class="info-group">
                        <div class="info-label">提供している医療ケア</div>
                        <div class="info-value">${escapeHtml(facility.medicalCare) || '未設定'}</div>
                    </div>
                    
                    <div class="info-group">
                        <div class="info-label">施設の特徴</div>
                        <div class="info-value">${escapeHtml(facility.features) || '未設定'}</div>
                    </div>
                    
                    <div class="info-group">
                        <div class="info-label">特記事項</div>
                        <div class="info-value">${escapeHtml(facility.notes) || '未設定'}</div>
                    </div>
                    
                    ${facility.reviews ? `
                        <div class="info-group">
                            <div class="info-label">口コミ情報</div>
                            <div class="info-value" style="max-height: 100px; overflow-y: auto; font-size: 13px; line-height: 1.4;">${escapeHtml(facility.reviews)}</div>
                        </div>
                    ` : ''}
                </div>
                
                ${generateRealtimeSection(facility)}
                
                <div style="display: flex; gap: 10px; margin-top: 15px; flex-wrap: wrap;">
                    <button class="delete-btn" onclick="deleteFacility(${facility.id})">削除</button>
                    <button onclick="fetchRealtimeInfo(${facility.id})" style="background-color: #3182ce; color: white; padding: 8px 16px; border: none; border-radius: 5px; cursor: pointer; font-size: 14px;">🔄 リアルタイム情報取得</button>
                    ${facility.realtimeInfo ? `
                        <button onclick="applyWebInfoToSheet(${facility.id})" style="background-color: #38a169; color: white; padding: 8px 16px; border: none; border-radius: 5px; cursor: pointer; font-size: 14px;">🌐 WEB情報から取得</button>
                    ` : ''}
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// 札幌特化の高度な検索機能（シンプル化）
function searchFacilities() {
    const areaFilter = document.getElementById('searchArea').value;
    const careLevelFilter = document.getElementById('searchCareLevel').value;
    const availabilityFilter = document.getElementById('searchAvailability').value;
    const ratingFilter = document.getElementById('searchRating').value;
    const sortOrder = document.getElementById('sortOrder').value;
    
    let filtered = [...facilities];
    
    // エリアでフィルター（札幌特化）
    if (areaFilter) {
        filtered = filtered.filter(facility => 
            facility.area === areaFilter
        );
    }
    
    // 要介護度でフィルター
    if (careLevelFilter) {
        filtered = filtered.filter(facility => 
            facility.careLevel.includes(careLevelFilter)
        );
    }
    
    // 空き状況でフィルター（シンプル化）
    if (availabilityFilter) {
        filtered = filtered.filter(facility => 
            facility.availability === availabilityFilter
        );
    }
    
    // 評価でフィルター
    if (ratingFilter) {
        const minRating = parseFloat(ratingFilter);
        filtered = filtered.filter(facility => 
            facility.realtimeInfo && 
            facility.realtimeInfo.averageRating >= minRating
        );
    }
    
    // おすすめスコアを計算
    filtered = calculateRecommendationScores(filtered);
    
    // ソート
    filtered = sortFacilities(filtered, sortOrder);
    
    displayFacilities(filtered);
}

// すべての施設を表示
function showAllFacilities() {
    document.getElementById('searchArea').value = '';
    document.getElementById('searchCareLevel').value = '';
    document.getElementById('searchAvailability').value = '';
    document.getElementById('searchRating').value = '';
    document.getElementById('sortOrder').value = 'recommended';
    
    const facilitiesWithScores = calculateRecommendationScores([...facilities]);
    const sortedFacilities = sortFacilities(facilitiesWithScores, 'recommended');
    displayFacilities(sortedFacilities);
}

// 施設を削除する関数
function deleteFacility(facilityId) {
    if (confirm('この施設を削除してもよろしいですか？')) {
        facilities = facilities.filter(facility => facility.id !== facilityId);
        saveFacilities();
        displayFacilities();
        showMessage('施設が削除されました。', 'success');
    }
}

// ローカルストレージに施設データを保存
function saveFacilities() {
    localStorage.setItem('careFacilities', JSON.stringify(facilities));
}

// ローカルストレージから施設データを読み込み
function loadFacilities() {
    const savedFacilities = localStorage.getItem('careFacilities');
    if (savedFacilities) {
        facilities = JSON.parse(savedFacilities);
    }
}

// HTMLエスケープ処理（セキュリティ対策）
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// メッセージ表示機能
function showMessage(message, type = 'success') {
    // 既存のメッセージを削除
    const existingMessage = document.querySelector('.message');
    if (existingMessage) {
        existingMessage.remove();
    }
    
    // 新しいメッセージ要素を作成
    const messageDiv = document.createElement('div');
    messageDiv.className = `message message-${type}`;
    messageDiv.textContent = message;
    
    // ページの最上部に挿入
    const container = document.querySelector('.container');
    container.insertBefore(messageDiv, container.firstChild);
    
    // 3秒後にメッセージを自動削除
    setTimeout(() => {
        if (messageDiv && messageDiv.parentNode) {
            messageDiv.remove();
        }
    }, 3000);
}

// リアルタイム情報取得機能
async function fetchRealtimeInfo(facilityId) {
    const facility = facilities.find(f => f.id === facilityId);
    if (!facility || !facility.websiteUrl) {
        showMessage('ホームページURLが設定されていないため、リアルタイム情報を取得できません。', 'error');
        return;
    }
    
    try {
        showRealtimeLoading(facilityId, true);
        
        // シミュレーション: 実際のスクレイピング処理
        const realtimeData = await simulateWebScraping(facility);
        
        // 施設データにリアルタイム情報を追加
        const facilityIndex = facilities.findIndex(f => f.id === facilityId);
        if (facilityIndex !== -1) {
            facilities[facilityIndex].realtimeInfo = realtimeData;
            facilities[facilityIndex].lastUpdated = new Date().toISOString();
            saveFacilities();
        }
        
        // キャッシュに保存
        realtimeCache[facilityId] = realtimeData;
        
        // 画面を更新
        displayFacilities();
        showMessage(`${facility.name}のリアルタイム情報を取得しました。`, 'success');
        
    } catch (error) {
        console.error('リアルタイム情報の取得に失敗:', error);
        showMessage('リアルタイム情報の取得に失敗しました。', 'error');
    } finally {
        showRealtimeLoading(facilityId, false);
    }
}

// Webスクレイピングのシミュレーション（実際の環境では外部サービスを使用）
async function simulateWebScraping(facility) {
    // 実際の実装では、サーバーサイドでスクレイピングを行います
    // ここでは、デモ用にランダムなデータを生成します
    
    return new Promise((resolve) => {
        setTimeout(() => {
            const availabilityTexts = [
                '現在空室あり（個室2室、多床室1室）',
                '満室のため、入居をお待ちいただいております',
                '短期利用のみ受付中',
                '要介護3以上の方のみ受付中',
                '見学・相談随時受付中'
            ];
            
            const reviewSummaries = [
                'スタッフの対応が丁寧で、家族も安心しています。食事も美味しく、リハビリも充実しています。',
                '清潔で明るい施設です。イベントも多く、入居者の方々が楽しそうに過ごされています。',
                '医療体制がしっかりしており、緊急時の対応も迅速です。看護師の方々が親切です。',
                'アットホームな雰囲気で、スタッフと入居者の距離が近く温かい施設だと感じました。',
                '料金は少し高めですが、サービスの質を考えると納得できます。'
            ];
            
            const ratings = [3.8, 4.1, 4.5, 3.9, 4.2, 3.7, 4.3];
            
            resolve({
                availabilityStatus: availabilityTexts[Math.floor(Math.random() * availabilityTexts.length)],
                reviewSummary: reviewSummaries[Math.floor(Math.random() * reviewSummaries.length)],
                averageRating: ratings[Math.floor(Math.random() * ratings.length)],
                reviewCount: Math.floor(Math.random() * 50) + 10,
                lastScrapedAt: new Date().toISOString()
            });
        }, 2000); // 2秒のシミュレート
    });
}

// サンプルデータの追加（開発用）
function addSampleData() {
    const sampleFacilities = [
        {
            id: 1,
            name: "札幌中央特別養護老人ホーム",
            address: "札幌市中央区南1条西10丁目2-15",
            area: "中央区",
            detailAddress: "南1条西10丁目2-15",
            phone: "011-123-4567",
            websiteUrl: "https://example.com/sapporo-chuo",
            careLevel: ["要介護1", "要介護2", "要介護3", "要介護4", "要介護5"],
            monthlyFee: "12万円〜18万円",
            medicalCare: "胃ろう、たん吸引、インスリン注射、認知症対応",
            features: "24時間看護師常駐、リハビリ充実、個室完備、すすきの近く",
            availability: "空きあり",
            notes: "認知症専門ケア対応、医療体制充実、地下鉄駅から徒歩5分",
            reviews: "[WEB取得 2024/12/15] スタッフの対応が丁寧で清潔感のある施設です。医療体制が充実しており、認知症の方への専門的なケアが評価されています。",
            reliabilityLevel: "high",
            lastConfirmed: "2024-12-15",
            confirmationMethod: "phone",
            realtimeInfo: null,
            lastUpdated: null,
            createdAt: new Date().toISOString()
        },
        {
            id: 2,
            name: "北区やまざくらグループホーム",
            address: "札幌市北区北24条西5丁目1-8",
            area: "北区",
            detailAddress: "北24条西5丁目1-8",
            phone: "011-765-4321",
            websiteUrl: "https://example.com/kita-yamazakura",
            careLevel: ["要支援2", "要介護1", "要介護2", "要介護3"],
            monthlyFee: "10万円〜14万円",
            medicalCare: "服薬管理、血圧測定、リハビリ",
            features: "アットホームな環境、園芸療法、個室あり、北海道大学近く",
            availability: "満室",
            notes: "見学随時受付中、家族面会しやすい立地、地下鉄南北線北24条駅徒歩3分",
            reviews: "[WEB取得 2024/11/20] アットホームな雰囲気で入居者とスタッフの関係が良好です。園芸療法が好評で、入居者の方々が楽しそうに参加されています。",
            reliabilityLevel: "medium",
            lastConfirmed: "2024-11-20",
            confirmationMethod: "web",
            realtimeInfo: null,
            lastUpdated: null,
            createdAt: new Date().toISOString()
        },
        {
            id: 3,
            name: "江別リハビリテーション介護老人保健施設",
            address: "江別市野幌町50-5",
            area: "江別市",
            detailAddress: "野幌町50-5",
            phone: "011-234-5678",
            websiteUrl: "https://example.com/ebetsu-rehab",
            careLevel: ["要支援1", "要支援2", "要介護1", "要介護2", "要介護3"],
            monthlyFee: "11万円〜16万円",
            medicalCare: "理学療法、作業療法、言語聴覚療法、胃ろう",
            features: "リハビリ特化、理学療法士常駐、送迎サービス、自然豊かな環境",
            availability: "空き僅か",
            notes: "リハビリ重視の方におすすめ、JR函館本線野幌駅徒歩10分",
            reviews: "[WEB取得 2024/10/05] リハビリテーション設備が充実しており、理学療法士による専門的な指導が受けられます。自然豊かな環境で回復に集中できる環境です。",
            reliabilityLevel: "low",
            lastConfirmed: "2024-10-05",
            confirmationMethod: "estimate",
            realtimeInfo: null,
            lastUpdated: null,
            createdAt: new Date().toISOString()
        },
        {
            id: 4,
            name: "手稲みどりの風介護老人福祉施設",
            address: "札幌市手稲区手稲本町2条3丁目4-12",
            area: "手稲区",
            detailAddress: "手稲本町2条3丁目4-12",
            phone: "011-685-9876",
            websiteUrl: "https://example.com/teine-midori",
            careLevel: ["要介護1", "要介護2", "要介護3", "要介護4", "要介護5"],
            monthlyFee: "13万円〜17万円",
            medicalCare: "24時間看護、胃ろう、たん吸引、酸素療法",
            features: "医療体制充実、個室・多床室選択可能、手稲山が見える立地",
            availability: "空きあり",
            notes: "医療依存度の高い方も受け入れ可能、JR手稲駅徒歩8分",
            reviews: "[WEB取得 2024/12/18] 24時間看護体制で医療依存度の高い方も安心して入居できます。手稲山を望む立地で環境も良く、家族の評判も上々です。",
            reliabilityLevel: "high",
            lastConfirmed: "2024-12-18",
            confirmationMethod: "visit",
            realtimeInfo: null,
            lastUpdated: null,
            createdAt: new Date().toISOString()
        }
    ];
    
    facilities = sampleFacilities;
    saveFacilities();
    displayFacilities();
    showMessage('サンプルデータを追加しました。', 'success');
}

// リアルタイム情報表示セクションを生成
function generateRealtimeSection(facility) {
    if (!facility.realtimeInfo) {
        return `
            <div id="realtime-${facility.id}" class="realtime-section" style="display: none;">
                <h4>🔄 リアルタイム情報</h4>
                <div class="error-message">リアルタイム情報はまだ取得されていません。「リアルタイム情報取得」ボタンをクリックして情報を取得してください。</div>
            </div>
        `;
    }
    
    const info = facility.realtimeInfo;
    const updateTime = new Date(facility.lastUpdated).toLocaleString('ja-JP');
    
    return `
        <div id="realtime-${facility.id}" class="realtime-section">
            <h4>🔄 リアルタイム情報</h4>
            
            <div class="realtime-item">
                <div class="realtime-label">ホームページ上の空き状況</div>
                <div class="realtime-value">${escapeHtml(info.availabilityStatus)}</div>
            </div>
            
            <div class="reviews-summary">
                <h5>📝 最新の口コミ要約 (評価: <span class="reviews-rating">★${info.averageRating}/5.0</span> - ${info.reviewCount}件)</h5>
                <div style="color: #744210; font-size: 13px; line-height: 1.5;">${escapeHtml(info.reviewSummary)}</div>
            </div>
            
            ${generateDiscrepancyAlert(facility)}
            
            <div class="update-timestamp">最終更新: ${updateTime}</div>
        </div>
    `;
}

// ローディング表示の制御
function showRealtimeLoading(facilityId, isLoading) {
    const section = document.getElementById(`realtime-${facilityId}`);
    if (!section) return;
    
    if (isLoading) {
        section.style.display = 'block';
        section.innerHTML = `
            <h4>🔄 リアルタイム情報</h4>
            <div style="padding: 20px; text-align: center;">
                <div class="loading-spinner"></div>
                情報を取得中...
            </div>
        `;
    }
}

// 全施設のリアルタイム情報を更新
async function refreshAllRealtimeInfo() {
    const facilitiesWithUrls = facilities.filter(f => f.websiteUrl);
    
    if (facilitiesWithUrls.length === 0) {
        showMessage('ホームページURLが設定されている施設がありません。', 'error');
        return;
    }
    
    showMessage(`${facilitiesWithUrls.length}件の施設のリアルタイム情報を更新中...`, 'success');
    
    for (const facility of facilitiesWithUrls) {
        await fetchRealtimeInfo(facility.id);
        // 各リクエストの間に少し間隔を空ける
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    showMessage('すべての施設のリアルタイム情報更新が完了しました。', 'success');
}

// 信頼性バッジを生成
function generateReliabilityBadge(facility) {
    if (!facility.reliabilityLevel) return '';
    
    const reliabilityLabels = {
        'high': '🟢 高',
        'medium': '🟡 中',
        'low': '🔴 低'
    };
    
    return `<span class="reliability-badge reliability-${facility.reliabilityLevel}">${reliabilityLabels[facility.reliabilityLevel]}</span>`;
}

// 確認情報を生成
function generateConfirmationInfo(facility) {
    if (!facility.lastConfirmed) return '';
    
    const confirmedDate = new Date(facility.lastConfirmed);
    const today = new Date();
    const daysDiff = Math.floor((today - confirmedDate) / (1000 * 60 * 60 * 24));
    
    const methodLabels = {
        'phone': '📞 電話',
        'web': '🌐 WEB', 
        'visit': '🏢 訪問',
        'email': '📧 メール',
        'estimate': '💭 推測'
    };
    
    let className = 'confirmation-info';
    let alertText = '';
    
    if (daysDiff > 30) {
        className += ' confirmation-overdue';
        alertText = '⚠️ 30日以上未確認';
    } else if (daysDiff <= 7) {
        className += ' confirmation-recent';
    }
    
    return `
        <div class="${className}">
            ${alertText} 最終確認: ${confirmedDate.toLocaleDateString('ja-JP')} 
            (${daysDiff}日前・${methodLabels[facility.confirmationMethod] || '不明'})
        </div>
    `;
}

// 情報齟齬を検出・表示
function generateDiscrepancyAlert(facility) {
    if (!facility.realtimeInfo) return '';
    
    const sheetAvailability = facility.availability;
    const webAvailability = detectAvailabilityFromWeb(facility.realtimeInfo.availabilityStatus);
    
    // 空き状況の齟齬チェック
    if (sheetAvailability !== webAvailability && webAvailability !== '不明') {
        return `
            <div class="discrepancy-alert">
                <h5>⚠️ 情報に齟齬の可能性があります</h5>
                <div class="info-comparison">
                    <div class="info-source sheet-info">
                        <h6>📋 シート情報</h6>
                        <div>${sheetAvailability}</div>
                    </div>
                    <div class="info-source web-info">
                        <h6>🌐 WEB情報</h6>
                        <div>${webAvailability}</div>
                    </div>
                </div>
                ${generateActionRequired(facility)}
            </div>
        `;
    }
    
    return '';
}

// WEB情報から空き状況を推測
function detectAvailabilityFromWeb(webText) {
    if (!webText) return '不明';
    
    const text = webText.toLowerCase();
    
    if (text.includes('空室あり') || text.includes('入居可能')) {
        return '空きあり';
    } else if (text.includes('満室') || text.includes('お待ち')) {
        return '満室';
    } else if (text.includes('空き僅か') || text.includes('残り僅か')) {
        return '空き僅か';
    }
    
    return '要確認';
}

// 行動促進メッセージを生成
function generateActionRequired(facility) {
    return `
        <div class="action-required">
            <h4>🔔 確認が必要です</h4>
            <p>情報の正確性を確保するため、施設に直接確認することをお勧めします。</p>
            ${facility.phone ? `
                <a href="tel:${facility.phone}" class="action-button">📞 電話で確認</a>
            ` : ''}
            ${facility.websiteUrl ? `
                <a href="${facility.websiteUrl}" target="_blank" class="action-button">🌐 サイト確認</a>
            ` : ''}
            <button onclick="markAsConfirmed(${facility.id})" class="action-button">✅ 確認完了</button>
        </div>
        ${facility.phone ? `
            <div class="contact-info">
                📞 <strong>${facility.name}</strong><br>
                電話: ${facility.phone}
            </div>
        ` : ''}
    `;
}

// 確認完了マーク
function markAsConfirmed(facilityId) {
    const today = new Date().toISOString().split('T')[0];
    const method = prompt('確認方法を選択してください：\nphone: 電話\nweb: WEB\nvisit: 訪問\nemail: メール', 'phone');
    
    if (method) {
        const facilityIndex = facilities.findIndex(f => f.id === facilityId);
        if (facilityIndex !== -1) {
            facilities[facilityIndex].lastConfirmed = today;
            facilities[facilityIndex].confirmationMethod = method;
            facilities[facilityIndex].reliabilityLevel = 'high'; // 確認済みは信頼性高
            
            saveFacilities();
            displayFacilities();
            showMessage('確認情報が更新されました。', 'success');
        }
    }
}

// 信頼性スコアの計算（おすすめ度に反映）
function calculateReliabilityScore(facility) {
    let score = 0;
    
    // 信頼性レベル
    switch (facility.reliabilityLevel) {
        case 'high': score += 10; break;
        case 'medium': score += 5; break;
        case 'low': score += 0; break;
    }
    
    // 確認の新しさ
    if (facility.lastConfirmed) {
        const daysSinceConfirm = (Date.now() - new Date(facility.lastConfirmed)) / (1000 * 60 * 60 * 24);
        if (daysSinceConfirm <= 7) score += 5;
        else if (daysSinceConfirm <= 30) score += 2;
        else score -= 3; // 古い情報はマイナス
    }
    
    return score;
}

// 統合フィルター：空き状況・信頼性を組み合わせて適用
function applyAvailabilityReliabilityFilter(facilities, filterValue) {
    const [availability, reliability] = filterValue.split('-');
    
    return facilities.filter(facility => {
        // 空き状況チェック
        if (availability !== 'any' && facility.availability !== availability) {
            return false;
        }
        
        // 信頼性チェック
        if (reliability !== 'any' && facility.reliabilityLevel !== reliability) {
            return false;
        }
        
        return true;
    });
}

// 情報鮮度フィルターを適用
function applyFreshnessFilter(facilities, freshnessValue) {
    const today = new Date();
    
    return facilities.filter(facility => {
        if (!facility.lastConfirmed) {
            return freshnessValue === 'overdue'; // 確認日未設定は期限切れ扱い
        }
        
        const confirmedDate = new Date(facility.lastConfirmed);
        const daysDiff = Math.floor((today - confirmedDate) / (1000 * 60 * 60 * 24));
        
        switch (freshnessValue) {
            case '7':
                return daysDiff <= 7;
            case '30':
                return daysDiff <= 30;
            case 'overdue':
                return daysDiff > 30;
            default:
                return true;
        }
    });
}

// WEB情報をシートに適用する機能
async function applyWebInfoToSheet(facilityId) {
    const facility = facilities.find(f => f.id === facilityId);
    if (!facility || !facility.realtimeInfo) {
        showMessage('リアルタイム情報が取得されていません。', 'error');
        return;
    }
    
    // 確認ダイアログ
    const confirmed = confirm(
        `WEB情報をシートに適用しますか？\n\n` +
        `【現在のシート情報】\n` +
        `空き状況: ${facility.availability}\n` +
        `信頼性: ${getReliabilityLabel(facility.reliabilityLevel)}\n\n` +
        `【WEB情報から推測される情報】\n` +
        `空き状況: ${detectAvailabilityFromWeb(facility.realtimeInfo.availabilityStatus)}\n` +
        `信頼性: WEB情報（中）\n\n` +
        `※この操作により、シート情報がWEB情報で上書きされます。`
    );
    
    if (!confirmed) return;
    
    try {
        // WEB情報から空き状況を推測
        const webAvailability = detectAvailabilityFromWeb(facility.realtimeInfo.availabilityStatus);
        
        // 施設情報を更新
        const facilityIndex = facilities.findIndex(f => f.id === facilityId);
        if (facilityIndex !== -1) {
            // WEB情報を正として更新
            facilities[facilityIndex].availability = webAvailability;
            facilities[facilityIndex].reliabilityLevel = 'medium'; // WEB情報は中信頼性
            facilities[facilityIndex].lastConfirmed = new Date().toISOString().split('T')[0];
            facilities[facilityIndex].confirmationMethod = 'web';
            
            // 口コミ情報があれば口コミ欄に追加
            if (facility.realtimeInfo.reviewSummary) {
                const reviewNote = `[WEB取得 ${new Date().toLocaleDateString('ja-JP')}] ${facility.realtimeInfo.reviewSummary}`;
                const existingReviews = facilities[facilityIndex].reviews || '';
                facilities[facilityIndex].reviews = existingReviews ? existingReviews + '\\n\\n' + reviewNote : reviewNote;
            }
            
            saveFacilities();
            displayFacilities();
            showMessage(`${facility.name}の情報をWEBデータで更新しました。`, 'success');
        }
        
    } catch (error) {
        console.error('WEB情報適用エラー:', error);
        showMessage('WEB情報の適用に失敗しました。', 'error');
    }
}

// 信頼性レベルのラベル取得
function getReliabilityLabel(level) {
    const labels = {
        'high': '🟢 高（電話確認済み）',
        'medium': '🟡 中（WEB情報）',
        'low': '🔴 低（要確認）'
    };
    return labels[level] || '未設定';
}

// 新規施設登録時のWEB情報取得
async function fetchWebInfoForNewFacility() {
    const websiteUrl = document.getElementById('websiteUrl').value.trim();
    if (!websiteUrl) {
        showMessage('ホームページURLを入力してください。', 'error');
        return;
    }
    
    const statusEl = document.getElementById('webFetchStatus');
    const btnEl = document.querySelector('.web-fetch-btn');
    
    try {
        // UI更新
        btnEl.disabled = true;
        statusEl.textContent = '取得中...';
        statusEl.className = 'web-fetch-status loading';
        
        // シミュレーション: WEB情報を取得
        const webData = await simulateWebScrapingForNewFacility(websiteUrl);
        
        // フォームに情報を自動入力
        document.getElementById('availability').value = webData.availability;
        document.getElementById('reliabilityLevel').value = 'medium'; // WEB情報は中信頼性
        document.getElementById('lastConfirmed').value = new Date().toISOString().split('T')[0];
        document.getElementById('confirmationMethod').value = 'web';
        document.getElementById('reviews').value = webData.reviewSummary;
        
        // 成功メッセージ
        statusEl.textContent = '✅ 取得完了';
        statusEl.className = 'web-fetch-status success';
        showMessage('WEB情報を取得しました。内容を確認して施設を追加してください。', 'success');
        
    } catch (error) {
        console.error('WEB情報取得エラー:', error);
        statusEl.textContent = '❌ 取得失敗';
        statusEl.className = 'web-fetch-status error';
        showMessage('WEB情報の取得に失敗しました。', 'error');
    } finally {
        btnEl.disabled = false;
    }
}

// 新規登録用のWEB情報取得シミュレーション
async function simulateWebScrapingForNewFacility(url) {
    return new Promise((resolve) => {
        setTimeout(() => {
            const availabilityOptions = ['空きあり', '空き僅か', '満室', '要確認'];
            const reviewSummaries = [
                '[WEB取得] スタッフの対応が丁寧で、施設も清潔感があります。リハビリ体制も充実しており、入居者の方々が楽しそうに過ごされている印象を受けました。',
                '[WEB取得] アットホームな雰囲気で、看護師の方が親切に対応してくださいます。医療体制がしっかりしており、家族も安心して預けることができます。',
                '[WEB取得] 立地が良く、面会に通いやすい環境です。レクリエーション活動も豊富で、入居者の方々が活気に満ちて生活されています。',
                '[WEB取得] 料金は相場より少し高めですが、サービスの質を考えると納得できる範囲です。個室も充実しており、プライバシーが確保されています。'
            ];
            
            resolve({
                availability: availabilityOptions[Math.floor(Math.random() * availabilityOptions.length)],
                reviewSummary: reviewSummaries[Math.floor(Math.random() * reviewSummaries.length)]
            });
        }, 2000);
    });
}

// 表示モード切替
function switchViewMode(mode) {
    const cardView = document.getElementById('cardView');
    const tableView = document.getElementById('tableView');
    const cardBtn = document.getElementById('cardViewBtn');
    const tableBtn = document.getElementById('tableViewBtn');
    
    if (mode === 'cards') {
        cardView.style.display = 'block';
        tableView.style.display = 'none';
        cardBtn.classList.add('active');
        tableBtn.classList.remove('active');
    } else {
        cardView.style.display = 'none';
        tableView.style.display = 'block';
        cardBtn.classList.remove('active');
        tableBtn.classList.add('active');
        updateTableView();
    }
}

// 一覧表の更新
function updateTableView() {
    const tbody = document.getElementById('facilitiesTableBody');
    const currentFacilities = getCurrentFilteredFacilities();
    
    if (currentFacilities.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; padding: 40px; color: #666;">施設が登録されていません。</td></tr>';
        return;
    }
    
    let html = '';
    currentFacilities.forEach(facility => {
        const rating = facility.realtimeInfo 
            ? `★${facility.realtimeInfo.averageRating} (${facility.realtimeInfo.reviewCount}件)`
            : '未取得';
        
        const lastConfirmed = facility.lastConfirmed 
            ? new Date(facility.lastConfirmed).toLocaleDateString('ja-JP')
            : '未確認';
        
        html += `
            <tr>
                <td class="table-facility-name">${escapeHtml(facility.name)}</td>
                <td>${escapeHtml(facility.area || '')}</td>
                <td><span class="table-availability availability-${facility.availability}">${facility.availability}</span></td>
                <td><span class="table-reliability reliability-${facility.reliabilityLevel}">${getReliabilityLabel(facility.reliabilityLevel).substring(2)}</span></td>
                <td>${escapeHtml(facility.monthlyFee || '')}</td>
                <td>${facility.careLevel.join(', ')}</td>
                <td>${facility.phone ? `<a href="tel:${facility.phone}" class="table-btn call">📞</a>` : '-'}</td>
                <td>${lastConfirmed}</td>
                <td>${rating}</td>
                <td class="table-actions">
                    ${facility.websiteUrl ? `<a href="${facility.websiteUrl}" target="_blank" class="table-btn web">WEB</a>` : ''}
                    <button onclick="fetchRealtimeInfo(${facility.id})" class="table-btn edit">更新</button>
                </td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
}

// 現在フィルタリングされている施設データを取得
function getCurrentFilteredFacilities() {
    // 現在のフィルター条件を取得して適用
    const areaFilter = document.getElementById('searchArea').value;
    const careLevelFilter = document.getElementById('searchCareLevel').value;
    const availabilityFilter = document.getElementById('searchAvailability').value;
    const ratingFilter = document.getElementById('searchRating').value;
    const sortOrder = document.getElementById('sortOrder').value;
    
    let filtered = [...facilities];
    
    // 各フィルターを適用
    if (areaFilter) {
        filtered = filtered.filter(facility => facility.area === areaFilter);
    }
    
    if (careLevelFilter) {
        filtered = filtered.filter(facility => facility.careLevel.includes(careLevelFilter));
    }
    
    if (availabilityFilter) {
        filtered = filtered.filter(facility => facility.availability === availabilityFilter);
    }
    
    if (ratingFilter) {
        const minRating = parseFloat(ratingFilter);
        filtered = filtered.filter(facility => 
            facility.realtimeInfo && facility.realtimeInfo.averageRating >= minRating
        );
    }
    
    filtered = calculateRecommendationScores(filtered);
    filtered = sortFacilities(filtered, sortOrder);
    
    return filtered;
}

// CSV出力機能
function exportToCSV() {
    const currentFacilities = getCurrentFilteredFacilities();
    
    if (currentFacilities.length === 0) {
        showMessage('出力する施設データがありません。', 'error');
        return;
    }
    
    const headers = [
        '施設名', 'エリア', '住所', '電話番号', 'ホームページURL',
        '空き状況', '信頼性レベル', '月額料金', '受入可能要介護度',
        '医療ケア', '施設特徴', '特記事項', '口コミ情報',
        '最終確認日', '確認方法', '口コミ評価'
    ];
    
    let csvContent = headers.join(',') + '\\n';
    
    currentFacilities.forEach(facility => {
        const row = [
            `"${facility.name}"`,
            `"${facility.area || ''}"`,
            `"${facility.address}"`,
            `"${facility.phone || ''}"`,
            `"${facility.websiteUrl || ''}"`,
            `"${facility.availability}"`,
            `"${getReliabilityLabel(facility.reliabilityLevel)}"`,
            `"${facility.monthlyFee || ''}"`,
            `"${facility.careLevel.join(', ')}"`,
            `"${facility.medicalCare || ''}"`,
            `"${facility.features || ''}"`,
            `"${facility.notes || ''}"`,
            `"${facility.reviews || ''}"`,
            `"${facility.lastConfirmed || ''}"`,
            `"${facility.confirmationMethod || ''}"`,
            `"${facility.realtimeInfo ? '★' + facility.realtimeInfo.averageRating + ' (' + facility.realtimeInfo.reviewCount + '件)' : ''}"`
        ];
        csvContent += row.join(',') + '\\n';
    });
    
    // ファイルダウンロード
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `介護施設一覧_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showMessage('CSVファイルをダウンロードしました。', 'success');
}

// AIベースのおすすめスコア計算
function calculateRecommendationScores(facilitiesArray) {
    return facilitiesArray.map(facility => {
        let score = 50; // ベーススコア
        
        // 患者プロファイルが設定されている場合の詳細マッチング
        if (patientProfile && Object.keys(patientProfile).length > 0) {
            
            // 要介護度マッチング（20点満点）
            if (patientProfile.careLevel && facility.careLevel.includes(patientProfile.careLevel)) {
                score += 20;
            }
            
            // 医療ケアマッチング（15点満点）
            if (patientProfile.medicalNeeds && facility.medicalCare) {
                const patientNeeds = patientProfile.medicalNeeds.toLowerCase();
                const facilityServices = facility.medicalCare.toLowerCase();
                
                const keywords = ['胃ろう', 'たん吸引', 'インスリン', '認知症', 'リハビリ', '酸素'];
                let matchCount = 0;
                keywords.forEach(keyword => {
                    if (patientNeeds.includes(keyword) && facilityServices.includes(keyword)) {
                        matchCount++;
                    }
                });
                score += (matchCount / keywords.length) * 15;
            }
            
            // 希望条件マッチング（10点満点）
            if (patientProfile.preferences && facility.features) {
                const preferences = patientProfile.preferences.toLowerCase();
                const features = facility.features.toLowerCase();
                
                const preferenceKeywords = ['個室', 'リハビリ', '24時間', '看護師'];
                let prefMatchCount = 0;
                preferenceKeywords.forEach(keyword => {
                    if (preferences.includes(keyword) && features.includes(keyword)) {
                        prefMatchCount++;
                    }
                });
                score += (prefMatchCount / preferenceKeywords.length) * 10;
            }
        }
        
        // リアルタイム情報による調整
        if (facility.realtimeInfo) {
            // 口コミ評価による調整（5点満点）
            if (facility.realtimeInfo.averageRating) {
                score += (facility.realtimeInfo.averageRating - 3.0) * 2.5; // 3.0を基準に調整
            }
            
            // レビュー数による信頼性調整
            if (facility.realtimeInfo.reviewCount && facility.realtimeInfo.reviewCount > 10) {
                score += 3; // レビューが多い場合は信頼性ボーナス
            }
        }
        
        // 空き状況による調整
        switch (facility.availability) {
            case '空きあり':
                score += 10;
                break;
            case '空き僅か':
                score += 5;
                break;
            case '満室':
                score -= 15;
                break;
            case '要確認':
                break; // 変更なし
        }
        
        // 最新情報更新度による調整
        if (facility.lastUpdated) {
            const daysSinceUpdate = (Date.now() - new Date(facility.lastUpdated)) / (1000 * 60 * 60 * 24);
            if (daysSinceUpdate < 1) score += 3;
            else if (daysSinceUpdate < 7) score += 1;
        }
        
        // 信頼性スコアを追加
        score += calculateReliabilityScore(facility);
        
        return {
            ...facility,
            recommendationScore: Math.max(0, Math.min(100, score)) // 0-100の範囲に制限
        };
    });
}

// 施設の並び替え
function sortFacilities(facilitiesArray, sortOrder) {
    switch (sortOrder) {
        case 'recommended':
            return facilitiesArray.sort((a, b) => (b.recommendationScore || 0) - (a.recommendationScore || 0));
        
        case 'reliability':
            return facilitiesArray.sort((a, b) => {
                const reliabilityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
                const aScore = reliabilityOrder[a.reliabilityLevel] || 0;
                const bScore = reliabilityOrder[b.reliabilityLevel] || 0;
                
                if (aScore !== bScore) {
                    return bScore - aScore; // 信頼性の高い順
                }
                
                // 信頼性が同じ場合は確認日の新しい順
                const aTime = a.lastConfirmed ? new Date(a.lastConfirmed) : new Date(0);
                const bTime = b.lastConfirmed ? new Date(b.lastConfirmed) : new Date(0);
                return bTime - aTime;
            });
        
        case 'rating':
            return facilitiesArray.sort((a, b) => {
                const aRating = a.realtimeInfo ? a.realtimeInfo.averageRating : 0;
                const bRating = b.realtimeInfo ? b.realtimeInfo.averageRating : 0;
                return bRating - aRating;
            });
        
        case 'name':
            return facilitiesArray.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
        
        case 'updated':
            return facilitiesArray.sort((a, b) => {
                const aTime = a.lastUpdated ? new Date(a.lastUpdated) : new Date(0);
                const bTime = b.lastUpdated ? new Date(b.lastUpdated) : new Date(0);
                return bTime - aTime;
            });
        
        default:
            return facilitiesArray;
    }
}

// 患者プロファイル保存
function savePatientProfile() {
    const profile = {
        name: document.getElementById('patientName').value.trim(),
        age: document.getElementById('patientAge').value,
        careLevel: document.getElementById('patientCareLevel').value,
        budget: document.getElementById('patientBudget').value.trim(),
        medicalNeeds: document.getElementById('patientMedicalNeeds').value.trim(),
        preferences: document.getElementById('patientPreferences').value.trim(),
        savedAt: new Date().toISOString()
    };
    
    // 必須項目チェック
    if (!profile.name) {
        showMessage('患者名は必須項目です。', 'error');
        return;
    }
    
    patientProfile = profile;
    localStorage.setItem('patientProfile', JSON.stringify(profile));
    
    showMessage('患者プロファイルが保存されました。検索結果におすすめ度が反映されます。', 'success');
    
    // 保存後に検索結果を更新
    searchFacilities();
}

// 患者プロファイルクリア
function clearPatientProfile() {
    if (confirm('患者プロファイルをクリアしますか？')) {
        patientProfile = {};
        localStorage.removeItem('patientProfile');
        
        // フォームをクリア
        document.getElementById('patientName').value = '';
        document.getElementById('patientAge').value = '';
        document.getElementById('patientCareLevel').value = '';
        document.getElementById('patientBudget').value = '';
        document.getElementById('patientMedicalNeeds').value = '';
        document.getElementById('patientPreferences').value = '';
        
        showMessage('患者プロファイルがクリアされました。', 'success');
        searchFacilities();
    }
}

// 患者プロファイルの読み込み
function loadPatientProfile() {
    const saved = localStorage.getItem('patientProfile');
    if (saved) {
        patientProfile = JSON.parse(saved);
        
        // フォームに復元
        document.getElementById('patientName').value = patientProfile.name || '';
        document.getElementById('patientAge').value = patientProfile.age || '';
        document.getElementById('patientCareLevel').value = patientProfile.careLevel || '';
        document.getElementById('patientBudget').value = patientProfile.budget || '';
        document.getElementById('patientMedicalNeeds').value = patientProfile.medicalNeeds || '';
        document.getElementById('patientPreferences').value = patientProfile.preferences || '';
    }
}

// 自動更新設定の管理
function setupAutoUpdate() {
    const enableCheckbox = document.getElementById('enableAutoUpdate');
    const intervalSelect = document.getElementById('updateInterval');
    const statusDiv = document.getElementById('autoUpdateStatus');
    
    // 設定を復元
    const autoUpdateEnabled = localStorage.getItem('autoUpdateEnabled') === 'true';
    const updateInterval = localStorage.getItem('updateInterval') || '60';
    
    enableCheckbox.checked = autoUpdateEnabled;
    intervalSelect.value = updateInterval;
    
    // イベントリスナー設定
    enableCheckbox.addEventListener('change', function() {
        const enabled = this.checked;
        localStorage.setItem('autoUpdateEnabled', enabled);
        
        if (enabled) {
            startAutoUpdate();
        } else {
            stopAutoUpdate();
        }
        updateAutoUpdateStatus();
    });
    
    intervalSelect.addEventListener('change', function() {
        localStorage.setItem('updateInterval', this.value);
        if (enableCheckbox.checked) {
            stopAutoUpdate();
            startAutoUpdate();
        }
    });
    
    // 初期状態で自動更新を開始
    if (autoUpdateEnabled) {
        startAutoUpdate();
    }
    
    updateAutoUpdateStatus();
}

// 自動更新開始
function startAutoUpdate() {
    const interval = parseInt(localStorage.getItem('updateInterval') || '60') * 60 * 1000; // ミリ秒に変換
    
    autoUpdateTimer = setInterval(async () => {
        console.log('定期自動更新を実行中...');
        await refreshAllRealtimeInfo();
    }, interval);
    
    console.log(`自動更新を開始しました。更新間隔: ${interval / 60000}分`);
}

// 自動更新停止
function stopAutoUpdate() {
    if (autoUpdateTimer) {
        clearInterval(autoUpdateTimer);
        autoUpdateTimer = null;
        console.log('自動更新を停止しました。');
    }
}

// 自動更新ステータス表示更新
function updateAutoUpdateStatus() {
    const statusDiv = document.getElementById('autoUpdateStatus');
    const enabled = document.getElementById('enableAutoUpdate').checked;
    const interval = document.getElementById('updateInterval').value;
    
    if (enabled) {
        statusDiv.textContent = `自動更新: 有効 (${interval}分間隔)`;
        statusDiv.className = 'update-status active';
    } else {
        statusDiv.textContent = '自動更新: 無効';
        statusDiv.className = 'update-status';
    }
}

// ページ切り替え機能
function switchPage(pageType) {
    const listPage = document.getElementById('listPage');
    const addPage = document.getElementById('addPage');
    const listBtn = document.getElementById('listPageBtn');
    const addBtn = document.getElementById('addPageBtn');
    
    if (pageType === 'list') {
        listPage.style.display = 'block';
        addPage.style.display = 'none';
        listBtn.classList.add('active');
        addBtn.classList.remove('active');
    } else if (pageType === 'add') {
        listPage.style.display = 'none';
        addPage.style.display = 'block';
        listBtn.classList.remove('active');
        addBtn.classList.add('active');
    }
}

// WEB情報一括更新機能（信頼性「WEB情報」の施設のみ対象）
async function bulkUpdateWebInfo() {
    const statusEl = document.getElementById('bulkUpdateStatus');
    const btnEl = document.querySelector('.bulk-update-btn');
    
    // 信頼性レベルが「medium（WEB情報）」の施設のみを抽出
    const webInfoFacilities = facilities.filter(f => 
        f.reliabilityLevel === 'medium' && f.websiteUrl
    );
    
    if (webInfoFacilities.length === 0) {
        showMessage('WEB情報レベルの施設で、ホームページURLが設定されている施設がありません。', 'error');
        return;
    }
    
    try {
        // UI更新
        btnEl.disabled = true;
        statusEl.textContent = `更新中... (0/${webInfoFacilities.length})`;
        statusEl.className = 'bulk-update-status loading';
        
        let updatedCount = 0;
        
        for (const facility of webInfoFacilities) {
            try {
                // リアルタイム情報を取得
                const realtimeData = await simulateWebScraping(facility);
                
                // 施設データを更新
                const facilityIndex = facilities.findIndex(f => f.id === facility.id);
                if (facilityIndex !== -1) {
                    // WEB情報から空き状況を推測
                    const webAvailability = detectAvailabilityFromWeb(realtimeData.availabilityStatus);
                    
                    // 施設情報を更新（WEB情報優先）
                    facilities[facilityIndex].availability = webAvailability;
                    facilities[facilityIndex].realtimeInfo = realtimeData;
                    facilities[facilityIndex].lastUpdated = new Date().toISOString();
                    facilities[facilityIndex].lastConfirmed = new Date().toISOString().split('T')[0];
                    facilities[facilityIndex].confirmationMethod = 'web';
                    
                    // 口コミ情報があれば口コミ欄に追加
                    if (realtimeData.reviewSummary) {
                        const reviewNote = `[一括更新 ${new Date().toLocaleDateString('ja-JP')}] ${realtimeData.reviewSummary}`;
                        const existingReviews = facilities[facilityIndex].reviews || '';
                        facilities[facilityIndex].reviews = existingReviews ? existingReviews + '\\n\\n' + reviewNote : reviewNote;
                    }
                    
                    updatedCount++;
                }
                
                // プログレス表示更新
                statusEl.textContent = `更新中... (${updatedCount}/${webInfoFacilities.length})`;
                
                // リクエストの間隔を空ける
                await new Promise(resolve => setTimeout(resolve, 1500));
                
            } catch (error) {
                console.error(`施設 ${facility.name} の更新に失敗:`, error);
            }
        }
        
        // データを保存
        saveFacilities();
        
        // 画面を更新
        displayFacilities();
        
        // 成功メッセージ
        statusEl.textContent = `✅ 完了 (${updatedCount}件更新)`;
        statusEl.className = 'bulk-update-status success';
        showMessage(`WEB情報一括更新が完了しました。${updatedCount}件の施設を更新しました。`, 'success');
        
    } catch (error) {
        console.error('一括更新エラー:', error);
        statusEl.textContent = '❌ 更新失敗';
        statusEl.className = 'bulk-update-status error';
        showMessage('一括更新に失敗しました。', 'error');
    } finally {
        btnEl.disabled = false;
        
        // 5秒後にステータスをクリア
        setTimeout(() => {
            statusEl.textContent = '';
            statusEl.className = 'bulk-update-status';
        }, 5000);
    }
}

// 検索フィルターをリセットする機能
function resetSearch() {
    // すべてのフィルターをデフォルト値にリセット
    document.getElementById('searchArea').value = '';
    document.getElementById('searchCareLevel').value = '';
    document.getElementById('searchAvailability').value = '';
    document.getElementById('searchRating').value = '';
    document.getElementById('sortOrder').value = 'recommended';
    
    // 表示を更新
    const facilitiesWithScores = calculateRecommendationScores([...facilities]);
    const sortedFacilities = sortFacilities(facilitiesWithScores, 'recommended');
    displayFacilities(sortedFacilities);
    
    showMessage('検索フィルターをリセットしました。', 'success');
}

// デバッグ用: サンプルデータ追加ボタン（開発時のみ使用）
// 本番では削除してください
if (localStorage.getItem('careFacilities') === null) {
    setTimeout(() => {
        if (confirm('サンプルデータを追加しますか？（デモ用）')) {
            addSampleData();
        }
    }, 1000);
}