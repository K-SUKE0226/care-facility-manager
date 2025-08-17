// 施設データを保存する配列（ブラウザのローカルストレージに保存）
let facilities = [];

// JavaScript読み込み確認
console.log('=== script.js ファイル読み込み開始 ===');
console.log('現在時刻:', new Date().toLocaleString());

// リアルタイム情報のキャッシュ（メモリ内保存）
let realtimeCache = {};

// 患者プロファイルデータ
let patientProfile = {};

// 自動更新のタイマーID
let autoUpdateTimer = null;

// ページ読み込み時に実行される関数
document.addEventListener('DOMContentLoaded', function() {
    console.log('Page loading started...');
    
    loadFacilities();
    console.log('Facilities loaded:', facilities.length);
    
    loadPatientProfile();
    setupAutoUpdate();
    setupEventListeners();
    
    // 初期値設定
    document.getElementById('lastConfirmed').value = new Date().toISOString().split('T')[0];
    
    // 初期表示（おすすめ順）
    const facilitiesWithScores = calculateRecommendationScores([...facilities]);
    const sortedFacilities = sortFacilities(facilitiesWithScores, 'recommended');
    
    console.log('Initial display - facilities count:', sortedFacilities.length);
    
    // 初期表示時に件数を表示
    showSearchResultCount(sortedFacilities.length, facilities.length);
    
    displayFacilities(sortedFacilities);
});

// イベントリスナーを設定する関数
function setupEventListeners() {
    // フォーム送信時の処理
    document.getElementById('facilityForm').addEventListener('submit', function(e) {
        e.preventDefault(); // ページのリロードを防ぐ
        
        // 編集モードかどうかを確認
        if (window.editingFacilityId) {
            updateFacility();
        } else {
            addFacility();
        }
    });
    
    // 検索フィルターが変更されたときの処理（無効化 - 検索ボタンでのみ実行）
    // document.getElementById('searchArea').addEventListener('change', searchFacilities);
    // document.getElementById('searchCareLevel').addEventListener('change', searchFacilities);
    // document.getElementById('searchAvailability').addEventListener('change', searchFacilities);
    // document.getElementById('searchRating').addEventListener('change', searchFacilities);
    // document.getElementById('sortOrder').addEventListener('change', searchFacilities);
    console.log('Auto-search on dropdown change disabled - search only on button click');
    
    // CSVインポートボタンのイベントリスナーを追加
    const importBtn = document.querySelector('.import-btn');
    if (importBtn) {
        importBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('CSV Import button clicked');
            showImportDialog();
        });
        console.log('CSV Import button event listener added');
    } else {
        console.error('CSV Import button not found');
    }
}

// 新しい施設を追加する関数
function addFacility() {
    // フォームから値を取得
    const name = document.getElementById('facilityName').value.trim();
    const facilityType = document.getElementById('facilityType').value;
    const address = document.getElementById('address').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const websiteUrl = document.getElementById('websiteUrl').value.trim();
    // 要介護度チェックボックスから値を取得
    const careLevel = [];
    const careLevelCheckboxes = [
        'careSupport1', 'careSupport2', 'careLevel1', 'careLevel2', 
        'careLevel3', 'careLevel4', 'careLevel5'
    ];
    careLevelCheckboxes.forEach(id => {
        const checkbox = document.getElementById(id);
        if (checkbox && checkbox.checked) {
            careLevel.push(checkbox.value);
        }
    });
    const services = [
        document.getElementById('services1').value,
        document.getElementById('services2').value,
        document.getElementById('services3').value
    ].filter(service => service !== '');
    
    // チェックボックス項目を取得
    const additionalOptions = [];
    const checkboxes = [
        'nurseAvailable', 'supportRequired', 'independent', 'publicAssistance',
        'noFamily', 'endOfLife', 'coupleRoom', 'selfCooking', 'twoMeals', 'kitchen'
    ];
    checkboxes.forEach(id => {
        const checkbox = document.getElementById(id);
        if (checkbox && checkbox.checked) {
            additionalOptions.push(checkbox.value);
        }
    });
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
    const isHidden = document.getElementById('isHidden').checked;
    
    // 必須項目のチェック
    if (!name || !address || !facilityType) {
        showMessage('施設名、種類、住所は必須項目です。', 'error');
        return;
    }
    
    // 新しい施設オブジェクトを作成
    const newFacility = {
        id: Date.now(), // 簡易的なID生成（現在時刻を使用）
        name: name,
        facilityType: facilityType,
        address: address,
        phone: phone,
        websiteUrl: websiteUrl,
        careLevel: careLevel,
        services: services,
        additionalOptions: additionalOptions,
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
        isHidden: isHidden, // 非表示フラグ
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
    // 非表示施設を除外
    const visibleFacilities = (filteredFacilities || facilities).filter(facility => !facility.isHidden);
    const facilitiesToShow = visibleFacilities;
    
    console.log('displayFacilities called:');
    console.log('  facilities.length:', facilities.length);
    console.log('  facilitiesToShow.length:', facilitiesToShow.length);
    console.log('  first facility:', facilitiesToShow[0]);
    
    if (facilitiesToShow.length === 0) {
        console.log('No facilities to show, displaying empty message');
        container.innerHTML = '<p style="text-align: center; color: #666; padding: 40px;">登録された施設はありません。</p>';
        return;
    }
    
    let html = '';
    
    facilitiesToShow.forEach(facility => {
        html += `
            <div class="facility-card">
                <div class="facility-header">
                    <div>
                        <div class="facility-name">
                            <span onclick="navigateToFacilitySheet(${facility.id})" style="cursor: pointer; color: #3182ce; text-decoration: underline;">${escapeHtml(facility.name)}</span>
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
                        <div class="info-label">種類</div>
                        <div class="info-value">${escapeHtml(facility.facilityType || '未設定')}</div>
                    </div>
                    
                    <div class="info-group">
                        <div class="info-label">住所</div>
                        <div class="info-value">${escapeHtml(facility.address)}</div>
                    </div>
                    
                    <div class="info-group">
                        <div class="info-label">エリア</div>
                        <div class="info-value">${escapeHtml(facility.area || '未設定')}</div>
                    </div>
                    
                    <div class="info-group">
                        <div class="info-label">提供サービス</div>
                        <div class="info-value">${facility.services && facility.services.length > 0 ? facility.services.join(', ') : '未設定'}</div>
                    </div>
                    
                    <div class="info-group">
                        <div class="info-label">追加オプション</div>
                        <div class="info-value">
                            <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; font-size: 14px;">
                                ${['看護師', '要支援', '自立', '生保', '身寄り', '看取り', '夫婦部屋', '自炊', '2食可', 'キッチン'].map(option => {
                                    const isChecked = facility.additionalOptions && facility.additionalOptions.includes(option);
                                    return `<span style="display: flex; align-items: center; gap: 3px;">
                                        <span style="font-size: 16px;">${isChecked ? '☑' : '☐'}</span>
                                        ${option}
                                    </span>`;
                                }).join('')}
                            </div>
                        </div>
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
                    <button onclick="fetchRealtimeInfo(${facility.id})" style="background-color: #3182ce; color: white; padding: 8px 16px; border: none; border-radius: 5px; cursor: pointer; font-size: 14px;">🔄 リアルタイム情報取得</button>
                    ${facility.realtimeInfo ? `
                        <button onclick="applyWebInfoToSheet(${facility.id})" style="background-color: #38a169; color: white; padding: 8px 16px; border: none; border-radius: 5px; cursor: pointer; font-size: 14px;">🌐 WEB情報から取得</button>
                    ` : ''}
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
    console.log('HTML generated, length:', html.length);
}

// デバッグ用関数
function debugFacilities() {
    console.log('=== Facilities Debug ===');
    console.log('Total facilities:', facilities.length);
    facilities.forEach((f, i) => {
        console.log(`${i}: ${f.name} (${f.area})`);
    });
    console.log('===================');
}

// 札幌特化の高度な検索機能（シンプル化）
function searchFacilities() {
    console.log('searchFacilities function called');
    
    const areaFilter = document.getElementById('searchArea').value;
    const careLevelFilter = document.getElementById('searchCareLevel').value;
    const availabilityFilter = document.getElementById('searchAvailability').value;
    const ratingFilter = document.getElementById('searchRating').value;
    const sortOrder = document.getElementById('sortOrder').value;
    
    console.log('Search filters:', { areaFilter, careLevelFilter, availabilityFilter, ratingFilter, sortOrder });
    console.log('Total facilities:', facilities.length);
    
    // 非表示施設を除外してから検索
    let filtered = facilities.filter(facility => !facility.isHidden);
    
    // エリアでフィルター（札幌特化）
    if (areaFilter) {
        filtered = filtered.filter(facility => 
            facility.area === areaFilter
        );
        console.log('After area filter:', filtered.length);
    }
    
    // 要介護度でフィルター
    if (careLevelFilter) {
        filtered = filtered.filter(facility => 
            facility.careLevel.includes(careLevelFilter)
        );
        console.log('After care level filter:', filtered.length);
    }
    
    // 空き状況でフィルター（シンプル化）
    if (availabilityFilter) {
        filtered = filtered.filter(facility => 
            facility.availability === availabilityFilter
        );
        console.log('After availability filter:', filtered.length);
    }
    
    // 評価でフィルター
    if (ratingFilter) {
        const minRating = parseFloat(ratingFilter);
        filtered = filtered.filter(facility => 
            facility.realtimeInfo && 
            facility.realtimeInfo.averageRating >= minRating
        );
        console.log('After rating filter:', filtered.length);
    }
    
    // おすすめスコアを計算
    filtered = calculateRecommendationScores(filtered);
    
    // ソート
    filtered = sortFacilities(filtered, sortOrder);
    
    console.log('Final filtered count:', filtered.length);
    
    // 検索結果件数を表示（非表示施設を除外した総数を使用）
    const visibleTotalCount = facilities.filter(facility => !facility.isHidden).length;
    showSearchResultCount(filtered.length, visibleTotalCount);
    
    displayFacilities(filtered);
}

// 検索結果件数表示
function showSearchResultCount(filteredCount, totalCount) {
    const countElement = document.getElementById('searchResultCount');
    
    console.log(`showSearchResultCount called: ${filteredCount}/${totalCount}`);
    
    if (!countElement) {
        console.error('searchResultCount element not found');
        return;
    }
    
    // 検索結果件数を常に表示（テスト用）
    const percentage = totalCount > 0 ? Math.round((filteredCount / totalCount) * 100) : 0;
    
    if (filteredCount === totalCount) {
        countElement.innerHTML = `📋 <strong>全施設表示中: ${totalCount}件</strong>`;
    } else {
        countElement.innerHTML = `🔍 <strong>検索結果: ${filteredCount}件</strong> / 全${totalCount}件中 (${percentage}%)`;
    }
    
    countElement.style.display = 'block';
    countElement.style.visibility = 'visible';
    console.log('Count display updated:', countElement.innerHTML);
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
    
    // 全件表示時は件数表示を隠す
    showSearchResultCount(sortedFacilities.length, facilities.length);
    
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
    localStorage.setItem('facilities', JSON.stringify(facilities));
}

// ローカルストレージから施設データを読み込み
function loadFacilities() {
    const savedFacilities = localStorage.getItem('facilities');
    if (savedFacilities) {
        facilities = JSON.parse(savedFacilities);
        console.log('ローカルストレージから読み込み:', facilities.length, '件');
    } else {
        console.log('ローカルストレージに施設データが見つかりません');
        facilities = [];
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
    
    // テーブル表示時も検索結果件数を表示
    showSearchResultCount(currentFacilities.length, facilities.length);
    
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
    const bulkPage = document.getElementById('bulkPage');
    const listBtn = document.getElementById('listPageBtn');
    const addBtn = document.getElementById('addPageBtn');
    const bulkBtn = document.getElementById('bulkPageBtn');
    
    // すべてのページを非表示にして、すべてのボタンから active クラスを削除
    listPage.style.display = 'none';
    addPage.style.display = 'none';
    bulkPage.style.display = 'none';
    listBtn.classList.remove('active');
    addBtn.classList.remove('active');
    bulkBtn.classList.remove('active');
    
    // 指定されたページを表示して、対応するボタンを active にする
    if (pageType === 'list') {
        listPage.style.display = 'block';
        listBtn.classList.add('active');
    } else if (pageType === 'add') {
        addPage.style.display = 'block';
        addBtn.classList.add('active');
    } else if (pageType === 'bulk') {
        bulkPage.style.display = 'block';
        bulkBtn.classList.add('active');
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
        
        // 最終更新日時を保存
        const lastUpdateTime = new Date().toLocaleString('ja-JP');
        localStorage.setItem('lastBulkUpdateTime', lastUpdateTime);
        updateLastBulkUpdateDisplay();
        
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
    
    // リセット時は件数表示を隠す
    showSearchResultCount(sortedFacilities.length, facilities.length);
    
    displayFacilities(sortedFacilities);
    
    showMessage('検索フィルターをリセットしました。', 'success');
}

// URL一括処理関連の変数
let bulkProcessResults = [];
let currentProcessingIndex = 0;

// URL入力クリア機能
function clearUrlInput() {
    document.getElementById('urlInput').value = '';
    
    // 進捗・結果セクションを非表示
    document.getElementById('bulkProgressSection').style.display = 'none';
    document.getElementById('bulkResultsSection').style.display = 'none';
    
    // 結果データをクリア
    bulkProcessResults = [];
    currentProcessingIndex = 0;
    
    showMessage('URL入力がクリアされました。', 'success');
}

// URL判定機能
function detectUrlType(url) {
    const urlLower = url.toLowerCase();
    
    // 主要な介護情報サイトを判定
    if (urlLower.includes('homes.co.jp')) {
        return { type: 'HOMES', name: 'ライフルホームズ' };
    } else if (urlLower.includes('minnannokaigo.com')) {
        return { type: 'MINNANO', name: 'みんなの介護' };
    } else if (urlLower.includes('.lg.jp') || urlLower.includes('.city.') || urlLower.includes('.pref.')) {
        return { type: 'GOVERNMENT', name: '自治体サイト' };
    } else if (urlLower.includes('kaigo') || urlLower.includes('nursing') || urlLower.includes('care')) {
        return { type: 'CARE_SITE', name: '介護関連サイト' };
    } else {
        return { type: 'INDIVIDUAL', name: '個別施設サイト' };
    }
}

// URL一括処理開始
async function startBulkProcessing() {
    const urlInput = document.getElementById('urlInput').value.trim();
    const processBtn = document.getElementById('bulkProcessBtn');
    
    if (!urlInput) {
        showMessage('URLを入力してください。', 'error');
        return;
    }
    
    // URLリストを解析
    const urls = urlInput.split('\n')
        .map(url => url.trim())
        .filter(url => url.length > 0 && (url.startsWith('http://') || url.startsWith('https://')));
    
    if (urls.length === 0) {
        showMessage('有効なURL（http://またはhttps://で始まる）を入力してください。', 'error');
        return;
    }
    
    // 初期化
    bulkProcessResults = [];
    currentProcessingIndex = 0;
    
    // UI更新
    processBtn.disabled = true;
    document.getElementById('bulkProgressSection').style.display = 'block';
    document.getElementById('bulkResultsSection').style.display = 'none';
    
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    const processingLog = document.getElementById('processingLog');
    
    progressText.textContent = `処理開始: ${urls.length}件のURLを処理します...`;
    processingLog.innerHTML = '';
    
    addLogEntry('🚀 一括処理を開始しました', 'processing');
    addLogEntry(`📋 処理対象: ${urls.length}件のURL`, 'processing');
    
    try {
        // 各URLを順次処理
        for (let i = 0; i < urls.length; i++) {
            currentProcessingIndex = i;
            const url = urls[i];
            const urlType = detectUrlType(url);
            
            addLogEntry(`🔍 [${i + 1}/${urls.length}] ${urlType.name}: ${url}`, 'processing');
            progressText.textContent = `処理中 (${i + 1}/${urls.length}): ${url}`;
            progressBar.style.width = `${((i + 1) / urls.length) * 100}%`;
            
            try {
                // URL情報を抽出（シミュレーション）
                const extractedData = await extractInfoFromUrl(url, urlType);
                
                if (extractedData && extractedData.length > 0) {
                    bulkProcessResults = bulkProcessResults.concat(extractedData);
                    addLogEntry(`✅ 成功: ${extractedData.length}件の施設情報を取得`, 'success');
                } else {
                    addLogEntry(`⚠️ 情報取得なし: 有効な施設情報が見つかりませんでした`, 'error');
                }
                
                // 処理間隔を空ける
                await new Promise(resolve => setTimeout(resolve, 1500));
                
            } catch (error) {
                console.error(`URL処理エラー (${url}):`, error);
                addLogEntry(`❌ エラー: ${error.message}`, 'error');
            }
        }
        
        // 処理完了
        progressText.textContent = `完了: ${bulkProcessResults.length}件の施設情報を取得しました`;
        addLogEntry(`🎉 処理完了: 合計${bulkProcessResults.length}件の施設情報を取得`, 'success');
        
        // 結果表示
        if (bulkProcessResults.length > 0) {
            displayBulkResults();
        } else {
            addLogEntry('⚠️ 取得できた施設情報がありませんでした', 'error');
        }
        
    } catch (error) {
        console.error('一括処理エラー:', error);
        progressText.textContent = '処理中にエラーが発生しました';
        addLogEntry(`💥 致命的エラー: ${error.message}`, 'error');
    } finally {
        processBtn.disabled = false;
    }
}

// ログエントリを追加
function addLogEntry(message, type = 'processing') {
    const processingLog = document.getElementById('processingLog');
    const timestamp = new Date().toLocaleTimeString('ja-JP');
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry ${type}`;
    logEntry.textContent = `[${timestamp}] ${message}`;
    
    processingLog.appendChild(logEntry);
    processingLog.scrollTop = processingLog.scrollHeight;
}

// URL情報抽出（シミュレーション）
async function extractInfoFromUrl(url, urlType) {
    return new Promise((resolve) => {
        setTimeout(() => {
            // デモ用のシミュレーションデータ生成
            const facilityCount = Math.floor(Math.random() * 5) + 1; // 1-5件
            const results = [];
            
            for (let i = 0; i < facilityCount; i++) {
                const sampleNames = [
                    '札幌中央介護ホーム',
                    '北区やまざくらホーム', 
                    '手稲みどりの風',
                    '豊平グループホーム',
                    '白石ケアセンター',
                    '厚別リハビリホーム',
                    '西区つばさの家',
                    '東区あおぞらホーム'
                ];
                
                const sampleAreas = ['中央区', '北区', '東区', '白石区', '豊平区', '南区', '西区', '厚別区', '手稲区', '清田区'];
                const sampleAvailability = ['空きあり', '空き僅か', '満室', '要確認'];
                const sampleFees = ['12万円〜18万円', '10万円〜15万円', '15万円〜22万円', '8万円〜12万円'];
                
                results.push({
                    name: sampleNames[Math.floor(Math.random() * sampleNames.length)] + (facilityCount > 1 ? ` ${i + 1}` : ''),
                    address: `札幌市${sampleAreas[Math.floor(Math.random() * sampleAreas.length)]}○○${Math.floor(Math.random() * 30) + 1}丁目${Math.floor(Math.random() * 20) + 1}-${Math.floor(Math.random() * 30) + 1}`,
                    area: sampleAreas[Math.floor(Math.random() * sampleAreas.length)],
                    phone: `011-${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}`,
                    websiteUrl: url,
                    careLevel: ['要介護1', '要介護2', '要介護3', '要介護4', '要介護5'],
                    monthlyFee: sampleFees[Math.floor(Math.random() * sampleFees.length)],
                    medicalCare: '胃ろう、たん吸引、インスリン注射対応',
                    features: '24時間看護師常駐、リハビリ充実',
                    availability: sampleAvailability[Math.floor(Math.random() * sampleAvailability.length)],
                    reliabilityLevel: 'medium',
                    lastConfirmed: new Date().toISOString().split('T')[0],
                    confirmationMethod: 'web',
                    notes: `${urlType.name}から自動取得`,
                    reviews: `[自動取得 ${new Date().toLocaleDateString('ja-JP')}] WEBサイトから取得した情報です。`,
                    sourceUrl: url,
                    sourceType: urlType
                });
            }
            
            resolve(results);
        }, Math.random() * 2000 + 1000); // 1-3秒のランダム遅延
    });
}

// 一括処理結果表示
function displayBulkResults() {
    const resultsSection = document.getElementById('bulkResultsSection');
    const resultsSummary = document.getElementById('resultsSummary');
    
    // サマリー統計を生成
    const totalCount = bulkProcessResults.length;
    const areaStats = {};
    const availabilityStats = {};
    
    bulkProcessResults.forEach(facility => {
        // エリア統計
        areaStats[facility.area] = (areaStats[facility.area] || 0) + 1;
        
        // 空き状況統計
        availabilityStats[facility.availability] = (availabilityStats[facility.availability] || 0) + 1;
    });
    
    const topAreas = Object.entries(areaStats)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 3)
        .map(([area, count]) => `${area}: ${count}件`)
        .join(', ');
    
    resultsSummary.innerHTML = `
        <div class="summary-stats">
            <div class="stat-item">
                <span class="stat-number">${totalCount}</span>
                <span class="stat-label">総取得件数</span>
            </div>
            <div class="stat-item">
                <span class="stat-number">${Object.keys(areaStats).length}</span>
                <span class="stat-label">対象エリア数</span>
            </div>
            <div class="stat-item">
                <span class="stat-number">${availabilityStats['空きあり'] || 0}</span>
                <span class="stat-label">空きあり施設</span>
            </div>
        </div>
        <p><strong>主要エリア:</strong> ${topAreas}</p>
        <p><strong>取得日時:</strong> ${new Date().toLocaleString('ja-JP')}</p>
    `;
    
    resultsSection.style.display = 'block';
}

// 全件プレビュー表示
function previewAllResults() {
    const previewContainer = document.getElementById('resultsPreview');
    
    if (bulkProcessResults.length === 0) {
        previewContainer.innerHTML = '<p>プレビューする結果がありません。</p>';
        return;
    }
    
    let html = '';
    bulkProcessResults.forEach((facility, index) => {
        html += `
            <div class="preview-facility">
                <h4>[${index + 1}] ${escapeHtml(facility.name)}</h4>
                <div class="preview-details">
                    <div class="preview-detail">
                        <span class="preview-label">住所:</span>
                        <span class="preview-value">${escapeHtml(facility.address)}</span>
                    </div>
                    <div class="preview-detail">
                        <span class="preview-label">エリア:</span>
                        <span class="preview-value">${escapeHtml(facility.area)}</span>
                    </div>
                    <div class="preview-detail">
                        <span class="preview-label">空き状況:</span>
                        <span class="preview-value">${escapeHtml(facility.availability)}</span>
                    </div>
                    <div class="preview-detail">
                        <span class="preview-label">月額料金:</span>
                        <span class="preview-value">${escapeHtml(facility.monthlyFee)}</span>
                    </div>
                    <div class="preview-detail">
                        <span class="preview-label">電話番号:</span>
                        <span class="preview-value">${escapeHtml(facility.phone)}</span>
                    </div>
                    <div class="preview-detail">
                        <span class="preview-label">取得元:</span>
                        <span class="preview-value">${escapeHtml(facility.sourceType.name)}</span>
                    </div>
                </div>
            </div>
        `;
    });
    
    previewContainer.innerHTML = html;
}

// 全件保存
function saveAllResults() {
    if (bulkProcessResults.length === 0) {
        showMessage('保存する結果がありません。', 'error');
        return;
    }
    
    const confirmed = confirm(`${bulkProcessResults.length}件の施設情報を一括保存しますか？`);
    if (!confirmed) return;
    
    // 既存の施設データに追加
    bulkProcessResults.forEach(facilityData => {
        const newFacility = {
            id: Date.now() + Math.random(), // 一意なID生成
            name: facilityData.name,
            address: facilityData.address,
            area: facilityData.area,
            phone: facilityData.phone,
            websiteUrl: facilityData.websiteUrl,
            careLevel: facilityData.careLevel,
            monthlyFee: facilityData.monthlyFee,
            medicalCare: facilityData.medicalCare,
            features: facilityData.features,
            availability: facilityData.availability,
            notes: facilityData.notes,
            reviews: facilityData.reviews,
            reliabilityLevel: facilityData.reliabilityLevel,
            lastConfirmed: facilityData.lastConfirmed,
            confirmationMethod: facilityData.confirmationMethod,
            createdAt: new Date().toISOString(),
            realtimeInfo: null,
            lastUpdated: null
        };
        
        facilities.push(newFacility);
    });
    
    // ローカルストレージに保存
    saveFacilities();
    
    // 施設一覧ページに切り替えて表示更新
    switchPage('list');
    displayFacilities();
    
    showMessage(`${bulkProcessResults.length}件の施設情報を保存しました。`, 'success');
    
    // 結果をクリア
    bulkProcessResults = [];
}

// 選択保存（今後の拡張用）
function selectiveSave() {
    showMessage('選択保存機能は今後実装予定です。現在は全件保存をご利用ください。', 'info');
}

// CSVインポート機能
function showImportDialog() {
    document.getElementById('csvImportDialog').style.display = 'flex';
}

function closeImportDialog() {
    document.getElementById('csvImportDialog').style.display = 'none';
    document.getElementById('csvFileInput').value = '';
    document.getElementById('importStatus').textContent = '';
    document.getElementById('importStatus').className = 'import-status';
}

function importCSV() {
    const fileInput = document.getElementById('csvFileInput');
    const statusDiv = document.getElementById('importStatus');
    
    if (!fileInput.files || fileInput.files.length === 0) {
        statusDiv.textContent = 'CSVファイルを選択してください。';
        statusDiv.className = 'import-status error';
        return;
    }
    
    const file = fileInput.files[0];
    
    if (!file.name.toLowerCase().endsWith('.csv')) {
        statusDiv.textContent = 'CSVファイルを選択してください。';
        statusDiv.className = 'import-status error';
        return;
    }
    
    const reader = new FileReader();
    
    reader.onload = function(e) {
        try {
            let csvText = e.target.result;
            
            // BOM (Byte Order Mark) を除去
            if (csvText.charCodeAt(0) === 0xFEFF) {
                csvText = csvText.slice(1);
            }
            
            console.log('CSV content preview:', csvText.substring(0, 500));
            console.log('CSV lines count:', csvText.split('\n').length);
            
            const importedFacilities = parseCSV(csvText);
            processFacilitiesImport(importedFacilities, statusDiv);
            
        } catch (error) {
            console.error('CSV解析エラー:', error);
            console.log('UTF-8での読み込みに失敗。Shift_JISで再試行...');
            
            // Shift_JISで再試行
            const readerSJIS = new FileReader();
            readerSJIS.onload = function(e2) {
                try {
                    let csvText = e2.target.result;
                    
                    // BOM除去
                    if (csvText.charCodeAt(0) === 0xFEFF) {
                        csvText = csvText.slice(1);
                    }
                    
                    console.log('Shift_JIS CSV content preview:', csvText.substring(0, 500));
                    
                    const importedFacilities = parseCSV(csvText);
                    
                    if (importedFacilities.length === 0) {
                        statusDiv.textContent = 'インポートできる施設データが見つかりませんでした。';
                        statusDiv.className = 'import-status error';
                        return;
                    }
                    
                    // 同じ処理を実行
                    processFacilitiesImport(importedFacilities, statusDiv);
                    
                } catch (error2) {
                    console.error('Shift_JIS解析エラー:', error2);
                    statusDiv.textContent = 'CSVファイルの解析に失敗しました。正しい形式のファイルか確認してください。UTF-8またはShift_JIS形式で保存してください。';
                    statusDiv.className = 'import-status error';
                }
            };
            
            statusDiv.textContent = 'Shift_JISエンコーディングで再試行中...';
            readerSJIS.readAsText(file, 'Shift_JIS');
        }
    };
    
    reader.onerror = function() {
        statusDiv.textContent = 'ファイルの読み込みに失敗しました。';
        statusDiv.className = 'import-status error';
    };
    
    statusDiv.textContent = 'ファイルを読み込み中...';
    statusDiv.className = 'import-status';
    
    // 最初にUTF-8で試し、失敗したらShift_JISで再試行
    reader.readAsText(file, 'UTF-8');
}

function processFacilitiesImport(importedFacilities, statusDiv) {
    if (importedFacilities.length === 0) {
        statusDiv.textContent = 'インポートできる施設データが見つかりませんでした。';
        statusDiv.className = 'import-status error';
        return;
    }
    
    // 重複チェック（施設名ベース）
    const existingNames = facilities.map(f => f.name.toLowerCase());
    const newFacilities = importedFacilities.filter(
        imported => !existingNames.includes(imported.name.toLowerCase())
    );
    
    if (newFacilities.length === 0) {
        statusDiv.textContent = `${importedFacilities.length}件のデータがありましたが、すべて既存のデータと重複しています。`;
        statusDiv.className = 'import-status error';
        return;
    }
    
    // 施設データに追加
    newFacilities.forEach(facilityData => {
        const newFacility = {
            id: Date.now() + Math.random(),
            name: facilityData.name,
            address: facilityData.address,
            area: facilityData.area,
            phone: facilityData.phone,
            websiteUrl: facilityData.websiteUrl,
            careLevel: facilityData.careLevel ? facilityData.careLevel.split(',') : [],
            monthlyFee: facilityData.monthlyFee,
            medicalCare: facilityData.medicalCare,
            features: facilityData.features,
            availability: facilityData.availability,
            notes: facilityData.notes,
            reviews: facilityData.reviews,
            reliabilityLevel: facilityData.reliabilityLevel || 'medium',
            lastConfirmed: facilityData.lastConfirmed,
            confirmationMethod: facilityData.confirmationMethod || 'web',
            createdAt: new Date().toISOString(),
            realtimeInfo: null,
            lastUpdated: null
        };
        
        facilities.push(newFacility);
    });
    
    // データを保存
    saveFacilities();
    
    // 表示を更新
    console.log('About to call displayFacilities after import');
    displayFacilities();
    
    // 強制的に施設一覧タブに切り替え
    showTab('facilities');
    
    // 成功メッセージ
    const duplicateCount = importedFacilities.length - newFacilities.length;
    let message = `${newFacilities.length}件の施設データをインポートしました。`;
    if (duplicateCount > 0) {
        message += ` (${duplicateCount}件は重複のため除外)`;
    }
    
    statusDiv.textContent = message;
    statusDiv.className = 'import-status success';
    
    showMessage(message, 'success');
    
    // 3秒後にダイアログを閉じる
    setTimeout(() => {
        closeImportDialog();
    }, 3000);
}

function parseCSV(csvText) {
    // BOM文字を除去（\uFEFF）
    let cleanText = csvText;
    if (cleanText.charCodeAt(0) === 0xFEFF) {
        cleanText = cleanText.slice(1);
    }
    // さらに文字列の先頭からBOM文字を除去
    cleanText = cleanText.replace(/^\uFEFF/, '');
    
    // 改行コードを統一（\r\n → \n）
    const normalizedText = cleanText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = normalizedText.split('\n').filter(line => line.trim());
    
    console.log('Parsed lines count:', lines.length);
    console.log('First few lines:', lines.slice(0, 3));
    
    if (lines.length < 2) {
        throw new Error(`CSVファイルが空か、ヘッダー行のみです。行数: ${lines.length}`);
    }
    
    const headers = parseCSVLine(lines[0]);
    console.log('Headers:', headers);
    console.log('Header mapping check:');
    headers.forEach((header, index) => {
        console.log(`  [${index}] "${header}" (length: ${header.length}, charCodes: ${header.split('').map(c => c.charCodeAt(0)).join(',')})`);
    });
    
    const facilities = [];
    
    for (let i = 1; i < lines.length; i++) {
        try {
            const line = lines[i];
            if (!line || line.trim() === '') {
                continue; // 空行はスキップ
            }
            
            const values = parseCSVLine(line);
            console.log(`Row ${i}:`, values.slice(0, 3)); // 最初の3列だけログ出力
            
            if (values.length < 3) { // 最低限の列数チェック
                console.warn(`Row ${i} skipped: insufficient columns (${values.length})`);
                continue;
            }
            
            const facility = {};
            
            // ヘッダーと値をマッピング
            headers.forEach((header, index) => {
                let value = values[index] || '';
                
                // クォートを除去
                if (value.startsWith('"') && value.endsWith('"')) {
                    value = value.slice(1, -1);
                }
                
                // ヘッダー名をプロパティ名にマッピング
                console.log(`Mapping header "${header}" to value "${value}"`);
                switch (header) {
                    case '施設名':
                        facility.name = value;
                        console.log('Mapped name:', value);
                        break;
                    case 'エリア':
                        facility.area = value;
                        break;
                    case '住所':
                        facility.address = value;
                        break;
                    case '電話番号':
                        facility.phone = value;
                        break;
                    case 'ホームページURL':
                        facility.websiteUrl = value;
                        break;
                    case '空き状況':
                        facility.availability = value;
                        break;
                    case '信頼性レベル':
                        facility.reliabilityLevel = value;
                        break;
                    case '月額料金':
                        facility.monthlyFee = value;
                        break;
                    case '受入可能要介護度':
                        facility.careLevel = value;
                        break;
                    case '医療ケア':
                        facility.medicalCare = value;
                        break;
                    case '施設特徴':
                        facility.features = value;
                        break;
                    case '特記事項':
                        facility.notes = value;
                        break;
                    case '口コミ情報':
                        facility.reviews = value;
                        break;
                    case '最終確認日':
                        facility.lastConfirmed = value;
                        break;
                    case '確認方法':
                        facility.confirmationMethod = value;
                        break;
                }
            });
            
            // 必須項目チェック
            console.log('Final facility object:', facility);
            if (facility.name && facility.name.trim()) {
                // IDを生成
                facility.id = Date.now() + Math.random();
                facilities.push(facility);
                console.log(`Added facility: ${facility.name}`);
            } else {
                console.warn(`Row ${i} skipped: no valid name found. Facility object:`, facility);
            }
            
        } catch (error) {
            console.warn(`CSV行 ${i + 1} の解析をスキップ:`, error);
        }
    }
    
    return facilities;
}

function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    // 行の前後の空白を削除
    line = line.trim();
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++; // 次の文字をスキップ
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    
    result.push(current.trim());
    
    // 各フィールドのクォートとBOM文字を除去
    return result.map(field => {
        // BOM文字を除去
        field = field.replace(/^\uFEFF/, '');
        
        if (field.startsWith('"') && field.endsWith('"')) {
            return field.slice(1, -1);
        }
        return field;
    });
}

// 初回利用時のメッセージ
if (localStorage.getItem('careFacilities') === null || facilities.length === 0) {
    console.log('No facilities found in storage. Please add facilities or import CSV data.');
}

// 最終一括更新日時を表示
function updateLastBulkUpdateDisplay() {
    const lastUpdateTime = localStorage.getItem('lastBulkUpdateTime');
    const displayEl = document.getElementById('lastBulkUpdateTime');
    
    if (lastUpdateTime && displayEl) {
        displayEl.textContent = `最終一括更新: ${lastUpdateTime}`;
    } else if (displayEl) {
        displayEl.textContent = '一括更新未実行';
    }
}

// ページ読み込み時に最終更新時刻を表示
document.addEventListener('DOMContentLoaded', function() {
    updateLastBulkUpdateDisplay();
    // 初期表示は検索ページなので、一覧ページの表示は必要なし
});

// 新しい施設一覧ページ用の表示関数（簡易表示）
function displayOverviewFacilities(filteredFacilities = null) {
    const container = document.getElementById('overviewFacilitiesContainer');
    // 非表示施設を除外
    const visibleFacilities = (filteredFacilities || facilities).filter(facility => !facility.isHidden);
    const facilitiesToShow = visibleFacilities;
    
    if (facilitiesToShow.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #666; padding: 40px;">登録された施設はありません。</p>';
        return;
    }
    
    let html = '<div class="simple-facility-list">';
    facilitiesToShow.forEach(facility => {
        // 最終更新日の表示用フォーマット
        const lastUpdateDate = facility.lastUpdated 
            ? new Date(facility.lastUpdated).toLocaleDateString('ja-JP')
            : facility.createdAt 
                ? new Date(facility.createdAt).toLocaleDateString('ja-JP')
                : '未設定';
        
        html += `
            <div class="simple-facility-card">
                <div class="simple-facility-header">
                    <div class="simple-facility-name clickable-name" onclick="editFacility(${facility.id})">${escapeHtml(facility.name)}</div>
                </div>
                <div class="simple-facility-info">
                    <span class="simple-info">🏢 ${escapeHtml(facility.facilityType || '未設定')}</span>
                    <span class="simple-info">🏘️ ${escapeHtml(facility.area || '未設定')}</span>
                    <span class="simple-info">📅 ${lastUpdateDate}</span>
                </div>
            </div>
        `;
    });
    html += '</div>';
    
    container.innerHTML = html;
}

// 一覧ページの検索機能（施設名のみで検索）
function performOverviewSearch() {
    const searchTerm = document.getElementById('overviewSearchInput').value.toLowerCase().trim();
    
    console.log('Overview search term:', searchTerm);
    console.log('Total facilities:', facilities.length);
    
    if (!searchTerm) {
        displayOverviewFacilities();
        return;
    }
    
    // 施設名のみで検索
    const filtered = facilities.filter(facility => {
        return facility.name && facility.name.toLowerCase().includes(searchTerm);
    });
    
    console.log('Filtered results:', filtered.length);
    displayOverviewFacilities(filtered);
}

// 一覧ページの検索クリア
function clearOverviewSearch() {
    document.getElementById('overviewSearchInput').value = '';
    displayOverviewFacilities();
}

// すべての施設を削除する関数
function deleteAllFacilities() {
    const facilityCount = facilities.length;
    
    if (facilityCount === 0) {
        showMessage('削除する施設がありません。', 'info');
        return;
    }
    
    const confirmMessage = `本当にすべての施設（${facilityCount}件）を削除しますか？\n\nこの操作は取り消すことができません。`;
    
    if (confirm(confirmMessage)) {
        // 全施設を削除
        facilities.length = 0;
        
        // ローカルストレージを更新
        saveFacilities();
        
        // 画面を更新
        displayFacilities();
        displayOverviewFacilities();
        
        // 成功メッセージを表示
        showMessage(`${facilityCount}件の施設をすべて削除しました。`, 'success');
        
        console.log('All facilities deleted successfully');
    }
}

// 施設編集機能
function editFacility(facilityId) {
    const facility = facilities.find(f => f.id === facilityId);
    if (!facility) {
        showMessage('編集対象の施設が見つかりません。', 'error');
        return;
    }
    
    // 編集モードフラグを設定
    window.editingFacilityId = facilityId;
    
    // 施設追加ページに移動
    switchPageManual('add');
    
    // フォームに既存データを入力
    populateFormForEdit(facility);
    
    // ページタイトルを変更
    const addPageTitle = document.querySelector('#addPage h2');
    if (addPageTitle) {
        addPageTitle.textContent = '✏️ 施設情報編集';
    }
    
    // ボタンテキストを変更
    const addButton = document.querySelector('#addPage button[type="submit"]');
    if (addButton) {
        addButton.textContent = '✏️ 施設情報を更新';
    }
    
    // 削除ボタンを表示
    const deleteBtn = document.getElementById('deleteFacilityBtn');
    if (deleteBtn) {
        deleteBtn.style.display = 'inline-block';
    }
}

// 施設検索タブから施設シートに移行する関数
function navigateToFacilitySheet(facilityId) {
    // 編集モードフラグを設定
    window.editingFacilityId = facilityId;
    
    // 施設追加ページに移動
    switchPageManual('add');
    
    // 対象の施設情報を取得
    const facility = facilities.find(f => f.id === facilityId);
    if (!facility) {
        console.error(`Facility with ID ${facilityId} not found`);
        return;
    }
    
    // フォームに既存データを入力
    populateFormForEdit(facility);
    
    // ページタイトルを変更
    const addPageTitle = document.querySelector('#addPage h2');
    if (addPageTitle) {
        addPageTitle.textContent = '📋 施設情報シート';
    }
    
    // ボタンテキストを変更
    const addButton = document.querySelector('#addPage button[type="submit"]');
    if (addButton) {
        addButton.textContent = '✏️ 施設情報を更新';
    }
    
    // 削除ボタンを表示
    const deleteBtn = document.getElementById('deleteFacilityBtn');
    if (deleteBtn) {
        deleteBtn.style.display = 'inline-block';
    }
}

// フォームに編集データを入力
function populateFormForEdit(facility) {
    document.getElementById('facilityName').value = facility.name || '';
    document.getElementById('facilityType').value = facility.facilityType || '';
    document.getElementById('address').value = facility.address || '';
    document.getElementById('area').value = facility.area || '';
    document.getElementById('phone').value = facility.phone || '';
    document.getElementById('websiteUrl').value = facility.websiteUrl || '';
    
    // URLボタンの状態を更新
    const openWebsiteBtn = document.getElementById('openWebsiteBtn');
    if (openWebsiteBtn) {
        openWebsiteBtn.disabled = !(facility.websiteUrl && facility.websiteUrl.trim());
    }
    document.getElementById('availability').value = facility.availability || '';
    document.getElementById('monthlyFee').value = facility.monthlyFee || '';
    document.getElementById('medicalCare').value = facility.medicalCare || '';
    document.getElementById('features').value = facility.features || '';
    document.getElementById('notes').value = facility.notes || '';
    document.getElementById('reliabilityLevel').value = facility.reliabilityLevel || '';
    document.getElementById('lastConfirmed').value = facility.lastConfirmed || '';
    document.getElementById('confirmationMethod').value = facility.confirmationMethod || '';
    document.getElementById('reviews').value = facility.reviews || '';
    
    // 要介護度チェックボックスの設定
    const careLevelCheckboxes = [
        'careSupport1', 'careSupport2', 'careLevel1', 'careLevel2', 
        'careLevel3', 'careLevel4', 'careLevel5'
    ];
    careLevelCheckboxes.forEach(id => {
        const checkbox = document.getElementById(id);
        if (checkbox && facility.careLevel) {
            checkbox.checked = facility.careLevel.includes(checkbox.value);
        }
    });
    
    // サービスの選択（3つのプルダウンに設定）
    if (facility.services) {
        document.getElementById('services1').value = facility.services[0] || '';
        document.getElementById('services2').value = facility.services[1] || '';
        document.getElementById('services3').value = facility.services[2] || '';
    }
    
    // チェックボックス項目の設定
    const checkboxes = [
        'nurseAvailable', 'supportRequired', 'independent', 'publicAssistance',
        'noFamily', 'endOfLife', 'coupleRoom', 'selfCooking', 'twoMeals', 'kitchen'
    ];
    checkboxes.forEach(id => {
        const checkbox = document.getElementById(id);
        if (checkbox && facility.additionalOptions) {
            checkbox.checked = facility.additionalOptions.includes(checkbox.value);
        }
    });
    
    // 非表示チェックボックスの設定
    const isHiddenCheckbox = document.getElementById('isHidden');
    if (isHiddenCheckbox) {
        isHiddenCheckbox.checked = facility.isHidden || false;
    }
}

// 施設情報更新
function updateFacility() {
    if (!window.editingFacilityId) {
        showMessage('編集対象が不明です。', 'error');
        return;
    }
    
    const facilityIndex = facilities.findIndex(f => f.id === window.editingFacilityId);
    if (facilityIndex === -1) {
        showMessage('編集対象の施設が見つかりません。', 'error');
        return;
    }
    
    // フォームデータを取得
    const updatedData = {
        name: document.getElementById('facilityName').value.trim(),
        facilityType: document.getElementById('facilityType').value,
        address: document.getElementById('address').value.trim(),
        area: document.getElementById('area').value,
        phone: document.getElementById('phone').value.trim(),
        websiteUrl: document.getElementById('websiteUrl').value.trim(),
        availability: document.getElementById('availability').value,
        monthlyFee: document.getElementById('monthlyFee').value.trim(),
        medicalCare: document.getElementById('medicalCare').value.trim(),
        features: document.getElementById('features').value.trim(),
        notes: document.getElementById('notes').value.trim(),
        reliabilityLevel: document.getElementById('reliabilityLevel').value,
        lastConfirmed: document.getElementById('lastConfirmed').value,
        confirmationMethod: document.getElementById('confirmationMethod').value,
        careLevel: (() => {
            const careLevel = [];
            const careLevelCheckboxes = [
                'careSupport1', 'careSupport2', 'careLevel1', 'careLevel2', 
                'careLevel3', 'careLevel4', 'careLevel5'
            ];
            careLevelCheckboxes.forEach(id => {
                const checkbox = document.getElementById(id);
                if (checkbox && checkbox.checked) {
                    careLevel.push(checkbox.value);
                }
            });
            return careLevel;
        })(),
        services: [
            document.getElementById('services1').value,
            document.getElementById('services2').value,
            document.getElementById('services3').value
        ].filter(service => service !== ''),
        additionalOptions: (() => {
            const options = [];
            const checkboxes = [
                'nurseAvailable', 'supportRequired', 'independent', 'publicAssistance',
                'noFamily', 'endOfLife', 'coupleRoom', 'selfCooking', 'twoMeals', 'kitchen'
            ];
            checkboxes.forEach(id => {
                const checkbox = document.getElementById(id);
                if (checkbox && checkbox.checked) {
                    options.push(checkbox.value);
                }
            });
            return options;
        })(),
        isHidden: document.getElementById('isHidden').checked
    };
    
    // バリデーション
    if (!updatedData.name) {
        showMessage('施設名を入力してください。', 'error');
        return;
    }
    
    // データを更新（最終更新日時も追加）
    facilities[facilityIndex] = { ...facilities[facilityIndex], ...updatedData, lastUpdated: new Date().toISOString() };
    
    // データを保存
    saveFacilities();
    
    // 画面を更新
    displayFacilities();
    displayOverviewFacilities();
    
    // 編集モードをクリア
    window.editingFacilityId = null;
    
    // フォームをクリア
    clearAddForm();
    
    // タイトルとボタンを元に戻す
    resetAddPageToDefault();
    
    // 施設一覧ページに戻る
    switchPageManual('overview');
    
    showMessage('施設情報を更新しました。', 'success');
}

// 編集モードから施設を削除
function deleteFacilityFromEditMode() {
    if (!window.editingFacilityId) {
        showMessage('削除対象が不明です。', 'error');
        return;
    }
    
    const facility = facilities.find(f => f.id === window.editingFacilityId);
    if (!facility) {
        showMessage('削除対象の施設が見つかりません。', 'error');
        return;
    }
    
    if (confirm(`「${facility.name}」を削除してもよろしいですか？\nこの操作は取り消せません。`)) {
        // 施設を削除
        const index = facilities.findIndex(f => f.id === window.editingFacilityId);
        if (index !== -1) {
            facilities.splice(index, 1);
            saveFacilities();
            
            // 画面を更新
            displayFacilities();
            displayOverviewFacilities();
            
            // 編集モードをクリア
            window.editingFacilityId = null;
            
            // フォームをクリア
            clearAddForm();
            
            // 追加ページを初期状態に戻す
            resetAddPageToDefault();
            
            // 施設一覧ページに戻る
            switchPageManual('overview');
            
            showMessage('施設を削除しました。', 'success');
        }
    }
}

// フォームをクリアする関数
function clearAddForm() {
    document.getElementById('facilityName').value = '';
    document.getElementById('facilityType').value = '';
    document.getElementById('address').value = '';
    document.getElementById('area').value = '';
    document.getElementById('phone').value = '';
    document.getElementById('websiteUrl').value = '';
    
    // URLボタンを無効化
    const openWebsiteBtn = document.getElementById('openWebsiteBtn');
    if (openWebsiteBtn) {
        openWebsiteBtn.disabled = true;
    }
    document.getElementById('monthlyFee').value = '';
    document.getElementById('medicalCare').value = '';
    document.getElementById('features').value = '';
    document.getElementById('availability').value = '';
    document.getElementById('notes').value = '';
    document.getElementById('reliabilityLevel').value = '';
    document.getElementById('lastConfirmed').value = new Date().toISOString().split('T')[0];
    document.getElementById('confirmationMethod').value = '';
    document.getElementById('reviews').value = '';
    
    // 要介護度をクリア
    const careLevel = document.getElementById('careLevel');
    if (careLevel) {
        Array.from(careLevel.options).forEach(option => {
            option.selected = false;
        });
    }
    
    // サービスをクリア
    document.getElementById('services1').value = '';
    document.getElementById('services2').value = '';
    document.getElementById('services3').value = '';
    
    // チェックボックスをクリア
    const checkboxes = [
        'nurseAvailable', 'supportRequired', 'independent', 'publicAssistance',
        'noFamily', 'endOfLife', 'coupleRoom', 'selfCooking', 'twoMeals', 'kitchen', 'isHidden'
    ];
    checkboxes.forEach(id => {
        const checkbox = document.getElementById(id);
        if (checkbox) {
            checkbox.checked = false;
        }
    });
}

// 札幌中央区自動検索機能
async function searchSapporoChuo() {
    if (!confirm('札幌中央区の介護施設を自動検索しますか？')) {
        return;
    }
    
    const button = document.querySelector('.auto-search-btn');
    const originalText = button.textContent;
    
    try {
        button.textContent = '🔄 検索中...';
        button.disabled = true;
        
        const response = await fetch('http://localhost:5000/api/search-sapporo-chuo', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({})
        });
        
        const data = await response.json();
        console.log('取得データ:', data);
        
        if (data.success && data.facilities) {
            // 既存リストに追加
            data.facilities.forEach(newFacility => {
                newFacility.id = Date.now() + Math.random();
                facilities.push(newFacility);
            });
            
            // 保存と表示更新
            saveFacilities();
            displayFacilities();
            
            alert(`${data.facilities.length}件の新しい施設を追加しました！`);
        }
        
    } catch (error) {
        console.error('Error:', error);
        alert('エラーが発生しました: ' + error.message);
    } finally {
        button.textContent = originalText;
        button.disabled = false;
    }
}

// サービス選択時の処理
function handleServiceChange(serviceNumber) {
    const selectedValue = document.getElementById(`services${serviceNumber}`).value;
    
    // 「サービスなし」が選ばれた場合
    if (selectedValue === 'サービスなし') {
        if (serviceNumber === 1) {
            // 提供サービス1で「サービスなし」→ 2、3も自動的に「サービスなし」
            document.getElementById('services2').value = 'サービスなし';
            document.getElementById('services3').value = 'サービスなし';
        } else if (serviceNumber === 2) {
            // 提供サービス2で「サービスなし」→ 3だけ自動的に「サービスなし」
            document.getElementById('services3').value = 'サービスなし';
        }
        // 提供サービス3で「サービスなし」→ 1、2はそのまま（何もしない）
    }
    // 「サービスなし」以外が選ばれた場合
    else if (selectedValue !== '' && selectedValue !== 'サービスなし') {
        // 他の「サービスなし」を空にする
        for (let i = 1; i <= 3; i++) {
            if (i !== serviceNumber) {
                const otherSelect = document.getElementById(`services${i}`);
                if (otherSelect.value === 'サービスなし') {
                    otherSelect.value = '';
                }
            }
        }
    }
}

// 追加ページを初期状態に戻す
function resetAddPageToDefault() {
    const addPageTitle = document.querySelector('#addPage h2');
    if (addPageTitle) {
        addPageTitle.textContent = '➕ 新しい施設を追加';
    }
    
    const addButton = document.querySelector('#addPage button[type="submit"]');
    if (addButton) {
        addButton.textContent = '施設を追加・更新';
    }
    
    // 削除ボタンを非表示
    const deleteBtn = document.getElementById('deleteFacilityBtn');
    if (deleteBtn) {
        deleteBtn.style.display = 'none';
    }
}

// Enterキーでの検索対応と初期化
document.addEventListener('DOMContentLoaded', function() {
    const overviewSearchInput = document.getElementById('overviewSearchInput');
    if (overviewSearchInput) {
        overviewSearchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                performOverviewSearch();
            }
        });
    }
    
    // ページ読み込み時に施設データを読み込み・表示
    loadFacilities();
    displayFacilities();
    displayOverviewFacilities();
    
    console.log('施設管理システム初期化完了:', facilities.length, '件の施設データを読み込みました');
    
    // URL入力フィールドの変更を監視してボタンの有効/無効を切り替え
    const websiteUrlInput = document.getElementById('websiteUrl');
    const openWebsiteBtn = document.getElementById('openWebsiteBtn');
    
    if (websiteUrlInput && openWebsiteBtn) {
        // 初期状態をチェック
        const initialUrl = websiteUrlInput.value.trim();
        openWebsiteBtn.disabled = !initialUrl;
        
        // 入力時の処理
        websiteUrlInput.addEventListener('input', function() {
            const url = this.value.trim();
            openWebsiteBtn.disabled = !url;
        });
        
        // フォーカスアウト時にも再チェック
        websiteUrlInput.addEventListener('blur', function() {
            const url = this.value.trim();
            openWebsiteBtn.disabled = !url;
        });
    }
});

// ホームページURLを開く機能
function openWebsite() {
    const url = document.getElementById('websiteUrl').value.trim();
    if (url) {
        window.open(url, '_blank');
    }
}

// 非表示施設管理機能
function showHiddenFacilities() {
    const hiddenFacilities = facilities.filter(facility => facility.isHidden);
    
    if (hiddenFacilities.length === 0) {
        alert('現在、非表示に設定された施設はありません。');
        return;
    }
    
    // 非表示施設選択ダイアログを表示
    showHiddenFacilitiesDialog(hiddenFacilities);
}

// 非表示施設選択ダイアログを表示
function showHiddenFacilitiesDialog(hiddenFacilities) {
    // 既存のダイアログがあれば削除
    const existingDialog = document.getElementById('hiddenFacilitiesDialog');
    if (existingDialog) {
        existingDialog.remove();
    }
    
    // ダイアログHTMLを作成
    const dialogHTML = `
        <div id="hiddenFacilitiesDialog" style="
            position: fixed; 
            top: 0; 
            left: 0; 
            width: 100vw; 
            height: 100vh; 
            background-color: rgba(0,0,0,0.5); 
            display: flex; 
            justify-content: center; 
            align-items: center; 
            z-index: 10000;
        ">
            <div style="
                background: white; 
                border-radius: 12px; 
                padding: 30px; 
                max-width: 600px; 
                max-height: 80vh; 
                overflow-y: auto;
                box-shadow: 0 10px 25px rgba(0,0,0,0.3);
            ">
                <h2 style="margin-top: 0; color: #e53e3e; text-align: center;">
                    👁️ 非表示施設管理 (${hiddenFacilities.length}件)
                </h2>
                <p style="text-align: center; color: #666; margin-bottom: 20px;">
                    編集したい施設をクリックして、非表示チェックを外して更新してください
                </p>
                <div style="space-y: 10px;">
                    ${hiddenFacilities.map(facility => `
                        <div style="
                            border: 2px solid #fed7d7; 
                            border-radius: 8px; 
                            padding: 15px; 
                            margin-bottom: 10px; 
                            cursor: pointer; 
                            transition: all 0.2s;
                            background-color: #fff5f5;
                        " 
                        onclick="editHiddenFacility(${facility.id})"
                        onmouseover="this.style.borderColor='#e53e3e'; this.style.backgroundColor='#fef5e7';"
                        onmouseout="this.style.borderColor='#fed7d7'; this.style.backgroundColor='#fff5f5';">
                            <div style="font-weight: 600; font-size: 16px; color: #2d3748; margin-bottom: 5px;">
                                🏥 ${facility.name}
                            </div>
                            <div style="font-size: 14px; color: #666;">
                                📍 ${facility.area || '未設定'} | 🏢 ${facility.facilityType || '未設定'}
                            </div>
                            <div style="font-size: 12px; color: #9ca3af; margin-top: 5px;">
                                💰 ${facility.monthlyFee || '料金未設定'} | 📅 ${facility.lastConfirmed || '確認日未設定'}
                            </div>
                        </div>
                    `).join('')}
                </div>
                <div style="text-align: center; margin-top: 20px;">
                    <button onclick="closeHiddenFacilitiesDialog()" style="
                        background-color: #e53e3e; 
                        color: white; 
                        border: none; 
                        padding: 12px 24px; 
                        border-radius: 6px; 
                        cursor: pointer; 
                        font-size: 14px; 
                        font-weight: 600;
                        margin-right: 10px;
                    ">✖️ 閉じる</button>
                    <button onclick="unhideAllFacilitiesFromDialog()" style="
                        background-color: #38a169; 
                        color: white; 
                        border: none; 
                        padding: 12px 24px; 
                        border-radius: 6px; 
                        cursor: pointer; 
                        font-size: 14px; 
                        font-weight: 600;
                    ">👁️ 全て表示に戻す</button>
                </div>
            </div>
        </div>
    `;
    
    // ダイアログをDOMに追加
    document.body.insertAdjacentHTML('beforeend', dialogHTML);
}

// 非表示施設を編集モードで開く
function editHiddenFacility(facilityId) {
    // ダイアログを閉じる
    closeHiddenFacilitiesDialog();
    
    // 施設を編集モードで開く
    editFacility(facilityId);
}

// ダイアログを閉じる
function closeHiddenFacilitiesDialog() {
    const dialog = document.getElementById('hiddenFacilitiesDialog');
    if (dialog) {
        dialog.remove();
    }
}

// ダイアログから全ての非表示施設を表示に戻す
function unhideAllFacilitiesFromDialog() {
    if (confirm('全ての非表示施設を表示に戻しますか？')) {
        unhideAllFacilities();
        closeHiddenFacilitiesDialog();
    }
}

// 全ての非表示施設を表示に戻す（開発者ツール用）
function unhideAllFacilities() {
    const hiddenCount = facilities.filter(facility => facility.isHidden).length;
    
    if (hiddenCount === 0) {
        console.log('非表示の施設はありません。');
        return;
    }
    
    facilities.forEach(facility => {
        if (facility.isHidden) {
            facility.isHidden = false;
        }
    });
    
    saveFacilities();
    displayFacilities();
    displayOverviewFacilities();
    
    console.log(`${hiddenCount}件の施設を表示に戻しました。`);
    alert(`${hiddenCount}件の施設を表示に戻しました。`);
}

// 特定の施設を名前で検索して表示に戻す（開発者ツール用）
function unhideFacilityByName(facilityName) {
    const facility = facilities.find(f => f.name.includes(facilityName) && f.isHidden);
    
    if (!facility) {
        console.log(`"${facilityName}"に一致する非表示施設が見つかりません。`);
        return;
    }
    
    facility.isHidden = false;
    saveFacilities();
    displayFacilities();
    displayOverviewFacilities();
    
    console.log(`"${facility.name}"を表示に戻しました。`);
    alert(`"${facility.name}"を表示に戻しました。`);
}

// 非表示施設一覧をコンソールに表示（開発者ツール用）
function listHiddenFacilities() {
    const hiddenFacilities = facilities.filter(facility => facility.isHidden);
    
    if (hiddenFacilities.length === 0) {
        console.log('非表示の施設はありません。');
        return;
    }
    
    console.log(`非表示施設一覧 (${hiddenFacilities.length}件):`);
    hiddenFacilities.forEach((facility, index) => {
        console.log(`${index + 1}. ${facility.name} (${facility.area}, ${facility.facilityType})`);
    });
}

